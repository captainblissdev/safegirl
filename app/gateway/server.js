/**
 * SafeGirl Backend — Express Entry Point
 *
 * Provides the HTTP entry point for the SafeGirl backend.
 * The Express layer handles request validation and delegates
 * application processing to the backend service layer.
 *
 * createApp() builds the Express application from injected
 * dependencies so it can be tested in-process. The server only listens
 * when this file is executed directly.
 *
 * Firebase Anonymous Authentication and persistent data storage
 * are not implemented in this entry point.
 */

const express = require("express");

/**
 * Maximum accepted JSON body size. A query is a single chat message;
 * even 2,000 characters of multi-byte text stays well under this, and
 * ml_service rejects text over 2,000 characters anyway.
 */
const BODY_LIMIT = "10kb";

/**
 * Error responses. Fixed strings only: no error message, stack or
 * request content is ever echoed to the client.
 */
const ERRORS = Object.freeze({
  malformedBody: "Malformed request body.",
  tooLarge: "Request too large.",
  notFound: "Not found.",
  internal: "Unable to process query.",
});

/**
 * True for errors raised by body-parser (express.json) while reading or
 * parsing a request body: malformed JSON, unsupported charset/encoding,
 * aborted requests and similar client errors.
 */
function isBodyParserError(err) {
  return (
    typeof err.type === "string" &&
    Number.isInteger(err.status) &&
    err.status >= 400 &&
    err.status < 500
  );
}

/**
 * Build the SafeGirl Express application.
 *
 * @param {object} deps
 * @param {(text: string) => Promise<object>} deps.handleQuery - Query
 *        processing pipeline.
 * @param {Function} deps.authMiddleware - Express middleware run before
 *        POST /api/query.
 * @param {object} [deps.logger] - Logger with an error() method.
 * @returns {import("express").Express} The configured application.
 */
function createApp({ handleQuery, authMiddleware, logger = console }) {
  const app = express();

  /**
   * Log a fixed event string plus the error's class name only. The error
   * message, stack, request body and any user text are never logged:
   * body-parser messages, for example, can quote the start of the body.
   */
  const logFailure = (event, err) => {
    logger.error(`[gateway] ${event} (${err && err.name})`);
  };

  /**
   * Parse incoming JSON request bodies, up to BODY_LIMIT.
   */
  app.use(express.json({ limit: BODY_LIMIT }));

  /**
   * POST /api/query
   *
   * Accepts an adolescent SRH query and passes it to the
   * SafeGirl processing pipeline.
   *
   * The application layer is responsible for safety checking,
   * intent classification, retrieval, generation, and response
   * orchestration.
   */
  app.post("/api/query", authMiddleware, async (req, res, next) => {
    try {
      const { text } = req.body;

      // Reject missing or empty queries before processing.
      if (typeof text !== "string" || text.trim() === "") {
        return res.status(400).json({
          error: "Query text is required.",
        });
      }

      // Delegate query processing to the application layer.
      const result = await handleQuery(text.trim());

      return res.json(result);
    } catch (err) {
      // Handled by the error middleware below: 500 with a fixed message.
      return next(err);
    }
  });

  /**
   * GET /health
   *
   * Provides a simple endpoint for confirming that the
   * backend server is running and responding to requests.
   */
  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  /**
   * Unknown routes: JSON 404 instead of Express's HTML page.
   */
  app.use((req, res) => {
    res.status(404).json({ error: ERRORS.notFound });
  });

  /**
   * Error handler. Replaces Express's default handler, which logs the
   * full error (including body-parser messages that quote the request
   * body) and returns an HTML page with a stack trace.
   */
  // eslint-disable-next-line no-unused-vars -- Express needs 4 arguments.
  app.use((err, req, res, next) => {
    if (res.headersSent) {
      logFailure("response failed after headers were sent", err);
      return res.end();
    }

    if (err.type === "entity.too.large") {
      logFailure("rejected request body: too large", err);
      return res.status(413).json({ error: ERRORS.tooLarge });
    }

    if (isBodyParserError(err)) {
      logFailure("rejected request body: malformed", err);
      return res.status(400).json({ error: ERRORS.malformedBody });
    }

    logFailure("request failed", err);
    return res.status(500).json({ error: ERRORS.internal });
  });

  return app;
}

/**
 * Start the server only when this file is executed directly.
 * This allows the Express application to be imported independently
 * for testing without automatically starting a server.
 */
if (require.main === module) {
  const { handleQuery } = require("./src/backend");

  /**
   * Use the PORT environment variable when available;
   * otherwise default to port 3001 for local development.
   */
  const PORT = process.env.PORT || 3001;

  // Authentication is not mounted yet; requests pass straight through.
  const allowAll = (req, res, next) => next();

  createApp({ handleQuery, authMiddleware: allowAll }).listen(PORT, () => {
    console.log(`SafeGirl backend listening on :${PORT}`);
  });
}

module.exports = { createApp, BODY_LIMIT };

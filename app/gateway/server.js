/**
 * SafeGirl Backend — Express Entry Point
 *
 * Provides the HTTP entry point for the SafeGirl backend.
 * The Express layer handles request validation and delegates
 * application processing to the backend service layer.
 *
 * Firebase Anonymous Authentication and persistent data storage
 * are not implemented in this entry point.
 */

const express = require("express");
const { handleQuery } = require("./src/backend");

const app = express();

/**
 * Parse incoming JSON request bodies.
 */
app.use(express.json());

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
app.post("/api/query", async (req, res) => {
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
    // Log processing errors for development and debugging.
    console.error("Query processing error:", err);

    return res.status(400).json({
      error: err.message || "Unable to process query.",
    });
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
 * Use the PORT environment variable when available;
 * otherwise default to port 3001 for local development.
 */
const PORT = process.env.PORT || 3001;

/**
 * Start the server only when this file is executed directly.
 * This allows the Express application to be imported independently
 * for testing without automatically starting a server.
 */
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SafeGirl backend listening on :${PORT}`);
  });
}

/**
 * Export the application for testing and reuse.
 */
module.exports = app;

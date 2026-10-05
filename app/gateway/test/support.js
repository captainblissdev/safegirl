/**
 * Shared helpers for in-process HTTP tests.
 */

const util = require("node:util");

/**
 * Start an Express app on a random free port.
 *
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
function startApp(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

/**
 * Run fn while capturing everything written through console.* (log,
 * info, warn, error, debug, trace) and directly to process.stderr, so a
 * test can assert that nothing sensitive was logged.
 *
 * process.stdout is deliberately not patched: node --test runs each file
 * in a child process that reports results to the runner over stdout.
 * console.log is still captured through the console patch.
 *
 * @returns {Promise<{ result: any, output: string }>}
 */
async function captureOutput(fn) {
  const chunks = [];
  const methods = ["log", "info", "warn", "error", "debug", "trace"];
  const originalConsole = Object.fromEntries(
    methods.map((name) => [name, console[name]]),
  );
  const originalStderr = process.stderr.write;

  for (const name of methods) {
    console[name] = (...args) => chunks.push(util.format(...args));
  }
  process.stderr.write = (chunk) => {
    chunks.push(String(chunk));
    return true;
  };

  try {
    const result = await fn();
    return { result, output: chunks.join("\n") };
  } finally {
    Object.assign(console, originalConsole);
    process.stderr.write = originalStderr;
  }
}

/**
 * fetch() that also reads the body as text, so callers can search the raw
 * response for leaked content.
 */
async function request(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    text,
    json: () => JSON.parse(text),
  };
}

const allowAll = (req, res, next) => next();

module.exports = { startApp, captureOutput, request, allowAll };

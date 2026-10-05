/**
 * SafeGirl session authentication
 *
 * Verifies the Firebase Anonymous Authentication ID token sent by the
 * interface as "Authorization: Bearer <token>". The verified Firebase uid
 * is attached to req.uid for the lifetime of the request only, as an
 * anonymous session identifier. It is never logged, never put in a
 * response and never sent to ml_service.
 *
 * Importing this module needs no credentials. The default verifier only
 * needs the Firebase project ID: firebase-admin checks ID tokens against
 * Google's public keys, so no service-account file is required.
 */

const { initializeApp, getApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

/** Same body for every failure, so the client cannot tell why. */
const AUTH_REQUIRED = Object.freeze({ error: "Authentication required." });

const DISABLED_WARNING =
  "[auth] AUTH DISABLED (development only): POST /api/query is unauthenticated";

// A named app, so this never collides with any other firebase-admin use.
const FIREBASE_APP_NAME = "safegirl-gateway-auth";

/**
 * Map a verification error to a fixed reason category for logging.
 * Only the category is ever logged, never the error message (which can
 * include token details).
 */
function reasonCategory(error) {
  switch (error && error.code) {
    case "auth/id-token-expired":
      return "expired";
    case "auth/id-token-revoked":
      return "revoked";
    case "auth/user-disabled":
      return "disabled";
    case "auth/argument-error":
      // Malformed token, bad signature, wrong project, audience or issuer.
      return "invalid";
    default:
      // Not a token problem: verifier misconfigured or Google's public
      // keys unavailable.
      return "verifier_error";
  }
}

/**
 * Create the default token verifier. firebase-admin is initialised on
 * first use with the project ID only, so no credential is read when the
 * module is imported or the gateway starts.
 *
 * @param {object} options
 * @param {string} options.projectId - Firebase project ID.
 * @returns {(token: string) => Promise<{ uid: string }>}
 */
function createFirebaseVerifier({ projectId }) {
  let auth = null;

  return async function verifyIdToken(token) {
    if (!auth) {
      const app = getApps().some((a) => a.name === FIREBASE_APP_NAME)
        ? getApp(FIREBASE_APP_NAME)
        : initializeApp({ projectId }, FIREBASE_APP_NAME);
      auth = getAuth(app);
    }

    // checkRevoked is left off: it would need a credential and an extra
    // network call per request.
    return auth.verifyIdToken(token);
  };
}

/**
 * Create Express middleware that requires a valid ID token.
 *
 * @param {object} deps
 * @param {(token: string) => Promise<{ uid: string }>} deps.verifyIdToken
 * @param {object} [deps.logger] - Logger with a warn() method.
 */
function createAuthMiddleware({ verifyIdToken, logger = console }) {
  if (typeof verifyIdToken !== "function") {
    throw new TypeError(
      "createAuthMiddleware requires a verifyIdToken function",
    );
  }

  const reject = (res, reason) => {
    logger.warn(`[auth] rejected request: ${reason}`);
    return res.status(401).json(AUTH_REQUIRED);
  };

  return async function requireSession(req, res, next) {
    const header = req.headers.authorization;

    if (typeof header !== "string" || header === "") {
      return reject(res, "missing");
    }

    const match = /^Bearer (\S+)$/.exec(header.trim());

    if (!match) {
      return reject(res, "malformed_header");
    }

    let decoded;
    try {
      decoded = await verifyIdToken(match[1]);
    } catch (error) {
      return reject(res, reasonCategory(error));
    }

    if (!decoded || typeof decoded.uid !== "string" || decoded.uid === "") {
      return reject(res, "invalid");
    }

    // Request-scoped only; deliberately not logged on success.
    req.uid = decoded.uid;
    return next();
  };
}

/**
 * Resolve the authentication configuration from environment variables.
 * Pure: it returns warnings for the caller to log and throws when the
 * gateway must refuse to start.
 *
 * Rules:
 * - AUTH_DISABLED exactly "true" and NODE_ENV not "production": auth off.
 * - AUTH_DISABLED "true" with NODE_ENV "production": refuse to start.
 * - Any other AUTH_DISABLED value: auth stays on (fail closed); a
 *   non-empty value other than "false" also produces a warning.
 * - Auth on without FIREBASE_PROJECT_ID: refuse to start.
 *
 * @param {object} env - Environment variables.
 * @returns {{ authEnabled: boolean, projectId: string | null,
 *             warnings: string[] }}
 */
function resolveAuthConfig(env) {
  const flag = env.AUTH_DISABLED;
  const isProduction = env.NODE_ENV === "production";
  const warnings = [];

  if (flag === "true") {
    if (isProduction) {
      throw new Error(
        "Refusing to start: AUTH_DISABLED=true is not allowed when NODE_ENV=production.",
      );
    }
    warnings.push(DISABLED_WARNING);
    return { authEnabled: false, projectId: null, warnings };
  }

  if (flag !== undefined && flag !== "" && flag !== "false") {
    warnings.push(
      `[auth] ignoring AUTH_DISABLED=${JSON.stringify(flag)}: only the exact value "true" disables authentication; authentication stays enabled`,
    );
  }

  const projectId =
    typeof env.FIREBASE_PROJECT_ID === "string"
      ? env.FIREBASE_PROJECT_ID.trim()
      : "";

  if (projectId === "") {
    throw new Error(
      "Refusing to start: authentication is enabled but FIREBASE_PROJECT_ID is not set. " +
        "Set FIREBASE_PROJECT_ID, or for local development only set AUTH_DISABLED=true.",
    );
  }

  return { authEnabled: true, projectId, warnings };
}

/**
 * Pass-through used only when AUTH_DISABLED=true in development.
 */
function allowUnauthenticated(req, res, next) {
  return next();
}

/**
 * Build the auth middleware for POST /api/query from environment
 * variables. Run once at startup: it logs resolveAuthConfig's warnings
 * (including the AUTH DISABLED warning) once and throws when the gateway
 * must refuse to start.
 *
 * @param {object} env - Environment variables.
 * @param {object} [deps]
 * @param {Function} [deps.verifyIdToken] - Overrides the Firebase
 *        verifier (tests).
 * @param {object} [deps.logger] - Logger with a warn() method.
 * @returns {Function} Express middleware.
 */
function createAuthFromEnv(env, { verifyIdToken, logger = console } = {}) {
  const config = resolveAuthConfig(env);

  for (const warning of config.warnings) {
    logger.warn(warning);
  }

  if (!config.authEnabled) {
    return allowUnauthenticated;
  }

  return createAuthMiddleware({
    verifyIdToken:
      verifyIdToken || createFirebaseVerifier({ projectId: config.projectId }),
    logger,
  });
}

module.exports = {
  createAuthFromEnv,
  createAuthMiddleware,
  createFirebaseVerifier,
  resolveAuthConfig,
  reasonCategory,
  AUTH_REQUIRED,
  DISABLED_WARNING,
};

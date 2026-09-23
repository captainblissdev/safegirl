/**
 * Verifies the Firebase ID token sent by the frontend on every request.
 *
 * The verified Firebase UID is attached to req.uid and is used only as
 * an anonymous session identifier. No name, email, or other personal
 * information is attached, consistent with SafeGirl's privacy model.
 */

const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
  path.join(__dirname, "../../firebase-service-account.json");

if (!admin.apps.length) {
  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

/**
 * Express middleware that verifies a Firebase ID token.
 *
 * Expects:
 *   Authorization: Bearer <firebase-id-token>
 *
 * On success:
 *   req.uid contains the Firebase anonymous user's UID.
 *
 * On failure:
 *   Responds with HTTP 401 Unauthorized.
 */
async function verifyFirebaseToken(req, res, next) {
  const authorizationHeader = req.headers.authorization || "";

  if (!authorizationHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Missing or malformed Authorization header",
    });
  }

  const idToken = authorizationHeader.substring("Bearer ".length).trim();

  if (!idToken) {
    return res.status(401).json({
      error: "Missing or malformed Authorization header",
    });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Firebase UID is used only as an anonymous session identifier.
    req.uid = decodedToken.uid;

    return next();
  } catch (error) {
    console.error(
      `[firebaseAuth] Token verification failed: ${error.message}`
    );

    return res.status(401).json({
      error: "Invalid or expired session token",
    });
  }
}

module.exports = {
  verifyFirebaseToken,
};
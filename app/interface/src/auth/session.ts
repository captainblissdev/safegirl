import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/**
 * Ensures the user has an anonymous session. SafeGirl never asks for
 * identifying information -- this is purely a session identity, not
 * a user account. No email, no name, no persisted profile.
 */
export function ensureSession(): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
        return;
      }
      signInAnonymously(auth).then(
        (result) => resolve(result.user),
        (err: unknown) =>
          reject(err instanceof Error ? err : new Error(String(err))),
      );
    });
  });
}

/** Returns the current session's ID token, to send on API requests. */
export async function getSessionToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export { auth };

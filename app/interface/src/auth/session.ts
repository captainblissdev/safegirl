import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  signInAnonymously,
  type Auth,
} from "firebase/auth";

/**
 * Anonymous session for SafeGirl.
 *
 * Firebase Anonymous Authentication gives each visitor a session identity
 * that is never linked to a name, email or account. Privacy rules:
 *
 * - In-memory persistence only: nothing is written to localStorage,
 *   sessionStorage or IndexedDB, so a reload or a new tab starts a new
 *   anonymous identity.
 * - Lazy: Firebase is not initialised on page load. The first query signs
 *   in, so visitors who never ask anything create no Firebase record.
 * - Only Firebase Auth is used; no analytics or other Firebase product.
 */

/** The parts of a Firebase user this module needs. */
export interface SessionUser {
  getIdToken(forceRefresh?: boolean): Promise<string>;
}

/** The parts of Firebase Auth this module needs. */
export interface SessionAuth {
  readonly currentUser: SessionUser | null;
}

export interface SessionDeps<A extends SessionAuth> {
  /** Returns the auth instance, initialising it on first use. */
  getAuth: () => A;
  /** Signs in anonymously and resolves with the new user. */
  signIn: (auth: A) => Promise<SessionUser>;
}

export interface Session {
  /** Resolves with the current anonymous user, signing in if needed. */
  ensureSession: () => Promise<SessionUser>;
  /** Resolves with an ID token for the current session. */
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}

/**
 * Create a session manager. Concurrent ensureSession() calls share one
 * in-flight sign-in, so a burst of queries signs in only once. A failed
 * sign-in is not cached: the next call tries again.
 */
export function createSession<A extends SessionAuth>(
  deps: SessionDeps<A>,
): Session {
  let inFlight: Promise<SessionUser> | null = null;

  async function ensureSession(): Promise<SessionUser> {
    const auth = deps.getAuth();

    if (auth.currentUser) {
      return auth.currentUser;
    }

    inFlight ??= deps.signIn(auth).finally(() => {
      inFlight = null;
    });

    return inFlight;
  }

  async function getIdToken(forceRefresh = false): Promise<string> {
    const user = await ensureSession();
    return user.getIdToken(forceRefresh);
  }

  return { ensureSession, getIdToken };
}

/** True when a Firebase error means the network, not the request, failed. */
export function isNetworkError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "auth/network-request-failed"
  );
}

let firebaseAuth: Auth | null = null;

/**
 * Initialise Firebase Auth on first use, with in-memory persistence and
 * no popup/redirect resolver.
 *
 * initializeAuth throws auth/already-initialized if it runs twice for the
 * same app, which happens when Vite hot-reloads this module. In that case
 * the existing instance, which was created with in-memory persistence, is
 * reused via getAuth().
 */
function getFirebaseAuth(): Auth {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
        });

  try {
    firebaseAuth = initializeAuth(app, { persistence: inMemoryPersistence });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "auth/already-initialized"
    ) {
      firebaseAuth = getAuth(app);
    } else {
      throw error;
    }
  }

  return firebaseAuth;
}

const session = createSession<Auth>({
  getAuth: getFirebaseAuth,
  signIn: async (auth) => (await signInAnonymously(auth)).user,
});

export const ensureSession = session.ensureSession;
export const getIdToken = session.getIdToken;

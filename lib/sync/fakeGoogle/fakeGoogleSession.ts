/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The fake Google account session: who is "signed in", and the bridge that
 * lets `signInWithGoogle()` wait on the on-screen account chooser
 * (components/FakeGoogleSignIn.tsx) instead of the native Google SDK.
 * Authenticity is assumed — picking the account always succeeds — so e2e
 * runs and demo videos never depend on a real Google account.
 */
export interface FakeGoogleAccount {
  name: string;
  email: string;
}

export const FAKE_GOOGLE_ACCOUNT: FakeGoogleAccount = {
  name: "Carlos Martínez",
  email: "carlos@micobro.test"
};

export const FAKE_ACCESS_TOKEN = "fake-google-access-token";

type RequestListener = (pending: boolean) => void;

export interface FakeGoogleSession {
  isSignedIn(): boolean;
  /** Opens the chooser and resolves true on approval, false on cancel. */
  requestSignIn(): Promise<boolean>;
  /** Called by the chooser UI when the user approves or cancels. */
  resolveSignIn(approved: boolean): void;
  signOut(): void;
  isSignInPending(): boolean;
  subscribe(listener: RequestListener): () => void;
}

export function createFakeGoogleSession(): FakeGoogleSession {
  let signedIn = false;
  let resolver: ((approved: boolean) => void) | null = null;
  const listeners = new Set<RequestListener>();
  const notify = () => listeners.forEach((listener) => listener(resolver !== null));

  return {
    isSignedIn: () => signedIn,
    isSignInPending: () => resolver !== null,
    requestSignIn() {
      // A second request while the chooser is open reuses the same prompt.
      if (resolver)
        return new Promise<boolean>((resolve) => {
          const first = resolver!;
          resolver = (approved) => {
            first(approved);
            resolve(approved);
          };
        });
      return new Promise<boolean>((resolve) => {
        resolver = resolve;
        notify();
      });
    },
    resolveSignIn(approved) {
      const done = resolver;
      resolver = null;
      if (approved) signedIn = true;
      notify();
      done?.(approved);
    },
    signOut() {
      signedIn = false;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
}

/** The app-wide session; tests build their own with `createFakeGoogleSession`. */
export const fakeGoogleSession = createFakeGoogleSession();

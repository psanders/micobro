/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Fake Google (lib/sync/fakeGoogle) — the sign-in bridge the on-screen
 * account chooser drives. Authenticity is assumed: approving always signs in.
 */
import { createFakeGoogleSession } from "../lib/sync/fakeGoogle/fakeGoogleSession";

describe("fake Google session", () => {
  it("starts signed out with no sign-in pending", () => {
    const session = createFakeGoogleSession();

    expect(session.isSignedIn()).toBe(false);
    expect(session.isSignInPending()).toBe(false);
  });

  it("signs in once the chooser approves", async () => {
    const session = createFakeGoogleSession();

    const result = session.requestSignIn();
    expect(session.isSignInPending()).toBe(true);
    session.resolveSignIn(true);

    await expect(result).resolves.toBe(true);
    expect(session.isSignedIn()).toBe(true);
    expect(session.isSignInPending()).toBe(false);
  });

  it("stays signed out when the chooser is cancelled", async () => {
    const session = createFakeGoogleSession();

    const result = session.requestSignIn();
    session.resolveSignIn(false);

    await expect(result).resolves.toBe(false);
    expect(session.isSignedIn()).toBe(false);
  });

  it("answers two overlapping requests from the same prompt", async () => {
    const session = createFakeGoogleSession();

    const first = session.requestSignIn();
    const second = session.requestSignIn();
    session.resolveSignIn(true);

    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
  });

  it("notifies subscribers when a request opens and closes, until unsubscribed", () => {
    const session = createFakeGoogleSession();
    const listener = jest.fn();
    const unsubscribe = session.subscribe(listener);

    void session.requestSignIn();
    session.resolveSignIn(false);
    expect(listener.mock.calls).toEqual([[true], [false]]);

    unsubscribe();
    void session.requestSignIn();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("signs out", async () => {
    const session = createFakeGoogleSession();
    const result = session.requestSignIn();
    session.resolveSignIn(true);
    await result;

    session.signOut();

    expect(session.isSignedIn()).toBe(false);
  });
});

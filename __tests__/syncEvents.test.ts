/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { notifyMutationQueued, onMutationQueued } from "../lib/sync/syncEvents";

describe("syncEvents", () => {
  it("invokes all subscribed listeners when a mutation is queued", () => {
    const a = jest.fn();
    const b = jest.fn();
    const unsubA = onMutationQueued(a);
    const unsubB = onMutationQueued(b);

    notifyMutationQueued();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);

    unsubA();
    unsubB();
  });

  it("stops delivering to a listener after it unsubscribes", () => {
    const listener = jest.fn();
    const unsubscribe = onMutationQueued(listener);

    notifyMutationQueued();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    notifyMutationQueued();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

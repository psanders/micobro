/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Tiny in-process signal: "a mutation was queued." The real repos
 * (lib/repo/real/*.ts) call notifyMutationQueued() after their create/collect
 * method resolves; SyncProvider subscribes to trigger an immediate push
 * attempt. A module-level emitter rather than RN's DeviceEventEmitter (that's
 * for native<->JS bridging, not plain cross-module JS signaling) or a
 * dependency — this is the entire surface area needed.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function notifyMutationQueued(): void {
  for (const listener of listeners) listener();
}

/** Subscribes to mutation-queued signals. Returns an unsubscribe function. */
export function onMutationQueued(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

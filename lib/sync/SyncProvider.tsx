/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Centralizes when a push runs: immediately after a mutation is queued, as
 * soon as connectivity returns, or when the lender taps "Sincronizar ahora" —
 * all funneled through one in-flight guard so exactly one push ever runs at a
 * time. Adapted from Mikro's SyncProvider (~/Projects/mikro,
 * mods/mobile/lib/offline/SyncProvider.tsx) but connectivity comes from
 * NetInfo (event-driven) rather than polling a first-party backend, which
 * Micobro doesn't have — see design.md for the full rationale.
 *
 * Automatic triggers (on-mutation, on-reconnect) push silently: a background
 * attempt failing shouldn't interrupt the lender. The manual "Sincronizar
 * ahora" path keeps surfacing errors, as it did before this provider existed.
 */
import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode
} from "react";
import { Alert } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useSyncRepo } from "../repo/RepoProvider";
import { onMutationQueued } from "./syncEvents";
import { shouldAutoPush } from "./autoPushPolicy";
import { logger } from "../logger";
import type { SyncStatus } from "../repo/types";
import type { PushResult } from "./push";

const EMPTY_STATUS: SyncStatus = {
  connected: false,
  sheetId: null,
  lastPushedAt: null,
  pendingCount: 0,
  stuckCount: 0
};

interface SyncContextValue {
  isOnline: boolean;
  isPushing: boolean;
  status: SyncStatus;
  /** Manually triggered — surfaces failures to the lender. */
  push: () => Promise<PushResult | null>;
  refreshStatus: () => Promise<SyncStatus>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const syncRepo = useSyncRepo();
  const [isOnline, setIsOnline] = useState(true);
  const [isPushing, setIsPushing] = useState(false);
  const [status, setStatus] = useState<SyncStatus>(EMPTY_STATUS);
  const pushingRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    const next = await syncRepo.getStatus();
    setStatus(next);
    return next;
  }, [syncRepo]);

  const runPush = useCallback(
    async (silent: boolean): Promise<PushResult | null> => {
      if (pushingRef.current) return null;
      pushingRef.current = true;
      setIsPushing(true);
      try {
        const result = await syncRepo.pushNow();
        await refreshStatus();
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (silent) {
          logger.warn("auto push failed", { message });
        } else {
          Alert.alert("Error de sincronización", `No se pudo sincronizar: ${message}`);
        }
        return null;
      } finally {
        pushingRef.current = false;
        setIsPushing(false);
      }
    },
    [syncRepo, refreshStatus]
  );

  const push = useCallback(() => runPush(false), [runPush]);

  // Refs so the NetInfo/event listeners (subscribed once) always see the
  // latest values without needing to resubscribe.
  const runPushRef = useRef(runPush);
  runPushRef.current = runPush;
  const isPushingRef = useRef(isPushing);
  isPushingRef.current = isPushing;
  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  // Guards against a flapping connection (NetInfo firing repeatedly in a
  // burst) queuing up unbounded overlapping refreshStatus()/push cycles,
  // which would otherwise flood the DB/network and could stall the JS thread.
  const autoPushCycleInFlightRef = useRef(false);

  const maybeAutoPush = useCallback(async () => {
    if (autoPushCycleInFlightRef.current) return;
    autoPushCycleInFlightRef.current = true;
    try {
      const next = await refreshStatus();
      if (
        shouldAutoPush({
          isOnline: isOnlineRef.current,
          isPushing: isPushingRef.current,
          pendingCount: next.pendingCount
        })
      ) {
        await runPushRef.current(true);
      }
    } finally {
      autoPushCycleInFlightRef.current = false;
    }
  }, [refreshStatus]);

  const maybeAutoPushRef = useRef(maybeAutoPush);
  maybeAutoPushRef.current = maybeAutoPush;

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Mutation queued (lib/repo/real/*.ts, right after a create/collect
  // resolves) — attempt a push immediately if we're online.
  useEffect(() => {
    return onMutationQueued(() => {
      maybeAutoPushRef.current();
    });
  }, []);

  // Connectivity: event-driven, no polling. Track the offline->online
  // transition explicitly and push on reconnect.
  useEffect(() => {
    let wasOnline = true;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const nowOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(nowOnline);
      const cameOnline = nowOnline && !wasOnline;
      wasOnline = nowOnline;
      if (cameOnline) {
        maybeAutoPushRef.current();
      }
    });
    return unsubscribe;
  }, []);

  return (
    <SyncContext.Provider value={{ isOnline, isPushing, status, push, refreshStatus }}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSyncContext must be used within a SyncProvider");
  return ctx;
}

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Centralizes when a sync runs: immediately after a mutation is queued, as
 * soon as connectivity returns, once on app-open (guarded), or when the
 * lender taps "Sincronizar ahora" / "Cerrar día y sincronizar" — all funneled
 * through one in-flight guard so exactly one sync operation ever runs at a
 * time. Adapted from Mikro's SyncProvider (~/Projects/mikro,
 * mods/mobile/lib/offline/SyncProvider.tsx) but connectivity comes from
 * NetInfo (event-driven) rather than polling a first-party backend, which
 * Micobro doesn't have — see design.md for the full rationale.
 *
 * Two distinct operations share the guard:
 * - **push-only** (on-mutation, on-reconnect): silent, unchanged since
 *   sync-push-policy — a background attempt failing shouldn't interrupt the
 *   lender.
 * - **push-then-pull** ("sync", `syncRepo.syncNow()`): the manual button
 *   (surfaces errors) and the guarded app-open auto-sync (silent, gated by
 *   connectivity + a ~15 min debounce — see autoSyncPolicy.ts and
 *   openspec/changes/7-pull-two-way-sync/design.md §1).
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
import { router } from "expo-router";
import { useSyncRepo } from "../repo/RepoProvider";
import { onMutationQueued } from "./syncEvents";
import { shouldAutoPush } from "./autoPushPolicy";
import { shouldAutoSync } from "./autoSyncPolicy";
import { friendlySyncErrorMessage } from "./friendlySyncError";
import { logger } from "../logger";
import type { SyncStatus } from "../repo/types";
import type { PushResult } from "./push";
import type { PullResult } from "./pullResult";

const EMPTY_STATUS: SyncStatus = {
  connected: false,
  sheetId: null,
  lastPushedAt: null,
  lastPulledAt: null,
  pendingCount: 0,
  stuckCount: 0,
  heldDeletions: null,
  syncProblems: [],
  tipoNoticePending: false
};

export interface SyncOptions {
  reviewAlert?: boolean;
}

/** Offers Sincronización con Google when the pull left something to review; `then` runs after it closes (or right away). */
function offerReview(pull: PullResult, then: () => void) {
  if (!pull.held && pull.problems.length === 0) {
    then();
    return;
  }
  Alert.alert(
    "Revisa tu sincronización",
    pull.held
      ? "Se borraron filas en tu hoja. Confirma si también quieres borrarlas de este teléfono."
      : "Hay filas en tu hoja que no se pudieron leer. Revisa cuáles corregir.",
    [
      { text: "Más tarde", style: "cancel", onPress: then },
      {
        text: "Revisar",
        onPress: () => {
          router.push("/sincronizar");
          then();
        }
      }
    ],
    { onDismiss: then }
  );
}

/**
 * After this phone moved an existing Pagos tab to the Tipo layout (see
 * lib/sync/pagosLayout.ts): a phone on an older build reads mora and penalty
 * rows as cuotas, so ask the lender to update the others. Not cancelable; it
 * clears only on "Entendido", so it shows again if the app is killed first.
 */
function showTipoNotice(onAcknowledge: () => void) {
  Alert.alert(
    "Actualiza Micobro en tus otros teléfonos",
    'Tu hoja ahora guarda el tipo de cada pago en la columna "Tipo". Si otro teléfono usa esta misma hoja, actualízalo a la última versión de Micobro antes de cobrar con él. Hasta entonces puede leer mal las moras y penalidades.',
    [{ text: "Entendido", onPress: onAcknowledge }],
    { cancelable: false }
  );
}

interface SyncContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  status: SyncStatus;
  /**
   * Manually triggered backup, push and pull — surfaces failures to the lender.
   * When the pull leaves something to review (held deletions, broken tabs) it
   * offers to open Sincronización con Google, unless `reviewAlert` is false
   * (that screen shows it already).
   */
  sync: (options?: SyncOptions) => Promise<{ push: PushResult; pull: PullResult } | null>;
  /** The owner's Aplicar / Restaurar for held Sheet deletions — surfaces failures like `sync`. */
  resolveHeldDeletions: (
    choice: "apply" | "restore"
  ) => Promise<{ push: PushResult; pull: PullResult } | null>;
  refreshStatus: () => Promise<SyncStatus>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const syncRepo = useSyncRepo();
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState<SyncStatus>(EMPTY_STATUS);
  const syncingRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    const next = await syncRepo.getStatus();
    setStatus(next);
    return next;
  }, [syncRepo]);

  const runGuarded = useCallback(
    async <T,>(op: () => Promise<T>, silent: boolean): Promise<T | null> => {
      if (syncingRef.current) return null;
      syncingRef.current = true;
      setIsSyncing(true);
      try {
        const result = await op();
        await refreshStatus();
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (silent) {
          logger.warn("auto sync failed", { message });
        } else {
          logger.warn("sync failed", { message });
          Alert.alert("Error de sincronización", friendlySyncErrorMessage(err));
        }
        return null;
      } finally {
        syncingRef.current = false;
        setIsSyncing(false);
      }
    },
    [refreshStatus]
  );

  // One notice on screen at a time; the stored flag survives an app kill.
  const tipoNoticeShownRef = useRef(false);
  const maybeShowTipoNotice = useCallback(async () => {
    if (tipoNoticeShownRef.current) return;
    const next = await syncRepo.getStatus();
    if (!next.tipoNoticePending) return;
    tipoNoticeShownRef.current = true;
    showTipoNotice(() => {
      syncRepo
        .acknowledgeTipoNotice()
        .catch((err: unknown) => logger.warn("could not clear the Tipo notice", { err }))
        .finally(() => {
          tipoNoticeShownRef.current = false;
          void refreshStatus();
        });
    });
  }, [syncRepo, refreshStatus]);

  const runPush = useCallback(
    async (silent: boolean) => {
      const result = await runGuarded(() => syncRepo.pushNow(), silent);
      if (result) void maybeShowTipoNotice();
      return result;
    },
    [runGuarded, syncRepo, maybeShowTipoNotice]
  );
  const runSync = useCallback(
    async (silent: boolean) => {
      const result = await runGuarded(() => syncRepo.syncNow(), silent);
      // The manual sync (not silent) shows the notice after its review alert.
      if (result && silent) void maybeShowTipoNotice();
      return result;
    },
    [runGuarded, syncRepo, maybeShowTipoNotice]
  );

  const sync = useCallback(
    async (options: SyncOptions = {}) => {
      const result = await runSync(false);
      if (result && options.reviewAlert !== false) {
        offerReview(result.pull, () => void maybeShowTipoNotice());
      } else if (result) {
        void maybeShowTipoNotice();
      }
      return result;
    },
    [runSync, maybeShowTipoNotice]
  );
  const resolveHeldDeletions = useCallback(
    (choice: "apply" | "restore") => runGuarded(() => syncRepo.resolveHeldDeletions(choice), false),
    [runGuarded, syncRepo]
  );

  // Refs so the NetInfo/event listeners (subscribed once) always see the
  // latest values without needing to resubscribe.
  const runPushRef = useRef(runPush);
  runPushRef.current = runPush;
  const runSyncRef = useRef(runSync);
  runSyncRef.current = runSync;
  const isSyncingRef = useRef(isSyncing);
  isSyncingRef.current = isSyncing;
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
          isPushing: isSyncingRef.current,
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

  // App-open: one guarded push-then-pull attempt, additional to (never a
  // replacement for) the manual button — connectivity-gated, ~15 min
  // debounced against the last successful pull, non-blocking, and silent on
  // failure (design.md §1's owner amendment).
  useEffect(() => {
    (async () => {
      const next = await refreshStatus();
      if (
        shouldAutoSync({
          isOnline: isOnlineRef.current,
          isSyncing: isSyncingRef.current,
          lastSyncedAt: next.lastPulledAt,
          now: new Date()
        })
      ) {
        await runSyncRef.current(true);
      }
    })();
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
    <SyncContext.Provider
      value={{ isOnline, isSyncing, status, sync, resolveHeldDeletions, refreshStatus }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSyncContext must be used within a SyncProvider");
  return ctx;
}

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: sync "The phone that migrated tells the lender to update the others"
 * (issue #191 item 12, Storyboard frame 8) — after a sync that left the Tipo
 * notice pending, SyncProvider raises it (after any review alert), not
 * cancelable, and clears it only on "Entendido".
 */
jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => () => {})
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("../lib/sync/friendlySyncError", () => ({ friendlySyncErrorMessage: () => "" }));

const mockRepo = {
  getStatus: jest.fn(),
  syncNow: jest.fn(),
  pushNow: jest.fn(),
  acknowledgeTipoNotice: jest.fn()
};
jest.mock("../lib/repo/RepoProvider", () => ({ useSyncRepo: () => mockRepo }));

import { Alert } from "react-native";
import { act, create } from "react-test-renderer";
import { SyncProvider, useSyncContext } from "../lib/sync/SyncProvider";
import { EMPTY_PULL_RESULT } from "../lib/sync/pullResult";
import type { SyncStatus } from "../lib/repo/types";

type AlertButton = { text: string; onPress?: () => void };

const status = (tipoNoticePending: boolean): SyncStatus => ({
  connected: true,
  sheetId: "sheet-1",
  // Recent, so the app-open auto-sync stays out of the way.
  lastPushedAt: new Date(),
  lastPulledAt: new Date(),
  pendingCount: 0,
  stuckCount: 0,
  heldDeletions: null,
  syncProblems: [],
  tipoNoticePending
});

let ctx: ReturnType<typeof useSyncContext>;
function Grab() {
  ctx = useSyncContext();
  return null;
}

async function render() {
  await act(async () => {
    create(
      <SyncProvider>
        <Grab />
      </SyncProvider>
    );
  });
}

const flush = () => act(async () => {});

describe("SyncProvider — Tipo notice", () => {
  let alertSpy: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    mockRepo.syncNow.mockResolvedValue({ push: { pushed: 0, failed: 0 }, pull: EMPTY_PULL_RESULT });
    mockRepo.acknowledgeTipoNotice.mockResolvedValue(undefined);
  });

  it("shows the notice when the sync ends with it pending, and clears it only on Entendido", async () => {
    let pending = true;
    mockRepo.getStatus.mockImplementation(async () => status(pending));
    mockRepo.acknowledgeTipoNotice.mockImplementation(async () => {
      pending = false;
    });
    await render();

    await act(async () => {
      await ctx.sync();
    });
    await flush();

    const notice = alertSpy.mock.calls.find(
      (c) => c[0] === "Actualiza Micobro en tus otros teléfonos"
    );
    expect(notice).toBeDefined();
    expect(notice![1]).toBe(
      'Tu hoja ahora guarda el tipo de cada pago en la columna "Tipo". Si otro teléfono usa esta misma hoja, actualízalo a la última versión de Micobro antes de cobrar con él. Hasta entonces puede leer mal las moras y penalidades.'
    );
    const buttons = notice![2] as AlertButton[];
    expect(buttons.map((b) => b.text)).toEqual(["Entendido"]);
    expect(notice![3]).toEqual({ cancelable: false });
    expect(mockRepo.acknowledgeTipoNotice).not.toHaveBeenCalled();

    await act(async () => buttons[0]!.onPress!());
    expect(mockRepo.acknowledgeTipoNotice).toHaveBeenCalledTimes(1);
  });

  it("waits for the review alert to close before showing the notice", async () => {
    mockRepo.getStatus.mockResolvedValue(status(true));
    mockRepo.syncNow.mockResolvedValue({
      push: { pushed: 0, failed: 0 },
      pull: { ...EMPTY_PULL_RESULT, problems: [{ entity: "payment", sheetRow: 3, reason: "x" }] }
    });
    await render();

    await act(async () => {
      await ctx.sync();
    });
    await flush();

    expect(alertSpy.mock.calls.map((c) => c[0])).toEqual(["Revisa tu sincronización"]);

    const review = alertSpy.mock.calls[0]![2] as AlertButton[];
    await act(async () => review.find((b) => b.text === "Más tarde")!.onPress!());
    await flush();

    expect(alertSpy.mock.calls.map((c) => c[0])).toEqual([
      "Revisa tu sincronización",
      "Actualiza Micobro en tus otros teléfonos"
    ]);
  });

  it("shows nothing when no notice is pending", async () => {
    mockRepo.getStatus.mockResolvedValue(status(false));
    await render();

    await act(async () => {
      await ctx.sync();
    });
    await flush();

    expect(alertSpy).not.toHaveBeenCalled();
  });
});

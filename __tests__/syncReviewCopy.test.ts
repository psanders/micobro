/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: pull-two-way-sync "Large deletions need the owner's confirmation"
 * and "A tab with broken rows is skipped and reported", sync-backups
 * "Backups are listed in Copias de seguridad" — the Spanish the owner reads.
 */
import {
  backupSummary,
  backupTitle,
  countLabel,
  deletionLines,
  problemLine
} from "../components/syncReviewCopy";

describe("sync review copy", () => {
  it("pluralizes counts", () => {
    expect(countLabel("customer", 1)).toBe("1 cliente");
    expect(countLabel("loan", 4)).toBe("4 préstamos");
    expect(countLabel("payment", 0)).toBe("0 pagos");
  });

  it("lists only the tables with deletions, parents first", () => {
    expect(
      deletionLines({ total: 6, byEntity: { customer: 1, loan: 1, payment: 4, visit: 0 } })
    ).toEqual(["1 cliente", "1 préstamo", "4 pagos"]);
  });

  it("names the tab and row of a broken row", () => {
    expect(
      problemLine({
        entity: "payment",
        sheetRow: 3,
        reason: "el ID se repite (también en la fila 2)"
      })
    ).toBe("Pagos · fila 3: el ID se repite (también en la fila 2)");
  });

  it("describes a backup by date and contents", () => {
    // Arrange
    const backup = {
      name: "micobro-backup-1.db",
      createdAt: new Date(2026, 9, 27, 14, 42),
      customers: 1,
      loans: 31,
      payments: 412
    };

    // Act + Assert
    expect(backupTitle(backup)).toMatch(/^27\/10\/2026 · /);
    expect(backupSummary(backup)).toBe("1 cliente · 31 préstamos · 412 pagos");
  });
});

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Spec: sync "A payment's kind is its Tipo" (issue #191 item 9) — balances,
 * mora, penalties and history read `tipo`; `notes` is free text and never
 * changes what a payment is.
 */
import {
  isMoraPayment,
  isPenaltyPayment,
  isPrincipalPayment,
  legacyPaymentKind
} from "../lib/payments/paymentNotes";
import { buildLoanDetailView, buildPaymentHistoryView } from "../lib/loans/loanViews";
import { computeLoanMora, loanMoraPolicy } from "../lib/loans/mora";
import { tradicionalPlusState } from "../lib/loans/tradicionalPlus";
import { day, pay, plusLoan } from "./helpers/tradicionalPlusFixture";
import type { Loan } from "../lib/loans/loan.schema";

const tradicional: Loan = {
  ...plusLoan,
  id: "loan-trad",
  loanType: null,
  penaltyCents: null,
  frequency: "biweekly",
  moraEnabled: true,
  moraRateBps: 500
};

describe("a payment's kind is its tipo", () => {
  it("counts tipo penalidad with notes 'pagó tarde' as a penalty", () => {
    const p = pay(day(3, 20), 30_000, "penalidad", { notes: "pagó tarde" });

    expect(isPenaltyPayment(p)).toBe(true);
    expect(isPrincipalPayment(p)).toBe(false);
    expect(tradicionalPlusState(plusLoan, [p], day(3, 20)).timesMoved).toBe(1);
  });

  it("counts tipo cuota with notes 'mora' as principal", () => {
    const p = pay(day(3, 1), 130_000, "cuota", { notes: "mora" });

    expect(isPrincipalPayment(p)).toBe(true);
    expect(isMoraPayment(p)).toBe(false);
    expect(tradicionalPlusState(plusLoan, [p], day(3, 1)).installmentsPaid).toBe(1);
  });

  it("follows tipo for mora on a Tradicional loan: balance, mora and history", () => {
    const moraRow = pay(day(3, 10), 5_000, "mora", { loanId: tradicional.id, notes: "cuota" });
    const cuotaRow = pay(day(3, 10), 130_000, "cuota", { loanId: tradicional.id, notes: "mora" });
    const payments = [moraRow, cuotaRow];

    const view = buildLoanDetailView({
      loan: tradicional,
      customerName: "",
      business: null,
      payments,
      today: day(3, 10)
    });
    expect(view.paidCents).toBe(130_000);

    // The mora row nets the accrued mora; the cuota row (notes "mora") doesn't.
    const gross = computeLoanMora(tradicional, [], day(3, 20), loanMoraPolicy(tradicional));
    const net = computeLoanMora(
      tradicional,
      [pay(day(3, 5), 1_000, "mora", { loanId: tradicional.id, notes: "abono" })],
      day(3, 20),
      loanMoraPolicy(tradicional)
    );
    const notNetted = computeLoanMora(
      tradicional,
      [pay(day(3, 5), 1_000, "cuota", { loanId: tradicional.id, notes: "mora" })],
      day(3, 20),
      loanMoraPolicy(tradicional)
    );
    expect(gross.moraCents).toBeGreaterThan(1_000);
    expect(net.moraCents).toBe(gross.moraCents - 1_000);
    expect(notNetted.moraCents).toBe(gross.moraCents);

    const history = buildPaymentHistoryView(tradicional, payments);
    expect(history.moraPaidCents).toBe(5_000);
    expect(history.entries.map((e) => e.label).sort()).toEqual(["Cuota 1", "Pago de mora"]);
  });

  it("labels history by tipo, never by notes", () => {
    const rows = [
      pay(day(3, 1), 130_000, "cuota", { notes: "penalidad" }),
      pay(day(3, 20), 30_000, "penalidad", { notes: null })
    ];

    const labels = buildPaymentHistoryView(plusLoan, rows).entries.map((e) => e.label);

    expect(labels).toEqual(["Penalidad", "Cuota 1"]);
  });
});

describe("legacyPaymentKind", () => {
  it("maps only the exact legacy flags", () => {
    expect(legacyPaymentKind("mora")).toBe("mora");
    expect(legacyPaymentKind("penalidad")).toBe("penalidad");
    expect(legacyPaymentKind("Mora")).toBeNull();
    expect(legacyPaymentKind(" mora ")).toBeNull();
    expect(legacyPaymentKind("otra cosa")).toBeNull();
    expect(legacyPaymentKind(null)).toBeNull();
  });
});

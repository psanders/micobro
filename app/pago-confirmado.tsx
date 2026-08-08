/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useLocalSearchParams } from "expo-router";
import { PaymentConfirmedScreen } from "../components/screens/PaymentConfirmedScreen";
import type { ReceiptLine } from "../lib/repo/types";

/**
 * A router param is only trustworthy enough to print once it parses to a
 * real date. `new Date("garbage")` is an `Invalid Date` — truthy, and
 * `formatFullDate` would render it "NaN/NaN/NaN" onto a thermal receipt.
 * `useLocalSearchParams` also hands back a `string[]` when a param is
 * duplicated in the URL, despite the `string` annotation. Both cases fall
 * back to `null`, which drops the row (see `components/ReceiptView.tsx`).
 */
function dateParam(raw: string | string[] | undefined): Date | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default function PagoConfirmadoRoute() {
  const params = useLocalSearchParams<{
    customerName: string;
    totalCents: string;
    method: string;
    receiptNumber: string;
    paidAtLabel: string;
    lines: string;
    loanStartDate: string;
    loanEndDate: string;
    isOpenCredit: string;
  }>();

  let lines: ReceiptLine[] = [];
  try {
    lines = JSON.parse(params.lines ?? "[]") as ReceiptLine[];
  } catch {
    lines = [];
  }

  return (
    <PaymentConfirmedScreen
      customerName={params.customerName ?? ""}
      totalCents={Number(params.totalCents ?? 0)}
      method={params.method === "transfer" ? "transfer" : "cash"}
      receiptNumber={params.receiptNumber ?? ""}
      paidAtLabel={params.paidAtLabel ?? ""}
      lines={lines}
      loanStartDate={dateParam(params.loanStartDate)}
      loanEndDate={dateParam(params.loanEndDate)}
      isOpenCredit={params.isOpenCredit === "true"}
    />
  );
}

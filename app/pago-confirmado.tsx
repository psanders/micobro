/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useLocalSearchParams } from "expo-router";
import { PaymentConfirmedScreen } from "../components/screens/PaymentConfirmedScreen";
import type { ReceiptLine } from "../lib/repo/types";

export default function PagoConfirmadoRoute() {
  const params = useLocalSearchParams<{
    customerName: string;
    totalCents: string;
    method: string;
    receiptNumber: string;
    paidAtLabel: string;
    lines: string;
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
    />
  );
}

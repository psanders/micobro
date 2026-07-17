/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Offline receipt rendered as a React Native view (capturable via
 * react-native-view-shot), shared through the OS share sheet from
 * PaymentConfirmedScreen. Micobro has no backend, so this is the only
 * receipt-image path — there's no server-signed variant to fall back to.
 */
import { forwardRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { formatCurrency } from "../lib/utils/money";
import { colors, fonts } from "../lib/ui/theme";
import type { ReceiptLine } from "../lib/repo/types";

export interface ReceiptViewData {
  receiptNumber: string;
  customerName: string;
  paidAtLabel: string;
  method: string;
  lines: ReceiptLine[];
  totalCents: number;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

export const ReceiptView = forwardRef<View, { data: ReceiptViewData }>(({ data }, ref) => {
  const fields: [string, string][] = [
    ["Recibo", `#${data.receiptNumber}`],
    ["Cliente", data.customerName],
    ["Fecha", data.paidAtLabel],
    ["Método", data.method],
    ...data.lines.map<[string, string]>((line) => [line.label, formatCurrency(line.amountCents)])
  ];

  return (
    <View ref={ref} collapsable={false} style={s.receipt}>
      <View style={s.header}>
        <Text style={s.brand}>MICOBRO</Text>
        <Text style={s.subtitle}>RECIBO DE PAGO</Text>
      </View>

      <View style={s.dashedDivider} />

      <View style={s.amountSection}>
        <Text style={s.amount}>{formatCurrency(data.totalCents)}</Text>
      </View>

      <View style={s.divider} />

      <View style={s.fields}>
        {fields.map(([label, value]) => (
          <Row key={label} label={label} value={value} />
        ))}
      </View>

      <View style={s.dashedDivider} />

      <View style={s.footer}>
        <Text style={s.thanks}>Gracias por su pago</Text>
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  receipt: {
    width: 384,
    backgroundColor: colors.white,
    paddingHorizontal: 20
  },
  header: {
    alignItems: "center",
    gap: 4,
    paddingTop: 20,
    paddingBottom: 8
  },
  brand: {
    fontFamily: fonts.logo,
    fontSize: 28,
    color: colors.brandDeep,
    letterSpacing: -0.5
  },
  subtitle: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.slate,
    letterSpacing: 2
  },
  dashedDivider: {
    width: "100%",
    borderBottomWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.hairline
  },
  amountSection: {
    alignItems: "center",
    paddingVertical: 16
  },
  amount: {
    fontFamily: fonts.bold,
    fontSize: 32,
    color: colors.brandDeep
  },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: colors.mist
  },
  fields: {
    gap: 10,
    paddingVertical: 14
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%"
  },
  rowLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.slate
  },
  rowValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.ink
  },
  footer: {
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 20,
    gap: 2
  },
  thanks: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.ink
  }
});

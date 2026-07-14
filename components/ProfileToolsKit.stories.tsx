/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The profile/tools kit (stat cards, payment history rows, the cuadre
 * amount input, and Anotar Visita's outcome chips) in one gallery.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { useState } from "react";
import { View } from "react-native";
import { StatCard } from "./StatCard";
import { PaymentHistoryRow } from "./PaymentHistoryRow";
import { AmountInputCard } from "./AmountInputCard";
import { OutcomeChip } from "./OutcomeChip";
import { colors } from "../lib/ui/theme";

const meta: Meta = {
  title: "Kit/ProfileTools",
  decorators: [
    (Story) => (
      <View style={{ padding: 20, gap: 16, backgroundColor: colors.bg, flex: 1 }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

export const StatCards: StoryObj = {
  render: () => (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <StatCard value="8" label="Cobros" />
      <StatCard value="18.2K" label="Recaudado" />
      <StatCard value="12" label="Pendientes" />
    </View>
  )
};

export const PaymentHistoryRows: StoryObj = {
  render: () => (
    <View style={{ gap: 8 }}>
      <PaymentHistoryRow
        month="MAY"
        day="4"
        label="Cuota 3"
        subLabel="Pago completo · Efectivo · Recibo #R-00872 · sin mora"
        amount="RD$2,400"
      />
      <PaymentHistoryRow
        month="ABR"
        day="22"
        label="Abono a cuenta"
        subLabel="Anticipo del cliente · Recibo #R-00840"
        amount="RD$500"
      />
    </View>
  )
};

function AmountInputDemo() {
  const [value, setValue] = useState("18000");
  const matches = value === "18000";
  return (
    <AmountInputCard
      label="EFECTIVO CONTADO"
      value={value}
      onChangeText={setValue}
      matches={matches}
      hint="Conta el efectivo y escribe el total. El sistema te avisa si hay diferencia."
    />
  );
}

export const AmountInput: StoryObj = { render: () => <AmountInputDemo /> };

function OutcomeChipsDemo() {
  const [selected, setSelected] = useState("promise");
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <OutcomeChip
        label="Promesa de pago"
        selected={selected === "promise"}
        onPress={() => setSelected("promise")}
      />
      <OutcomeChip
        label="Sin contacto"
        selected={selected === "no_contact"}
        onPress={() => setSelected("no_contact")}
      />
      <OutcomeChip
        label="No quiere pagar"
        selected={selected === "refused"}
        onPress={() => setSelected("refused")}
      />
      <OutcomeChip
        label="Reagendar"
        selected={selected === "reschedule"}
        onPress={() => setSelected("reschedule")}
      />
    </View>
  );
}

export const OutcomeChips: StoryObj = { render: () => <OutcomeChipsDemo /> };

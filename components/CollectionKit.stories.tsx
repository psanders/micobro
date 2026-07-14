/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The collection-flow kit (cuota rows, option rows, kv rows, meta chips,
 * info rows) in one gallery story per component family.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { useState } from "react";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { CuotaRow } from "./CuotaRow";
import { OptionRow } from "./OptionRow";
import { KvRow } from "./KvRow";
import { MetaChip } from "./MetaChip";
import { InfoRow } from "./InfoRow";
import { colors } from "../lib/ui/theme";

const meta: Meta = {
  title: "Kit/Collection",
  decorators: [
    (Story) => (
      <View style={{ padding: 20, gap: 16, backgroundColor: colors.bg, flex: 1 }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

export const CuotaRows: StoryObj = {
  render: () => (
    <View style={{ gap: 6 }}>
      <CuotaRow name="Cuota 1" date="20 abr" amount="RD$2,400" status="paid" />
      <CuotaRow name="Cuota 2" date="27 abr" amount="RD$2,400" status="paid" />
      <CuotaRow name="Cuota 4" date="11 may · ATRASO" amount="RD$3,150" status="overdue" />
      <CuotaRow name="Cuota 5" date="18 may" amount="RD$2,400" status="upcoming" />
    </View>
  )
};

function OptionRowsDemo() {
  const [selected, setSelected] = useState("arrears");
  return (
    <View style={{ gap: 8 }}>
      <OptionRow
        label="Cobrar cuota + mora"
        value="RD$3,150"
        selected={selected === "arrears"}
        onPress={() => setSelected("arrears")}
      />
      <OptionRow
        label="Solo mora"
        value="RD$750"
        valueColor={colors.ink}
        selected={selected === "mora"}
        onPress={() => setSelected("mora")}
      />
      <OptionRow
        label="Otro monto"
        value="Escribir"
        valueColor={colors.slate}
        selected={selected === "custom"}
        onPress={() => setSelected("custom")}
      />
      <OptionRow
        label="Saldar préstamo"
        value="RD$18,750"
        valueColor={colors.ink}
        selected={selected === "settle"}
        onPress={() => setSelected("settle")}
      />
    </View>
  );
}

export const OptionRows: StoryObj = {
  render: () => <OptionRowsDemo />
};

export const KvRows: StoryObj = {
  render: () => (
    <View style={{ gap: 10, backgroundColor: colors.white, borderRadius: 14, padding: 14 }}>
      <KvRow label="Mora (prioridad)" value="RD$750" />
      <KvRow label="Cuota 4" value="RD$2,400" />
      <KvRow label="Recibo" value="#R-00891" valueColor={colors.brandPrimary} />
    </View>
  )
};

export const MetaChips: StoryObj = {
  render: () => (
    <View style={{ flexDirection: "row", gap: 6 }}>
      <MetaChip>Semanal</MetaChip>
      <MetaChip>84 días</MetaChip>
      <MetaChip>Vence 5 jun</MetaChip>
    </View>
  )
};

export const InfoRows: StoryObj = {
  render: () => (
    <View style={{ gap: 8, backgroundColor: colors.white, borderRadius: 18, padding: 20 }}>
      <InfoRow
        icon={<Feather name="phone" size={16} color={colors.brandPrimary} />}
        text="829-555-0143"
      />
      <InfoRow
        icon={<Feather name="map-pin" size={16} color={colors.brandPrimary} />}
        text="Calle Duarte 24, Santo Domingo"
      />
      <InfoRow
        icon={<Feather name="credit-card" size={16} color={colors.brandPrimary} />}
        text="Cédula 001-1234567-8"
      />
    </View>
  )
};

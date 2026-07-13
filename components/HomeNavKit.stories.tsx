/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Small pieces of the home/navigation kit (quick actions, chips, progress,
 * section labels, search input, list tiles) in one gallery story per
 * component family.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { useState } from "react";
import { View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { QuickAction } from "./QuickAction";
import { ProgressBar } from "./ProgressBar";
import { FilterChip } from "./FilterChip";
import { SectionLabel } from "./SectionLabel";
import { SearchInput } from "./SearchInput";
import { ListTile } from "./ListTile";
import { colors } from "../lib/ui/theme";

const meta: Meta = {
  title: "Kit/HomeNav",
  decorators: [
    (Story) => (
      <View style={{ padding: 20, gap: 16, backgroundColor: colors.bg, flex: 1 }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

export const QuickActions: StoryObj = {
  render: () => (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <QuickAction
        icon={<Feather name="map-pin" size={18} color={colors.orangeDeep} />}
        label="Mi ruta"
      />
      <QuickAction
        icon={<Feather name="search" size={18} color={colors.brandPrimary} />}
        label="Buscar"
      />
      <QuickAction
        icon={
          <MaterialCommunityIcons
            name="calculator-variant-outline"
            size={18}
            color={colors.brandDeep}
          />
        }
        label="Cuadre"
      />
    </View>
  )
};

export const Progress: StoryObj = {
  render: () => (
    <View style={{ gap: 12 }}>
      <ProgressBar progress={0.72} />
      <ProgressBar progress={0.72} trackColor={colors.brandPrimary} fillColor={colors.white} />
    </View>
  )
};

export const Chips: StoryObj = {
  render: () => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <FilterChip label="Todas · 20" selected />
      <FilterChip label="Pendientes · 12" />
      <FilterChip label="Atrasadas · 4" textColor={colors.orangeDeep} />
      <FilterChip
        label="Vencidos · 1"
        textColor={colors.orangeDeep}
        borderColor="#F2C2A4"
        dotColor={colors.orangeDeep}
      />
      <FilterChip label="Hechas · 8" textColor={colors.brandPrimary} />
    </View>
  )
};

export const Search: StoryObj = {
  render: function SearchStory() {
    const [value, setValue] = useState("");
    return (
      <View style={{ gap: 14 }}>
        <SearchInput
          value={value}
          placeholder="Nombre, teléfono o cédula…"
          onChangeText={setValue}
        />
        <SectionLabel>Búsquedas recientes</SectionLabel>
        <ListTile icon="clock" label="María Rosa" trailingIcon="x" />
        <ListTile icon="clock" label="809-555" trailingIcon="x" />
      </View>
    );
  }
};

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { ClientRow } from "./ClientRow";
import { colors } from "../lib/ui/theme";

const meta: Meta<typeof ClientRow> = {
  title: "Rows/ClientRow",
  component: ClientRow,
  decorators: [
    (Story) => (
      <View style={{ padding: 20, backgroundColor: colors.bg }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

type Story = StoryObj<typeof ClientRow>;

export const Pending: Story = {
  args: {
    avatarKey: "female2",
    name: "María Rosa Peralta",
    business: "Colmado La Rosa · Calle Duarte",
    meta: "Hoy · Calle Duarte 24",
    amount: "RD$2,400"
  }
};

export const Overdue: Story = {
  args: {
    avatarKey: "male2",
    name: "Felipe Taveras",
    business: "Repuestos Taveras · Av. Las Carreras",
    meta: "Venció hace 6 días",
    metaColor: "#A8521F",
    metaBold: true,
    amount: "RD$4,200",
    amountColor: colors.orangeDeep,
    subLabel: "+ mora",
    variant: "overdue"
  }
};

export const Done: Story = {
  args: {
    avatarKey: "male5",
    name: "Pedro Cabrera",
    business: "Pica pollo La Esquina · El Sol",
    meta: "Cobrado · 9:14 AM",
    metaColor: colors.brandPrimary,
    metaBold: true,
    amount: "RD$1,800",
    amountColor: colors.brandPrimary,
    variant: "done"
  }
};

export const CompactSearch: Story = {
  args: {
    avatarKey: "male3",
    name: "José Núñez",
    meta: "En mora · 1 préstamo",
    metaColor: colors.orangeDeep,
    compact: true,
    trailing: <Feather name="chevron-right" size={18} color={colors.slate} />
  }
};

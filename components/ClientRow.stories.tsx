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

// 96×96 base64 JPEG of images/micobro-face-maria-crop.png, the stored photo format.
const SAMPLE_PHOTO =
  "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";

export const Pending: Story = {
  args: {
    avatarKey: "female2",
    name: "María Rosa Peralta",
    business: "Colmado La Rosa · Calle Duarte",
    meta: "Hoy · Calle Duarte 24",
    amount: "RD$2,400"
  }
};

export const WithPhoto: Story = {
  args: {
    photo: SAMPLE_PHOTO,
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

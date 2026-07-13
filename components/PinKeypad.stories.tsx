/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "react-native";
import { PinKeypad } from "./PinKeypad";

const meta: Meta<typeof PinKeypad> = {
  title: "Interactive/PinKeypad",
  component: PinKeypad,
  decorators: [
    (Story) => (
      <View style={{ padding: 20 }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

type Story = StoryObj<typeof PinKeypad>;

export const Default: Story = { args: { onPress: () => {} } };

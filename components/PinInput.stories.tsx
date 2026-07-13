/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "react-native";
import { PinInput } from "./PinInput";

const meta: Meta<typeof PinInput> = {
  title: "Interactive/PinInput",
  component: PinInput,
  decorators: [
    (Story) => (
      <View style={{ padding: 20 }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

type Story = StoryObj<typeof PinInput>;

export const Empty: Story = { args: { length: 4, filled: 0 } };
export const Partial: Story = { args: { length: 4, filled: 2 } };
export const Full: Story = { args: { length: 4, filled: 4 } };
export const Error: Story = { args: { length: 4, filled: 0, error: true } };

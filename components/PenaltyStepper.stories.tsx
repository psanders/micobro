/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "react-native";
import { PenaltyStepper } from "./PenaltyStepper";
import { colors } from "../lib/ui/theme";

const meta: Meta<typeof PenaltyStepper> = {
  title: "Collection/PenaltyStepper",
  component: PenaltyStepper,
  decorators: [
    (Story) => (
      <View style={{ padding: 20, backgroundColor: colors.bg }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

type Story = StoryObj<typeof PenaltyStepper>;

function Live({ initial, max }: { initial: number; max: number }) {
  const [value, setValue] = useState(initial);
  return <PenaltyStepper value={value} max={max} onChange={setValue} />;
}

/** 07p-b: one of two owed penalties. */
export const OneOfTwo: Story = { render: () => <Live initial={1} max={2} /> };

/** Starts at every owed penalty. */
export const AllOwed: Story = { render: () => <Live initial={3} max={3} /> };

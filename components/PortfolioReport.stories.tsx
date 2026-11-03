/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Mi cartera's report body with the figures from the portfolio simulation
 * (openspec/changes/cartera-figures-fix), plus the nothing-late and empty
 * states. Prestado + interés por cobrar always adds up to por cobrar.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "react-native";
import { PortfolioReport } from "./PortfolioReport";
import { colors } from "../lib/ui/theme";
import type { OwnerPosition } from "../lib/reports/position.schema";

const meta: Meta = {
  title: "Screens/MiCartera",
  decorators: [
    (Story) => (
      <View style={{ backgroundColor: colors.bg, flex: 1 }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

const portfolio: OwnerPosition = {
  capitalCents: 73304600,
  receivableCents: 88744800,
  interestCents: 15440200,
  overdue: { cents: 15205600, loanCount: 12, percent: 17 },
  byType: {
    term: { loanCount: 31, outstandingCents: 52345300 },
    openCredit: { loanCount: 12, outstandingCents: 36399500 }
  },
  month: {
    collectedCents: 16255100,
    remainingCents: 14062100,
    expectedCents: 30317200,
    progress: 16255100 / 30317200
  }
};

export const WithLateLoans: StoryObj = {
  render: () => <PortfolioReport position={portfolio} />
};

export const NothingLate: StoryObj = {
  render: () => (
    <PortfolioReport position={{ ...portfolio, overdue: { cents: 0, loanCount: 0, percent: 0 } }} />
  )
};

export const OneLateLoan: StoryObj = {
  render: () => (
    <PortfolioReport
      position={{ ...portfolio, overdue: { cents: 500000, loanCount: 1, percent: 1 } }}
    />
  )
};

export const Empty: StoryObj = {
  render: () => (
    <PortfolioReport
      position={{
        capitalCents: 0,
        receivableCents: 0,
        interestCents: 0,
        overdue: { cents: 0, loanCount: 0, percent: 0 },
        byType: {
          term: { loanCount: 0, outstandingCents: 0 },
          openCredit: { loanCount: 0, outstandingCents: 0 }
        },
        month: { collectedCents: 0, remainingCents: 0, expectedCents: 0, progress: 0 }
      }}
    />
  )
};

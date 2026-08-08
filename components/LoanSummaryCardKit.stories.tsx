/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The Cliente Detalle loan card, both vocabularies: term (cuotas paid) and
 * crédito abierto (capital repaid), plus the clamped-at-0% edge case where
 * capitalized interest has pushed the balance past the original principal.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "react-native";
import { LoanSummaryCard } from "./LoanSummaryCard";
import { colors } from "../lib/ui/theme";
import type { CustomerLoanSummary } from "../lib/repo/types";

const meta: Meta = {
  title: "Kit/Loans",
  decorators: [
    (Story) => (
      <View style={{ padding: 20, gap: 16, backgroundColor: colors.bg, flex: 1 }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const termLoan: CustomerLoanSummary = {
  loanId: "loan-term-1",
  code: "L-00042",
  principalCents: 2880000,
  frequency: "weekly",
  installmentsPaid: 4,
  installmentsTotal: 12,
  nextDueDate: daysFromNow(3),
  nextAmountCents: 240000,
  openCredit: null
};

const openCreditLoan: CustomerLoanSummary = {
  loanId: "loan-open-1",
  code: "L-00099",
  principalCents: 1000000,
  frequency: "weekly",
  installmentsPaid: 0,
  installmentsTotal: 0,
  nextDueDate: new Date(),
  nextAmountCents: 32500,
  openCredit: { interestRateBps: 500, balanceCents: 650000, capitalPaidRatio: 0.35 }
};

const openCreditClampedLoan: CustomerLoanSummary = {
  loanId: "loan-open-2",
  code: "L-00104",
  principalCents: 1000000,
  frequency: "biweekly",
  installmentsPaid: 0,
  installmentsTotal: 0,
  nextDueDate: daysFromNow(6),
  nextAmountCents: 55000,
  // Skipped cycles capitalized their interest, growing the balance past the
  // original principal — capitalPaidRatio clamps to 0, never negative.
  openCredit: { interestRateBps: 500, balanceCents: 1105000, capitalPaidRatio: 0 }
};

export const TermVariant: StoryObj = {
  render: () => <LoanSummaryCard loan={termLoan} onPress={() => {}} />
};

export const OpenCreditVariant: StoryObj = {
  render: () => <LoanSummaryCard loan={openCreditLoan} onPress={() => {}} />
};

export const OpenCreditClamped: StoryObj = {
  render: () => <LoanSummaryCard loan={openCreditClampedLoan} onPress={() => {}} />
};

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Loan correction (edit / archive / restore): the "Más opciones" sheet with
 * Editar available and locked, the "¿Archivar el préstamo?" confirmation in
 * its three variants (no payments, with payments to correct, fully paid),
 * and Cliente Detalle's ARCHIVADOS section collapsed and expanded.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "react-native";
import { LoanOptionsSheet, type LoanOption } from "./LoanOptionsSheet";
import { ArchiveLoanSheet } from "./ArchiveLoanSheet";
import { ArchivedLoansSection } from "./ArchivedLoansSection";
import { colors } from "../lib/ui/theme";
import type { ArchivedLoanSummary } from "../lib/repo/types";

const meta: Meta = {
  title: "Kit/Loan correction",
  decorators: [
    (Story) => (
      <View style={{ padding: 20, backgroundColor: colors.bg, flex: 1 }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

const noop = () => {};

const archiveOption: LoanOption = {
  key: "archive",
  icon: "archive",
  title: "Archivar préstamo",
  subtitle: "Lo saca de tu ruta y de los préstamos activos",
  tone: "amber",
  onPress: noop
};

const editOption: LoanOption = {
  key: "edit",
  icon: "edit-2",
  title: "Editar préstamo",
  subtitle: "Corrige monto, cuotas, tasa o fechas",
  tone: "brand",
  onPress: noop
};

const lockedEditOption: LoanOption = {
  ...editOption,
  subtitle: "No disponible: este préstamo ya tiene pagos. Archívalo y crea uno corregido.",
  disabled: true
};

const restoreOption: LoanOption = {
  key: "restore",
  icon: "rotate-ccw",
  title: "Restaurar préstamo",
  subtitle: "Vuelve a tu ruta y a los préstamos activos",
  tone: "brand",
  onPress: noop
};

export const OptionsEditAvailable: StoryObj = {
  render: () => (
    <LoanOptionsSheet
      visible
      title="Préstamo #L-00042"
      subtitle="María Rosa Peralta"
      options={[editOption, archiveOption]}
      onClose={noop}
    />
  )
};

export const OptionsEditLocked: StoryObj = {
  render: () => (
    <LoanOptionsSheet
      visible
      title="Préstamo #L-00042"
      subtitle="María Rosa Peralta"
      options={[lockedEditOption, archiveOption]}
      onClose={noop}
    />
  )
};

export const OptionsArchivedRestore: StoryObj = {
  render: () => (
    <LoanOptionsSheet
      visible
      title="Préstamo #L-00042"
      subtitle="Archivado"
      options={[restoreOption]}
      onClose={noop}
    />
  )
};

export const ArchiveWithoutPayments: StoryObj = {
  render: () => (
    <ArchiveLoanSheet
      visible
      loanCode="L-00042"
      customerName="María Rosa Peralta"
      paymentCount={0}
      collectedCents={0}
      offerCorrected={false}
      busy={false}
      onArchive={noop}
      onArchiveAndCreate={noop}
      onClose={noop}
    />
  )
};

export const ArchiveWithPaymentsOfferCorrected: StoryObj = {
  render: () => (
    <ArchiveLoanSheet
      visible
      loanCode="L-00042"
      customerName="María Rosa Peralta"
      paymentCount={3}
      collectedCents={165900}
      offerCorrected
      busy={false}
      onArchive={noop}
      onArchiveAndCreate={noop}
      onClose={noop}
    />
  )
};

export const ArchivePaidOff: StoryObj = {
  render: () => (
    <ArchiveLoanSheet
      visible
      loanCode="L-00042"
      customerName="María Rosa Peralta"
      paymentCount={12}
      collectedCents={3200000}
      offerCorrected={false}
      busy={false}
      onArchive={noop}
      onArchiveAndCreate={noop}
      onClose={noop}
    />
  )
};

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const archivedLoans: ArchivedLoanSummary[] = [
  {
    loanId: "loan-a",
    code: "L-00031",
    principalCents: 1000000,
    frequency: "weekly",
    paymentCount: 3,
    collectedCents: 165900,
    archivedAt: daysAgo(4)
  },
  {
    loanId: "loan-b",
    code: "L-00027",
    principalCents: 500000,
    frequency: "monthly",
    paymentCount: 0,
    collectedCents: 0,
    archivedAt: daysAgo(30)
  }
];

export const ArchivedSectionCollapsed: StoryObj = {
  render: () => <ArchivedLoansSection loans={archivedLoans} onOpen={noop} />
};

export const ArchivedSectionExpanded: StoryObj = {
  render: () => <ArchivedLoansSection loans={archivedLoans} onOpen={noop} initiallyExpanded />
};

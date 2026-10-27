/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Full two-way sync review UI — held Sheet deletions, unreadable rows, and
 * the Copias de seguridad list. Built without a Pencil frame (task 7.1 is
 * still owed); review here first.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "react-native";
import { HeldDeletionsCard, SyncProblemsCard } from "./SyncReviewCards";
import { BackupList } from "./BackupList";
import { colors } from "../lib/ui/theme";
import type { Backup } from "../lib/backups";

const meta: Meta = {
  title: "Kit/SyncReview",
  decorators: [
    (Story) => (
      <View style={{ padding: 20, gap: 16, backgroundColor: colors.bg, flex: 1 }}>
        <Story />
      </View>
    )
  ]
};

export default meta;

const noop = () => {};

export const HeldDeletions: StoryObj = {
  render: () => (
    <HeldDeletionsCard
      counts={{ total: 12, byEntity: { customer: 4, loan: 4, payment: 3, visit: 1 } }}
      onApply={noop}
      onRestore={noop}
    />
  )
};

export const HeldDeletionsBusy: StoryObj = {
  render: () => (
    <HeldDeletionsCard
      counts={{ total: 12, byEntity: { customer: 4, loan: 4, payment: 4, visit: 0 } }}
      busy
      onApply={noop}
      onRestore={noop}
    />
  )
};

export const BrokenRows: StoryObj = {
  render: () => (
    <SyncProblemsCard
      problems={[
        { entity: "payment", sheetRow: 3, reason: "el ID se repite (también en la fila 2)" },
        { entity: "payment", sheetRow: 9, reason: "el monto no es un número entero" },
        { entity: "loan", sheetRow: 1, reason: 'la columna 6 debería llamarse "Frecuencia"' }
      ]}
    />
  )
};

const DAY = 24 * 60 * 60 * 1000;
const backups: Backup[] = [0, 1, 3].map((daysAgo) => ({
  name: `micobro-backup-${daysAgo}.db`,
  createdAt: new Date(Date.UTC(2026, 9, 27, 14, 42) - daysAgo * DAY),
  customers: 24 - daysAgo,
  loans: 31 - daysAgo,
  payments: 412 - daysAgo * 9
}));

export const Backups: StoryObj = {
  render: () => <BackupList backups={backups} onSelect={noop} />
};

export const BackupsEmpty: StoryObj = {
  render: () => <BackupList backups={[]} onSelect={noop} />
};

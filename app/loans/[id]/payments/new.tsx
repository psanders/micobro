/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useLocalSearchParams } from "expo-router";
import { RecordPaymentScreen } from "../../../../components/screens/RecordPaymentScreen";

export default function NewPaymentRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecordPaymentScreen loanId={id} />;
}

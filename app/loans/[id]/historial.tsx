/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useLocalSearchParams } from "expo-router";
import { PaymentHistoryScreen } from "../../../components/screens/PaymentHistoryScreen";

export default function HistorialRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PaymentHistoryScreen loanId={id} />;
}

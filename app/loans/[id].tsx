/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useLocalSearchParams } from "expo-router";
import { LoanDetailScreen } from "../../components/screens/LoanDetailScreen";

export default function LoanDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LoanDetailScreen loanId={id} />;
}

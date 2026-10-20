/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useLocalSearchParams } from "expo-router";
import { NewLoanFormScreen } from "../../components/screens/NewLoanFormScreen";

export default function NewLoanRoute() {
  const { customerId, fromLoanId } = useLocalSearchParams<{
    customerId?: string;
    fromLoanId?: string;
  }>();
  return <NewLoanFormScreen customerId={customerId} fromLoanId={fromLoanId} />;
}

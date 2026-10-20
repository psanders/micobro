/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useLocalSearchParams } from "expo-router";
import { NewLoanFormScreen } from "../../../components/screens/NewLoanFormScreen";

export default function EditLoanRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <NewLoanFormScreen editLoanId={id} />;
}

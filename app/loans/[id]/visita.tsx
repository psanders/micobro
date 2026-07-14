/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useLocalSearchParams } from "expo-router";
import { VisitOutcomeScreen } from "../../../components/screens/VisitOutcomeScreen";

export default function VisitaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <VisitOutcomeScreen loanId={id} />;
}

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useLocalSearchParams } from "expo-router";
import { CollectPaymentScreen } from "../../../components/screens/CollectPaymentScreen";

export default function CobrarRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CollectPaymentScreen loanId={id} />;
}

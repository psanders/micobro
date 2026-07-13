/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useLocalSearchParams } from "expo-router";
import { CustomerDetailScreen } from "../../components/screens/CustomerDetailScreen";

export default function CustomerDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CustomerDetailScreen customerId={id} />;
}

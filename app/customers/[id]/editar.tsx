/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useLocalSearchParams } from "expo-router";
import { EditCustomerFormScreen } from "../../../components/screens/EditCustomerFormScreen";

export default function EditCustomerRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditCustomerFormScreen customerId={id} />;
}

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useLocalSearchParams } from "expo-router";
import { PaymentReceiptScreen } from "../../components/screens/PaymentReceiptScreen";

export default function PagoHistoricoRoute() {
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  return <PaymentReceiptScreen paymentId={paymentId} />;
}

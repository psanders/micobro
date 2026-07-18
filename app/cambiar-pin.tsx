/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useRouter } from "expo-router";
import { ChangePinScreen } from "../components/screens/ChangePinScreen";

export default function CambiarPinScreen() {
  const router = useRouter();

  return <ChangePinScreen onDone={() => router.back()} />;
}

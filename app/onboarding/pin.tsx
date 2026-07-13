/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useRouter } from "expo-router";
import { PinSetupScreen } from "../../components/screens/PinSetupScreen";

export default function SetPinScreen() {
  const router = useRouter();

  return <PinSetupScreen onDone={() => router.push("/onboarding/sync")} />;
}

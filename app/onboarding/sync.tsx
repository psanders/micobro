/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { ConnectGoogleScreen } from "../../components/screens/ConnectGoogleScreen";
import { useAuthGate } from "../../lib/security/AuthGateProvider";

export default function OnboardingSyncScreen() {
  const { completeOnboarding } = useAuthGate();

  return <ConnectGoogleScreen onDone={() => completeOnboarding()} />;
}

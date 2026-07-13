/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { UnlockScreen } from "../components/screens/UnlockScreen";
import { useAuthGate } from "../lib/security/AuthGateProvider";

export default function DesbloquearScreen() {
  const { unlock } = useAuthGate();

  return <UnlockScreen onUnlocked={() => unlock()} />;
}

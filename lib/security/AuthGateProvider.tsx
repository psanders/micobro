/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Drives which Stack.Protected group app/_layout.tsx renders:
 * onboarding (no PIN set yet) -> desbloquear (PIN set, locked this session)
 * -> the main app (unlocked). Google Sign-In is a separate, optional concern
 * (lib/repo SyncRepo) — this provider only ever gates on the local PIN.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { isOnboardingComplete, setOnboardingComplete } from "./onboarding";

interface AuthGateValue {
  ready: boolean;
  onboardingComplete: boolean;
  unlocked: boolean;
  completeOnboarding: () => Promise<void>;
  unlock: () => void;
  lock: () => void;
  /** Back to a fresh install: onboarding (create PIN) next. Used after erasing the device data. */
  reset: () => void;
}

const AuthGateContext = createContext<AuthGateValue | null>(null);

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [onboardingComplete, setOnboardingCompleteState] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    isOnboardingComplete().then((complete) => {
      setOnboardingCompleteState(complete);
      setReady(true);
    });
  }, []);

  const value: AuthGateValue = {
    ready,
    onboardingComplete,
    unlocked,
    completeOnboarding: async () => {
      await setOnboardingComplete();
      setOnboardingCompleteState(true);
      setUnlocked(true);
    },
    unlock: () => setUnlocked(true),
    lock: () => setUnlocked(false),
    reset: () => {
      setUnlocked(false);
      setOnboardingCompleteState(false);
    }
  };

  return <AuthGateContext.Provider value={value}>{children}</AuthGateContext.Provider>;
}

export function useAuthGate(): AuthGateValue {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error("useAuthGate must be used within an AuthGateProvider");
  return ctx;
}

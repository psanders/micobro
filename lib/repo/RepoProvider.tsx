/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { createContext, useContext, type ReactNode } from "react";
import type { Repos } from "./types";

const RepoContext = createContext<Repos | null>(null);

export function RepoProvider({ repos, children }: { repos: Repos; children: ReactNode }) {
  return <RepoContext.Provider value={repos}>{children}</RepoContext.Provider>;
}

function useRepos(): Repos {
  const ctx = useContext(RepoContext);
  if (!ctx) throw new Error("useRepos must be used within a RepoProvider");
  return ctx;
}

export const useCustomerRepo = () => useRepos().customers;
export const useLoanRepo = () => useRepos().loans;
export const usePaymentRepo = () => useRepos().payments;
export const useSyncRepo = () => useRepos().sync;
export const useProfileRepo = () => useRepos().profile;
export const useRouteRepo = () => useRepos().route;
export const useVisitRepo = () => useRepos().visits;
export const useFeedbackRepo = () => useRepos().feedback;

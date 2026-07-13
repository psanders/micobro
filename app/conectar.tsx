/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useRouter } from "expo-router";
import { ConnectGoogleScreen } from "../components/screens/ConnectGoogleScreen";

export default function ConectarScreen() {
  const router = useRouter();

  return <ConnectGoogleScreen onDone={() => router.back()} />;
}

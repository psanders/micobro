/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useRouter } from "expo-router";
import { BluetoothPermissionScreen } from "../components/screens/BluetoothPermissionScreen";

export default function PermisoImpresionScreen() {
  const router = useRouter();

  return <BluetoothPermissionScreen onClose={() => router.back()} />;
}

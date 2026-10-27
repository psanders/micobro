/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { RestoreBackupScreen } from "../components/screens/RestoreBackupScreen";

export default function RestaurarCopiaRoute() {
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  return (
    <RestoreBackupScreen
      name={name ?? ""}
      onCancel={() => router.back()}
      onRestored={() => router.dismissTo("/sincronizar")}
    />
  );
}

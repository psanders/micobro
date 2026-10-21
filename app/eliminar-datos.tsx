/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useRouter } from "expo-router";
import { EraseDataScreen } from "../components/screens/EraseDataScreen";

export default function EliminarDatosRoute() {
  const router = useRouter();

  return <EraseDataScreen onCancel={() => router.back()} />;
}

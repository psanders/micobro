/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useRouter } from "expo-router";
import { ConnectGoogleScreen } from "../components/screens/ConnectGoogleScreen";

export default function ConectarScreen() {
  const router = useRouter();

  return (
    <ConnectGoogleScreen
      title="Conectar con Google"
      subtitle="Respalda tus clientes y préstamos en una hoja de cálculo de Google Sheets. Tus datos siguen viviendo primero en este teléfono."
      skipLabel="Ahora no"
      onDone={() => router.back()}
    />
  );
}

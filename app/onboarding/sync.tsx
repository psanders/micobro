/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { View } from "react-native";
import { ConnectGoogleScreen } from "../../components/screens/ConnectGoogleScreen";
import { useAuthGate } from "../../lib/security/AuthGateProvider";

export default function OnboardingSyncScreen() {
  const { completeOnboarding } = useAuthGate();

  return (
    <View style={{ flex: 1 }}>
      <ConnectGoogleScreen
        title="Guarda un respaldo en la nube"
        subtitle="Puedes conectar tu cuenta de Google para respaldar tus clientes y préstamos en una hoja de cálculo. Es opcional: tus datos siempre viven primero en este teléfono, y puedes conectar o desconectar cuando quieras desde Ajustes."
        skipLabel="Ahora no, tal vez después"
        onDone={() => completeOnboarding()}
      />
    </View>
  );
}

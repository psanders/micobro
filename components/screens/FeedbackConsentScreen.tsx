/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 11a Enviar feedback · Consentimiento per pencil.pen `v8bmyV`.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFeedback } from "../../lib/feedback/FeedbackContext";
import { ScreenHeader } from "../ScreenHeader";
import { colors, fonts } from "../../lib/ui/theme";

export function FeedbackConsentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { startRecording } = useFeedback();

  const handleStart = async () => {
    await startRecording();
    router.back();
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="Enviar feedback" backIcon="close" onBack={() => router.back()} />

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Feather name="message-square" size={28} color={colors.brandDeep} />
        </View>
        <Text style={styles.consentBody}>
          Esto va a grabar tu pantalla mientras muestras lo que quieres compartir — un problema,
          algo confuso o una idea. La grabación se usa solo para crear el reporte y no se guarda de
          forma permanente. Evita mostrar datos sensibles de clientes si es posible.
        </Text>
      </View>

      <View style={[styles.actionBar, { paddingBottom: 14 + insets.bottom }]}>
        <Pressable style={styles.startBtn} onPress={handleStart}>
          <Feather name="circle" size={16} color={colors.white} />
          <Text style={styles.startBtnText}>Empezar a grabar</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.cancelLink}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    paddingHorizontal: 24
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center"
  },
  consentBody: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: "#5B6472",
    textAlign: "center",
    lineHeight: 21
  },
  actionBar: {
    backgroundColor: colors.white,
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.actionBarBorder
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandDeep,
    borderRadius: 12,
    padding: 14
  },
  startBtnText: { fontSize: 15, fontFamily: fonts.bold, color: colors.white },
  cancelLink: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.slate, textAlign: "center" }
});

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 11c/11d/11e Enviar feedback · Enviando/Enviado/Error per pencil.pen
 * (`rv2oJ`/`fsDNM`/`oTSL4`): a full-screen modal covering the
 * processing/result/error stages, mounted globally alongside the
 * recording pill so it appears the instant the stage changes regardless
 * of which screen is on top.
 */
import { View, Text, Pressable, ActivityIndicator, Modal, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFeedback } from "../../lib/feedback/FeedbackContext";
import { colors, fonts } from "../../lib/ui/theme";

export function FeedbackStatusModal() {
  const insets = useSafeAreaInsets();
  const { stage, errorMessage, retrySubmit, reset } = useFeedback();

  const visible = stage === "processing" || stage === "result" || stage === "error";
  if (!visible) return null;

  return (
    <Modal visible transparent={false} animationType="slide">
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {stage === "processing"
              ? "Enviando feedback…"
              : stage === "result"
                ? "Feedback enviado"
                : "No se pudo enviar"}
          </Text>
        </View>

        <View style={styles.body}>
          <View
            style={[
              styles.iconWrap,
              stage === "result" && styles.iconWrapOk,
              stage === "error" && styles.iconWrapError
            ]}
          >
            {stage === "processing" ? (
              <ActivityIndicator color={colors.brandDeep} />
            ) : (
              <Feather
                name={stage === "result" ? "check" : "alert-triangle"}
                size={28}
                color={stage === "result" ? "#0E7C5F" : colors.red}
              />
            )}
          </View>
          <Text style={[styles.bodyText, stage === "error" && styles.bodyTextError]}>
            {stage === "processing"
              ? "Enviando tu feedback al equipo. Esto puede tardar un momento."
              : stage === "result"
                ? "Gracias por tu feedback. Nuestro equipo lo va a revisar y priorizar."
                : (errorMessage ?? "No se pudo enviar el feedback.")}
          </Text>
        </View>

        {stage === "result" ? (
          <View style={styles.actionBar}>
            <Pressable style={styles.primaryBtn} onPress={reset}>
              <Text style={styles.primaryBtnText}>Cerrar</Text>
            </Pressable>
          </View>
        ) : null}

        {stage === "error" ? (
          <View style={styles.actionBar}>
            <Pressable style={styles.primaryBtn} onPress={retrySubmit}>
              <Feather name="rotate-cw" size={16} color={colors.white} />
              <Text style={styles.primaryBtnText}>Intentar de nuevo</Text>
            </Pressable>
            <Pressable onPress={reset} hitSlop={8}>
              <Text style={styles.closeLink}>Cerrar</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingVertical: 14 },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.brandDeep },
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
  iconWrapOk: { backgroundColor: "#D6F3E5" },
  iconWrapError: { backgroundColor: "#FDE2E2" },
  bodyText: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: "#5B6472",
    textAlign: "center",
    lineHeight: 21
  },
  bodyTextError: { color: colors.red },
  actionBar: {
    backgroundColor: colors.white,
    gap: 10,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.actionBarBorder
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandDeep,
    borderRadius: 12,
    padding: 14
  },
  primaryBtnText: { fontSize: 15, fontFamily: fonts.bold, color: colors.white },
  closeLink: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.slate, textAlign: "center" }
});

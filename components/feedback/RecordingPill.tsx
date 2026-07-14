/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 11b Enviar feedback · Grabando per pencil.pen `OWGz8`: a floating pill
 * shown over whatever screen the user navigates to while recording. A
 * plain absolutely-positioned View, not a `Modal` — mikro's own
 * RecordingPill avoids `Modal` here deliberately (an iOS touch-blocking
 * bug), and matching that shape costs nothing on Android either.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFeedback } from "../../lib/feedback/FeedbackContext";
import { colors, fonts } from "../../lib/ui/theme";

export function RecordingPill() {
  const insets = useSafeAreaInsets();
  const { stage, stopRecording, discardRecording } = useFeedback();

  if (stage !== "recording") return null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View style={[styles.pill, { bottom: 24 + insets.bottom }]}>
        <View style={styles.left}>
          <View style={styles.dot} />
          <Text style={styles.label}>Grabando feedback…</Text>
        </View>
        <View style={styles.actions}>
          <Pressable hitSlop={10} onPress={discardRecording}>
            <Feather name="trash-2" size={18} color="#F2B8B8" />
          </Pressable>
          <Pressable hitSlop={10} onPress={stopRecording}>
            <Feather name="square" size={18} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.ink,
    borderRadius: 26,
    paddingVertical: 10,
    paddingLeft: 18,
    paddingRight: 10,
    gap: 10
  },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red },
  label: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.white },
  actions: { flexDirection: "row", alignItems: "center", gap: 14 }
});

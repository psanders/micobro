/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * m/progress-bar from pencil.pen.
 */
import { View, StyleSheet } from "react-native";
import { colors } from "../lib/ui/theme";

interface ProgressBarProps {
  /** 0..1, clamped. */
  progress: number;
  trackColor?: string;
  fillColor?: string;
}

export function ProgressBar({ progress, trackColor, fillColor }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  return (
    <View style={[styles.track, trackColor ? { backgroundColor: trackColor } : null]}>
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%` },
          fillColor ? { backgroundColor: fillColor } : null
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.mist,
    overflow: "hidden",
    alignSelf: "stretch"
  },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary }
});

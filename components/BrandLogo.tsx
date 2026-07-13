/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The micobro logo lockup from pencil.pen (`component/logo`): rounded-square
 * mark with the slightly rotated "m" plus the wordmark. Sizes default to the
 * auth-screen variant (40px mark / 28px word).
 */
import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../lib/ui/theme";

interface BrandLogoProps {
  markSize?: number;
  wordSize?: number;
}

export function BrandLogo({ markSize = 40, wordSize = 28 }: BrandLogoProps) {
  return (
    <View style={styles.row}>
      <View
        style={[styles.mark, { width: markSize, height: markSize, borderRadius: markSize * 0.25 }]}
      >
        <Text style={[styles.markM, { fontSize: markSize * 0.6, lineHeight: markSize * 0.6 }]}>
          m
        </Text>
      </View>
      <Text style={[styles.word, { fontSize: wordSize }]}>micobro</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  mark: {
    backgroundColor: colors.brandDeep,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 4
  },
  markM: {
    fontFamily: fonts.bold,
    color: colors.white,
    transform: [{ rotate: "-0.27deg" }]
  },
  word: { fontFamily: fonts.bold, color: colors.brandDeep, letterSpacing: -0.5 }
});

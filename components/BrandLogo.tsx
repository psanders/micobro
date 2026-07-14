/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The micobro logo lockup from pencil.pen (`component/logo`): rounded-square
 * mark with the slightly rotated "m" plus the wordmark, set in Sora
 * ($font-logo — the brand typeface, distinct from the Plus Jakarta Sans
 * body font). Sizes default to the auth-screen variant (40px mark / 28px
 * word). No extra padding on the mark box — Sora's "m" centers correctly
 * under plain `justifyContent: "center"` (the old Plus-Jakarta-Sans-tuned
 * bottom-padding offset sat the glyph too low once the font changed; fixed
 * in pencil.pen across every logo instance and mirrored here).
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
    justifyContent: "center"
  },
  markM: {
    fontFamily: fonts.logo,
    color: colors.white,
    transform: [{ rotate: "-0.27deg" }]
  },
  word: { fontFamily: fonts.logo, color: colors.brandDeep, letterSpacing: -0.5 }
});

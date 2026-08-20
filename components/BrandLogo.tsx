/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The micobro logo lockup from pencil.pen (`component/logo`): rounded-square
 * mark with the slightly rotated "m" plus the wordmark, set in Sora
 * ($font-logo — the brand typeface, distinct from the Plus Jakarta Sans
 * body font). Sizes default to the auth-screen variant (40px mark / 28px
 * word). `includeFontPadding`/`textAlignVertical` only center Sora vertically
 * on Android — iOS ignores both, and Sora's ascent/descent are asymmetric
 * enough that plain `justifyContent: "center"` sits the glyph noticeably
 * above center there, so iOS gets an explicit translateY nudge — applied to
 * both the mark and the word by the same fontSize ratio, so the two stay
 * aligned with each other rather than just the mark being re-centered on
 * its own.
 */
import { View, Text, StyleSheet, Platform } from "react-native";
import { colors, fonts } from "../lib/ui/theme";

interface BrandLogoProps {
  markSize?: number;
  wordSize?: number;
}

function iosGlyphNudge(fontSize: number): number {
  return Platform.OS === "ios" ? fontSize * 0.055 : 0;
}

export function BrandLogo({ markSize = 40, wordSize = 28 }: BrandLogoProps) {
  const markFontSize = markSize * 0.6;
  const markNudge = iosGlyphNudge(markFontSize);
  const wordNudge = iosGlyphNudge(wordSize);
  return (
    <View style={styles.row}>
      <View
        style={[styles.mark, { width: markSize, height: markSize, borderRadius: markSize * 0.25 }]}
      >
        <Text
          style={[
            styles.markM,
            { fontSize: markFontSize, lineHeight: markFontSize },
            { transform: [{ rotate: "-0.27deg" }, { translateY: markNudge }] }
          ]}
        >
          m
        </Text>
      </View>
      <Text
        style={[
          styles.word,
          { fontSize: wordSize, lineHeight: wordSize },
          wordNudge ? { transform: [{ translateY: wordNudge }] } : null
        ]}
      >
        micobro
      </Text>
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
  word: {
    fontFamily: fonts.logo,
    color: colors.brandDeep,
    letterSpacing: -0.5,
    includeFontPadding: false,
    textAlignVertical: "center"
  }
});

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * m/section-label from pencil.pen: small tracked uppercase heading.
 */
import { Text, StyleSheet } from "react-native";
import { colors, fonts } from "../lib/ui/theme";

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  label: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: colors.slate,
    letterSpacing: 1.5
  }
});

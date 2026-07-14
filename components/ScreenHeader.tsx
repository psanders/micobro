/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * m/header from pencil.pen: back/close button, title (+ optional
 * subtitle), optional right slot. Screens own their headers, so the
 * expo-router header is hidden on routes that use this.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { ReactNode } from "react";
import { Feather } from "@expo/vector-icons";
import { colors, fonts } from "../lib/ui/theme";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  backIcon?: "back" | "close";
  onBack: () => void;
  right?: ReactNode;
}

export function ScreenHeader({
  title,
  subtitle,
  backIcon = "back",
  onBack,
  right
}: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <Pressable onPress={onBack} hitSlop={10}>
          <Feather
            name={backIcon === "close" ? "x" : "chevron-left"}
            size={24}
            color={colors.brandDeep}
          />
        </Pressable>
        <View>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 20
  },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 18, fontFamily: fonts.bold, color: colors.brandDeep },
  subtitle: { fontSize: 12, fontFamily: fonts.medium, color: colors.slate, marginTop: 2 }
});

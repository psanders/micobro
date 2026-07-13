/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * m/client-row from pencil.pen: avatar, name/business/meta column, trailing
 * amount + sub-label (or chevron in compact search rows). The done variant
 * gets the green treatment, overdue gets the warm border.
 */
import type { ReactNode } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Avatar } from "./Avatar";
import { colors, fonts } from "../lib/ui/theme";

interface ClientRowProps {
  avatarKey?: string | null;
  name: string;
  business?: string | null;
  meta: string;
  metaColor?: string;
  metaBold?: boolean;
  amount?: string;
  amountColor?: string;
  subLabel?: string;
  subLabelColor?: string;
  variant?: "default" | "done" | "overdue";
  compact?: boolean;
  trailing?: ReactNode;
  onPress?: () => void;
}

export function ClientRow({
  avatarKey,
  name,
  business,
  meta,
  metaColor,
  metaBold,
  amount,
  amountColor,
  subLabel,
  subLabelColor,
  variant = "default",
  compact,
  trailing,
  onPress
}: ClientRowProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        compact && styles.rowCompact,
        variant === "done" && styles.rowDone,
        variant === "overdue" && styles.rowOverdue,
        pressed && onPress ? { opacity: 0.7 } : null
      ]}
    >
      <Avatar avatarKey={avatarKey} name={name} size={compact ? 36 : 42} />
      <View style={styles.mid}>
        <Text style={styles.name}>{name}</Text>
        {business ? <Text style={styles.business}>{business}</Text> : null}
        <Text
          style={[
            styles.meta,
            metaColor ? { color: metaColor } : null,
            metaBold ? { fontFamily: fonts.semiBold } : null
          ]}
        >
          {meta}
        </Text>
      </View>
      {trailing ?? (
        <View style={styles.trail}>
          {amount ? (
            <Text style={[styles.amount, amountColor ? { color: amountColor } : null]}>
              {amount}
            </Text>
          ) : null}
          {subLabel ? (
            <Text style={[styles.subLabel, subLabelColor ? { color: subLabelColor } : null]}>
              {subLabel}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14
  },
  rowCompact: { borderRadius: 12, padding: 12 },
  rowDone: { backgroundColor: colors.mist },
  rowOverdue: { borderWidth: 1, borderColor: "#F2C2A4" },
  mid: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.ink },
  business: { fontSize: 11, fontFamily: fonts.bold, color: colors.brandDeep },
  meta: { fontSize: 12, fontFamily: fonts.medium, color: colors.slate },
  trail: { alignItems: "flex-end", gap: 2 },
  amount: { fontSize: 14, fontFamily: fonts.bold, color: colors.brandDeep },
  subLabel: { fontSize: 10, fontFamily: fonts.semiBold, color: colors.orangeDeep }
});

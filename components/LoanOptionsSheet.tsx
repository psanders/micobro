/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Préstamo Detalle's "Más opciones" sheet per pencil.pen `ixpVF`/`qV9lE`:
 * a bottom sheet listing loan actions. A disabled option stays visible
 * with a lock and its reason, so the lender learns why (and what to do
 * instead) rather than wondering where the action went.
 */
import type { ComponentProps } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Icon } from "./Icon";
import { colors, fonts, radius } from "../lib/ui/theme";

export interface LoanOption {
  key: string;
  icon: ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle: string;
  tone: "brand" | "amber";
  /** Shown greyed with a lock; `subtitle` should carry the reason. */
  disabled?: boolean;
  onPress: () => void;
}

interface LoanOptionsSheetProps {
  visible: boolean;
  title: string;
  subtitle: string;
  options: LoanOption[];
  onClose: () => void;
}

export function LoanOptionsSheet({
  visible,
  title,
  subtitle,
  options,
  onClose
}: LoanOptionsSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.head}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {options.map((option) => (
          <Pressable
            key={option.key}
            testID={`loan-option-${option.key}`}
            style={styles.row}
            disabled={option.disabled}
            accessibilityState={{ disabled: !!option.disabled }}
            onPress={option.onPress}
          >
            <View
              style={[
                styles.iconWrap,
                option.disabled
                  ? styles.iconWrapDisabled
                  : option.tone === "amber"
                    ? styles.iconWrapAmber
                    : styles.iconWrapBrand
              ]}
            >
              <Icon
                name={option.disabled ? "lock" : option.icon}
                size={18}
                color={
                  option.disabled
                    ? colors.slate
                    : option.tone === "amber"
                      ? colors.amber
                      : colors.brandDeep
                }
              />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, option.disabled && styles.rowTitleDisabled]}>
                {option.title}
              </Text>
              <Text style={styles.rowSubtitle}>{option.subtitle}</Text>
            </View>
            {!option.disabled && <Icon name="chevron-right" size={18} color={colors.slate} />}
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(20, 37, 74, 0.4)" },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 30,
    gap: 6
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline,
    marginBottom: 8
  },
  head: { gap: 2, paddingBottom: 10 },
  title: { fontSize: 16, fontFamily: fonts.bold, color: colors.ink },
  subtitle: { fontSize: 12, fontFamily: fonts.medium, color: colors.muted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  iconWrapBrand: { backgroundColor: colors.mist },
  iconWrapAmber: { backgroundColor: colors.amberBg },
  iconWrapDisabled: { backgroundColor: colors.subtle },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontFamily: fonts.bold, color: colors.ink },
  rowTitleDisabled: { color: colors.slate },
  rowSubtitle: { fontSize: 12, fontFamily: fonts.medium, color: colors.muted, lineHeight: 16 }
});

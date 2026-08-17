/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * A reusable "select" — an input-styled pressable row (matching the app's
 * text-input fields) that opens a modal list of options and reports the
 * pick via `onChange`. The app previously faked selects with a chip row;
 * this is the first real dropdown, per the pencil.pen designs' "Tipo de
 * préstamo" / "Frecuencia de pago" fields. The option list reuses
 * `OptionRow` (radio + label), the same building block CollectPaymentScreen
 * uses for its own picker list; the bottom-sheet modal shape follows
 * FeedbackStatusModal / EditProfileScreen's picker conventions.
 */
import { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from "react-native";
import { Icon } from "./Icon";
import { OptionRow } from "./OptionRow";
import { colors } from "../lib/ui/theme";

export interface SelectFieldOption<T> {
  value: T;
  label: string;
}

interface SelectFieldProps<T> {
  label: string;
  value: T;
  options: SelectFieldOption<T>[];
  onChange: (value: T) => void;
}

export function SelectField<T>({ label, value, options, onChange }: SelectFieldProps<T>) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  function handlePick(option: SelectFieldOption<T>) {
    onChange(option.value);
    setOpen(false);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={styles.inputText}>{selectedOption?.label ?? "Seleccionar"}</Text>
        <Icon name="chevron-down" size={18} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* accessible={false} on both this and the nested sheet Pressable:
         * without it, iOS treats the nearest accessible=true ancestor (this
         * one, by default) as one opaque VoiceOver element and merges the
         * title and every OptionRow's label into a single unreadable
         * string, making individual options unreachable. Neither Pressable
         * needs to itself be a VoiceOver-focusable unit — they only exist
         * to stop the backdrop's close-on-tap from bubbling up. */}
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessible={false}>
          <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <ScrollView contentContainerStyle={styles.optionsList}>
              {options.map((option) => (
                <OptionRow
                  key={String(option.value)}
                  label={option.label}
                  selected={option.value === value}
                  onPress={() => handlePick(option)}
                />
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white
  },
  inputText: { fontSize: 15, color: colors.ink, fontWeight: "600" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 42, 38, 0.45)",
    justifyContent: "flex-end"
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    maxHeight: "70%"
  },
  sheetTitle: { fontSize: 15, fontWeight: "700", color: colors.ink, marginBottom: 12 },
  optionsList: { gap: 8 }
});

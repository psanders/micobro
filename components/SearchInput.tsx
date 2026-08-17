/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * m/input (search variant) from pencil.pen: mist box, leading icon, value.
 */
import { View, TextInput, StyleSheet } from "react-native";
import { Icon } from "./Icon";
import { colors, fonts } from "../lib/ui/theme";

interface SearchInputProps {
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
}

export function SearchInput({ value, placeholder, onChangeText, onSubmit }: SearchInputProps) {
  return (
    <View style={styles.box}>
      <Icon name="search" size={18} color={colors.brandPrimary} />
      <TextInput
        style={styles.input}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={colors.slate}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.mist,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 16
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.ink,
    paddingVertical: 10
  }
});

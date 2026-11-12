/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * "Penalidades a cobrar" stepper from app.pen `07p-b`: shown under the
 * selected "Cobrar penalidad" row of a Tradicional Plus loan owing two or
 * more penalties, from 1 to every owed one. The − and + buttons are 44×44
 * targets and disable themselves at the ends.
 */
import { View, Text, Pressable, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors, fonts } from "../lib/ui/theme";

interface PenaltyStepperProps {
  value: number;
  max: number;
  onChange: (next: number) => void;
}

export function PenaltyStepper({ value, max, onChange }: PenaltyStepperProps) {
  const canRemove = value > 1;
  const canAdd = value < max;
  return (
    <View
      style={styles.card}
      accessibilityRole="adjustable"
      accessibilityLabel="Cantidad de penalidades"
      accessibilityValue={{ text: `${value} de ${max} penalidades` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment" && canAdd) onChange(value + 1);
        if (event.nativeEvent.actionName === "decrement" && canRemove) onChange(value - 1);
      }}
      testID="penalty-stepper"
    >
      <Text style={styles.label}>Penalidades a cobrar</Text>
      <View style={styles.row}>
        <StepButton
          icon="minus"
          label="Quitar una penalidad"
          disabled={!canRemove}
          onPress={() => onChange(value - 1)}
        />
        <View style={styles.valueRow}>
          <Text style={styles.value} testID="penalty-stepper-value">
            {value}
          </Text>
          <Text style={styles.of}>de {max}</Text>
        </View>
        <StepButton
          icon="plus"
          label="Agregar una penalidad"
          disabled={!canAdd}
          onPress={() => onChange(value + 1)}
        />
      </View>
    </View>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress
}: {
  icon: "minus" | "plus";
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.button, disabled && styles.buttonDisabled]}
    >
      <MaterialCommunityIcons
        name={icon}
        size={20}
        color={disabled ? colors.slate : colors.brandDeep}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8
  },
  label: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.slate },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  valueRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  value: { fontSize: 22, fontFamily: fonts.bold, color: colors.ink },
  of: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.slate, marginBottom: 2 },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.mist,
    borderWidth: 1,
    borderColor: colors.brandDeep
  },
  buttonDisabled: { opacity: 0.45, backgroundColor: colors.subtle, borderColor: colors.border }
});

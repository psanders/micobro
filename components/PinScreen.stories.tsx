/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import type { Meta, StoryObj } from "@storybook/react-native";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { PinScreen } from "./PinScreen";
import { BrandLogo } from "./BrandLogo";
import { colors, fonts } from "../lib/ui/theme";

const meta: Meta<typeof PinScreen> = {
  title: "Screens/PinScreen",
  component: PinScreen
};

export default meta;

type Story = StoryObj<typeof PinScreen>;

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: 24, alignSelf: "stretch" },
  titleGroup: { alignItems: "center", gap: 6 },
  title: { fontSize: 30, fontFamily: fonts.bold, color: colors.brandDeep },
  subtitle: { fontSize: 14, fontFamily: fonts.medium, color: colors.slate },
  subtitleError: { color: colors.red },
  forgotText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.brandPrimary }
});

function SetupHeader({
  title,
  subtitle,
  error
}: {
  title: string;
  subtitle: string;
  error?: boolean;
}) {
  return (
    <View style={styles.header}>
      <BrandLogo />
      <View style={styles.titleGroup}>
        <Text style={styles.title}>{title}</Text>
        <Text style={[styles.subtitle, error && styles.subtitleError]}>{subtitle}</Text>
      </View>
    </View>
  );
}

export const Setup: Story = {
  args: {
    header: <SetupHeader title="Crea tu PIN" subtitle="Este PIN abre la app en este teléfono" />,
    filled: 2,
    onKey: () => {}
  }
};

export const Confirm: Story = {
  args: {
    header: <SetupHeader title="Confirma tu PIN" subtitle="Ingresa el mismo PIN otra vez" />,
    filled: 0,
    onKey: () => {}
  }
};

export const MismatchError: Story = {
  args: {
    header: (
      <SetupHeader title="Crea tu PIN" subtitle="Los PIN no coinciden. Intenta de nuevo." error />
    ),
    filled: 0,
    error: true,
    onKey: () => {}
  }
};

export const Unlock: Story = {
  args: {
    header: (
      <View style={styles.header}>
        <BrandLogo />
        <View style={styles.titleGroup}>
          <Text style={styles.title}>Hola, Carlos.</Text>
          <Text style={styles.subtitle}>Ingresa tu PIN para continuar</Text>
        </View>
      </View>
    ),
    filled: 1,
    hint: "Se guarda solo en este teléfono",
    onKey: () => {},
    footer: (
      <Pressable>
        <Text style={styles.forgotText}>¿Olvidaste tu PIN?</Text>
      </Pressable>
    )
  }
};

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * "Permiso de impresión" per pencil.pen `v7HT7z` — the recovery screen shown
 * when Bluetooth permission is denied while trying to print a receipt (the
 * error the old flow surfaced as a dead-end Alert). Reached via router.push
 * from PaymentConfirmedScreen when requestBluetoothPermission() returns false;
 * the CTA jumps straight to the app's system settings so the lender can grant
 * the permission and come back to retry.
 */
import { View, Text, Pressable, StyleSheet, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { logger } from "../../lib/logger";
import { colors, fonts } from "../../lib/ui/theme";

interface BluetoothPermissionScreenProps {
  /** Called on close (X / "Ahora no"), typically router.back(). */
  onClose: () => void;
}

const STEPS = ["Toca «Permisos»", "Activa «Dispositivos cercanos»", "Vuelve e imprime de nuevo"];

export function BluetoothPermissionScreen({ onClose }: BluetoothPermissionScreenProps) {
  const insets = useSafeAreaInsets();

  function handleOpenSettings() {
    Linking.openSettings().catch((err) => {
      logger.warn("could not open app settings", {
        message: err instanceof Error ? err.message : String(err)
      });
    });
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={12}>
          <Feather name="x" size={24} color={colors.brandDeep} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.headerTitle}>Permiso de impresión</Text>
          <Text style={styles.headerSubtitle}>Impresora Bluetooth</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Feather name="printer" size={32} color={colors.brandDeep} />
        </View>
        <Text style={styles.headline}>Activa el Bluetooth para imprimir</Text>
        <Text style={styles.description}>
          Micobro necesita permiso de Bluetooth para conectarse con tu impresora. Actívalo en
          Ajustes y vuelve a intentar.
        </Text>

        <View style={styles.stepsCard}>
          {STEPS.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepLabel}>{step}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.actionBar, { paddingBottom: 14 + insets.bottom }]}>
        <Pressable style={styles.ctaButton} onPress={handleOpenSettings}>
          <Text style={styles.ctaText}>Abrir Ajustes</Text>
          <Feather name="arrow-right" size={18} color={colors.white} />
        </Pressable>
        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={styles.skipLink}>Ahora no</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20
  },
  titleWrap: { gap: 2 },
  headerTitle: { fontSize: 20, fontFamily: fonts.bold, color: colors.brandDeep },
  headerSubtitle: { fontSize: 12, fontFamily: fonts.medium, color: colors.slate },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingHorizontal: 24
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center"
  },
  headline: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.brandDeep,
    letterSpacing: -0.5,
    textAlign: "center"
  },
  description: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: "#5B6472",
    lineHeight: 22,
    textAlign: "center"
  },
  stepsCard: {
    alignSelf: "stretch",
    backgroundColor: colors.subtle,
    borderRadius: 16,
    padding: 16,
    gap: 14
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brandDeep,
    alignItems: "center",
    justifyContent: "center"
  },
  badgeText: { fontSize: 14, fontFamily: fonts.bold, color: colors.white },
  stepLabel: { flex: 1, fontSize: 14, fontFamily: fonts.semiBold, color: "#3A4457" },
  actionBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.actionBarBorder,
    paddingTop: 14,
    paddingHorizontal: 20,
    gap: 10,
    alignItems: "center"
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    alignSelf: "stretch",
    backgroundColor: colors.brandDeep,
    borderRadius: 14,
    padding: 18
  },
  ctaText: { fontSize: 17, fontFamily: fonts.bold, color: colors.white },
  skipLink: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.slate }
});

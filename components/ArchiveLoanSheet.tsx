/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * "¿Archivar el préstamo?" confirmation per pencil.pen `EmH4L`. When the
 * loan has payments but still owes money, its terms can't be edited, so
 * the primary action archives it and opens Nuevo préstamo prefilled with
 * its terms ("Crear préstamo corregido"); "Solo archivar" stays as the
 * plain path. A fully paid loan has nothing to correct, so it only gets
 * the plain confirmation.
 */
import { Modal, View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Icon } from "./Icon";
import { formatCurrency } from "../lib/utils/money";
import { colors, fonts, radius } from "../lib/ui/theme";

interface ArchiveLoanSheetProps {
  visible: boolean;
  loanCode: string;
  customerName: string;
  paymentCount: number;
  collectedCents: number;
  /** Offer "Archivar y crear préstamo corregido" — only for a loan with payments that isn't paid off. */
  offerCorrected: boolean;
  busy: boolean;
  onArchive: () => void;
  onArchiveAndCreate: () => void;
  onClose: () => void;
}

function bodyText(customerName: string, paymentCount: number, collectedCents: number): string {
  const leaves = `Saldrá de tu ruta y de los préstamos activos de ${customerName}.`;
  const restore = "Puedes restaurarlo cuando quieras.";
  if (paymentCount === 0) return `${leaves} ${restore}`;
  const payments = paymentCount === 1 ? "Su pago" : `Sus ${paymentCount} pagos`;
  const stay = paymentCount === 1 ? "se queda" : "se quedan";
  return `${leaves} ${payments} (${formatCurrency(collectedCents)}) ${stay} en el historial y en el cuadre de caja. ${restore}`;
}

export function ArchiveLoanSheet({
  visible,
  loanCode,
  customerName,
  paymentCount,
  collectedCents,
  offerCorrected,
  busy,
  onArchive,
  onArchiveAndCreate,
  onClose
}: ArchiveLoanSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <View style={styles.icon}>
          <Icon name="archive" size={22} color={colors.amber} />
        </View>
        <Text style={styles.title}>¿Archivar el préstamo #{loanCode}?</Text>
        <Text style={styles.body}>{bodyText(customerName, paymentCount, collectedCents)}</Text>

        <View style={styles.actions}>
          {offerCorrected && (
            <Pressable
              testID="archive-and-create"
              style={styles.primary}
              disabled={busy}
              onPress={onArchiveAndCreate}
            >
              <Icon name="file-plus" size={16} color={colors.yellowAccent} />
              <Text style={styles.primaryText}>Archivar y crear préstamo corregido</Text>
            </Pressable>
          )}
          <Pressable
            testID="archive-only"
            style={offerCorrected ? styles.secondary : styles.primary}
            disabled={busy}
            onPress={onArchive}
          >
            {busy ? (
              <ActivityIndicator color={offerCorrected ? colors.ink : colors.white} />
            ) : (
              <Text style={offerCorrected ? styles.secondaryText : styles.primaryText}>
                {offerCorrected ? "Solo archivar" : "Archivar préstamo"}
              </Text>
            )}
          </Pressable>
          <Pressable style={styles.cancel} disabled={busy} onPress={onClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </Pressable>
        </View>
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
    gap: 14
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.amberBg,
    alignItems: "center",
    justifyContent: "center"
  },
  title: { fontSize: 18, fontFamily: fonts.bold, color: colors.ink },
  body: { fontSize: 13, fontFamily: fonts.medium, color: colors.muted, lineHeight: 19 },
  actions: { gap: 10, paddingTop: 6 },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandDeep,
    borderRadius: 12,
    padding: 14
  },
  primaryText: { fontSize: 14, fontFamily: fonts.bold, color: colors.white },
  secondary: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14
  },
  secondaryText: { fontSize: 14, fontFamily: fonts.bold, color: colors.ink },
  cancel: { alignItems: "center", paddingTop: 6 },
  cancelText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.muted }
});

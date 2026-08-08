/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Imprimir/WhatsApp actions shared by the just-collected "Pago Confirmado"
 * screen and the historical "Recibo de pago" screen. Owns the offscreen
 * `ReceiptView` used by both the printer and the WhatsApp share image.
 */
import { useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { colors, fonts } from "../lib/ui/theme";
import type { ReceiptLine } from "../lib/repo/types";
import { printReceiptWithUI, requestBluetoothPermission } from "../lib/printer";
import { ReceiptView, type ReceiptViewData } from "./ReceiptView";
import { useProfileRepo } from "../lib/repo/RepoProvider";
import { useAsync } from "../lib/hooks/useAsync";
import { formatFullDate } from "../lib/utils/dates";

export interface ReceiptActionsProps {
  customerName: string;
  totalCents: number;
  methodLabel: string;
  receiptNumber: string;
  paidAtLabel: string;
  lines: ReceiptLine[];
  /** The loan's start date — each surface (digital/printed) derives its own
   * label ("Fecha Inicio"/"Inicio" or, for crédito abierto, "Fecha
   * Inicia"/"Inicia") from `isOpenCredit`. `null` only when a stale deep link
   * reaches `/pago-confirmado` without the param; the row is then omitted
   * rather than filled with a fabricated date. */
  loanStartDate: Date | null;
  /** `null` for crédito abierto — rendered as "Crédito abierto" instead of a date. */
  loanEndDate: Date | null;
  isOpenCredit: boolean;
}

export function ReceiptActions({
  customerName,
  totalCents,
  methodLabel,
  receiptNumber,
  paidAtLabel,
  lines,
  loanStartDate,
  loanEndDate,
  isOpenCredit
}: ReceiptActionsProps) {
  const router = useRouter();
  const [printing, setPrinting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const receiptRef = useRef<View>(null);

  const profileRepo = useProfileRepo();
  const profile = useAsync(() => profileRepo.get(), []);
  const lenderName = profile.data?.businessName || profile.data?.name || "MICOBRO";
  const phone = profile.data?.phone ?? null;

  // dd/mm/yyyy, shared by both surfaces — only the labels differ per surface
  // (see ReceiptView.tsx / lib/printer.ts), driven by isOpenCredit.
  const loanStartDateLabel = loanStartDate ? formatFullDate(loanStartDate) : null;
  const loanEndDateLabel = loanEndDate ? formatFullDate(loanEndDate) : null;

  const receiptViewData = useMemo<ReceiptViewData>(
    () => ({
      lenderName,
      receiptNumber,
      customerName,
      paidAtLabel,
      method: methodLabel,
      lines,
      totalCents,
      phone,
      loanStartDate: loanStartDateLabel,
      loanEndDate: loanEndDateLabel,
      isOpenCredit
    }),
    [
      lenderName,
      receiptNumber,
      customerName,
      paidAtLabel,
      methodLabel,
      lines,
      totalCents,
      phone,
      loanStartDateLabel,
      loanEndDateLabel,
      isOpenCredit
    ]
  );

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const granted = await requestBluetoothPermission();
      if (!granted) {
        router.push("/permiso-impresion");
        return;
      }
      await printReceiptWithUI({
        lenderName,
        receiptNumber,
        customerName,
        date: paidAtLabel,
        method: methodLabel,
        lines,
        totalCents,
        phone,
        loanStartDate: loanStartDateLabel,
        loanEndDate: loanEndDateLabel,
        isOpenCredit
      });
    } finally {
      setPrinting(false);
    }
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      const fileUri = await captureRef(receiptRef, {
        format: "png",
        quality: 1,
        result: "tmpfile"
      });
      await Sharing.shareAsync(fileUri, {
        mimeType: "image/png",
        dialogTitle: "Enviar recibo"
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert("Error", `No se pudo generar el recibo: ${msg}`);
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.actionBtn, printing && styles.actionBtnDisabled]}
          onPress={handlePrint}
          disabled={printing}
        >
          {printing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Feather name="printer" size={18} color={colors.white} />
          )}
          <Text style={styles.actionText}>Imprimir</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, sharing && styles.actionBtnDisabled]}
          onPress={handleShare}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Feather name="message-circle" size={18} color={colors.white} />
          )}
          <Text style={styles.actionText}>WhatsApp</Text>
        </Pressable>
      </View>

      <View style={styles.offscreen}>
        <ReceiptView ref={receiptRef} data={receiptViewData} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.brandPrimary,
    borderRadius: 12,
    padding: 14
  },
  actionText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.white },
  actionBtnDisabled: { opacity: 0.6 },
  offscreen: { position: "absolute", left: -9999, top: 0 }
});

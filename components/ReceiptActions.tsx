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
import { Icon } from "./Icon";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { colors, fonts } from "../lib/ui/theme";
import type { ReceiptLine } from "../lib/repo/types";
import { printReceiptWithUI, requestBluetoothPermission } from "../lib/printer";
import { ReceiptView, type ReceiptViewData } from "./ReceiptView";
import { useProfileRepo } from "../lib/repo/RepoProvider";
import { useAsync } from "../lib/hooks/useAsync";

export interface ReceiptActionsProps {
  customerName: string;
  totalCents: number;
  methodLabel: string;
  receiptNumber: string;
  paidAtLabel: string;
  lines: ReceiptLine[];
}

export function ReceiptActions({
  customerName,
  totalCents,
  methodLabel,
  receiptNumber,
  paidAtLabel,
  lines
}: ReceiptActionsProps) {
  const router = useRouter();
  const [printing, setPrinting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const receiptRef = useRef<View>(null);

  const profileRepo = useProfileRepo();
  const profile = useAsync(() => profileRepo.get(), []);
  const lenderName = profile.data?.businessName || profile.data?.name || "MICOBRO";
  const phone = profile.data?.phone ?? null;

  const receiptViewData = useMemo<ReceiptViewData>(
    () => ({
      lenderName,
      receiptNumber,
      customerName,
      paidAtLabel,
      method: methodLabel,
      lines,
      totalCents,
      phone
    }),
    [lenderName, receiptNumber, customerName, paidAtLabel, methodLabel, lines, totalCents, phone]
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
        phone
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
            <Icon name="printer" size={18} color={colors.white} />
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
            <Icon name="message-circle" size={18} color={colors.white} />
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

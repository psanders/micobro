/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 07 Cobrar Pago + 07b Otro Monto per pencil.pen `qoaNg`/`QZSle`.
 * Option semantics follow mikro's cobrar screen: the list is built from
 * the loan's state (cuota + mora / cuota / solo mora / saldar / otro
 * monto) and the mora-first split previews exactly what gets recorded.
 */
import { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { usePaymentRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { computePaymentSplit } from "../../lib/payments/paymentSplit";
import { formatCurrency } from "../../lib/utils/money";
import { formatShortDate, formatTime } from "../../lib/utils/dates";
import { Avatar } from "../Avatar";
import { ScreenHeader } from "../ScreenHeader";
import { SectionLabel } from "../SectionLabel";
import { OptionRow } from "../OptionRow";
import { KvRow } from "../KvRow";
import { colors, fonts } from "../../lib/ui/theme";
import type { PaymentMethod } from "../../lib/payments/payment.schema";
import type { ReceiptLine } from "../../lib/repo/types";

type PayOption = "arrears" | "cuota" | "mora" | "settle" | "custom";

export function CollectPaymentScreen({ loanId }: { loanId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const paymentRepo = usePaymentRepo();

  const [selectedOption, setSelectedOption] = useState<PayOption | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [customAmountText, setCustomAmountText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const customInputRef = useRef<TextInput>(null);

  const context = useAsync(() => paymentRepo.getCollectContext(loanId), [loanId]);
  const ctx = context.data;

  const cuota = ctx?.cuotaCents ?? 0;
  const mora = ctx?.moraCents ?? 0;
  const settleAmount = (ctx?.remainingBalanceCents ?? 0) + mora;

  const options = useMemo(() => {
    const opts: { key: PayOption; label: string; value: string; valueColor?: string }[] = [];
    if (mora > 0) {
      opts.push({
        key: "arrears",
        label: "Cobrar cuota + mora",
        value: formatCurrency(cuota + mora)
      });
      opts.push({
        key: "mora",
        label: "Solo mora",
        value: formatCurrency(mora),
        valueColor: colors.ink
      });
    } else {
      opts.push({ key: "cuota", label: "Cobrar cuota", value: formatCurrency(cuota) });
    }
    if ((ctx?.remainingInstallments ?? 0) > 1) {
      opts.push({
        key: "settle",
        label: "Saldar préstamo",
        value: formatCurrency(settleAmount),
        valueColor: colors.ink
      });
    }
    opts.push({ key: "custom", label: "Otro monto", value: "Escribir", valueColor: colors.slate });
    return opts;
  }, [cuota, mora, settleAmount, ctx?.remainingInstallments]);

  const effectiveOption: PayOption = selectedOption ?? (mora > 0 ? "arrears" : "cuota");

  const customAmountCents = useMemo(() => {
    const n = Number(customAmountText.replace(/[,.]/g, ""));
    return Number.isFinite(n) && n > 0 ? n * 100 : 0;
  }, [customAmountText]);

  const amount = useMemo(() => {
    switch (effectiveOption) {
      case "arrears":
        return cuota + mora;
      case "cuota":
        return cuota;
      case "mora":
        return mora;
      case "settle":
        return settleAmount;
      case "custom":
        return customAmountCents;
    }
  }, [effectiveOption, cuota, mora, settleAmount, customAmountCents]);

  const split = useMemo(
    () =>
      computePaymentSplit({
        amountCents: amount,
        expectedCuotaCents: cuota,
        accruedMoraCents: mora,
        kind: effectiveOption === "mora" ? "late_fee" : undefined
      }),
    [amount, cuota, mora, effectiveOption]
  );

  const breakdown = useMemo((): ReceiptLine[] => {
    if (!ctx) return [];
    const cuotaLabel = `Cuota ${ctx.currentInstallmentNumber}`;
    switch (effectiveOption) {
      case "mora":
        return [{ label: "Mora (prioridad)", amountCents: mora }];
      case "arrears":
        return [
          { label: "Mora (prioridad)", amountCents: mora },
          { label: cuotaLabel, amountCents: cuota }
        ];
      case "settle": {
        const lines: ReceiptLine[] = [];
        if (mora > 0) lines.push({ label: "Mora (prioridad)", amountCents: mora });
        lines.push({
          label: `${ctx.remainingInstallments} cuotas restantes`,
          amountCents: ctx.remainingBalanceCents
        });
        return lines;
      }
      case "custom":
        if (mora > 0 && customAmountCents > 0) {
          const lines: ReceiptLine[] = [
            { label: "Mora (prioridad)", amountCents: split.moraPortionCents }
          ];
          if (split.installmentPortionCents > 0) {
            lines.push({ label: "Aplica a cuota", amountCents: split.installmentPortionCents });
          }
          return lines;
        }
        return [{ label: "Monto personalizado", amountCents: customAmountCents }];
      default:
        return [{ label: cuotaLabel, amountCents: cuota }];
    }
  }, [ctx, effectiveOption, cuota, mora, customAmountCents, split]);

  const hint =
    effectiveOption === "custom"
      ? "Otro monto"
      : `${options.find((o) => o.key === effectiveOption)?.label ?? ""} seleccionado`;

  const handleConfirm = async () => {
    if (!ctx || submitting || amount <= 0) return;
    setSubmitting(true);
    try {
      const receipt = await paymentRepo.collect({
        loanId: ctx.loanId,
        amountCents: amount,
        method,
        moraCents: split.moraPortionCents,
        lines: breakdown
      });
      router.replace({
        pathname: "/pago-confirmado",
        params: {
          customerName: receipt.customerName,
          totalCents: String(receipt.totalCents),
          method: receipt.method,
          receiptNumber: receipt.receiptNumber,
          paidAtLabel: `${formatShortDate(receipt.paidAt)}, ${formatTime(receipt.paidAt)}`,
          lines: JSON.stringify(receipt.lines)
        }
      });
    } catch {
      Alert.alert("Error", "No se pudo registrar el cobro. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="Registrar cobro" backIcon="close" onBack={() => router.back()} />

      {context.loading || !ctx ? (
        <ActivityIndicator color={colors.brandDeep} style={styles.loading} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.clientRow}>
              <Avatar avatarKey={ctx.customerAvatarKey} name={ctx.customerName} size={40} />
              <View style={styles.clientText}>
                <Text style={styles.clientName}>{ctx.customerName}</Text>
                <Text style={styles.clientMeta}>
                  {ctx.business ? `${ctx.business} · ` : ""}Préstamo #{ctx.loanCode}
                </Text>
              </View>
            </View>

            <View style={styles.amountCard}>
              <SectionLabel>MONTO A COBRAR</SectionLabel>
              <View style={styles.amountRow}>
                <Text style={styles.amountCurrency}>RD$</Text>
                <Text style={styles.amountNumber}>{(amount / 100).toLocaleString("es-DO")}</Text>
              </View>
              <Text style={styles.amountHint}>{hint}</Text>
            </View>

            <View style={styles.section}>
              <SectionLabel>TIPO DE COBRO</SectionLabel>
              {options.map((option) => (
                <View key={option.key}>
                  <OptionRow
                    label={option.label}
                    value={option.value}
                    valueColor={option.valueColor}
                    selected={effectiveOption === option.key}
                    onPress={() => {
                      setSelectedOption(option.key);
                      if (option.key === "custom") {
                        setTimeout(() => customInputRef.current?.focus(), 100);
                      }
                    }}
                  />
                  {option.key === "custom" && effectiveOption === "custom" ? (
                    <View style={styles.customInputCard}>
                      <Text style={styles.customInputLabel}>RD$</Text>
                      <TextInput
                        ref={customInputRef}
                        style={styles.customInput}
                        value={customAmountText}
                        onChangeText={setCustomAmountText}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.slate}
                      />
                    </View>
                  ) : null}
                </View>
              ))}
            </View>

            <View style={styles.breakdownCard}>
              <SectionLabel>CÓMO SE APLICA</SectionLabel>
              {breakdown.map((line) => (
                <KvRow
                  key={line.label}
                  label={line.label}
                  value={line.amountCents > 0 ? formatCurrency(line.amountCents) : "—"}
                />
              ))}
            </View>

            <View style={styles.section}>
              <SectionLabel>MÉTODO DE PAGO</SectionLabel>
              <View style={styles.methodRow}>
                <Pressable
                  style={[styles.methodBtn, method === "cash" && styles.methodBtnActive]}
                  onPress={() => setMethod("cash")}
                >
                  <MaterialCommunityIcons
                    name="cash"
                    size={18}
                    color={method === "cash" ? colors.white : colors.brandDeep}
                  />
                  <Text style={[styles.methodText, method === "cash" && styles.methodTextActive]}>
                    Efectivo
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.methodBtn, method === "transfer" && styles.methodBtnActive]}
                  onPress={() => setMethod("transfer")}
                >
                  <MaterialCommunityIcons
                    name="swap-horizontal"
                    size={18}
                    color={method === "transfer" ? colors.white : colors.brandDeep}
                  />
                  <Text
                    style={[styles.methodText, method === "transfer" && styles.methodTextActive]}
                  >
                    Transferencia
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <Pressable
            style={[
              styles.cta,
              { paddingBottom: 18 + insets.bottom },
              (submitting || amount <= 0) && styles.ctaDisabled
            ]}
            disabled={submitting || amount <= 0}
            onPress={handleConfirm}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Feather name="check" size={20} color={colors.white} />
            )}
            <Text style={styles.ctaText}>
              {submitting ? "Procesando..." : "Confirmar y cobrar"}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loading: { marginTop: 40 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 18 },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 14
  },
  clientText: { flex: 1, gap: 2 },
  clientName: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.ink },
  clientMeta: { fontSize: 12, fontFamily: fonts.medium, color: colors.slate },
  amountCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 8
  },
  amountRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  amountCurrency: {
    fontSize: 22,
    fontFamily: fonts.semiBold,
    color: colors.brandPrimary,
    marginBottom: 6
  },
  amountNumber: {
    fontSize: 54,
    fontFamily: fonts.bold,
    color: colors.brandDeep,
    letterSpacing: -2,
    lineHeight: 56
  },
  amountHint: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.orangeDeep },
  section: { gap: 8 },
  customInputCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.brandPrimary
  },
  customInputLabel: { fontSize: 18, fontFamily: fonts.semiBold, color: colors.brandPrimary },
  customInput: {
    flex: 1,
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.brandDeep,
    padding: 0
  },
  breakdownCard: { backgroundColor: colors.white, borderRadius: 14, padding: 14, gap: 10 },
  methodRow: { flexDirection: "row", gap: 8 },
  methodBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.hairline
  },
  methodBtnActive: { backgroundColor: colors.brandDeep, borderColor: colors.brandDeep },
  methodText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.brandDeep },
  methodTextActive: { color: colors.white },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.brandDeep,
    paddingTop: 18
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { fontSize: 15, fontFamily: fonts.bold, color: colors.white }
});

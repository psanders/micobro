/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 07 Cobrar Pago + 07b Otro Monto per pencil.pen `qoaNg`/`QZSle`.
 * Option semantics follow mikro's cobrar screen: the list is built from
 * the loan's state (cuota + mora / cuota / solo mora / saldar / otro
 * monto) and the mora-first split previews exactly what gets recorded.
 */
import { useEffect, useMemo, useRef, useState } from "react";
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
import { resolveOpenCreditPayOptions } from "../../lib/payments/openCreditPayOptions";
import type { OpenCreditPayOption } from "../../lib/payments/openCreditPayOptions";
import { cuotaLabel as formatCuotaLabel } from "../../lib/loans/loanViews";
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

  // Crédito abierto (07c): "Solo interés" vs "Interés + capital", with a
  // lender-entered capital amount for the latter.
  const [ocOption, setOcOption] = useState<OpenCreditPayOption | null>("interest");
  const [ocCapitalText, setOcCapitalText] = useState("");

  const context = useAsync(() => paymentRepo.getCollectContext(loanId), [loanId]);
  const ctx = context.data;
  const oc = ctx?.openCredit ?? null;

  const ocCapitalCents = useMemo(() => {
    const n = Number(ocCapitalText.replace(/[,.]/g, ""));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  }, [ocCapitalText]);
  const ocCurrentCycle = oc && oc.cycles.length > 0 ? oc.cycles[oc.cycles.length - 1]! : null;
  // Which options this loan may be collected with right now — see
  // `resolveOpenCreditPayOptions` for why a covered cycle locks the interest
  // options instead of offering the next cycle's amount.
  const ocView = useMemo(
    () =>
      oc
        ? resolveOpenCreditPayOptions(oc)
        : {
            interestCovered: false,
            dueInterestCents: 0,
            interestEnabled: true,
            interestCapitalEnabled: true,
            capitalEnabled: false,
            defaultOption: "interest" as const
          },
    [oc]
  );
  const ocInterestCovered = ocView.interestCovered;
  const ocDueInterestCents = ocView.dueInterestCents;
  // Only actually applied to the total/preview when the selected option
  // includes that part — the capital input stays live either way so its pill
  // preview updates as the lender types.
  const ocInterestPortion =
    ocOption === "interest" || ocOption === "interest_capital" ? ocDueInterestCents : 0;
  const ocCapitalPortion =
    ocOption === "interest_capital" || ocOption === "capital" ? ocCapitalCents : 0;
  const ocAmountCents = ocInterestPortion + ocCapitalPortion;
  const ocBalanceAfterCents = Math.max(0, (oc?.balanceCents ?? 0) - ocCapitalPortion);
  const ocNextInterestCents = oc
    ? Math.round((ocBalanceAfterCents * oc.interestRateBps) / 10000)
    : 0;

  // Land on whichever option covers the main case right now — Solo interés
  // while interest is owed, Solo capital once it isn't — so the lender always
  // arrives at a live selection instead of an empty form.
  useEffect(() => {
    setOcOption(ocView.defaultOption);
  }, [ocView.defaultOption]);

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
    const cuotaLabel = formatCuotaLabel(ctx.currentInstallmentNumber, ctx.installmentsTotal);
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
      case "custom": {
        if (customAmountCents <= 0 || cuota <= 0) {
          return [{ label: "Monto personalizado", amountCents: customAmountCents }];
        }
        const lines: ReceiptLine[] = [];
        if (mora > 0) {
          lines.push({ label: "Mora (prioridad)", amountCents: split.moraPortionCents });
        }
        if (split.installmentPortionCents > 0) {
          // Once the payment covers more than one cuota, this line becomes
          // the numbered cuota label (e.g. "Cuota 8/24") to pair with the
          // "Abono a la cuota N+1" line below; otherwise it keeps the
          // original label for a payment that fits within one cuota.
          lines.push({
            label:
              split.advancePortionCents > 0
                ? cuotaLabel
                : mora > 0
                  ? "Aplica a cuota"
                  : "Monto personalizado",
            amountCents: split.installmentPortionCents
          });
        }
        if (split.advancePortionCents > 0) {
          const nextInstallmentNumber = ctx.currentInstallmentNumber + 1;
          // No "cuota N+1" exists once the current cuota is the loan's
          // last installment — fall back to a generic "extra" label.
          const advanceLabel =
            ctx.installmentsTotal > 0 && nextInstallmentNumber <= ctx.installmentsTotal
              ? `Abono a la cuota ${nextInstallmentNumber}/${ctx.installmentsTotal}`
              : "Abono adicional";
          lines.push({ label: advanceLabel, amountCents: split.advancePortionCents });
        }
        return lines;
      }
      default:
        return [{ label: cuotaLabel, amountCents: cuota }];
    }
  }, [ctx, effectiveOption, cuota, mora, customAmountCents, split]);

  const hint =
    effectiveOption === "custom"
      ? "Otro monto"
      : `${options.find((o) => o.key === effectiveOption)?.label ?? ""} seleccionado`;

  const handleConfirm = async () => {
    if (!ctx || submitting) return;
    const isOpenCredit = ctx.openCredit !== null;
    const totalCents = isOpenCredit ? ocAmountCents : amount;
    if (totalCents <= 0) return;

    setSubmitting(true);
    try {
      const lines: ReceiptLine[] = isOpenCredit
        ? [
            // "Solo capital" collects no interest, so the receipt shouldn't
            // carry an Interés line reading RD$0.
            ...(ocInterestPortion > 0
              ? [{ label: "Interés", amountCents: ocInterestPortion }]
              : []),
            ...(ocCapitalPortion > 0 ? [{ label: "Capital", amountCents: ocCapitalPortion }] : [])
          ]
        : breakdown;

      const receipt = await paymentRepo.collect({
        loanId: ctx.loanId,
        amountCents: totalCents,
        method,
        moraCents: isOpenCredit ? 0 : split.moraPortionCents,
        lines
      });
      router.replace({
        pathname: "/pago-confirmado",
        params: {
          customerName: receipt.customerName,
          totalCents: String(receipt.totalCents),
          method: receipt.method,
          receiptNumber: receipt.receiptNumber,
          paidAtLabel: `${formatShortDate(receipt.paidAt)}, ${formatTime(receipt.paidAt)}`,
          lines: JSON.stringify(receipt.lines),
          // Every router param is a string — dates cross as ISO, the
          // open-credit flag as "true"/"false"; app/pago-confirmado.tsx
          // parses them back.
          loanStartDate: receipt.loanStartDate.toISOString(),
          loanEndDate: receipt.loanEndDate ? receipt.loanEndDate.toISOString() : "",
          isOpenCredit: String(receipt.isOpenCredit)
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
      ) : ctx.openCredit ? (
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

            <View style={styles.ocBanner}>
              <Text style={styles.ocBannerTitle}>
                {ocCurrentCycle
                  ? `Ciclo ${ocCurrentCycle.index} · Del ${formatShortDate(ocCurrentCycle.start)} al ${formatShortDate(ocCurrentCycle.end)}`
                  : ""}
              </Text>
              <Text style={styles.ocBannerSub}>
                Capital actual: {formatCurrency(ctx.openCredit.balanceCents)}
              </Text>
            </View>

            <View style={styles.ocInterestCard}>
              <SectionLabel>INTERÉS DEL PRÓXIMO PAGO</SectionLabel>
              <Text style={styles.ocInterestAmount}>{formatCurrency(ocDueInterestCents)}</Text>
              {ocInterestCovered ? (
                <View style={styles.ocPaidNote}>
                  <Feather name="check" size={13} color={colors.green} />
                  <Text style={styles.ocPaidNoteText}>El interés de este ciclo ya fue pagado</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <SectionLabel>OPCIONES DE PAGO</SectionLabel>
              <View style={styles.ocOptions}>
                <Pressable
                  style={[
                    styles.ocOptionCard,
                    ocOption === "interest" && styles.ocOptionCardSelected,
                    ocInterestCovered && styles.ocOptionCardDisabled
                  ]}
                  disabled={ocInterestCovered}
                  onPress={() => setOcOption("interest")}
                >
                  <View style={styles.ocOptionHeader}>
                    <View style={styles.ocOptionTextWrap}>
                      <Text
                        style={[
                          styles.ocOptionTitle,
                          ocInterestCovered && styles.ocOptionTextDisabled
                        ]}
                      >
                        Solo interés
                      </Text>
                      <Text
                        style={[
                          styles.ocOptionSubtitle,
                          ocInterestCovered && styles.ocOptionTextDisabled
                        ]}
                      >
                        {ocInterestCovered
                          ? "Ya cubierto en este ciclo"
                          : "Mantiene el capital pendiente"}
                      </Text>
                    </View>
                    <View
                      style={[styles.ocRadio, ocOption === "interest" && styles.ocRadioSelected]}
                    >
                      {ocOption === "interest" ? (
                        <Feather name="check" size={14} color={colors.white} />
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.ocPayPill}>
                    <Text style={styles.ocPayPillLabel}>A pagar</Text>
                    <Text
                      style={[
                        styles.ocPayPillValue,
                        ocInterestCovered && styles.ocOptionTextDisabled
                      ]}
                    >
                      {formatCurrency(ocDueInterestCents)}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  style={[
                    styles.ocOptionCard,
                    ocOption === "interest_capital" && styles.ocOptionCardSelected,
                    ocInterestCovered && styles.ocOptionCardDisabled
                  ]}
                  disabled={ocInterestCovered}
                  onPress={() => setOcOption("interest_capital")}
                >
                  <View style={styles.ocOptionHeader}>
                    <View style={styles.ocOptionTextWrap}>
                      <Text
                        style={[
                          styles.ocOptionTitle,
                          ocInterestCovered && styles.ocOptionTextDisabled
                        ]}
                      >
                        Interés + capital
                      </Text>
                      <Text
                        style={[
                          styles.ocOptionSubtitle,
                          ocInterestCovered && styles.ocOptionTextDisabled
                        ]}
                      >
                        {ocInterestCovered
                          ? "Ya cubierto en este ciclo"
                          : "Reduce el capital y siguiente interés"}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.ocRadio,
                        ocOption === "interest_capital" && styles.ocRadioSelected
                      ]}
                    >
                      {ocOption === "interest_capital" ? (
                        <Feather name="check" size={14} color={colors.white} />
                      ) : null}
                    </View>
                  </View>
                  {ocInterestCovered ? null : (
                    <>
                      <Text style={styles.ocCapitalLabel}>Capital a pagar</Text>
                      <View style={styles.customInputCard}>
                        <Text style={styles.customInputLabel}>RD$</Text>
                        <TextInput
                          style={styles.customInput}
                          value={ocCapitalText}
                          onChangeText={setOcCapitalText}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={colors.slate}
                        />
                      </View>
                      <View style={[styles.ocPayPill, styles.ocPayPillGreen]}>
                        <Text style={styles.ocPayPillLabel}>A pagar</Text>
                        <Text style={[styles.ocPayPillValue, styles.ocPayPillValueGreen]}>
                          {formatCurrency(ocDueInterestCents + ocCapitalCents)}
                        </Text>
                      </View>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={[
                    styles.ocOptionCard,
                    ocOption === "capital" && styles.ocOptionCardSelected,
                    !ocInterestCovered && styles.ocOptionCardDisabled
                  ]}
                  disabled={!ocInterestCovered}
                  onPress={() => setOcOption("capital")}
                >
                  <View style={styles.ocOptionHeader}>
                    <View style={styles.ocOptionTextWrap}>
                      <Text
                        style={[
                          styles.ocOptionTitle,
                          !ocInterestCovered && styles.ocOptionTextDisabled
                        ]}
                      >
                        Solo capital
                      </Text>
                      <Text
                        style={[
                          styles.ocOptionSubtitle,
                          !ocInterestCovered && styles.ocOptionTextDisabled
                        ]}
                      >
                        {ocInterestCovered
                          ? "Todo el monto baja el capital"
                          : "Disponible al cubrir el interés del ciclo"}
                      </Text>
                    </View>
                    <View
                      style={[styles.ocRadio, ocOption === "capital" && styles.ocRadioSelected]}
                    >
                      {ocOption === "capital" ? (
                        <Feather name="check" size={14} color={colors.white} />
                      ) : null}
                    </View>
                  </View>
                  {ocInterestCovered ? (
                    <>
                      <Text style={styles.ocCapitalLabel}>Monto a capital</Text>
                      <View style={styles.customInputCard}>
                        <Text style={styles.customInputLabel}>RD$</Text>
                        <TextInput
                          style={styles.customInput}
                          value={ocCapitalText}
                          onChangeText={setOcCapitalText}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={colors.slate}
                        />
                      </View>
                      <View style={[styles.ocPayPill, styles.ocPayPillGreen]}>
                        <Text style={styles.ocPayPillLabel}>A pagar</Text>
                        <Text style={[styles.ocPayPillValue, styles.ocPayPillValueGreen]}>
                          {formatCurrency(ocCapitalCents)}
                        </Text>
                      </View>
                    </>
                  ) : null}
                </Pressable>
              </View>
            </View>

            <View style={styles.section}>
              <SectionLabel>DESPUÉS DEL PAGO</SectionLabel>
              <View style={styles.ocAfterCard}>
                <KvRow label="Capital restante" value={formatCurrency(ocBalanceAfterCents)} />
                <View style={styles.divider} />
                <KvRow
                  label={`Próx. interés (${oc ? oc.interestRateBps / 100 : 0}%)`}
                  value={formatCurrency(ocNextInterestCents)}
                />
              </View>
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
              (submitting || ocAmountCents <= 0) && styles.ctaDisabled
            ]}
            disabled={submitting || ocAmountCents <= 0}
            onPress={handleConfirm}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Feather name="check" size={20} color={colors.white} />
            )}
            <Text style={styles.ctaText}>
              {submitting ? "Procesando..." : `Confirmar pago ${formatCurrency(ocAmountCents)}`}
            </Text>
          </Pressable>
        </>
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
  ctaText: { fontSize: 15, fontFamily: fonts.bold, color: colors.white },
  divider: { height: 1, backgroundColor: colors.actionBarBorder },
  ocBanner: {
    backgroundColor: colors.mist,
    borderRadius: 14,
    padding: 16,
    gap: 8
  },
  ocBannerTitle: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.brandPrimary },
  ocBannerSub: { fontSize: 13, fontFamily: fonts.medium, color: colors.brandPrimary },
  ocInterestCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    gap: 10
  },
  ocInterestAmount: { fontSize: 32, fontFamily: fonts.bold, color: "#1A1A1A" },
  ocPaidNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.greenBg,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  ocPaidNoteText: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.green },
  ocOptions: { gap: 12 },
  ocOptionCard: {
    backgroundColor: colors.white,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.actionBarBorder
  },
  ocOptionCardSelected: { borderWidth: 2, borderColor: colors.brandDeep },
  // Locked out for this cycle — greyed but still on screen, so the lender can
  // see the option exists and read why it isn't available.
  ocOptionCardDisabled: { backgroundColor: "#F9FAFB", borderColor: colors.border },
  ocOptionTextDisabled: { color: "#9AA8C2" },
  ocOptionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between"
  },
  ocOptionTextWrap: { flex: 1, gap: 4 },
  ocOptionTitle: { fontSize: 14, fontFamily: fonts.bold, color: "#1A1A1A" },
  ocOptionSubtitle: { fontSize: 12, fontFamily: fonts.medium, color: "#5B6B7A" },
  ocRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.actionBarBorder,
    alignItems: "center",
    justifyContent: "center"
  },
  ocRadioSelected: { backgroundColor: colors.brandDeep },
  ocCapitalLabel: { fontSize: 12, fontFamily: fonts.semiBold, color: "#5B6B7A" },
  ocPayPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0F9FF",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12
  },
  ocPayPillGreen: { backgroundColor: "#F0FDF4" },
  ocPayPillLabel: { fontSize: 12, fontFamily: fonts.medium, color: "#5B6B7A" },
  ocPayPillValue: { fontSize: 16, fontFamily: fonts.bold, color: colors.brandDeep },
  ocPayPillValueGreen: { color: "#10B981" },
  ocAfterCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    gap: 8
  }
});

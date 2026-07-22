/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet
} from "react-native";
import { useRouter } from "expo-router";
import { useCustomerRepo, useLoanRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import {
  loanFrequencies,
  DEFAULT_GRACE_DAYS,
  type LoanFrequency
} from "../../lib/loans/loan.schema";
import { loanCostSummary } from "../../lib/loans/loanMath";
import { addFrequencyInterval } from "../../lib/loans/loanViews";
import { ValidationError } from "../../lib/errors/ValidationError";
import { formatCurrency, toCents } from "../../lib/utils/money";
import { formatShortDate } from "../../lib/utils/dates";
import { colors } from "../../lib/ui/theme";

const frequencyLabels: Record<LoanFrequency, string> = {
  daily: "Diario",
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual"
};

/**
 * Cycling presets for "primer pago" (first payment date), same pattern as
 * VisitOutcomeScreen's DATE_PRESETS — no native date-picker dependency.
 * Preset 0 is the healthy per-frequency default (mañana for diario, en 1
 * semana for semanal, ...); 1 and 2 let the lender push it further out.
 */
const FIRST_PAYMENT_PRESET_COUNT = 3;

function firstPaymentLabel(date: Date, frequency: LoanFrequency, intervalsFromNow: number): string {
  const short = formatShortDate(date);
  if (frequency === "daily") {
    if (intervalsFromNow === 1) return `Mañana, ${short}`;
    if (intervalsFromNow === 2) return `Pasado mañana, ${short}`;
    return `En ${intervalsFromNow} días, ${short}`;
  }
  const unitSingular =
    frequency === "weekly" ? "semana" : frequency === "biweekly" ? "quincena" : "mes";
  const unit =
    intervalsFromNow === 1 ? unitSingular : frequency === "monthly" ? "meses" : `${unitSingular}s`;
  return `En ${intervalsFromNow} ${unit}, ${short}`;
}

export function NewLoanFormScreen({ customerId: initialCustomerId }: { customerId?: string }) {
  const router = useRouter();
  const customerRepo = useCustomerRepo();
  const loanRepo = useLoanRepo();
  const { data: customers, loading } = useAsync(() => customerRepo.list(), []);

  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [principal, setPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [termCount, setTermCount] = useState("");
  const [frequency, setFrequency] = useState<LoanFrequency>("weekly");
  const [firstPaymentPresetIndex, setFirstPaymentPresetIndex] = useState(0);
  const [graceDays, setGraceDays] = useState(String(DEFAULT_GRACE_DAYS));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Changing the frequency changes what "healthy default" means (mañana vs.
  // en 1 semana), so a preset the lender picked for the old frequency isn't
  // meaningful anymore — snap back to the default (index 0).
  useEffect(() => {
    setFirstPaymentPresetIndex(0);
  }, [frequency]);

  const firstPaymentIntervalsFromNow = firstPaymentPresetIndex + 1;
  const firstPaymentDate = useMemo(
    () => addFrequencyInterval(new Date(), frequency, firstPaymentIntervalsFromNow),
    [frequency, firstPaymentIntervalsFromNow]
  );

  const principalValue = Number(principal);
  const interestRateValue = Number(interestRate);
  const termCountValue = Number(termCount);
  const costPreview =
    principalValue > 0 && termCountValue > 0 && Number.isInteger(termCountValue)
      ? loanCostSummary({
          principalCents: toCents(principalValue),
          interestRateBps: Math.round((interestRateValue || 0) * 100),
          termCount: termCountValue
        })
      : null;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      // `installmentDueDate` counts the first cuota as one interval after
      // `startDate`, so the disbursement anchor we send is the chosen
      // first-payment date minus one interval — this makes
      // installmentDueDate(loan, 1) land exactly on what the lender picked.
      const startDate = addFrequencyInterval(firstPaymentDate, frequency, -1);
      await loanRepo.create({
        customerId,
        principal: Number(principal),
        interestRate: Number(interestRate),
        termCount: Number(termCount),
        frequency,
        startDate,
        graceDays: graceDays.trim() === "" ? undefined : Number(graceDays)
      });
      router.back();
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : "No se pudo crear el préstamo");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!initialCustomerId && (
        <View style={styles.field}>
          <Text style={styles.label}>Cliente</Text>
          <View style={styles.chips}>
            {(customers ?? []).map((customer) => (
              <Pressable
                key={customer.id}
                style={[styles.chip, customerId === customer.id && styles.chipActive]}
                onPress={() => setCustomerId(customer.id)}
              >
                <Text
                  style={[styles.chipText, customerId === customer.id && styles.chipTextActive]}
                >
                  {customer.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Monto (RD$)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={principal}
          onChangeText={setPrincipal}
          placeholder="15000"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Tasa de interés (%)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={interestRate}
          onChangeText={setInterestRate}
          placeholder="10"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Cantidad de pagos</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={termCount}
          onChangeText={setTermCount}
          placeholder="12"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Frecuencia</Text>
        <View style={styles.chips}>
          {loanFrequencies.map((option) => (
            <Pressable
              key={option}
              style={[styles.chip, frequency === option && styles.chipActive]}
              onPress={() => setFrequency(option)}
            >
              <Text style={[styles.chipText, frequency === option && styles.chipTextActive]}>
                {frequencyLabels[option]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Primer pago</Text>
        <Pressable
          style={styles.dateInput}
          onPress={() => setFirstPaymentPresetIndex((i) => (i + 1) % FIRST_PAYMENT_PRESET_COUNT)}
        >
          <Text style={styles.dateInputText}>
            {firstPaymentLabel(firstPaymentDate, frequency, firstPaymentIntervalsFromNow)}
          </Text>
          <Text style={styles.dateInputHint}>Toca para cambiar</Text>
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Período de gracia (días)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={graceDays}
          onChangeText={setGraceDays}
          placeholder={String(DEFAULT_GRACE_DAYS)}
        />
      </View>

      {costPreview && (
        <View style={styles.preview}>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Cuota estimada</Text>
            <Text style={styles.previewValue}>{formatCurrency(costPreview.cuotaCents)}</Text>
          </View>
          {costPreview.lastCuotaCents !== costPreview.cuotaCents && (
            <View style={styles.previewRow}>
              <Text style={styles.previewLabelSub}>Última cuota</Text>
              <Text style={styles.previewValueSub}>
                {formatCurrency(costPreview.lastCuotaCents)}
              </Text>
            </View>
          )}
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Interés total</Text>
            <Text style={styles.previewValue}>
              {formatCurrency(costPreview.totalInterestCents)}
            </Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabelStrong}>Total a pagar</Text>
            <Text style={styles.previewValueStrong}>
              {formatCurrency(costPreview.totalRepayCents)}
            </Text>
          </View>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.submitButtonText}>
          {submitting ? "Guardando..." : "Crear préstamo"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.ink
  },
  dateInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  dateInputText: { fontSize: 15, color: colors.ink, fontWeight: "600" },
  dateInputHint: { fontSize: 12, color: colors.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: colors.subtle
  },
  chipActive: { backgroundColor: colors.brandPrimary },
  chipText: { fontSize: 13, color: colors.ink },
  chipTextActive: { color: colors.white },
  preview: {
    backgroundColor: colors.subtle,
    borderRadius: 14,
    padding: 14,
    gap: 8
  },
  previewRow: { flexDirection: "row", justifyContent: "space-between" },
  previewLabel: { fontSize: 13, color: colors.muted },
  previewValue: { fontSize: 13, fontWeight: "600", color: colors.ink },
  previewLabelSub: { fontSize: 12, color: colors.muted, paddingLeft: 12 },
  previewValueSub: { fontSize: 12, fontWeight: "600", color: colors.muted },
  previewLabelStrong: { fontSize: 14, fontWeight: "700", color: colors.ink },
  previewValueStrong: { fontSize: 16, fontWeight: "700", color: colors.ink },
  error: { color: colors.red, fontSize: 13 },
  submitButton: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center"
  },
  submitButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" }
});

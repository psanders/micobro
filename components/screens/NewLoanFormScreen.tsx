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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../Icon";
import { useCustomerRepo, useLoanRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import {
  loanFrequencies,
  DEFAULT_GRACE_DAYS,
  type LoanFrequency,
  type LoanType
} from "../../lib/loans/loan.schema";
import { loanCostSummary } from "../../lib/loans/loanMath";
import {
  addFrequencyInterval,
  healthyFirstPaymentFloor,
  monthlyAnchorAtRisk
} from "../../lib/loans/loanViews";
import { ValidationError } from "../../lib/errors/ValidationError";
import { formatCurrency, toCents } from "../../lib/utils/money";
import { formatShortDate } from "../../lib/utils/dates";
import { colors } from "../../lib/ui/theme";
import { ScreenHeader } from "../ScreenHeader";
import { ClientRow } from "../ClientRow";
import { SelectField } from "../SelectField";
import { Toggle } from "../Toggle";
import { CalendarPicker } from "../CalendarPicker";

const frequencyLabels: Record<LoanFrequency, string> = {
  daily: "Diario",
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual"
};

/**
 * "Tipo de préstamo": Tradicional (term, fixed cuotas) or Crédito Abierto
 * (open credit, interest-only cycles on an outstanding capital — see
 * `lib/loans/openCredit.ts`). Selecting Crédito Abierto hides the fields
 * that only make sense for a term loan (Plazo, mora, Saltar domingos).
 */
const loanTypeOptions: { value: LoanType; label: string }[] = [
  { value: "term", label: "Tradicional" },
  { value: "open_credit", label: "Crédito Abierto" }
];

/** Relative label for the default date, else the numeric "DD/MM" fallback
 * — the app avoids Spanish month abbreviations ("ago") reading like the
 * English word "ago" (see lib/utils/dates.ts). */
function firstPaymentLabel(date: Date, frequency: LoanFrequency, isDefault: boolean): string {
  const short = formatShortDate(date);
  if (!isDefault) return short;
  if (frequency === "daily") return `Mañana, ${short}`;
  const unit = frequency === "weekly" ? "semana" : frequency === "biweekly" ? "quincena" : "mes";
  return `En 1 ${unit}, ${short}`;
}

export function NewLoanFormScreen({ customerId: initialCustomerId }: { customerId?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const customerRepo = useCustomerRepo();
  const loanRepo = useLoanRepo();
  const { data: customers, loading } = useAsync(() => customerRepo.list(), []);

  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  // Once a customer is picked, collapse the chip list behind the selected
  // card; "Cambiar" reopens it. Starts open when there's nothing picked yet.
  const [showClientPicker, setShowClientPicker] = useState(!initialCustomerId);
  const [loanType, setLoanType] = useState<LoanType>("term");
  const [principal, setPrincipal] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [termCount, setTermCount] = useState("");
  const [frequency, setFrequency] = useState<LoanFrequency>("weekly");
  // On by default: prestamistas don't collect on Sundays, so a daily loan
  // almost always wants them skipped. Only affects loans created from here —
  // existing loans keep whatever they were stored with (`null` reads as off).
  const [skipSundays, setSkipSundays] = useState(true);
  // `firstPaymentFloor` is the single source of truth for "the healthy
  // default right now" — both the initial state below and the
  // frequency-reset effect reuse this exact value (rather than each
  // calling healthyFirstPaymentFloor/`new Date()` independently) so
  // `isFirstPaymentDefault` compares two computations of the same instant
  // instead of two different millisecond timestamps a render/effect cycle
  // apart.
  const firstPaymentFloor = useMemo(
    () => healthyFirstPaymentFloor(frequency, skipSundays),
    [frequency, skipSundays]
  );
  const [firstPaymentDate, setFirstPaymentDate] = useState<Date>(() => firstPaymentFloor);
  const [showCalendar, setShowCalendar] = useState(false);
  const [graceDays, setGraceDays] = useState(String(DEFAULT_GRACE_DAYS));
  const [moraEnabled, setMoraEnabled] = useState(false);
  const [moraRate, setMoraRate] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedCustomer = (customers ?? []).find((customer) => customer.id === customerId);
  const isOpenCredit = loanType === "open_credit";

  // Changing the frequency changes what "healthy default" means (mañana vs.
  // en 1 semana) — a date the lender picked for the old frequency isn't
  // meaningful anymore, so snap back to the new default.
  useEffect(() => {
    setFirstPaymentDate(firstPaymentFloor);
  }, [frequency]);

  // Turning on Saltar domingos can invalidate an already-picked Sunday —
  // bump it forward to the (now Sunday-aware) floor rather than leaving an
  // invalid date staged for submit.
  useEffect(() => {
    if (frequency === "daily" && skipSundays && firstPaymentDate.getDay() === 0) {
      setFirstPaymentDate(firstPaymentFloor);
    }
  }, [skipSundays]);

  const isFirstPaymentDefault = firstPaymentDate.getTime() === firstPaymentFloor.getTime();

  // Issue #112: a monthly loan whose Primer pago day doesn't exist in the
  // preceding month gets its first cuota due a few days early — the full
  // fix needs a persisted anchor day, so this just warns on the affected
  // picks with the actual date rather than changing any date math.
  const monthlyAnchorWarningDate = useMemo(() => {
    if (frequency !== "monthly" || !monthlyAnchorAtRisk(firstPaymentDate)) return null;
    const startDate = addFrequencyInterval(firstPaymentDate, frequency, -1);
    return addFrequencyInterval(startDate, frequency, 1);
  }, [frequency, firstPaymentDate]);

  const principalValue = Number(principal);
  const interestRateValue = Number(interestRate);
  const termCountValue = Number(termCount);
  const costPreview =
    !isOpenCredit && principalValue > 0 && termCountValue > 0 && Number.isInteger(termCountValue)
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
        // Open credit has no fixed term — omitted (not just undefined) so
        // createLoanSchema's .refine (term-only requirement) is satisfied.
        ...(!isOpenCredit && { termCount: Number(termCount) }),
        frequency,
        startDate,
        loanType: isOpenCredit ? "open_credit" : undefined,
        // Mora and Saltar domingos are meaningless for open credit — no
        // mora ever applies to it (capitalization is the penalty instead).
        ...(!isOpenCredit && {
          graceDays: graceDays.trim() === "" ? undefined : Number(graceDays),
          moraEnabled,
          ...(moraEnabled && {
            moraRate: moraRate.trim() === "" ? undefined : Number(moraRate)
          })
        }),
        ...(frequency === "daily" && !isOpenCredit && { skipSundays })
      });
      router.back();
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : "No se pudo crear el préstamo");
    } finally {
      setSubmitting(false);
    }
  }

  const headerSubtitle = selectedCustomer ? `Para ${selectedCustomer.name}` : undefined;

  if (loading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScreenHeader title="Nuevo préstamo" onBack={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="Nuevo préstamo" subtitle={headerSubtitle} onBack={() => router.back()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.field}>
          {selectedCustomer && !showClientPicker ? (
            <ClientRow
              avatarKey={selectedCustomer.avatarKey}
              name={selectedCustomer.name}
              meta="Cliente seleccionado"
              trailing={<Icon name="chevron-right" size={18} color={colors.slate} />}
              onPress={initialCustomerId ? undefined : () => setShowClientPicker(true)}
            />
          ) : (
            <>
              <Text style={styles.label}>Cliente</Text>
              <View style={styles.chips}>
                {(customers ?? []).map((customer) => (
                  <Pressable
                    key={customer.id}
                    style={[styles.chip, customerId === customer.id && styles.chipActive]}
                    onPress={() => {
                      setCustomerId(customer.id);
                      setShowClientPicker(false);
                    }}
                  >
                    <Text
                      style={[styles.chipText, customerId === customer.id && styles.chipTextActive]}
                    >
                      {customer.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>

        <SelectField
          label="Tipo de préstamo"
          value={loanType}
          options={loanTypeOptions}
          onChange={setLoanType}
        />

        <SelectField
          label="Frecuencia de pago"
          value={frequency}
          options={loanFrequencies.map((option) => ({
            value: option,
            label: frequencyLabels[option]
          }))}
          onChange={setFrequency}
        />

        <View style={styles.field}>
          <Text style={styles.label}>Primer pago</Text>
          <Pressable style={styles.dateInput} onPress={() => setShowCalendar(true)}>
            <Text style={styles.dateInputText}>
              {firstPaymentLabel(firstPaymentDate, frequency, isFirstPaymentDefault)}
            </Text>
            <Text style={styles.dateInputHint}>Toca para cambiar</Text>
          </Pressable>
          {monthlyAnchorWarningDate && (
            <Text style={styles.anchorWarning}>
              El mes anterior no tiene el día {firstPaymentDate.getDate()}, así que la primera cuota
              caerá el {formatShortDate(monthlyAnchorWarningDate)}.
            </Text>
          )}
        </View>

        {frequency === "daily" && !isOpenCredit && (
          <View style={[styles.field, styles.switchRow]}>
            <Text style={styles.label}>Saltar domingos</Text>
            <Toggle value={skipSundays} onValueChange={setSkipSundays} />
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Monto del préstamo</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={principal}
            onChangeText={setPrincipal}
            placeholder="15000"
          />
        </View>

        {!isOpenCredit && (
          <View style={styles.field}>
            <Text style={styles.label}>Plazo (número de cuotas)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={termCount}
              // Cuotas are whole numbers — strip anything but digits so a
              // stray decimal can't reach the integer schema validation.
              onChangeText={(t) => setTermCount(t.replace(/[^0-9]/g, ""))}
              placeholder="12"
            />
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>
            {isOpenCredit ? "Interés por ciclo (%)" : "Tasa de interés (%)"}
          </Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={interestRate}
            onChangeText={setInterestRate}
            placeholder="10"
          />
        </View>

        {!isOpenCredit && (
          <View style={[styles.field, styles.switchRow]}>
            <Text style={styles.label}>Cobrar mora por atraso</Text>
            <Toggle value={moraEnabled} onValueChange={setMoraEnabled} />
          </View>
        )}

        {!isOpenCredit && moraEnabled && (
          <>
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

            <View style={styles.field}>
              <Text style={styles.label}>Tasa de mora (%)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={moraRate}
                onChangeText={setMoraRate}
                placeholder="10"
              />
            </View>
          </>
        )}

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

      <CalendarPicker
        visible={showCalendar}
        title="Primer pago"
        value={firstPaymentDate}
        // No `minDate`: `firstPaymentFloor` is only the suggested default
        // (pre-fill + frequency-reset value, see above) — the lender can
        // still pick a nearer date or backdate into the past.
        isDateDisabled={(d) => frequency === "daily" && skipSundays && d.getDay() === 0}
        onSelect={setFirstPaymentDate}
        onClose={() => setShowCalendar(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 20 },
  field: { gap: 8 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
  anchorWarning: { fontSize: 12, color: colors.amber, marginTop: 6 },
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

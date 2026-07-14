/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 09 Anotar Visita per pencil.pen `jzV2S`: outcome picker, and — when
 * "Promesa de pago" is chosen — date/time/amount/comment fields. Date and
 * time are simple cycling presets rather than a native picker, so this
 * ships without adding a second native dependency alongside the feedback
 * flow's screen recorder in the same change.
 */
import { useMemo, useState } from "react";
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
import { Feather } from "@expo/vector-icons";
import { usePaymentRepo, useVisitRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { formatShortDate, formatTime } from "../../lib/utils/dates";
import { ScreenHeader } from "../ScreenHeader";
import { SectionLabel } from "../SectionLabel";
import { ClientRow } from "../ClientRow";
import { OutcomeChip } from "../OutcomeChip";
import { colors, fonts } from "../../lib/ui/theme";
import type { VisitOutcome } from "../../lib/visits/visit.schema";

const OUTCOME_OPTIONS: { key: VisitOutcome; label: string }[] = [
  { key: "promise", label: "Promesa de pago" },
  { key: "no_contact", label: "Sin contacto" },
  { key: "refused", label: "No quiere pagar" },
  { key: "reschedule", label: "Reagendar" }
];

const DATE_PRESETS = [1, 2, 3];
const TIME_PRESETS = [9, 12, 15, 18];

function dateLabel(date: Date): string {
  const days = Math.round((date.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days === 1) return `Mañana, ${formatShortDate(date)}`;
  if (days === 2) return `Pasado mañana, ${formatShortDate(date)}`;
  return formatShortDate(date);
}

const MAX_NOTE_LENGTH = 280;

export function VisitOutcomeScreen({ loanId }: { loanId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const paymentRepo = usePaymentRepo();
  const visitRepo = useVisitRepo();

  const context = useAsync(() => paymentRepo.getCollectContext(loanId), [loanId]);
  const ctx = context.data;

  const [outcome, setOutcome] = useState<VisitOutcome>("promise");
  const [datePresetIndex, setDatePresetIndex] = useState(0);
  const [timePresetIndex, setTimePresetIndex] = useState(2);
  const [amountText, setAmountText] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const promiseDate = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + DATE_PRESETS[datePresetIndex]!);
    date.setHours(TIME_PRESETS[timePresetIndex]!, 0, 0, 0);
    return date;
  }, [datePresetIndex, timePresetIndex]);

  const defaultAmountCents = (ctx?.cuotaCents ?? 0) + (ctx?.moraCents ?? 0);
  const amountCents = useMemo(() => {
    if (amountText === "") return defaultAmountCents;
    const n = Number(amountText.replace(/[,.]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n * 100 : 0;
  }, [amountText, defaultAmountCents]);

  const handleSave = async () => {
    if (!ctx || submitting) return;
    setSubmitting(true);
    try {
      await visitRepo.record({
        customerId: ctx.customerId,
        loanId,
        outcome,
        promiseDate: outcome === "promise" ? promiseDate : undefined,
        promiseAmount: outcome === "promise" ? amountCents / 100 : undefined,
        note: note.trim() || undefined
      });
      router.back();
    } catch {
      Alert.alert("Error", "No se pudo guardar la visita. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Anotar visita"
        backIcon="close"
        onBack={() => router.back()}
        right={
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.cancel}>Cancelar</Text>
          </Pressable>
        }
      />

      {context.loading || !ctx ? (
        <ActivityIndicator color={colors.brandDeep} style={styles.loading} />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <ClientRow
              avatarKey={ctx.customerAvatarKey}
              name={ctx.customerName}
              meta={`Cuota ${ctx.currentInstallmentNumber} · ${formatShortDate(new Date())} · ${formatTime(new Date())}`}
            />

            <SectionLabel>Resultado de la visita</SectionLabel>
            <View style={styles.chipGrid}>
              {OUTCOME_OPTIONS.map((option) => (
                <OutcomeChip
                  key={option.key}
                  label={option.label}
                  selected={outcome === option.key}
                  onPress={() => setOutcome(option.key)}
                />
              ))}
            </View>

            {outcome === "promise" ? (
              <>
                <SectionLabel>Promesa de pago</SectionLabel>
                <View style={styles.dateRow}>
                  <Pressable
                    style={styles.dateBtn}
                    onPress={() => setDatePresetIndex((i) => (i + 1) % DATE_PRESETS.length)}
                  >
                    <Feather name="calendar" size={18} color={colors.brandPrimary} />
                    <Text style={styles.dateBtnText}>{dateLabel(new Date(promiseDate))}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.dateBtn}
                    onPress={() => setTimePresetIndex((i) => (i + 1) % TIME_PRESETS.length)}
                  >
                    <Feather name="clock" size={18} color={colors.brandPrimary} />
                    <Text style={styles.dateBtnText}>{formatTime(promiseDate)}</Text>
                  </Pressable>
                </View>

                <SectionLabel>Monto prometido</SectionLabel>
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>RD$</Text>
                  <TextInput
                    style={styles.amountInput}
                    value={amountText}
                    onChangeText={setAmountText}
                    keyboardType="numeric"
                    placeholder={String(defaultAmountCents / 100)}
                    placeholderTextColor={colors.slate}
                  />
                </View>
              </>
            ) : null}

            <SectionLabel>Comentario</SectionLabel>
            <View style={styles.noteCard}>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={(text) => setNote(text.slice(0, MAX_NOTE_LENGTH))}
                placeholder="Escribe una nota sobre la visita…"
                placeholderTextColor={colors.slate}
                multiline
              />
              <Text style={styles.noteCounter}>
                {note.length}/{MAX_NOTE_LENGTH}
              </Text>
            </View>
          </ScrollView>

          <Pressable
            style={[
              styles.cta,
              { paddingBottom: 18 + insets.bottom },
              submitting && styles.ctaDisabled
            ]}
            disabled={submitting}
            onPress={handleSave}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Feather name="check" size={20} color={colors.white} />
            )}
            <Text style={styles.ctaText}>{submitting ? "Guardando..." : "Guardar visita"}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loading: { marginTop: 40 },
  cancel: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.brandPrimary },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 10 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dateRow: { flexDirection: "row", gap: 10 },
  dateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14
  },
  dateBtnText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.ink },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16
  },
  amountLabel: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.brandPrimary },
  amountInput: { flex: 1, fontSize: 18, fontFamily: fonts.bold, color: colors.ink, padding: 0 },
  noteCard: { backgroundColor: colors.white, borderRadius: 12, padding: 14, gap: 10 },
  noteInput: { fontSize: 13, fontFamily: fonts.medium, color: colors.ink, minHeight: 60 },
  noteCounter: { fontSize: 11, fontFamily: fonts.medium, color: colors.slate, textAlign: "right" },
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

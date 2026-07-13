/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useState } from "react";
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
import { loanFrequencies, type LoanFrequency } from "../../lib/loans/loan.schema";
import { ValidationError } from "../../lib/errors/ValidationError";

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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await loanRepo.create({
        customerId,
        principal: Number(principal),
        interestRate: Number(interestRate),
        termCount: Number(termCount),
        frequency
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
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

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
  label: { fontSize: 13, fontWeight: "600", color: "#5B6B8C" },
  input: {
    borderWidth: 1,
    borderColor: "#D3DFF4",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#1A2B4C"
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F5F7FB"
  },
  chipActive: { backgroundColor: "#1A2B4C" },
  chipText: { fontSize: 13, color: "#1A2B4C" },
  chipTextActive: { color: "#FFFFFF" },
  error: { color: "#D64545", fontSize: 13 },
  submitButton: {
    backgroundColor: "#1A2B4C",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center"
  },
  submitButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" }
});

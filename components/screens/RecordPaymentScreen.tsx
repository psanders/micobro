/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { usePaymentRepo } from "../../lib/repo/RepoProvider";
import { paymentMethods, type PaymentMethod } from "../../lib/payments/payment.schema";
import { ValidationError } from "../../lib/errors/ValidationError";

export function RecordPaymentScreen({ loanId }: { loanId: string }) {
  const router = useRouter();
  const paymentRepo = usePaymentRepo();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await paymentRepo.create({ loanId, amount: Number(amount), method });
      router.back();
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : "No se pudo registrar el pago");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.field}>
        <Text style={styles.label}>Monto (RD$)</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          placeholder="1500"
          autoFocus
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Método</Text>
        <View style={styles.chips}>
          {paymentMethods.map((option) => (
            <Pressable
              key={option}
              style={[styles.chip, method === option && styles.chipActive]}
              onPress={() => setMethod(option)}
            >
              <Text style={[styles.chipText, method === option && styles.chipTextActive]}>
                {option}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.submitButtonText}>
          {submitting ? "Guardando..." : "Registrar pago"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF", padding: 16, gap: 20 },
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

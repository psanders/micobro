/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useCustomerRepo } from "../../lib/repo/RepoProvider";
import { ValidationError } from "../../lib/errors/ValidationError";

export function NewCustomerFormScreen() {
  const router = useRouter();
  const customerRepo = useCustomerRepo();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await customerRepo.create({ name, phone, address: address || undefined });
      router.back();
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : "No se pudo guardar el cliente");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.field}>
        <Text style={styles.label}>Nombre completo</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Teléfono</Text>
        <TextInput
          style={styles.input}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Dirección (opcional)</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.submitButtonText}>
          {submitting ? "Guardando..." : "Guardar cliente"}
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
  error: { color: "#D64545", fontSize: 13 },
  submitButton: {
    backgroundColor: "#1A2B4C",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center"
  },
  submitButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" }
});

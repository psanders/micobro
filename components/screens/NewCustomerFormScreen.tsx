/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useCustomerRepo } from "../../lib/repo/RepoProvider";
import { ValidationError } from "../../lib/errors/ValidationError";
import { formatCedula, normalizeCedula } from "../../lib/utils/cedula";
import { AvatarPicker } from "../AvatarPicker";
import type { AvatarKey } from "../avatars";
import { colors, fonts, radius } from "../../lib/ui/theme";

export function NewCustomerFormScreen() {
  const router = useRouter();
  const customerRepo = useCustomerRepo();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [cedula, setCedula] = useState("");
  const [avatarKey, setAvatarKey] = useState<AvatarKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await customerRepo.create({
        name,
        phone,
        address: address || undefined,
        cedula: cedula || undefined,
        avatarKey: avatarKey ?? undefined
      });
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

      <View style={styles.field}>
        <Text style={styles.label}>Cédula (opcional)</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          placeholder="000-0000000-0"
          maxLength={13}
          value={cedula}
          onChangeText={(v) => setCedula(formatCedula(normalizeCedula(v)) || v)}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Avatar (opcional)</Text>
        <AvatarPicker name={name || "Cliente"} value={avatarKey} onChange={setAvatarKey} />
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
  screen: { flex: 1, backgroundColor: colors.white, padding: 16, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.ds,
    padding: 14,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.ink
  },
  error: { color: colors.red, fontSize: 13, fontFamily: fonts.medium },
  submitButton: {
    backgroundColor: colors.brandDeep,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center"
  },
  submitButtonText: { color: colors.white, fontSize: 15, fontFamily: fonts.semiBold }
});

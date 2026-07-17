/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Editar Cliente — reuses the Cliente Detalle fields (name, phone,
 * address) in an editable form. No corresponding pencil.pen frame exists
 * yet; this follows the current design tokens (ScreenHeader, theme) so it
 * matches the rest of the app pending a design pass.
 */
import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCustomerRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { ValidationError } from "../../lib/errors/ValidationError";
import { formatCedula, normalizeCedula } from "../../lib/utils/cedula";
import { ScreenHeader } from "../ScreenHeader";
import { AvatarPicker } from "../AvatarPicker";
import type { AvatarKey } from "../avatars";
import { colors, fonts, radius } from "../../lib/ui/theme";

export function EditCustomerFormScreen({ customerId }: { customerId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const customerRepo = useCustomerRepo();

  const detail = useAsync(() => customerRepo.getDetail(customerId), [customerId]);
  const customer = detail.data;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [cedula, setCedula] = useState("");
  const [avatarKey, setAvatarKey] = useState<AvatarKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!customer) return;
    setName(customer.name);
    setPhone(customer.phone);
    setAddress(customer.address ?? "");
    setCedula(formatCedula(customer.cedula));
    setAvatarKey((customer.avatarKey as AvatarKey | null) ?? null);
  }, [customer]);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await customerRepo.update(customerId, {
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

  if (!detail.loading && !customer) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScreenHeader title="Editar cliente" backIcon="close" onBack={() => router.back()} />
        <Text style={styles.notFound}>No encontramos este cliente.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="Editar cliente" backIcon="close" onBack={() => router.back()} />

      {detail.loading || !customer ? (
        <ActivityIndicator color={colors.brandDeep} style={styles.loading} />
      ) : (
        <View style={styles.content}>
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
              {submitting ? "Guardando..." : "Guardar cambios"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loading: { marginTop: 40 },
  notFound: {
    fontSize: 14,
    fontFamily: fonts.medium,
    color: colors.slate,
    textAlign: "center",
    marginTop: 40
  },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.ds,
    backgroundColor: colors.white,
    padding: 14,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.ink
  },
  error: { color: colors.red, fontSize: 13, fontFamily: fonts.medium },
  submitButton: {
    backgroundColor: colors.brandDeep,
    borderRadius: radius.ds,
    paddingVertical: 16,
    alignItems: "center"
  },
  submitButtonText: { color: colors.white, fontSize: 15, fontFamily: fonts.semiBold }
});

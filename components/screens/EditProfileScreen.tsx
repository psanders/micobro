/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Editar perfil — captures the lender's own identity (photo or avatar,
 * name, nombre del negocio, teléfono). Modeled on EditCustomerFormScreen's
 * fields/layout (ScreenHeader, theme tokens). "Tu foto" is the same
 * PhotoField as the customer forms (app.pen "Foto de perfil").
 */
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfileRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { ValidationError } from "../../lib/errors/ValidationError";
import type { AvatarKey } from "../../lib/profile/profile.schema";
import { formatPhoneInput, normalizePhone } from "../../lib/utils/text";
import { PhotoField, type PhotoValue } from "../PhotoField";
import { ScreenHeader } from "../ScreenHeader";
import { colors, fonts, radius } from "../../lib/ui/theme";

/** Real-time hint under a field being formatted as the user types. */
function formatHint(digits: string, maxDigits: number, format: string): string {
  if (digits.length === 0) return `Formato: ${format}`;
  if (digits.length < maxDigits) return `Faltan ${maxDigits - digits.length} dígitos`;
  return "";
}

export function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profileRepo = useProfileRepo();

  const profile = useAsync(() => profileRepo.get(), []);

  const [name, setName] = useState("");
  const [photoValue, setPhotoValue] = useState<PhotoValue>({ photo: null, avatarKey: null });
  // Untouched → `photo` is omitted on save, so the stored photo is kept.
  const [photoTouched, setPhotoTouched] = useState(false);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.name);
    setPhotoValue({
      photo: profile.data.photo,
      avatarKey: (profile.data.avatarKey as AvatarKey | null) ?? null
    });
    setPhotoTouched(false);
    setBusinessName(profile.data.businessName ?? "");
    setPhone(profile.data.phone ?? "");
  }, [profile.data]);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await profileRepo.set({
        name,
        avatarKey: photoValue.avatarKey ?? undefined,
        ...(photoTouched ? { photo: photoValue.photo } : {}),
        businessName: businessName || undefined,
        phone: phone || undefined
      });
      router.back();
    } catch (err) {
      setError(err instanceof ValidationError ? err.message : "No se pudo guardar el perfil");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader title="Editar perfil" backIcon="close" onBack={() => router.back()} />

      {profile.loading ? (
        <ActivityIndicator color={colors.brandDeep} style={styles.loading} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          <PhotoField
            label="Tu foto"
            sheetTitle="Tu foto"
            name={name}
            fallbackName="Cobrador"
            value={photoValue}
            onChange={(next) => {
              setPhotoValue(next);
              setPhotoTouched(true);
            }}
            onBusyChange={setPreparingPhoto}
          />

          <View style={styles.field}>
            <Text style={styles.label}>Nombre completo</Text>
            <TextInput
              testID="profile-name"
              style={styles.input}
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nombre del negocio (opcional)</Text>
            <TextInput
              testID="profile-business"
              style={styles.input}
              value={businessName}
              onChangeText={setBusinessName}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Teléfono (opcional)</Text>
            <TextInput
              testID="profile-phone"
              style={styles.input}
              keyboardType="phone-pad"
              placeholder="809-251-2222"
              maxLength={12}
              value={phone}
              onChangeText={(v) => setPhone(formatPhoneInput(v))}
            />
            <Text style={styles.hint}>{formatHint(normalizePhone(phone), 10, "809-251-2222")}</Text>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.submitButton, preparingPhoto && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting || preparingPhoto}
          >
            <Text style={styles.submitButtonText}>
              {submitting ? "Guardando..." : "Guardar cambios"}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loading: { marginTop: 40 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 20 },
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
  hint: { fontSize: 12, fontFamily: fonts.regular, color: colors.muted, minHeight: 16 },
  error: { color: colors.red, fontSize: 13, fontFamily: fonts.medium },
  submitButton: {
    backgroundColor: colors.brandDeep,
    borderRadius: radius.ds,
    paddingVertical: 16,
    alignItems: "center"
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: colors.white, fontSize: 15, fontFamily: fonts.semiBold }
});

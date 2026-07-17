/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Editar perfil — captures the lender's own identity (name, avatar,
 * nombre del negocio, teléfono). Modeled on EditCustomerFormScreen's
 * fields/layout (ScreenHeader, theme tokens) since no corresponding
 * pencil.pen frame exists for this screen yet.
 *
 * The avatar selector is a minimal inline picker over the app's curated
 * `AVATAR_KEYS` (mirrored from components/avatars.ts's private `AVATARS`
 * record — that file isn't touched here to avoid conflicting with the
 * parallel avatar-infrastructure branch). This may later unify with the
 * customer-facing `AvatarPicker` once that lands.
 */
import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Image,
  StyleSheet
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfileRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { ValidationError } from "../../lib/errors/ValidationError";
import { AVATAR_KEYS, type AvatarKey } from "../../lib/profile/profile.schema";
import { avatarSource } from "../avatars";
import { ScreenHeader } from "../ScreenHeader";
import { colors, fonts, radius } from "../../lib/ui/theme";

export function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profileRepo = useProfileRepo();

  const profile = useAsync(() => profileRepo.get(), []);

  const [name, setName] = useState("");
  const [avatarKey, setAvatarKey] = useState<AvatarKey | undefined>(undefined);
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.name);
    setAvatarKey((profile.data.avatarKey as AvatarKey | null) ?? undefined);
    setBusinessName(profile.data.businessName ?? "");
    setPhone(profile.data.phone ?? "");
  }, [profile.data]);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await profileRepo.set({
        name,
        avatarKey,
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
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.field}>
            <Text style={styles.label}>Avatar</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.avatarRow}>
              {AVATAR_KEYS.map((key) => {
                const selected = avatarKey === key;
                const source = avatarSource(key);
                return (
                  <Pressable
                    key={key}
                    onPress={() => setAvatarKey(key)}
                    style={[styles.avatarOption, selected && styles.avatarOptionSelected]}
                  >
                    {source ? (
                      <Image source={source} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.avatarImageWrap}>
                        <Text style={styles.avatarFallback}>{key.slice(0, 2).toUpperCase()}</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nombre completo</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nombre del negocio (opcional)</Text>
            <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Teléfono (opcional)</Text>
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
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
  avatarRow: { flexDirection: "row" },
  avatarOption: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center"
  },
  avatarOptionSelected: { borderColor: colors.brandPrimary },
  avatarImageWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  avatarImage: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { fontSize: 12, fontFamily: fonts.bold, color: colors.brandDeep },
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

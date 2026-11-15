/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * The photo field of Nuevo cliente, Editar cliente and Editar perfil
 * (app.pen "Foto de perfil"): a preview plus one "Editar" button. "Editar"
 * opens LoanOptionsSheet with Tomar foto / Elegir de la galería / Elegir un
 * avatar / Quitar. Photos go through lib/photos/pickPhoto.ts; nothing is
 * saved here, the form saves the value it gets from `onChange`.
 *
 * Choosing a cartoon drops the photo; picking a photo keeps the cartoon key
 * (the photo shows first); Quitar clears both, back to initials.
 */
import { useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet
} from "react-native";
import { Avatar } from "./Avatar";
import { AvatarSheet } from "./AvatarSheet";
import { LoanOptionsSheet, type LoanOption } from "./LoanOptionsSheet";
import type { AvatarKey } from "./avatars";
import { pickPhoto, type PhotoSource } from "../lib/photos/pickPhoto";
import { logger } from "../lib/logger";
import { colors, fonts, radius } from "../lib/ui/theme";

export interface PhotoValue {
  /** Base64 JPEG, or null for none. */
  photo: string | null;
  avatarKey: AvatarKey | null;
}

interface PhotoFieldProps {
  /** Field label, e.g. "Foto del cliente (opcional)" or "Tu foto". */
  label: string;
  /** The menu sheet's title, e.g. "Foto del cliente" or "Tu foto". */
  sheetTitle: string;
  /** For the initials and the menu's subtitle. */
  name: string;
  /** Shown when `name` is empty. */
  fallbackName?: string;
  value: PhotoValue;
  onChange: (next: PhotoValue) => void;
  /** True while a picked photo is being prepared; the form disables saving. */
  onBusyChange?: (busy: boolean) => void;
}

function previewLabel({ photo, avatarKey }: PhotoValue): string {
  if (photo) return "Foto elegida";
  if (avatarKey) return "Avatar elegido";
  return "Sin foto";
}

function openSettings() {
  Linking.openSettings().catch((err) => {
    logger.warn("could not open app settings", {
      message: err instanceof Error ? err.message : String(err)
    });
  });
}

export function PhotoField({
  label,
  sheetTitle,
  name,
  fallbackName = "Cliente",
  value,
  onChange,
  onBusyChange
}: PhotoFieldProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [avatarsVisible, setAvatarsVisible] = useState(false);
  const [preparing, setPreparing] = useState(false);
  // iOS can't present the camera, the picker or another sheet while the
  // menu is still sliding away, so the chosen option waits for onDismiss.
  const pendingAction = useRef<(() => void) | null>(null);

  const displayName = name.trim() || fallbackName;

  function setBusy(busy: boolean) {
    setPreparing(busy);
    onBusyChange?.(busy);
  }

  function choose(action: () => void) {
    setMenuVisible(false);
    if (Platform.OS === "ios") {
      pendingAction.current = action;
    } else {
      action();
    }
  }

  function runPending() {
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  }

  async function handlePick(source: PhotoSource) {
    setBusy(true);
    try {
      const result = await pickPhoto(source);
      if (result.status === "picked") {
        onChange({ photo: result.photo, avatarKey: value.avatarKey });
      } else if (result.status === "denied") {
        Alert.alert(
          "Sin acceso a la cámara",
          "Para tomar la foto, permite la cámara en Ajustes. También puedes elegir una foto de la galería.",
          [
            { text: "Ahora no", style: "cancel" },
            { text: "Abrir Ajustes", onPress: openSettings }
          ]
        );
      }
    } catch (err) {
      logger.warn("could not use the picked photo", {
        message: err instanceof Error ? err.message : String(err)
      });
      Alert.alert("No se pudo usar esta foto", "Prueba con otra foto o tómala de nuevo.", [
        { text: "Entendido" }
      ]);
    } finally {
      setBusy(false);
    }
  }

  const options: LoanOption[] = [
    {
      key: "camera",
      icon: "camera",
      title: "Tomar foto",
      subtitle: "Con la cámara del teléfono",
      tone: "brand",
      onPress: () => choose(() => void handlePick("camera"))
    },
    {
      key: "library",
      icon: "image",
      title: "Elegir de la galería",
      subtitle: "De las fotos del teléfono",
      tone: "brand",
      onPress: () => choose(() => void handlePick("library"))
    },
    {
      key: "avatar",
      icon: "smile",
      title: "Elegir un avatar",
      subtitle: "Uno de los dibujos de Micobro",
      tone: "brand",
      onPress: () => choose(() => setAvatarsVisible(true))
    }
  ];
  if (value.photo || value.avatarKey) {
    options.push({
      key: "remove",
      icon: "x",
      title: "Quitar",
      subtitle: "Vuelve a mostrar las iniciales",
      tone: "brand",
      onPress: () => choose(() => onChange({ photo: null, avatarKey: null }))
    });
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <View
          testID="photo-field-preview"
          accessible
          accessibilityRole="image"
          accessibilityLabel={previewLabel(value)}
        >
          <Avatar photo={value.photo} avatarKey={value.avatarKey} name={displayName} size={64} />
        </View>
        <Pressable
          testID="photo-field-edit"
          style={[styles.editButton, preparing && styles.editButtonDisabled]}
          onPress={() => setMenuVisible(true)}
          disabled={preparing}
          accessibilityRole="button"
          accessibilityState={{ disabled: preparing }}
        >
          <Text style={styles.editText}>Editar</Text>
        </Pressable>
      </View>
      {preparing && (
        <View style={styles.preparing}>
          <ActivityIndicator size="small" color={colors.brandDeep} />
          <Text style={styles.preparingText}>Preparando foto...</Text>
        </View>
      )}

      <LoanOptionsSheet
        visible={menuVisible}
        title={sheetTitle}
        subtitle={displayName}
        options={options}
        onClose={() => setMenuVisible(false)}
        onDismiss={runPending}
      />
      <AvatarSheet
        visible={avatarsVisible}
        value={value.avatarKey}
        name={displayName}
        onSelect={(key) => {
          setAvatarsVisible(false);
          onChange({ photo: null, avatarKey: key });
        }}
        onClose={() => setAvatarsVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.muted },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  editButton: {
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.ds,
    backgroundColor: colors.white,
    paddingVertical: 10,
    paddingHorizontal: 18
  },
  editButtonDisabled: { opacity: 0.5 },
  editText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.brandDeep },
  preparing: { flexDirection: "row", alignItems: "center", gap: 8 },
  preparingText: { fontSize: 12, fontFamily: fonts.medium, color: colors.muted }
});

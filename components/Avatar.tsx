/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * m/avatar from pencil.pen: the photo (base64 JPEG) when there is one,
 * else the bundled avatar image by key, else an initials circle. A photo
 * that fails to load falls back the same way.
 */
import { useEffect, useMemo, useState } from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { avatarSource } from "./avatars";
import { colors, fonts } from "../lib/ui/theme";

interface AvatarProps {
  /** Base64 JPEG with no `data:` prefix (lib/photos/photo.schema.ts). */
  photo?: string | null;
  avatarKey?: string | null;
  name: string;
  size?: number;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function Avatar({ photo, avatarKey, name, size = 42 }: AvatarProps) {
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => setPhotoFailed(false), [photo]);
  const photoSource = useMemo(
    () => (photo ? { uri: `data:image/jpeg;base64,${photo}` } : null),
    [photo]
  );
  const source = avatarSource(avatarKey);
  const radius = size / 2;

  if (photoSource && !photoFailed) {
    return (
      <Image
        source={photoSource}
        onError={() => setPhotoFailed(true)}
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }

  if (source) {
    return <Image source={source} style={{ width: size, height: size, borderRadius: radius }} />;
  }

  const fontSize = size / 3;
  // Same fontSize-proportional iOS nudge as BrandLogo.tsx's markM/word.
  const iosNudge = Platform.OS === "ios" ? fontSize * 0.13 : 0;

  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}>
      <Text
        style={[
          styles.initials,
          { fontSize, lineHeight: fontSize },
          iosNudge ? { transform: [{ translateY: iosNudge }] } : null
        ]}
      >
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center"
  },
  initials: {
    fontFamily: fonts.bold,
    color: colors.brandDeep,
    // includeFontPadding/textAlignVertical only affect Android — see BrandLogo.tsx
    includeFontPadding: false,
    textAlignVertical: "center"
  }
});

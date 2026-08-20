/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * m/avatar from pencil.pen: bundled avatar image by key, or an
 * initials circle when there's no image.
 */
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { avatarSource } from "./avatars";
import { colors, fonts } from "../lib/ui/theme";

interface AvatarProps {
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

export function Avatar({ avatarKey, name, size = 42 }: AvatarProps) {
  const source = avatarSource(avatarKey);
  const radius = size / 2;

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

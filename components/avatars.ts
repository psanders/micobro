/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Maps semantic avatar keys (as stored by the repo layer, e.g.
 * Profile.avatarKey) to bundled assets. Metro needs static import paths,
 * hence the explicit table.
 */
import type { ImageSourcePropType } from "react-native";
import female1 from "../assets/avatars/female1.png";
import female2 from "../assets/avatars/female2.png";
import male1 from "../assets/avatars/male1.png";
import male2 from "../assets/avatars/male2.png";
import male3 from "../assets/avatars/male3.png";
import male4 from "../assets/avatars/male4.png";
import male5 from "../assets/avatars/male5.png";
import male6 from "../assets/avatars/male6.png";
import male7 from "../assets/avatars/male7.png";

const AVATARS: Record<string, ImageSourcePropType> = {
  female1,
  female2,
  male1,
  male2,
  male3,
  male4,
  male5,
  male6,
  male7
};

export function avatarSource(key: string | null | undefined): ImageSourcePropType | null {
  if (!key) return null;
  return AVATARS[key] ?? null;
}

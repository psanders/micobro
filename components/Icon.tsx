/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Drop-in Feather replacement that keeps every icon's raw glyph out of the
 * accessibility tree. Every Feather icon in this app is decorative — its
 * meaning is already carried by a sibling Text or by the containing
 * Pressable's own accessibilityLabel — but without this, iOS auto-joins the
 * icon font's private-use glyph character into the accessible label VoiceOver
 * reads aloud (see issue #117). `importantForAccessibility="no"` mirrors the
 * same intent on Android for parity, though TalkBack doesn't exhibit the leak.
 */
import type { ComponentProps } from "react";
import { Feather } from "@expo/vector-icons";

export function Icon(props: ComponentProps<typeof Feather>) {
  return <Feather accessibilityElementsHidden importantForAccessibility="no" {...props} />;
}

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * On-device mirror of the design tokens in `pencil.pen` (get_variables).
 * The design file is the source of truth — when a token changes there,
 * update it here. Font families map to @expo-google-fonts/plus-jakarta-sans
 * exports loaded in app/_layout.tsx.
 *
 *   pencil.pen variable        → theme key
 *   brand.blue.deep   #0B4F4A  → colors.brandDeep
 *   brand.blue.primary #0E7C6B → colors.brandPrimary
 *   brand.blue.sky    #34C9A6  → colors.brandSky
 *   brand.ink         #142A26  → colors.ink
 *   brand.mist        #E8F7F2  → colors.mist
 *   brand.white       #FFFFFF  → colors.white
 *   brand.orange.deep #C2410C  → colors.orangeDeep
 *   brand.orange.primary #EA7317 → colors.orangePrimary
 *   brand.yellow.accent #F5B841 → colors.yellowAccent
 *   ds.bg             #F4F8FF  → colors.bg
 *   ds.surface        #FFFFFF  → colors.surface
 *   ds.border         #E5EAF1  → colors.border
 *   ds.subtle         #EEF3F9  → colors.subtle
 *   ds.muted          #697A93  → colors.muted
 *   ds.red            #DC2626  → colors.red
 *   ds.red.bg         #FCEBEB  → colors.redBg
 *   ds.green          #16A34A  → colors.green
 *   ds.green.bg       #E8F7EE  → colors.greenBg
 *   ds.amber          #D97706  → colors.amber
 *   ds.amber.bg       #FDF1E3  → colors.amberBg
 *   radius.card 20 / radius.ds 10 / radius.pill 9999 → radius.*
 */
export const colors = {
  brandDeep: "#0B4F4A",
  brandPrimary: "#0E7C6B",
  brandSky: "#34C9A6",
  ink: "#142A26",
  mist: "#E8F7F2",
  white: "#FFFFFF",
  orangeDeep: "#C2410C",
  orangePrimary: "#EA7317",
  yellowAccent: "#F5B841",
  bg: "#F4F8FF",
  surface: "#FFFFFF",
  border: "#E5EAF1",
  subtle: "#EEF3F9",
  muted: "#697A93",
  // Secondary text tone used across the auth designs (pinSubtitle, skipLink).
  slate: "#7888A8",
  red: "#DC2626",
  redBg: "#FCEBEB",
  green: "#16A34A",
  greenBg: "#E8F7EE",
  amber: "#D97706",
  amberBg: "#FDF1E3",
  // Hairline used on the auth PIN cells and action-bar top border.
  hairline: "#D3DFF4",
  actionBarBorder: "#E2EAF7"
} as const;

export const radius = {
  card: 20,
  ds: 10,
  pill: 9999
} as const;

export const fonts = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semiBold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold"
} as const;

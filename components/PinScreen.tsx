/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Shared PIN screen skeleton from pencil.pen — the design note on `EYzn2`
 * says setup, confirm, and error are the same component, and `Jy3HY`
 * (Desbloquear) uses the same dots + keypad with a different header and a
 * footer link. Screens compose it via the header/footer slots.
 */
import type { ReactNode } from "react";
import { View, Text, StyleSheet } from "react-native";
import { PinInput } from "./PinInput";
import { PinKeypad } from "./PinKeypad";
import { colors, fonts } from "../lib/ui/theme";

interface PinScreenProps {
  /** Logo/title block (setup) or logo/avatar/greeting block (unlock). */
  header: ReactNode;
  filled: number;
  error?: boolean;
  /** Small caption under the dots, e.g. "Se guarda solo en este teléfono". */
  hint?: string;
  onKey: (key: string) => void;
  /** Bottom slot, e.g. the "¿Olvidaste tu PIN?" link. Renders right under
   *  the keypad — the content always centers as one block, real users
   *  never see the avatar+greeting variant that used to justify pinning
   *  this to the screen edge (no profile-capture flow exists yet). */
  footer?: ReactNode;
}

export function PinScreen({ header, filled, error, hint, onKey, footer }: PinScreenProps) {
  return (
    <View style={styles.screen}>
      {header}
      <View style={styles.pinGroup}>
        <PinInput length={4} filled={filled} error={error} />
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <PinKeypad onPress={onKey} />
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.white,
    paddingTop: 48,
    paddingHorizontal: 32,
    paddingBottom: 32,
    justifyContent: "center",
    gap: 32,
    alignItems: "center"
  },
  pinGroup: { gap: 14, alignItems: "center", alignSelf: "stretch" },
  hint: { fontSize: 11, fontFamily: fonts.medium, color: colors.slate },
  footer: { alignItems: "center", gap: 14 }
});

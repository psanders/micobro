/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Bottom-sheet month calendar for picking a single date, with an optional
 * hard minimum (days before `minDate` are disabled, when provided — omit it
 * to allow any date, past or future, e.g. for backdating a loan's first
 * payment) and an optional per-date disable predicate (used for
 * skip-Sundays on daily loans). Pure React Native — no native date-picker
 * dependency, matching the app's deliberate choice to stay within
 * already-installed packages. Ported from mikro's `CalendarPicker.tsx`.
 */
import { useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fonts, radius } from "../lib/ui/theme";

interface CalendarPickerProps {
  visible: boolean;
  title: string;
  value: Date;
  /**
   * Earliest selectable day (inclusive). Days before it are disabled, and
   * month navigation stops before reaching it. Omit for no lower bound —
   * any past or future date is selectable and navigation is unrestricted.
   */
  minDate?: Date;
  /** Additional per-date disable rule, combined with `minDate`. */
  isDateDisabled?: (date: Date) => boolean;
  onSelect: (value: Date) => void;
  onClose: () => void;
}

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function monthTitle(year: number, month: number): string {
  const label = new Intl.DateTimeFormat("es-DO", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1)
  );
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function CalendarPicker({
  visible,
  title,
  value,
  minDate,
  isDateDisabled,
  onSelect,
  onClose
}: CalendarPickerProps) {
  const [view, setView] = useState({ year: value.getFullYear(), month: value.getMonth() });

  const min = minDate ? atMidnight(minDate) : null;
  const firstOfMonth = new Date(view.year, view.month, 1);
  // Monday-first offset (JS getDay is Sunday-first).
  const leading = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();

  // Disable navigating to months entirely before the minimum, when one is set.
  const prevDisabled =
    min !== null &&
    (view.year < min.getFullYear() ||
      (view.year === min.getFullYear() && view.month <= min.getMonth()));

  const cells: (Date | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(view.year, view.month, day));
  while (cells.length % 7 !== 0) cells.push(null);

  const shiftMonth = (delta: number) => {
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8} testID="calendar-close">
            <Feather name="x" size={20} color={colors.slate} />
          </Pressable>
        </View>

        <View style={styles.monthNav}>
          <Pressable
            onPress={() => !prevDisabled && shiftMonth(-1)}
            hitSlop={8}
            disabled={prevDisabled}
            testID="calendar-prev"
          >
            <Feather
              name="chevron-left"
              size={22}
              color={prevDisabled ? colors.hairline : colors.brandDeep}
            />
          </Pressable>
          <Text style={styles.monthLabel}>{monthTitle(view.year, view.month)}</Text>
          <Pressable onPress={() => shiftMonth(1)} hitSlop={8} testID="calendar-next">
            <Feather name="chevron-right" size={22} color={colors.brandDeep} />
          </Pressable>
        </View>

        <View style={styles.weekRow}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={styles.weekday}>
              {w}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {cells.map((date, i) => {
            if (!date) return <View key={i} style={styles.cell} />;
            const disabled = (min !== null && date < min) || (isDateDisabled?.(date) ?? false);
            const selected = sameDay(date, value);
            return (
              <Pressable
                key={i}
                style={styles.cell}
                disabled={disabled}
                onPress={() => {
                  onSelect(date);
                  onClose();
                }}
                testID={`calendar-day-${date.getDate()}`}
              >
                <View style={[styles.dayInner, selected && styles.daySelected]}>
                  <Text
                    style={[
                      styles.dayText,
                      disabled && styles.dayDisabled,
                      selected && styles.daySelectedText
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(20, 37, 74, 0.4)" },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingBottom: 28
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.actionBarBorder
  },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8
  },
  monthLabel: { fontFamily: fonts.semiBold, fontSize: 15, color: colors.ink },
  weekRow: { flexDirection: "row", paddingHorizontal: 12, paddingBottom: 4 },
  weekday: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.slate
  },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12 },
  cell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4
  },
  dayInner: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center"
  },
  daySelected: { backgroundColor: colors.brandPrimary },
  dayText: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  dayDisabled: { color: colors.hairline },
  daySelectedText: { color: colors.white, fontFamily: fonts.bold }
});

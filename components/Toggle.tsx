/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * An iOS-style pill toggle matching pencil.pen's design intent — React
 * Native's built-in `Switch` renders the chunky Android Material control on
 * Android, which doesn't match. Built from `Pressable` + `Animated` so the
 * knob slides and the track color crossfades on every value change.
 */
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { colors } from "../lib/ui/theme";

const TRACK_WIDTH = 51;
const TRACK_HEIGHT = 31;
const KNOB_SIZE = 27;
const KNOB_INSET = 2;
const TRAVEL = TRACK_WIDTH - KNOB_SIZE - KNOB_INSET * 2;
const ANIMATION_DURATION_MS = 170;

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export function Toggle({ value, onValueChange, disabled }: ToggleProps) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: value ? 1 : 0,
      duration: ANIMATION_DURATION_MS,
      useNativeDriver: false
    }).start();
  }, [value, progress]);

  const trackColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.brandSky]
  });
  const knobTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRAVEL]
  });

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      hitSlop={8}
    >
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.knob, { transform: [{ translateX: knobTranslateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    padding: KNOB_INSET,
    justifyContent: "center"
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: colors.white,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2
  }
});

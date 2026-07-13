/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Micobro</Text>
      <Text style={styles.subtitle}>Control de préstamos, sin internet.</Text>
      <Link href="/customers/new" style={styles.link}>
        Agregar cliente
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24
  },
  title: {
    fontSize: 28,
    fontWeight: "700"
  },
  subtitle: {
    fontSize: 14,
    color: "#555"
  },
  link: {
    marginTop: 24,
    fontSize: 16,
    color: "#0F5132",
    fontWeight: "600"
  }
});

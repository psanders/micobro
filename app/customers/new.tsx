/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { useState } from "react";
import { Button, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { db } from "../../lib/db/client";
import { createCreateCustomer } from "../../lib/customers";
import { logger } from "../../lib/logger";

export default function NewCustomerScreen() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  async function handleSubmit() {
    try {
      const createCustomer = createCreateCustomer({ db });
      await createCustomer({ name, phone });
      router.back();
    } catch (err) {
      logger.error("failed to create customer", { error: String(err) });
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Nombre completo"
        value={name}
        onChangeText={setName}
      />
      <TextInput
        style={styles.input}
        placeholder="Teléfono"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <Button title="Guardar cliente" onPress={handleSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    gap: 12
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16
  }
});

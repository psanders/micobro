/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 */
import { View, Text, Pressable, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useCustomerRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import type { Customer } from "../../lib/customers/customer.schema";

export function CustomerListScreen() {
  const router = useRouter();
  const customerRepo = useCustomerRepo();
  const { data, loading } = useAsync(() => customerRepo.list(), []);

  return (
    <View style={styles.screen}>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Aún no tienes clientes.</Text>}
          renderItem={({ item }: { item: Customer }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/customers/${item.id}`)}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.phone}>{item.phone}</Text>
            </Pressable>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push("/customers/new")}>
        <Text style={styles.fabText}>+ Agregar cliente</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  list: { padding: 16, gap: 8 },
  empty: { textAlign: "center", color: "#5B6B8C", marginTop: 32 },
  row: {
    backgroundColor: "#F5F7FB",
    borderRadius: 12,
    padding: 16,
    gap: 2
  },
  name: { fontSize: 16, fontWeight: "600", color: "#1A2B4C" },
  phone: { fontSize: 13, color: "#5B6B8C" },
  fab: {
    margin: 16,
    backgroundColor: "#1A2B4C",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center"
  },
  fabText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" }
});

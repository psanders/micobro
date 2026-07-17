/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * 04 Buscar per pencil.pen `p2s52`: search field, recent searches
 * (device-local, max 5), and the MIS CLIENTES list with status lines.
 */
import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useCustomerRepo } from "../../lib/repo/RepoProvider";
import {
  getRecentSearches,
  addRecentSearch,
  removeRecentSearch
} from "../../lib/search/recentSearches";
import { ClientRow } from "../ClientRow";
import { SearchInput } from "../SearchInput";
import { SectionLabel } from "../SectionLabel";
import { ListTile } from "../ListTile";
import { colors, fonts } from "../../lib/ui/theme";
import type { CustomerSearchResult } from "../../lib/repo/types";

export function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const customerRepo = useCustomerRepo();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSearchResult[] | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const runSearch = useCallback(
    (q: string) => {
      setLoading(true);
      customerRepo
        .search(q)
        .then(setResults)
        .finally(() => setLoading(false));
    },
    [customerRepo]
  );

  useEffect(() => {
    runSearch(query);
  }, [query, runSearch]);

  useEffect(() => {
    getRecentSearches().then(setRecents);
  }, []);

  async function handleSubmit() {
    if (!query.trim()) return;
    setRecents(await addRecentSearch(query));
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Buscar cliente</Text>
        <SearchInput
          value={query}
          placeholder="Nombre, teléfono o cédula…"
          onChangeText={setQuery}
          onSubmit={handleSubmit}
        />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {recents.length > 0 && (
          <View style={styles.section}>
            <SectionLabel>Búsquedas recientes</SectionLabel>
            <View style={styles.sectionList}>
              {recents.map((entry) => (
                <ListTile
                  key={entry}
                  icon="clock"
                  label={entry}
                  trailingIcon="x"
                  onPress={() => setQuery(entry)}
                  onTrailingPress={async () => setRecents(await removeRecentSearch(entry))}
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <SectionLabel>{query.trim() ? "Resultados" : "Mis clientes"}</SectionLabel>
          {loading ? (
            <ActivityIndicator color={colors.brandDeep} style={styles.loader} />
          ) : results && results.length > 0 ? (
            <View style={styles.sectionList}>
              {results.map((customer) => (
                <ClientRow
                  key={customer.id}
                  avatarKey={customer.avatarKey}
                  name={customer.name}
                  meta={
                    customer.inMora
                      ? `En mora · ${customer.loanCount} préstamo${customer.loanCount === 1 ? "" : "s"}`
                      : `Activo · ${customer.loanCount} préstamo${customer.loanCount === 1 ? "" : "s"}`
                  }
                  metaColor={customer.inMora ? colors.orangeDeep : colors.slate}
                  compact
                  trailing={<Feather name="chevron-right" size={18} color={colors.slate} />}
                  onPress={() => router.push(`/customers/${customer.id}`)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.empty}>
              {query.trim()
                ? `No se encontraron clientes para “${query.trim()}”.`
                : "Aún no tienes clientes registrados."}
            </Text>
          )}
        </View>
      </ScrollView>

      <Pressable
        testID="search-fab-new-customer"
        style={[styles.fab, { bottom: 24 + insets.bottom }]}
        onPress={() => router.push("/customers/new")}
        hitSlop={8}
      >
        <Feather name="plus" size={28} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  title: { fontSize: 24, fontFamily: fonts.bold, color: colors.brandDeep },
  body: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  section: { gap: 8 },
  sectionList: { gap: 8 },
  loader: { marginTop: 20 },
  empty: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.slate,
    textAlign: "center",
    marginTop: 16
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.brandDeep,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6
  }
});

/**
 * Copyright (C) 2026 by Pedro Sanders. MIT License.
 *
 * Mi cartera per designs/app.pen ("Mi cartera — reporte"): loads the
 * lender's position and renders it with `PortfolioReport`. Every figure
 * comes from `lib/reports/composePosition`.
 */
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReportsRepo } from "../../lib/repo/RepoProvider";
import { useAsync } from "../../lib/hooks/useAsync";
import { ScreenHeader } from "../ScreenHeader";
import { PortfolioReport } from "../PortfolioReport";
import { colors } from "../../lib/ui/theme";

export function MyPortfolioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reportsRepo = useReportsRepo();

  const report = useAsync(() => reportsRepo.getPosition());
  const position = report.data;
  const monthName = new Date().toLocaleDateString("es-DO", { month: "long", year: "numeric" });

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Mi cartera"
        subtitle={monthName.charAt(0).toUpperCase() + monthName.slice(1)}
        onBack={() => router.back()}
      />

      {report.loading || !position ? (
        <ActivityIndicator color={colors.brandDeep} style={styles.loading} />
      ) : (
        <PortfolioReport position={position} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loading: { marginTop: 40 }
});

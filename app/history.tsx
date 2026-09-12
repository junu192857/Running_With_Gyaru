// 기록 화면: SQLite 에 저장된 지난 러닝 목록

import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { listRuns, type RunRecord } from "../src/services/db";
import { formatDistance, formatDuration, formatPace } from "../src/utils/format";
import { theme } from "../src/theme";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function HistoryScreen() {
  const [runs, setRuns] = useState<RunRecord[] | null>(null);

  useEffect(() => {
    listRuns()
      .then(setRuns)
      .catch(() => setRuns([]));
  }, []);

  if (runs == null) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <Text style={styles.empty}>불러오는 중…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={runs}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>아직 기록이 없어요.</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.date}>{formatDate(item.startedAt)}</Text>
              <Text style={[styles.badge, item.completed ? styles.badgeDone : styles.badgePartial]}>
                {item.completed ? "완주" : "중단"}
              </Text>
            </View>
            <Text style={styles.summary}>
              {formatDistance(item.distanceMeters)} km · {formatDuration(item.durationSeconds)} ·{" "}
              {formatPace(item.averagePaceSecondsPerKm)}/km
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  list: { padding: theme.space, gap: 10 },
  row: { backgroundColor: theme.surface, borderRadius: theme.radius, padding: theme.space, gap: 6 },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { color: theme.text, fontSize: 15, fontWeight: "700" },
  badge: { fontSize: 12, fontWeight: "700", overflow: "hidden", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  badgeDone: { color: "#1a0d14", backgroundColor: theme.accent },
  badgePartial: { color: theme.textMuted, backgroundColor: theme.surfaceAlt },
  summary: { color: theme.textMuted, fontSize: 14 },
  empty: { color: theme.textMuted, textAlign: "center", marginTop: 40 },
});

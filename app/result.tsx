// 결과 화면: 방금 끝난 러닝 요약. SQLite 저장은 스토어에서 이미 끝난 상태다.

import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, PrimaryButton, StatTile } from "../src/components/ui";
import { useRunStore } from "../src/store/useRunStore";
import { formatDistance, formatDuration, formatPace } from "../src/utils/format";
import { theme } from "../src/theme";

export default function ResultScreen() {
  const router = useRouter();
  const snapshot = useRunStore((s) => s.snapshot);
  const settings = useRunStore((s) => s.settings);
  const error = useRunStore((s) => s.error);
  const reset = useRunStore((s) => s.reset);

  const goalText =
    settings.goalType === "distance"
      ? `${(settings.goalValue / 1000).toFixed(1)} km`
      : formatDuration(settings.goalValue);

  const onDone = () => {
    void reset().then(() => router.replace("/"));
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.body}>
        <Text style={styles.headline}>
          {snapshot.goalReached ? "완주했어요!" : "여기까지 달렸어요"}
        </Text>
        <Text style={styles.sub}>목표 {goalText}</Text>

        <Card>
          <View style={styles.row}>
            <StatTile label="거리" value={formatDistance(snapshot.distanceMeters)} unit="km" />
            <StatTile label="시간" value={formatDuration(snapshot.durationSeconds)} />
          </View>
          <View style={styles.row}>
            <StatTile label="평균 페이스" value={formatPace(snapshot.averagePaceSecPerKm)} unit="/km" />
            <StatTile label="완주" value={snapshot.goalReached ? "O" : "X"} />
          </View>
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.footer}>
        <PrimaryButton label="지난 기록 보기" tone="neutral" onPress={() => router.push("/history")} />
        <PrimaryButton label="확인" onPress={onDone} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  body: { flex: 1, padding: theme.space, gap: 12, justifyContent: "center" },
  headline: { color: theme.text, fontSize: 30, fontWeight: "900", textAlign: "center" },
  sub: { color: theme.textMuted, fontSize: 14, textAlign: "center", marginBottom: 8 },
  row: { flexDirection: "row", gap: 12 },
  error: { color: theme.danger, fontSize: 13, textAlign: "center" },
  footer: { padding: theme.space, gap: 12 },
});

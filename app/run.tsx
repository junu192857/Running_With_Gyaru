// 측정 화면: 거리 / 시간 / 페이스를 실시간으로 보여 준다.

import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton, StatTile } from "../src/components/ui";
import { useRunStore } from "../src/store/useRunStore";
import { formatDistance, formatDuration, formatPace } from "../src/utils/format";
import { theme } from "../src/theme";
import { useEffect } from "react";

export default function RunScreen() {
  const router = useRouter();
  const status = useRunStore((s) => s.status);
  const settings = useRunStore((s) => s.settings);
  const snapshot = useRunStore((s) => s.snapshot);
  const pause = useRunStore((s) => s.pause);
  const resume = useRunStore((s) => s.resume);
  const stop = useRunStore((s) => s.stop);

  // 목표 달성으로 스토어가 스스로 종료되면 결과 화면으로 넘어간다
  useEffect(() => {
    if (status === "stats" || status === "finished") {
      router.replace("/result");
    }
  }, [status, router]);

  const paused = status === "paused";
  const goalLabel =
    settings.goalType === "distance"
      ? `목표 ${(settings.goalValue / 1000).toFixed(1)} km`
      : `목표 ${formatDuration(settings.goalValue)}`;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.body}>
        <Text style={styles.goal}>{goalLabel}</Text>

        <View style={styles.hero}>
          <Text style={styles.heroValue}>{formatDistance(snapshot.distanceMeters)}</Text>
          <Text style={styles.heroUnit}>km</Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${snapshot.progress * 100}%` }]} />
        </View>

        <View style={styles.stats}>
          <StatTile label="시간" value={formatDuration(snapshot.durationSeconds)} />
          <StatTile label="현재 페이스" value={formatPace(snapshot.currentPaceSecPerKm)} unit="/km" />
          <StatTile label="평균 페이스" value={formatPace(snapshot.averagePaceSecPerKm)} unit="/km" />
        </View>

        {paused ? <Text style={styles.pausedBadge}>일시정지 중 · 거리와 시간이 멈춰 있어요</Text> : null}
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          label={paused ? "이어서 달리기" : "일시정지"}
          tone={paused ? "accent" : "neutral"}
          onPress={paused ? resume : pause}
        />
        <PrimaryButton label="종료" tone="danger" onPress={() => void stop()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  body: { flex: 1, padding: theme.space, gap: 20, justifyContent: "center" },
  goal: { color: theme.textMuted, fontSize: 14, textAlign: "center", fontWeight: "600" },
  hero: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 8 },
  heroValue: { color: theme.text, fontSize: 76, fontWeight: "900", letterSpacing: -2 },
  heroUnit: { color: theme.textMuted, fontSize: 22, fontWeight: "700" },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.surfaceAlt,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: theme.accent },
  stats: { flexDirection: "row", gap: 12, marginTop: 8 },
  pausedBadge: {
    color: theme.accent,
    fontSize: 13,
    textAlign: "center",
    fontWeight: "600",
  },
  footer: { padding: theme.space, gap: 12 },
});

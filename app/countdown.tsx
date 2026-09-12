// 카운트다운 화면: 5초 세는 동안 마일스톤 음성을 백그라운드에서 미리 생성한다.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "../src/components/ui";
import { useRunStore } from "../src/store/useRunStore";
import { COUNTDOWN_SECONDS } from "../src/store/runSession";
import { theme } from "../src/theme";

export default function CountdownScreen() {
  const router = useRouter();
  const beginRun = useRunStore((s) => s.beginRun);
  const reset = useRunStore((s) => s.reset);
  const prewarm = useRunStore((s) => s.prewarm);
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);
  const startedRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setRemaining((value) => value - 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (remaining > 0 || startedRef.current) return;
    // StrictMode 등으로 두 번 들어와도 러닝은 한 번만 시작한다
    startedRef.current = true;
    void beginRun().then(() => router.replace("/run"));
  }, [remaining, beginRun, router]);

  const onCancel = () => {
    void reset().then(() => router.replace("/"));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <Text style={styles.count}>{Math.max(0, remaining)}</Text>
        <Text style={styles.caption}>
          {prewarm == null
            ? "응원 멘트를 준비하고 있어요…"
            : prewarm.ready === 0
              ? "이번엔 시스템 음성으로 안내할게요."
              : `응원 멘트 ${prewarm.ready}/${prewarm.total}개 준비 완료`}
        </Text>
      </View>
      <View style={styles.footer}>
        <PrimaryButton label="취소" tone="neutral" onPress={onCancel} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  count: { color: theme.accent, fontSize: 120, fontWeight: "900" },
  caption: { color: theme.textMuted, fontSize: 15 },
  footer: { padding: theme.space },
});

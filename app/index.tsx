// 설정 화면: 목표 / 안내 간격 / 캐릭터 응원 주기를 정하고 러닝을 시작한다.

import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card, PrimaryButton, SectionLabel, Segmented, Stepper } from "../src/components/ui";
import { useRunStore } from "../src/store/useRunStore";
import { CHEER_MIN_INTERVAL_SECONDS, clampCheerInterval, type GoalType } from "../src/store/runSession";
import { characterVoiceAvailable } from "../src/config";
import { formatDuration } from "../src/utils/format";
import { theme } from "../src/theme";

const DISTANCE_STEP_M = 500;
const TIME_STEP_S = 300;
const INTERVAL_OPTIONS_M = [250, 500, 1000, 2000];

export default function SetupScreen() {
  const router = useRouter();
  const settings = useRunStore((s) => s.settings);
  const error = useRunStore((s) => s.error);
  const updateSettings = useRunStore((s) => s.updateSettings);
  const prepare = useRunStore((s) => s.prepare);

  const goalText =
    settings.goalType === "distance"
      ? `${(settings.goalValue / 1000).toFixed(1)} km`
      : formatDuration(settings.goalValue);

  const onGoalTypeChange = (goalType: GoalType) => {
    // 목표 타입이 바뀌면 값의 단위 자체가 달라지므로 기본값으로 되돌린다
    updateSettings({ goalType, goalValue: goalType === "distance" ? 5000 : 1800 });
  };

  const stepGoal = (direction: 1 | -1) => {
    const step = settings.goalType === "distance" ? DISTANCE_STEP_M : TIME_STEP_S;
    const min = settings.goalType === "distance" ? DISTANCE_STEP_M : TIME_STEP_S;
    updateSettings({ goalValue: Math.max(min, settings.goalValue + direction * step) });
  };

  const cycleInterval = (direction: 1 | -1) => {
    const index = INTERVAL_OPTIONS_M.indexOf(settings.voiceIntervalMeters);
    const next = Math.min(
      INTERVAL_OPTIONS_M.length - 1,
      Math.max(0, (index === -1 ? 2 : index) + direction),
    );
    updateSettings({ voiceIntervalMeters: INTERVAL_OPTIONS_M[next] });
  };

  const stepCheerInterval = (direction: 1 | -1) => {
    updateSettings({
      characterCheerIntervalSeconds: clampCheerInterval(
        settings.characterCheerIntervalSeconds + direction * 60,
      ),
    });
  };

  const onStart = async () => {
    if (await prepare()) {
      router.push("/countdown");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <SectionLabel>목표</SectionLabel>
          <Segmented
            value={settings.goalType}
            onChange={onGoalTypeChange}
            options={[
              { value: "distance", label: "거리" },
              { value: "time", label: "시간" },
            ]}
          />
          <Stepper
            label={settings.goalType === "distance" ? "달릴 거리" : "달릴 시간"}
            valueText={goalText}
            onDecrement={() => stepGoal(-1)}
            onIncrement={() => stepGoal(1)}
          />
        </Card>

        <Card>
          <SectionLabel>음성 안내</SectionLabel>
          <Text style={styles.hint}>
            구간 안내는 목표와 상관없이 거리 기준으로 나가요.
            {settings.goalType === "distance"
              ? " 완주 200m 전에 한 번 더 알려 줄게요."
              : " 완주 1분 전에 한 번 더 알려 줄게요."}
          </Text>
          <Stepper
            label="안내 간격"
            valueText={
              settings.voiceIntervalMeters >= 1000
                ? `${settings.voiceIntervalMeters / 1000} km`
                : `${settings.voiceIntervalMeters} m`
            }
            onDecrement={() => cycleInterval(-1)}
            onIncrement={() => cycleInterval(1)}
            decrementDisabled={settings.voiceIntervalMeters === INTERVAL_OPTIONS_M[0]}
            incrementDisabled={
              settings.voiceIntervalMeters === INTERVAL_OPTIONS_M[INTERVAL_OPTIONS_M.length - 1]
            }
          />
        </Card>

        <Card>
          <View style={styles.switchRow}>
            <SectionLabel>캐릭터 응원</SectionLabel>
            <Switch
              value={settings.characterCheerEnabled && characterVoiceAvailable}
              disabled={!characterVoiceAvailable}
              onValueChange={(characterCheerEnabled) => updateSettings({ characterCheerEnabled })}
              trackColor={{ true: theme.accent, false: theme.surfaceAlt }}
            />
          </View>
          {characterVoiceAvailable ? (
            <>
              <Text style={styles.hint}>
                구간 안내 사이사이에 실시간으로 만든 응원이 들어와요. 최소 간격은{" "}
                {CHEER_MIN_INTERVAL_SECONDS / 60}분이에요.
              </Text>
              <Stepper
                label="응원 간격"
                valueText={`${Math.round(settings.characterCheerIntervalSeconds / 60)}분`}
                onDecrement={() => stepCheerInterval(-1)}
                onIncrement={() => stepCheerInterval(1)}
                decrementDisabled={
                  settings.characterCheerIntervalSeconds <= CHEER_MIN_INTERVAL_SECONDS
                }
              />
            </>
          ) : (
            <Text style={styles.hint}>
              음성 서버 주소(EXPO_PUBLIC_VOICE_ENDPOINT)가 설정되지 않아서 시스템 TTS로만 안내해요.
            </Text>
          )}
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton label="시작하기" onPress={() => void onStart()} />
        <PrimaryButton label="지난 기록 보기" tone="neutral" onPress={() => router.push("/history")} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  content: { padding: theme.space, gap: theme.space },
  hint: { color: theme.textMuted, fontSize: 13, lineHeight: 19 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  error: { color: theme.danger, fontSize: 14, textAlign: "center" },
});

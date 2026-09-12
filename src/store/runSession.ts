// 러닝 세션 상태 머신
// SETUP -> COUNTDOWN -> RUNNING <-> PAUSED -> FINISHED -> STATS

export type GoalType = "distance" | "time";

export type SessionStatus =
  | "setup"
  | "countdown"
  | "running"
  | "paused"
  | "finished"
  | "stats";

export interface RunSettings {
  goalType: GoalType;
  goalValue: number; // distance: meters, time: seconds
  voiceIntervalMeters: number; // 안내 간격은 거리 기준으로 통일 (예: 500, 1000)
  characterCheerEnabled: boolean;
  characterCheerIntervalSeconds: number; // 최소 120초로 클램프
}

export interface RunSessionState {
  status: SessionStatus;
  settings: RunSettings | null;
  distanceMeters: number;
  durationSeconds: number;
  lastVoiceTriggerIndex: number; // floor(distanceMeters / voiceIntervalMeters)
  nearFinishAnnounced: boolean;
}

export const CHEER_MIN_INTERVAL_SECONDS = 120;

export function clampCheerInterval(seconds: number): number {
  return Math.max(seconds, CHEER_MIN_INTERVAL_SECONDS);
}

export const initialRunSessionState: RunSessionState = {
  status: "setup",
  settings: null,
  distanceMeters: 0,
  durationSeconds: 0,
  lastVoiceTriggerIndex: 0,
  nearFinishAnnounced: false,
};

export const DEFAULT_SETTINGS: RunSettings = {
  goalType: "distance",
  goalValue: 5000, // 5km
  voiceIntervalMeters: 1000,
  characterCheerEnabled: true,
  characterCheerIntervalSeconds: CHEER_MIN_INTERVAL_SECONDS,
};

/** 카운트다운 길이(초) */
export const COUNTDOWN_SECONDS = 5;

/** 목표 값이 유효한지 확인. 유효하지 않으면 사유 문자열을 돌려준다 */
export function validateSettings(settings: RunSettings): string | null {
  if (settings.goalType === "distance") {
    if (settings.goalValue < 100) return "거리 목표는 100m 이상이어야 해요.";
    if (settings.goalValue > 100_000) return "거리 목표는 100km 이하로 정해 주세요.";
  } else {
    if (settings.goalValue < 60) return "시간 목표는 1분 이상이어야 해요.";
    if (settings.goalValue > 24 * 3600) return "시간 목표는 24시간 이하로 정해 주세요.";
  }
  if (settings.voiceIntervalMeters < 100) return "안내 간격은 100m 이상이어야 해요.";
  return null;
}

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

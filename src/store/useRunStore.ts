// 화면이 바라보는 단일 상태 저장소.
// 실제 측정/음성 로직은 RunCoach 가 갖고 있고, 스토어는 그 결과만 반영한다.

import { create } from "zustand";
import { RunCoach, type PrewarmResult } from "../services/coach";
import { CharacterVoiceClient } from "../services/characterVoice";
import { requestPermissions } from "../services/locationTracking";
import { saveRun } from "../services/db";
import { averagePace } from "../services/pace";
import type { RunSnapshot } from "../services/runEngine";
import { characterVoiceAvailable, characterVoiceConfig } from "../config";
import {
  DEFAULT_SETTINGS,
  validateSettings,
  type RunSettings,
  type SessionStatus,
} from "./runSession";

const EMPTY_SNAPSHOT: RunSnapshot = {
  distanceMeters: 0,
  durationSeconds: 0,
  currentPaceSecPerKm: null,
  averagePaceSecPerKm: null,
  progress: 0,
  goalReached: false,
};

interface RunStore {
  status: SessionStatus;
  settings: RunSettings;
  snapshot: RunSnapshot;
  prewarm: PrewarmResult | null;
  error: string | null;
  /** 결과 화면에서 조회할 저장된 기록 id */
  lastRecordId: number | null;

  updateSettings: (patch: Partial<RunSettings>) => void;
  /** 권한 확인 + 음성 사전 생성. 성공하면 카운트다운으로 넘어간다 */
  prepare: () => Promise<boolean>;
  beginRun: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<void>;
  reset: () => Promise<void>;
}

let coach: RunCoach | null = null;

export const useRunStore = create<RunStore>((set, get) => ({
  status: "setup",
  settings: DEFAULT_SETTINGS,
  snapshot: EMPTY_SNAPSHOT,
  prewarm: null,
  error: null,
  lastRecordId: null,

  updateSettings: (patch) => {
    set((state) => ({ settings: { ...state.settings, ...patch }, error: null }));
  },

  prepare: async () => {
    const { settings } = get();
    const invalid = validateSettings(settings);
    if (invalid) {
      set({ error: invalid });
      return false;
    }

    const permission = await requestPermissions();
    if (!permission.foreground) {
      set({ error: "위치 권한이 없으면 거리를 측정할 수 없어요." });
      return false;
    }

    const voice = characterVoiceAvailable ? new CharacterVoiceClient(characterVoiceConfig) : null;
    coach = new RunCoach(settings, voice, {
      onSnapshot: (snapshot) => set({ snapshot }),
      onFinish: (snapshot) => void finishRun(snapshot, set, get),
    });

    set({ status: "countdown", error: null, prewarm: null, snapshot: EMPTY_SNAPSHOT });

    // 카운트다운이 도는 동안 백그라운드에서 마일스톤 음성을 만들어 둔다.
    // 다 못 만들어도 러닝은 예정대로 시작한다.
    void coach.prewarm().then((prewarm) => set({ prewarm })).catch(() => undefined);
    return true;
  },

  beginRun: async () => {
    if (!coach) return;
    await coach.start();
    set({ status: "running" });
  },

  pause: () => {
    coach?.pause();
    set({ status: "paused" });
  },

  resume: () => {
    coach?.resume();
    set({ status: "running" });
  },

  stop: async () => {
    if (!coach) return;
    await coach.stop();
  },

  reset: async () => {
    await coach?.dispose();
    coach = null;
    set({ status: "setup", snapshot: EMPTY_SNAPSHOT, prewarm: null, error: null, lastRecordId: null });
  },
}));

type SetState = (partial: Partial<RunStore>) => void;
type GetState = () => RunStore;

async function finishRun(snapshot: RunSnapshot, set: SetState, get: GetState): Promise<void> {
  set({ status: "finished", snapshot });

  const { settings } = get();
  try {
    const id = await saveRun({
      startedAt: (coach?.startedAt ?? new Date()).toISOString(),
      goalType: settings.goalType,
      goalValue: settings.goalValue,
      distanceMeters: snapshot.distanceMeters,
      durationSeconds: snapshot.durationSeconds,
      averagePaceSecondsPerKm: averagePace(snapshot.distanceMeters, snapshot.durationSeconds),
      completed: snapshot.goalReached,
    });
    set({ lastRecordId: id });
  } catch {
    // 저장에 실패해도 결과 화면은 보여 준다
    set({ error: "기록 저장에 실패했어요." });
  }
  set({ status: "stats" });
}

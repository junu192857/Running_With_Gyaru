// 러닝 1회를 끝까지 끌고 가는 오케스트레이터
//
// 측정(RunEngine) / 음성 생성(CharacterVoiceClient) / 재생(AudioQueue) 을 묶는다.
// 음성 쪽은 전부 비동기이고 실패해도 삼켜지므로, 네트워크가 끊겨도 측정은 계속된다.

import { RunEngine, type RunSnapshot } from "./runEngine";
import { AudioQueue } from "./audioQueue";
import { CharacterVoiceClient } from "./characterVoice";
import { playAudioFile, configureAudioSession } from "./audioPlayer";
import { speak, stopSpeaking } from "./speech";
import { watchPosition, type Unsubscribe } from "./locationTracking";
import type { Milestone } from "./announcer";
import { clampCheerInterval, type RunSettings } from "../store/runSession";

const TICK_INTERVAL_MS = 1000;

export interface PrewarmResult {
  total: number;
  ready: number;
}

export interface RunCoachCallbacks {
  onSnapshot: (snapshot: RunSnapshot) => void;
  onFinish: (snapshot: RunSnapshot) => void;
}

export class RunCoach {
  private readonly settings: RunSettings;
  private readonly engine: RunEngine;
  private readonly queue = new AudioQueue();
  private readonly voice: CharacterVoiceClient | null;
  private readonly callbacks: RunCoachCallbacks;

  private unsubscribeLocation: Unsubscribe | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private cheerTimer: ReturnType<typeof setInterval> | null = null;
  private finishNotified = false;
  readonly startedAt = new Date();

  constructor(settings: RunSettings, voice: CharacterVoiceClient | null, callbacks: RunCoachCallbacks) {
    this.settings = settings;
    this.voice = voice;
    this.engine = new RunEngine(settings);
    this.callbacks = callbacks;
  }

  /**
   * 카운트다운 동안 호출. 마일스톤 멘트를 미리 생성해 둔다.
   * 사전 생성이 끝나기 전에 러닝이 시작돼도 상관없다 — 준비 안 된 마일스톤은
   * 그 시점에 시스템 TTS로 폴백된다.
   */
  async prewarm(): Promise<PrewarmResult> {
    await configureAudioSession().catch(() => undefined);

    const plan = RunEngine.plannedMilestones(this.settings);
    if (!this.voice) return { total: plan.length, ready: 0 };

    const ready = await this.voice.prewarm(plan, {
      goalType: this.settings.goalType,
      goalValue: this.settings.goalValue,
    });
    return { total: plan.length, ready };
  }

  async start(): Promise<void> {
    this.engine.start(Date.now());
    this.unsubscribeLocation = await watchPosition((point) => {
      const due = this.engine.ingest(point);
      this.handleMilestones(due);
      this.emit();
    });

    this.tickTimer = setInterval(() => {
      this.handleMilestones(this.engine.tick(Date.now()));
      this.emit();
    }, TICK_INTERVAL_MS);

    this.scheduleCheers();
  }

  pause(): void {
    this.engine.pause(Date.now());
    this.stopCheers();
    this.emit();
  }

  resume(): void {
    this.engine.resume(Date.now());
    this.scheduleCheers();
    this.emit();
  }

  get isPaused(): boolean {
    return this.engine.isPaused;
  }

  /** 목표 달성 전에 사용자가 직접 종료한 경우 포함 */
  async stop(): Promise<RunSnapshot> {
    this.engine.finish(Date.now());
    await this.teardown();
    const snapshot = this.engine.snapshot(Date.now());
    // 목표 달성으로 자동 종료된 뒤 사용자가 종료 버튼을 눌러도 결과는 한 번만 넘긴다
    if (!this.finishNotified) {
      this.finishNotified = true;
      this.callbacks.onFinish(snapshot);
    }
    return snapshot;
  }

  snapshot(): RunSnapshot {
    return this.engine.snapshot(Date.now());
  }

  private emit(): void {
    this.callbacks.onSnapshot(this.engine.snapshot(Date.now()));
  }

  private handleMilestones(due: Milestone[]): void {
    for (const milestone of due) {
      this.queue.enqueue({
        id: milestone.id,
        priority: "milestone",
        play: async () => {
          const uri = this.voice?.milestoneAudio(milestone.id) ?? null;
          if (uri) {
            try {
              await playAudioFile(uri);
              return;
            } catch {
              // 파일이 깨졌거나 재생에 실패하면 시스템 TTS로 폴백
            }
          }
          await speak(milestone.fallbackText);
        },
      });
    }

    if (due.some((m) => m.kind === "finish")) {
      void this.stop();
    }
  }

  private scheduleCheers(): void {
    this.stopCheers();
    if (!this.settings.characterCheerEnabled || !this.voice) return;

    const intervalMs = clampCheerInterval(this.settings.characterCheerIntervalSeconds) * 1000;
    this.cheerTimer = setInterval(() => void this.emitCheer(intervalMs), intervalMs);
  }

  private stopCheers(): void {
    if (this.cheerTimer != null) {
      clearInterval(this.cheerTimer);
      this.cheerTimer = null;
    }
  }

  private async emitCheer(intervalMs: number): Promise<void> {
    if (!this.voice || this.engine.isPaused || this.engine.isFinished) return;

    const snapshot = this.engine.snapshot(Date.now());
    const uri = await this.voice.requestCheer({
      distanceMeters: snapshot.distanceMeters,
      durationSeconds: snapshot.durationSeconds,
      paceSecondsPerKm: snapshot.currentPaceSecPerKm,
      goalType: this.settings.goalType,
      goalValue: this.settings.goalValue,
    });
    if (!uri) return;
    // 생성에 오래 걸렸거나 마일스톤에 밀려 대기가 길어지면 이미 철 지난 멘트다.
    // 다음 응원 주기가 오기 전까지만 유효한 것으로 본다.
    this.queue.enqueue({
      id: `cheer-${Date.now()}`,
      priority: "cheer",
      expiresAtMs: Date.now() + intervalMs / 2,
      play: () => playAudioFile(uri),
    });
  }

  private async teardown(): Promise<void> {
    this.stopCheers();
    if (this.tickTimer != null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.unsubscribeLocation?.();
    this.unsubscribeLocation = null;
  }

  /** 화면을 벗어날 때 호출. 재생 중인 음성과 캐시를 정리한다 */
  async dispose(): Promise<void> {
    await this.teardown();
    this.queue.clear();
    stopSpeaking();
    await this.voice?.clearCache();
  }
}

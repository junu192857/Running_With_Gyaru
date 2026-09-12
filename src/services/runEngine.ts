// 러닝 측정 엔진
//
// GPS 포인트와 시계 tick만 받아서 거리/시간/페이스/마일스톤을 계산하는 순수 로직.
// expo 모듈에 의존하지 않으므로 그대로 테스트할 수 있다.
//
// 일시정지 정책: GPS 리스너는 유지하되 거리/시간 누적에서 제외한다.
// 재개 직후 몇 개 포인트는 좌표가 튀기 쉬우므로 버퍼링(폐기)한다.

import { isValidPoint, shouldAccumulate, type GpsPoint } from "./location";
import { MilestoneTracker, planMilestones, type Milestone } from "./announcer";
import { PaceMeter, averagePace } from "./pace";
import type { RunSettings } from "../store/runSession";

/** 재개 직후 폐기할 GPS 포인트 개수 */
export const RESUME_DISCARD_POINTS = 2;

export interface RunSnapshot {
  distanceMeters: number;
  durationSeconds: number;
  currentPaceSecPerKm: number | null;
  averagePaceSecPerKm: number | null;
  /** 목표 대비 진행률 0..1 */
  progress: number;
  goalReached: boolean;
}

export class RunEngine {
  private readonly settings: RunSettings;
  private readonly milestones: MilestoneTracker;
  private readonly paceMeter = new PaceMeter();

  private distanceMeters = 0;
  /** 일시정지 이전까지 누적된 러닝 시간(ms) */
  private accumulatedMs = 0;
  /** 현재 러닝 구간의 시작 시각(ms). 일시정지 중이면 null */
  private segmentStartMs: number | null = null;
  private lastPoint: GpsPoint | null = null;
  private discardRemaining = 0;
  private finished = false;

  constructor(settings: RunSettings) {
    this.settings = settings;
    this.milestones = new MilestoneTracker(planMilestones(settings));
  }

  /** 사전 생성 대상 마일스톤 목록 (러닝 시작 전에 음성 파이프라인으로 넘긴다) */
  static plannedMilestones(settings: RunSettings): Milestone[] {
    return planMilestones(settings);
  }

  start(nowMs: number): void {
    this.segmentStartMs = nowMs;
  }

  pause(nowMs: number): void {
    if (this.segmentStartMs == null) return;
    this.accumulatedMs += nowMs - this.segmentStartMs;
    this.segmentStartMs = null;
    // 정지 동안의 GPS 표류가 페이스에 섞이지 않도록 창을 비운다
    this.paceMeter.reset();
  }

  resume(nowMs: number): void {
    if (this.segmentStartMs != null) return;
    this.segmentStartMs = nowMs;
    this.lastPoint = null;
    this.discardRemaining = RESUME_DISCARD_POINTS;
  }

  get isPaused(): boolean {
    return this.segmentStartMs == null && !this.finished;
  }

  durationSeconds(nowMs: number): number {
    const running = this.segmentStartMs == null ? 0 : nowMs - this.segmentStartMs;
    return (this.accumulatedMs + running) / 1000;
  }

  /**
   * GPS 포인트 1개 반영. 발화해야 할 마일스톤을 반환한다.
   * 일시정지 중이거나 필터에 걸린 포인트는 거리에 반영되지 않는다.
   */
  ingest(point: GpsPoint): Milestone[] {
    if (this.finished) return [];
    if (!isValidPoint(point)) return [];

    if (this.isPaused) {
      // 리스너는 살아 있지만 누적하지 않는다. 재개 시 기준점도 새로 잡는다.
      return [];
    }

    if (this.discardRemaining > 0) {
      this.discardRemaining -= 1;
      this.lastPoint = point;
      return [];
    }

    if (this.lastPoint == null) {
      this.lastPoint = point;
      return [];
    }

    // 필터에 걸린 포인트는 기준점(lastPoint)도 갱신하지 않는다.
    // 제자리에서 미세하게 흔들릴 때 거리가 조금씩 불어나는 것과,
    // 튄 좌표가 다음 구간의 기준이 되는 것을 함께 막는다.
    const { accept, deltaMeters } = shouldAccumulate(this.lastPoint, point);
    if (accept) {
      this.distanceMeters += deltaMeters;
      this.lastPoint = point;
    }

    return this.collectMilestones(point.timestampMs);
  }

  /** GPS가 뜸할 때도 시간 기반 마일스톤이 제때 나가도록 주기적으로 호출한다 */
  tick(nowMs: number): Milestone[] {
    if (this.finished || this.isPaused) return [];
    return this.collectMilestones(nowMs);
  }

  private collectMilestones(nowMs: number): Milestone[] {
    const seconds = this.durationSeconds(nowMs);
    this.paceMeter.push(this.distanceMeters, seconds);

    this.milestones.extendIntervals(this.distanceMeters, this.settings.voiceIntervalMeters);
    const due = this.milestones.consume(this.distanceMeters, seconds);

    if (due.some((m) => m.kind === "finish")) {
      this.finish(nowMs);
    }
    return due;
  }

  finish(nowMs: number): void {
    if (this.finished) return;
    if (this.segmentStartMs != null) {
      this.accumulatedMs += nowMs - this.segmentStartMs;
      this.segmentStartMs = null;
    }
    this.finished = true;
  }

  get isFinished(): boolean {
    return this.finished;
  }

  snapshot(nowMs: number): RunSnapshot {
    const durationSeconds = this.durationSeconds(nowMs);
    const progress =
      this.settings.goalType === "distance"
        ? this.distanceMeters / this.settings.goalValue
        : durationSeconds / this.settings.goalValue;

    return {
      distanceMeters: this.distanceMeters,
      durationSeconds,
      currentPaceSecPerKm: this.paceMeter.current(),
      averagePaceSecPerKm: averagePace(this.distanceMeters, durationSeconds),
      progress: Math.max(0, Math.min(1, progress)),
      goalReached: this.milestones.hasFired("finish"),
    };
  }
}

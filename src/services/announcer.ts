// 마일스톤 안내 설계
//
// - 구간 안내는 목표 타입과 무관하게 "거리 기준"으로 통일한다 (예: 500m/1km마다)
// - 완주 직전 안내만 목표 타입에 따라 분기한다
//     거리 목표 -> 완주 200m 전
//     시간 목표 -> 완주 1분 전
// - 마일스톤 목록은 러닝 시작 직전에 미리 확정된다. 캐릭터 음성 파이프라인이
//   이 목록을 받아 멘트를 미리 생성/캐싱한다 (characterVoice.ts).

import type { RunSettings } from "../store/runSession";
import { spokenDistance, spokenDuration } from "../utils/format";

export const NEAR_FINISH_DISTANCE_METERS = 200;
export const NEAR_FINISH_TIME_SECONDS = 60;

// 시간 목표일 때 구간 안내를 몇 개나 미리 만들어 둘지 추정하기 위한 기준 페이스(초/km)
export const ASSUMED_PACE_SECONDS_PER_KM = 360; // 6'00"/km
// 추정보다 빨리 달릴 경우를 대비한 여유분
export const TIME_GOAL_DISTANCE_MARGIN = 1.4;

export type MilestoneKind = "interval" | "nearFinish" | "finish";

export interface Milestone {
  /** 음성 캐시 키로도 그대로 쓰인다 */
  id: string;
  kind: MilestoneKind;
  /** 누적 거리(m)가 이 값을 넘으면 발화. 시간 트리거 마일스톤은 null */
  atMeters: number | null;
  /** 경과 시간(초)이 이 값을 넘으면 발화. 거리 트리거 마일스톤은 null */
  atSeconds: number | null;
  /** 캐릭터 음성 생성 실패 시 시스템 TTS로 읽을 기본 문구 */
  fallbackText: string;
}

function intervalMilestone(meters: number): Milestone {
  return {
    id: `interval:${meters}`,
    kind: "interval",
    atMeters: meters,
    atSeconds: null,
    fallbackText: `${spokenDistance(meters)} 지났어요.`,
  };
}

/**
 * 시간 목표에서 미리 만들어 둘 구간 안내의 상한 거리(m).
 * 기준 페이스로 목표 시간만큼 달렸을 때의 거리에 여유분을 곱한다.
 */
export function estimatedDistanceForTimeGoal(goalSeconds: number): number {
  return (goalSeconds / ASSUMED_PACE_SECONDS_PER_KM) * 1000 * TIME_GOAL_DISTANCE_MARGIN;
}

/**
 * 러닝 시작 직전에 호출. 이번 러닝에서 발생할 수 있는 마일스톤을 모두 나열한다.
 * 반환 순서는 "발화가 예상되는 순서"이며, 음성 사전 생성도 이 순서대로 진행한다.
 */
export function planMilestones(settings: RunSettings): Milestone[] {
  const interval = settings.voiceIntervalMeters;
  const milestones: Milestone[] = [];

  if (interval > 0) {
    // 완주 직전 안내와 겹치는 구간 안내는 만들지 않는다 (연속 발화 방지)
    const intervalLimit =
      settings.goalType === "distance"
        ? settings.goalValue - NEAR_FINISH_DISTANCE_METERS
        : estimatedDistanceForTimeGoal(settings.goalValue);

    for (let m = interval; m < intervalLimit; m += interval) {
      milestones.push(intervalMilestone(m));
    }
  }

  if (settings.goalType === "distance") {
    const nearFinishAt = settings.goalValue - NEAR_FINISH_DISTANCE_METERS;
    if (nearFinishAt > 0) {
      milestones.push({
        id: "nearFinish",
        kind: "nearFinish",
        atMeters: nearFinishAt,
        atSeconds: null,
        fallbackText: `${NEAR_FINISH_DISTANCE_METERS}미터 남았어요. 끝까지 가요!`,
      });
    }
    milestones.push({
      id: "finish",
      kind: "finish",
      atMeters: settings.goalValue,
      atSeconds: null,
      fallbackText: `${spokenDistance(settings.goalValue)} 완주했어요. 수고했어요!`,
    });
  } else {
    const nearFinishAt = settings.goalValue - NEAR_FINISH_TIME_SECONDS;
    if (nearFinishAt > 0) {
      milestones.push({
        id: "nearFinish",
        kind: "nearFinish",
        atMeters: null,
        atSeconds: nearFinishAt,
        fallbackText: "1분 남았어요. 끝까지 가요!",
      });
    }
    milestones.push({
      id: "finish",
      kind: "finish",
      atMeters: null,
      atSeconds: settings.goalValue,
      fallbackText: `${spokenDuration(settings.goalValue)} 완주했어요. 수고했어요!`,
    });
  }

  return milestones;
}

/**
 * 계획된 마일스톤 중 발화 시점이 지난 것을 한 번씩만 꺼내 준다.
 * GPS 콜백마다 호출되며, 이미 꺼낸 마일스톤은 다시 나오지 않는다.
 */
export class MilestoneTracker {
  private readonly plan: Milestone[];
  private readonly fired = new Set<string>();

  constructor(plan: Milestone[]) {
    this.plan = plan;
  }

  consume(distanceMeters: number, durationSeconds: number): Milestone[] {
    const due: Milestone[] = [];
    for (const milestone of this.plan) {
      if (this.fired.has(milestone.id)) continue;

      const reached =
        (milestone.atMeters != null && distanceMeters >= milestone.atMeters) ||
        (milestone.atSeconds != null && durationSeconds >= milestone.atSeconds);

      if (reached) {
        this.fired.add(milestone.id);
        due.push(milestone);
      }
    }
    return due;
  }

  hasFired(id: string): boolean {
    return this.fired.has(id);
  }

  /**
   * 시간 목표에서 추정 거리를 넘겨 달린 경우처럼, 미리 만들어 둔 구간 안내가
   * 소진됐을 때 런타임에 다음 구간을 이어 붙인다.
   * 이때 만들어진 마일스톤은 사전 생성된 캐릭터 음성이 없으므로
   * 실시간 생성 또는 시스템 TTS 폴백으로 재생된다.
   */
  extendIntervals(distanceMeters: number, intervalMeters: number): void {
    if (intervalMeters <= 0) return;

    const plannedMax = this.plan.reduce(
      (max, m) => (m.kind === "interval" && m.atMeters != null ? Math.max(max, m.atMeters) : max),
      0,
    );
    for (let m = plannedMax + intervalMeters; m <= distanceMeters + intervalMeters; m += intervalMeters) {
      if (this.plan.some((existing) => existing.id === `interval:${m}`)) continue;
      this.plan.push(intervalMilestone(m));
    }
  }
}

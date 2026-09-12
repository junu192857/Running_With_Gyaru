import {
  MilestoneTracker,
  NEAR_FINISH_DISTANCE_METERS,
  estimatedDistanceForTimeGoal,
  planMilestones,
} from "../services/announcer";
import { DEFAULT_SETTINGS, type RunSettings } from "../store/runSession";

function settings(patch: Partial<RunSettings>): RunSettings {
  return { ...DEFAULT_SETTINGS, ...patch };
}

describe("planMilestones - 거리 목표", () => {
  const plan = planMilestones(
    settings({ goalType: "distance", goalValue: 5000, voiceIntervalMeters: 1000 }),
  );

  it("1km마다 구간 안내를 만든다", () => {
    const intervals = plan.filter((m) => m.kind === "interval").map((m) => m.atMeters);
    expect(intervals).toEqual([1000, 2000, 3000, 4000]);
  });

  it("완주 200m 전에 안내가 들어간다", () => {
    const nearFinish = plan.find((m) => m.kind === "nearFinish");
    expect(nearFinish?.atMeters).toBe(5000 - NEAR_FINISH_DISTANCE_METERS);
    expect(nearFinish?.atSeconds).toBeNull();
  });

  it("완주 직전 안내와 겹치는 구간 안내는 만들지 않는다", () => {
    // 4800m 지점에 완주 직전 안내가 있으므로 5000m 구간 안내는 없어야 한다
    const plan5k = planMilestones(
      settings({ goalType: "distance", goalValue: 5000, voiceIntervalMeters: 2500 }),
    );
    const intervals = plan5k.filter((m) => m.kind === "interval").map((m) => m.atMeters);
    expect(intervals).toEqual([2500]);
  });

  it("완주 안내는 거리로 트리거된다", () => {
    const finish = plan.find((m) => m.kind === "finish");
    expect(finish?.atMeters).toBe(5000);
    expect(finish?.atSeconds).toBeNull();
  });
});

describe("planMilestones - 시간 목표", () => {
  const goalSeconds = 1800; // 30분
  const plan = planMilestones(
    settings({ goalType: "time", goalValue: goalSeconds, voiceIntervalMeters: 1000 }),
  );

  it("구간 안내는 시간 목표에서도 거리 기준이다", () => {
    const intervals = plan.filter((m) => m.kind === "interval");
    expect(intervals.length).toBeGreaterThan(0);
    expect(intervals.every((m) => m.atMeters != null && m.atSeconds == null)).toBe(true);
  });

  it("추정 주행거리만큼 구간 안내를 미리 만들어 둔다", () => {
    const limit = estimatedDistanceForTimeGoal(goalSeconds);
    const last = plan.filter((m) => m.kind === "interval").at(-1);
    expect(last?.atMeters).toBeLessThan(limit);
    expect((last?.atMeters ?? 0) + 1000).toBeGreaterThanOrEqual(limit);
  });

  it("완주 1분 전 안내는 시간으로 트리거된다", () => {
    const nearFinish = plan.find((m) => m.kind === "nearFinish");
    expect(nearFinish?.atSeconds).toBe(goalSeconds - 60);
    expect(nearFinish?.atMeters).toBeNull();
  });

  it("완주 안내도 시간으로 트리거된다", () => {
    const finish = plan.find((m) => m.kind === "finish");
    expect(finish?.atSeconds).toBe(goalSeconds);
  });
});

describe("MilestoneTracker", () => {
  const plan = planMilestones(
    settings({ goalType: "distance", goalValue: 3000, voiceIntervalMeters: 1000 }),
  );

  it("같은 마일스톤을 두 번 발화하지 않는다", () => {
    const tracker = new MilestoneTracker(plan);
    expect(tracker.consume(1000, 300).map((m) => m.id)).toEqual(["interval:1000"]);
    expect(tracker.consume(1500, 400)).toEqual([]);
  });

  it("여러 마일스톤을 건너뛴 경우 밀린 것을 한꺼번에 돌려준다", () => {
    const tracker = new MilestoneTracker(plan);
    const due = tracker.consume(2100, 700).map((m) => m.id);
    expect(due).toEqual(["interval:1000", "interval:2000"]);
  });

  it("추정 거리를 넘겨 달리면 구간 안내를 이어 붙인다", () => {
    const timePlan = planMilestones(
      settings({ goalType: "time", goalValue: 600, voiceIntervalMeters: 1000 }),
    );
    const tracker = new MilestoneTracker(timePlan);
    // 10분 목표의 추정 거리는 약 2.3km. 그보다 멀리 달린 상황
    tracker.extendIntervals(4000, 1000);
    const due = tracker.consume(4000, 500).map((m) => m.id);
    expect(due).toContain("interval:3000");
    expect(due).toContain("interval:4000");
  });
});

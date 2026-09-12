import { RunEngine, RESUME_DISCARD_POINTS } from "../services/runEngine";
import { DEFAULT_SETTINGS, type RunSettings } from "../store/runSession";
import type { GpsPoint } from "../services/location";

const START_LAT = 37.5665;
const LON = 126.978;
/** 위도 1도 ≈ 111,320m */
const METERS_PER_DEGREE = 111_320;

function settings(patch: Partial<RunSettings>): RunSettings {
  return { ...DEFAULT_SETTINGS, ...patch };
}

/** 출발점에서 북쪽으로 meters 만큼 떨어진 지점 */
function pointAt(meters: number, timestampMs: number): GpsPoint {
  return {
    latitude: START_LAT + meters / METERS_PER_DEGREE,
    longitude: LON,
    accuracy: 5,
    timestampMs,
  };
}

/** 5m/s 로 달리는 경로를 초 단위로 흘려 넣는다 */
function run(engine: RunEngine, fromSec: number, toSec: number, speedMps = 5, startMeters = 0) {
  for (let t = fromSec; t <= toSec; t += 1) {
    engine.ingest(pointAt(startMeters + (t - fromSec) * speedMps, t * 1000));
  }
}

describe("RunEngine", () => {
  it("정확도가 나쁜 포인트는 거리에 반영하지 않는다", () => {
    const engine = new RunEngine(settings({ goalValue: 100_000 }));
    engine.start(0);
    engine.ingest(pointAt(0, 0));
    engine.ingest({ ...pointAt(50, 10_000), accuracy: 50 });
    expect(engine.snapshot(10_000).distanceMeters).toBe(0);
  });

  it("정상 주행 거리를 누적한다", () => {
    const engine = new RunEngine(settings({ goalValue: 100_000 }));
    engine.start(0);
    run(engine, 0, 20);
    // 20초 * 5m/s = 100m
    expect(engine.snapshot(20_000).distanceMeters).toBeCloseTo(100, 0);
  });

  it("일시정지 중에는 거리도 시간도 늘지 않는다", () => {
    const engine = new RunEngine(settings({ goalValue: 100_000 }));
    engine.start(0);
    run(engine, 0, 20);
    const before = engine.snapshot(20_000);

    engine.pause(20_000);
    run(engine, 21, 40); // 정지 중 들어온 포인트
    const during = engine.snapshot(40_000);

    expect(during.distanceMeters).toBeCloseTo(before.distanceMeters, 5);
    expect(during.durationSeconds).toBeCloseTo(20, 5);
  });

  it("재개 직후 몇 개 포인트는 버퍼링해서 튐을 막는다", () => {
    const engine = new RunEngine(settings({ goalValue: 100_000 }));
    engine.start(0);
    run(engine, 0, 20);
    const beforePause = engine.snapshot(20_000).distanceMeters;

    engine.pause(20_000);
    engine.resume(30_000);

    // 재개 후 폐기 개수만큼은 거리에 반영되지 않는다
    for (let i = 0; i < RESUME_DISCARD_POINTS; i += 1) {
      engine.ingest(pointAt(100 + i * 5, 31_000 + i * 1000));
    }
    expect(engine.snapshot(33_000).distanceMeters).toBeCloseTo(beforePause, 5);
  });

  it("거리 목표를 채우면 완주 마일스톤이 나오고 종료된다", () => {
    const engine = new RunEngine(
      settings({ goalType: "distance", goalValue: 300, voiceIntervalMeters: 100 }),
    );
    engine.start(0);

    const fired: string[] = [];
    for (let t = 0; t <= 70; t += 1) {
      fired.push(...engine.ingest(pointAt(t * 5, t * 1000)).map((m) => m.id));
    }

    expect(fired).toContain("interval:100");
    expect(fired).toContain("nearFinish");
    expect(fired).toContain("finish");
    expect(engine.isFinished).toBe(true);
    expect(engine.snapshot(70_000).goalReached).toBe(true);
  });

  it("시간 목표는 tick 만으로도 완주 판정이 된다", () => {
    const engine = new RunEngine(settings({ goalType: "time", goalValue: 120 }));
    engine.start(0);
    expect(engine.tick(119_000).map((m) => m.id)).toContain("nearFinish");
    expect(engine.tick(120_000).map((m) => m.id)).toContain("finish");
    expect(engine.isFinished).toBe(true);
  });

  it("종료 후에는 더 이상 거리를 누적하지 않는다", () => {
    const engine = new RunEngine(settings({ goalValue: 100_000 }));
    engine.start(0);
    run(engine, 0, 20);
    const distance = engine.snapshot(20_000).distanceMeters;

    engine.finish(20_000);
    run(engine, 21, 40, 5, 100);
    expect(engine.snapshot(40_000).distanceMeters).toBeCloseTo(distance, 5);
  });

  it("진행률은 0..1 로 잘린다", () => {
    const engine = new RunEngine(settings({ goalType: "time", goalValue: 60 }));
    engine.start(0);
    expect(engine.snapshot(600_000).progress).toBe(1);
  });
});

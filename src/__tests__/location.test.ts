import {
  haversineMeters,
  isValidPoint,
  shouldAccumulate,
  type GpsPoint,
} from "../services/location";

const base: GpsPoint = { latitude: 37.5665, longitude: 126.978, accuracy: 5, timestampMs: 0 };

function offset(point: GpsPoint, deltaLat: number, seconds: number): GpsPoint {
  return { ...point, latitude: point.latitude + deltaLat, timestampMs: point.timestampMs + seconds * 1000 };
}

describe("haversineMeters", () => {
  it("같은 좌표면 0", () => {
    expect(haversineMeters(base, base)).toBeCloseTo(0, 6);
  });

  it("위도 0.001도는 약 111m", () => {
    expect(haversineMeters(base, offset(base, 0.001, 0))).toBeCloseTo(111, 0);
  });
});

describe("isValidPoint", () => {
  it("정확도가 20m를 넘으면 버린다", () => {
    expect(isValidPoint({ ...base, accuracy: 21 })).toBe(false);
    expect(isValidPoint({ ...base, accuracy: 20 })).toBe(true);
  });
});

describe("shouldAccumulate", () => {
  it("2m 미만 이동은 정지로 보고 무시한다", () => {
    // 위도 0.00001도 ≈ 1.1m
    const result = shouldAccumulate(base, offset(base, 0.00001, 1));
    expect(result).toEqual({ accept: false, deltaMeters: 0 });
  });

  it("7m/s를 넘는 순간 속도는 GPS 튐으로 보고 버린다", () => {
    // 약 111m 를 1초만에 이동한 것으로 들어온 경우
    const result = shouldAccumulate(base, offset(base, 0.001, 1));
    expect(result.accept).toBe(false);
  });

  it("정상 범위 이동은 누적한다", () => {
    // 약 111m 를 30초에 이동 (3.7m/s)
    const result = shouldAccumulate(base, offset(base, 0.001, 30));
    expect(result.accept).toBe(true);
    expect(result.deltaMeters).toBeCloseTo(111, 0);
  });

  it("타임스탬프가 같으면 속도 판정을 건너뛴다", () => {
    const result = shouldAccumulate(base, offset(base, 0.001, 0));
    expect(result.accept).toBe(true);
  });
});

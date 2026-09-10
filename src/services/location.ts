// GPS 트래킹 서비스
// - 정확도 필터: accuracy > ACCURACY_THRESHOLD_M 인 포인트는 버림
// - 속도 이상치 필터: 순간 속도 > MAX_PLAUSIBLE_SPEED_MPS 이면 GPS 튐으로 간주
// - 정지 보정: 이동거리 < MIN_MOVE_METERS 이면 무시

export const ACCURACY_THRESHOLD_M = 20;
export const MAX_PLAUSIBLE_SPEED_MPS = 7; // 대략 3'00"/km 보다 빠른 속도는 이상치로 간주
export const MIN_MOVE_METERS = 2;

export interface GpsPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestampMs: number;
}

// haversine 공식으로 두 좌표 간 거리(m) 계산
export function haversineMeters(a: GpsPoint, b: GpsPoint): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function isValidPoint(point: GpsPoint): boolean {
  return point.accuracy <= ACCURACY_THRESHOLD_M;
}

// 이전 포인트 대비 이 포인트를 누적 거리에 반영할지 판단
export function shouldAccumulate(prev: GpsPoint, curr: GpsPoint): { accept: boolean; deltaMeters: number } {
  const deltaMeters = haversineMeters(prev, curr);
  const deltaSeconds = (curr.timestampMs - prev.timestampMs) / 1000;

  if (deltaMeters < MIN_MOVE_METERS) {
    return { accept: false, deltaMeters: 0 };
  }
  if (deltaSeconds > 0) {
    const speed = deltaMeters / deltaSeconds;
    if (speed > MAX_PLAUSIBLE_SPEED_MPS) {
      return { accept: false, deltaMeters: 0 };
    }
  }
  return { accept: true, deltaMeters };
}

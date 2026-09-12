// expo-location 구독 래퍼
//
// 화면이 꺼지거나 앱이 백그라운드로 가도 측정이 이어져야 하므로,
// 백그라운드 권한이 있으면 TaskManager 기반의 위치 업데이트를 쓴다.
// (Android 는 이때 foreground service 알림이 뜬다.)
// 권한이 없으면 앱이 떠 있는 동안만 동작하는 watchPositionAsync 로 내려간다.

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import type { GpsPoint } from "./location";

export const LOCATION_TASK_NAME = "running-with-gyaru-location";

export interface PermissionResult {
  foreground: boolean;
  background: boolean;
}

export async function requestPermissions(): Promise<PermissionResult> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    return { foreground: false, background: false };
  }
  // 백그라운드 권한은 거부돼도 앱이 켜져 있는 동안은 측정할 수 있으므로 치명적이지 않다
  const bg = await Location.requestBackgroundPermissionsAsync().catch(() => null);
  return { foreground: true, background: bg?.status === "granted" };
}

function toGpsPoint(location: Location.LocationObject): GpsPoint {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    // accuracy 를 못 주는 기기는 필터를 통과시키기 위해 0으로 본다
    accuracy: location.coords.accuracy ?? 0,
    timestampMs: location.timestamp,
  };
}

// 백그라운드 태스크는 모듈 스코프에서 한 번만 정의해야 한다.
// 실제 소비자는 러닝 중에만 붙으므로 여기서는 현재 구독자에게 넘기기만 한다.
let activeListener: ((point: GpsPoint) => void) | null = null;

TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: Location.LocationObject[] };
  for (const location of locations) {
    activeListener?.(toGpsPoint(location));
  }
});

const COMMON_OPTIONS = {
  accuracy: Location.Accuracy.BestForNavigation,
  timeInterval: 1000,
  distanceInterval: 0,
} as const;

export type Unsubscribe = () => void;

export async function watchPosition(onPoint: (point: GpsPoint) => void): Promise<Unsubscribe> {
  activeListener = onPoint;

  const background = await Location.getBackgroundPermissionsAsync().catch(() => null);
  if (background?.status === "granted") {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      ...COMMON_OPTIONS,
      // 일시정지 중에도 업데이트는 계속 받는다. 누적에서 뺄지는 RunEngine 이 판단한다.
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "러닝 측정 중",
        notificationBody: "거리와 페이스를 기록하고 있어요.",
        notificationColor: "#ff6392",
      },
    });

    return () => {
      activeListener = null;
      void Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => undefined);
    };
  }

  const subscription = await Location.watchPositionAsync(COMMON_OPTIONS, (location) =>
    activeListener?.(toGpsPoint(location)),
  );
  return () => {
    activeListener = null;
    subscription.remove();
  };
}

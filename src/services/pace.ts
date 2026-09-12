// 페이스 계산
// 순간 페이스는 GPS 노이즈에 민감하므로 최근 구간의 이동평균으로 계산한다.

export const DEFAULT_PACE_WINDOW_SECONDS = 30;
/** 이동평균을 내기 위해 필요한 최소 이동거리(m). 너무 짧으면 페이스가 요동친다 */
export const MIN_WINDOW_METERS = 20;

interface Sample {
  cumulativeMeters: number;
  elapsedSeconds: number;
}

export class PaceMeter {
  private readonly windowSeconds: number;
  private samples: Sample[] = [];

  constructor(windowSeconds: number = DEFAULT_PACE_WINDOW_SECONDS) {
    this.windowSeconds = windowSeconds;
  }

  push(cumulativeMeters: number, elapsedSeconds: number): void {
    this.samples.push({ cumulativeMeters, elapsedSeconds });
    const cutoff = elapsedSeconds - this.windowSeconds;
    // 창 밖으로 나간 샘플은 버리되, 창 경계를 잇기 위해 직전 샘플 하나는 남긴다
    let dropUntil = 0;
    while (dropUntil + 1 < this.samples.length && this.samples[dropUntil + 1].elapsedSeconds < cutoff) {
      dropUntil += 1;
    }
    if (dropUntil > 0) {
      this.samples = this.samples.slice(dropUntil);
    }
  }

  /** 최근 구간 기준 페이스(초/km). 표본이 부족하면 null */
  current(): number | null {
    if (this.samples.length < 2) return null;

    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const meters = last.cumulativeMeters - first.cumulativeMeters;
    const seconds = last.elapsedSeconds - first.elapsedSeconds;

    if (meters < MIN_WINDOW_METERS || seconds <= 0) return null;
    return (seconds / meters) * 1000;
  }

  reset(): void {
    this.samples = [];
  }
}

/** 전체 구간 평균 페이스(초/km) */
export function averagePace(totalMeters: number, totalSeconds: number): number | null {
  if (totalMeters < MIN_WINDOW_METERS || totalSeconds <= 0) return null;
  return (totalSeconds / totalMeters) * 1000;
}

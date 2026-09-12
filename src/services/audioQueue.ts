// 음성 재생 큐
//
// 마일스톤 안내와 일반 응원은 생성 경로가 다르지만 재생은 이 큐 하나로 합쳐진다.
// - 마일스톤이 항상 우선한다 (대기 중인 일반 응원보다 앞에 끼어든다)
// - 이미 재생 중인 음성은 끊지 않는다 (말이 겹쳐 들리는 것을 막는다)
// - 일반 응원은 유통기한이 있다. 큐에서 오래 대기했다면 이미 상황과 맞지 않으므로 버린다

export type CuePriority = "milestone" | "cheer";

export interface Cue {
  id: string;
  priority: CuePriority;
  /** 재생이 끝나면 resolve */
  play: () => Promise<void>;
  /** 이 시각(ms)을 넘기면 재생하지 않고 버린다. 마일스톤은 보통 만료시키지 않는다 */
  expiresAtMs?: number;
}

export class AudioQueue {
  private queue: Cue[] = [];
  private playing = false;
  private readonly now: () => number;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  enqueue(cue: Cue): void {
    if (cue.priority === "milestone") {
      // 앞선 마일스톤들 뒤, 대기 중인 일반 응원들 앞에 넣는다
      const insertAt = this.queue.findIndex((c) => c.priority !== "milestone");
      if (insertAt === -1) {
        this.queue.push(cue);
      } else {
        this.queue.splice(insertAt, 0, cue);
      }
    } else {
      this.queue.push(cue);
    }
    void this.drain();
  }

  clear(): void {
    this.queue = [];
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  private async drain(): Promise<void> {
    if (this.playing) return;
    this.playing = true;
    try {
      while (this.queue.length > 0) {
        const cue = this.queue.shift() as Cue;
        if (cue.expiresAtMs != null && this.now() > cue.expiresAtMs) continue;
        try {
          await cue.play();
        } catch {
          // 한 개가 실패해도 큐 전체가 멈추면 안 된다
        }
      }
    } finally {
      this.playing = false;
    }
  }
}

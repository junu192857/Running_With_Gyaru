import { AudioQueue, type Cue } from "../services/audioQueue";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function cue(id: string, priority: Cue["priority"], log: string[], gate?: Promise<void>): Cue {
  return {
    id,
    priority,
    play: async () => {
      await gate;
      log.push(id);
    },
  };
}

describe("AudioQueue", () => {
  it("한 번에 하나씩 순서대로 재생한다", async () => {
    const log: string[] = [];
    const queue = new AudioQueue();
    queue.enqueue(cue("a", "cheer", log));
    queue.enqueue(cue("b", "cheer", log));
    await new Promise((r) => setImmediate(r));
    expect(log).toEqual(["a", "b"]);
  });

  it("마일스톤은 대기 중인 일반 응원보다 먼저 나간다", async () => {
    const log: string[] = [];
    const gate = deferred();
    const queue = new AudioQueue();

    // 첫 큐가 재생 중인 동안 뒤이어 들어온 것들의 순서를 본다
    queue.enqueue(cue("playing", "cheer", log, gate.promise));
    queue.enqueue(cue("cheer1", "cheer", log));
    queue.enqueue(cue("milestone1", "milestone", log));
    queue.enqueue(cue("cheer2", "cheer", log));
    queue.enqueue(cue("milestone2", "milestone", log));

    gate.resolve();
    await new Promise((r) => setImmediate(r));

    expect(log).toEqual(["playing", "milestone1", "milestone2", "cheer1", "cheer2"]);
  });

  it("재생 중인 음성은 끊지 않는다", async () => {
    const log: string[] = [];
    const gate = deferred();
    const queue = new AudioQueue();
    queue.enqueue(cue("playing", "cheer", log, gate.promise));
    queue.enqueue(cue("milestone", "milestone", log));

    await new Promise((r) => setImmediate(r));
    expect(log).toEqual([]); // 아직 첫 번째가 안 끝났다

    gate.resolve();
    await new Promise((r) => setImmediate(r));
    expect(log).toEqual(["playing", "milestone"]);
  });

  it("유통기한이 지난 일반 응원은 버린다", async () => {
    const log: string[] = [];
    let now = 0;
    const gate = deferred();
    const queue = new AudioQueue(() => now);

    queue.enqueue(cue("playing", "milestone", log, gate.promise));
    queue.enqueue({ ...cue("stale", "cheer", log), expiresAtMs: 100 });
    queue.enqueue({ ...cue("fresh", "cheer", log), expiresAtMs: 10_000 });

    now = 5_000; // 앞의 마일스톤이 길어 응원이 밀린 상황
    gate.resolve();
    await new Promise((r) => setImmediate(r));

    expect(log).toEqual(["playing", "fresh"]);
  });

  it("하나가 실패해도 큐가 멈추지 않는다", async () => {
    const log: string[] = [];
    const queue = new AudioQueue();
    queue.enqueue({ id: "boom", priority: "cheer", play: () => Promise.reject(new Error("x")) });
    queue.enqueue(cue("next", "cheer", log));
    await new Promise((r) => setImmediate(r));
    expect(log).toEqual(["next"]);
  });
});

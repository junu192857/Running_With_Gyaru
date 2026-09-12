import {
  formatDistance,
  formatDuration,
  formatPace,
  spokenDistance,
  spokenDuration,
  spokenPace,
} from "../utils/format";

describe("formatDuration", () => {
  it("1시간 미만은 MM:SS", () => {
    expect(formatDuration(65)).toBe("01:05");
  });
  it("1시간 이상은 H:MM:SS", () => {
    expect(formatDuration(3725)).toBe("1:02:05");
  });
  it("음수는 0으로 본다", () => {
    expect(formatDuration(-5)).toBe("00:00");
  });
});

describe("formatPace", () => {
  it("초/km를 분'초\" 로 바꾼다", () => {
    expect(formatPace(330)).toBe("5'30\"");
  });
  it("반올림이 60초가 되면 분으로 올린다", () => {
    expect(formatPace(359.7)).toBe("6'00\"");
  });
  it("측정 전이면 플레이스홀더", () => {
    expect(formatPace(null)).toBe("--'--\"");
    expect(formatPace(0)).toBe("--'--\"");
  });
});

describe("formatDistance", () => {
  it("m를 km 소수 둘째 자리로", () => {
    expect(formatDistance(3241)).toBe("3.24");
  });
});

describe("spoken*", () => {
  it("1km 미만은 미터로 읽는다", () => {
    expect(spokenDistance(500)).toBe("500미터");
  });
  it("1km 이상은 킬로미터로 읽는다", () => {
    expect(spokenDistance(1000)).toBe("1킬로미터");
    expect(spokenDistance(1500)).toBe("1.5킬로미터");
  });
  it("시간은 시/분/초로 읽는다", () => {
    expect(spokenDuration(1800)).toBe("30분");
    expect(spokenDuration(3900)).toBe("1시간 5분");
    expect(spokenDuration(45)).toBe("45초");
  });
  it("페이스는 분 초로 읽는다", () => {
    expect(spokenPace(330)).toBe("5분 30초");
    expect(spokenPace(300)).toBe("5분");
    expect(spokenPace(null)).toBeNull();
  });
});

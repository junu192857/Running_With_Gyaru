import { PaceMeter, averagePace } from "../services/pace";

describe("PaceMeter", () => {
  it("표본이 부족하면 null", () => {
    const meter = new PaceMeter();
    meter.push(0, 0);
    expect(meter.current()).toBeNull();
  });

  it("이동거리가 너무 짧으면 null", () => {
    const meter = new PaceMeter();
    meter.push(0, 0);
    meter.push(10, 5);
    expect(meter.current()).toBeNull();
  });

  it("최근 구간 기준으로 초/km를 낸다", () => {
    const meter = new PaceMeter();
    // 10초마다 50m -> 5m/s -> 200초/km
    for (let i = 0; i <= 3; i += 1) {
      meter.push(i * 50, i * 10);
    }
    expect(meter.current()).toBeCloseTo(200, 0);
  });

  it("창(window) 밖의 오래된 표본은 페이스에 섞이지 않는다", () => {
    const meter = new PaceMeter(30);
    // 처음 60초는 걷기(1m/s), 이후 30초는 달리기(5m/s)
    for (let t = 0; t <= 60; t += 10) meter.push(t * 1, t);
    for (let t = 70; t <= 90; t += 10) meter.push(60 + (t - 60) * 5, t);
    // 최근 30초 구간은 5m/s 에 가까우므로 200초/km 근처여야 한다
    expect(meter.current()).toBeLessThan(400);
  });

  it("reset 하면 표본이 비워진다", () => {
    const meter = new PaceMeter();
    meter.push(0, 0);
    meter.push(100, 20);
    meter.reset();
    expect(meter.current()).toBeNull();
  });
});

describe("averagePace", () => {
  it("5km를 25분에 달리면 300초/km", () => {
    expect(averagePace(5000, 1500)).toBeCloseTo(300, 5);
  });

  it("거리가 거의 없으면 null", () => {
    expect(averagePace(5, 30)).toBeNull();
  });
});

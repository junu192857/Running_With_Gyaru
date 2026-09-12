// 화면 표기 / 음성 문구용 포매터

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDistance(meters: number): string {
  return (meters / 1000).toFixed(2);
}

// 페이스는 초/km. 측정 전이거나 비정상값이면 "--'--"
export function formatPace(secondsPerKm: number | null): string {
  if (secondsPerKm == null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) {
    return "--'--\"";
  }
  const capped = Math.min(secondsPerKm, 59 * 60 + 59);
  const m = Math.floor(capped / 60);
  const s = Math.round(capped % 60);
  // 반올림으로 60초가 되면 분으로 올림
  const carry = s === 60;
  return `${carry ? m + 1 : m}'${String(carry ? 0 : s).padStart(2, "0")}"`;
}

// TTS로 읽히기 좋은 거리 표현 ("1.5킬로미터", "500미터")
export function spokenDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    const text = Number.isInteger(km) ? String(km) : km.toFixed(1);
    return `${text}킬로미터`;
  }
  return `${Math.round(meters)}미터`;
}

// TTS로 읽히기 좋은 시간 표현 ("30분", "1시간 5분", "45초")
export function spokenDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}시간`);
  if (m > 0) parts.push(`${m}분`);
  if (sec > 0 && h === 0) parts.push(`${sec}초`);
  return parts.length > 0 ? parts.join(" ") : "0초";
}

// TTS로 읽히기 좋은 페이스 표현 ("5분 30초")
export function spokenPace(secondsPerKm: number | null): string | null {
  if (secondsPerKm == null || !Number.isFinite(secondsPerKm) || secondsPerKm <= 0) {
    return null;
  }
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return s === 0 ? `${m}분` : `${m}분 ${s}초`;
}

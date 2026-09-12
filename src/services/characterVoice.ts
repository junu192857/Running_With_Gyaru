// 캐릭터 음성 파이프라인 클라이언트 (개인 소장용, 스토어 배포 대상 아님)
//
// 실제 생성(LLM 멘트 작성 -> TTS -> RVC 음성 변환)은 서버리스 GPU 쪽에서 돌고,
// 앱은 HTTP로 요청해서 오디오 파일을 받아 로컬에 캐싱만 한다.
//
// 두 가지 경로가 있다.
//   1) prewarm(): 마일스톤 멘트를 러닝 시작 직전에 미리 전부 생성해 둔다.
//      달리는 도중 네트워크가 끊겨도 구간 안내는 캐릭터 목소리로 나간다.
//   2) requestCheer(): 구간 사이 일반 응원. 현재 페이스/거리를 반영해야 하므로
//      실시간으로 생성한다. 실패하면 그냥 건너뛴다(시스템 TTS로 대체하지 않는다).
//
// 어느 쪽이든 GPS 누적/페이스 계산과는 분리된 비동기 흐름이라 측정 정확도에 영향이 없다.

import * as FileSystem from "expo-file-system";
import type { Milestone } from "./announcer";

export interface CharacterVoiceConfig {
  /** 서버리스 GPU 파이프라인 base URL */
  endpoint: string;
  apiKey?: string;
  /** 서버에 등록된 RVC 모델 식별자 */
  characterId: string;
  /** 요청 타임아웃(ms) */
  timeoutMs?: number;
}

/** 멘트 생성 시 LLM에 넘기는 러닝 상황 */
export interface CheerContext {
  distanceMeters: number;
  durationSeconds: number;
  paceSecondsPerKm: number | null;
  goalType: "distance" | "time";
  goalValue: number;
}

const DEFAULT_TIMEOUT_MS = 20_000;

function cacheRoot(): string {
  // expo-file-system 의 캐시 디렉터리. OS가 필요할 때 정리한다.
  return `${FileSystem.cacheDirectory}character-voice/`;
}

async function ensureCacheDir(): Promise<void> {
  const dir = cacheRoot();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class CharacterVoiceClient {
  private readonly config: CharacterVoiceConfig;
  /** milestone.id -> 로컬 파일 uri */
  private readonly milestoneCache = new Map<string, string>();
  private cheerCounter = 0;

  constructor(config: CharacterVoiceConfig) {
    this.config = config;
  }

  /**
   * 마일스톤 멘트 사전 생성. 러닝 시작 직전(설정 -> 카운트다운 사이)에 호출한다.
   * 개별 실패는 삼킨다. 캐시에 없는 마일스톤은 재생 시점에 시스템 TTS로 폴백된다.
   * @returns 생성에 성공한 마일스톤 수
   */
  async prewarm(milestones: Milestone[], context: Omit<CheerContext, "distanceMeters" | "durationSeconds" | "paceSecondsPerKm">): Promise<number> {
    await ensureCacheDir();

    let ready = 0;
    for (const milestone of milestones) {
      try {
        const uri = await this.generate({
          kind: milestone.kind,
          milestoneId: milestone.id,
          atMeters: milestone.atMeters,
          atSeconds: milestone.atSeconds,
          goalType: context.goalType,
          goalValue: context.goalValue,
        }, `milestone-${milestone.id.replace(/[^a-zA-Z0-9]/g, "_")}`);

        if (uri) {
          this.milestoneCache.set(milestone.id, uri);
          ready += 1;
        }
      } catch {
        // 이 마일스톤만 시스템 TTS로 폴백된다
      }
    }
    return ready;
  }

  /** 사전 생성된 마일스톤 음성의 로컬 uri. 없으면 null (시스템 TTS 폴백) */
  milestoneAudio(milestoneId: string): string | null {
    return this.milestoneCache.get(milestoneId) ?? null;
  }

  /** 구간 사이 일반 응원. 실시간 생성이라 실패하면 그냥 null */
  async requestCheer(context: CheerContext): Promise<string | null> {
    await ensureCacheDir();
    this.cheerCounter += 1;
    try {
      return await this.generate({ kind: "cheer", ...context }, `cheer-${this.cheerCounter}`);
    } catch {
      return null;
    }
  }

  /** 러닝이 끝나면 이번 세션에서 받은 파일을 정리한다 */
  async clearCache(): Promise<void> {
    this.milestoneCache.clear();
    await FileSystem.deleteAsync(cacheRoot(), { idempotent: true }).catch(() => undefined);
  }

  private async generate(payload: Record<string, unknown>, filename: string): Promise<string | null> {
    const response = await fetchWithTimeout(
      `${this.config.endpoint.replace(/\/$/, "")}/v1/line`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({ characterId: this.config.characterId, ...payload }),
      },
      this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    );

    if (!response.ok) return null;

    // 서버는 { audioUrl } 또는 { audioBase64 } 중 하나로 응답한다
    const body = (await response.json()) as { audioUrl?: string; audioBase64?: string };
    const target = `${cacheRoot()}${filename}.m4a`;

    if (body.audioUrl) {
      const result = await FileSystem.downloadAsync(body.audioUrl, target);
      return result.status === 200 ? result.uri : null;
    }
    if (body.audioBase64) {
      await FileSystem.writeAsStringAsync(target, body.audioBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return target;
    }
    return null;
  }
}

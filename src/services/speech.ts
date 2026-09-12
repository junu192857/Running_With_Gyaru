// 시스템 TTS (expo-speech) 래퍼.
// 캐릭터 음성 생성이 실패하거나 아직 준비되지 않았을 때의 폴백 경로다.

import * as Speech from "expo-speech";

export const TTS_LANGUAGE = "ko-KR";

export function speak(text: string, rate = 1.0): Promise<void> {
  return new Promise((resolve) => {
    Speech.speak(text, {
      language: TTS_LANGUAGE,
      rate,
      onDone: () => resolve(),
      // 실패해도 큐가 막히지 않도록 항상 resolve 한다
      onStopped: () => resolve(),
      onError: () => resolve(),
    });
  });
}

export function stopSpeaking(): void {
  void Speech.stop();
}

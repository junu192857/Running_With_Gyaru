// 캐릭터 음성 파이프라인 접속 정보.
// 개인 소장용이라 서버는 각자 띄우고, 주소는 EXPO_PUBLIC_ 환경변수로 주입한다.
// (.env 는 커밋하지 않는다)

export const characterVoiceConfig = {
  endpoint: process.env.EXPO_PUBLIC_VOICE_ENDPOINT ?? "",
  apiKey: process.env.EXPO_PUBLIC_VOICE_API_KEY,
  characterId: process.env.EXPO_PUBLIC_VOICE_CHARACTER_ID ?? "default",
};

/** 엔드포인트가 설정돼 있지 않으면 시스템 TTS만 사용한다 */
export const characterVoiceAvailable = characterVoiceConfig.endpoint.length > 0;

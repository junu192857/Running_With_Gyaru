// 생성된 캐릭터 음성 파일 재생 (expo-av)

import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av";

let configured = false;

/**
 * 화면이 꺼져도, 다른 앱의 음악이 재생 중이어도 안내가 들리도록 설정한다.
 * 음악은 끄지 않고 잠깐 볼륨만 낮춘다(ducking).
 */
export async function configureAudioSession(): Promise<void> {
  if (configured) return;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
  });
  configured = true;
}

export async function playAudioFile(uri: string): Promise<void> {
  await configureAudioSession();
  const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
  try {
    await new Promise<void>((resolve) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          resolve();
          return;
        }
        if (status.didJustFinish) resolve();
      });
    });
  } finally {
    await sound.unloadAsync().catch(() => undefined);
  }
}

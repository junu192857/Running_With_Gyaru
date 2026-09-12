# Running With Gyaru

좋아하는 캐릭터 목소리로 응원받으며 달리는 러닝 앱. React Native(Expo Router), Android/iOS 대상.
**개인 소장용이며 스토어 배포 대상이 아니다.**

## 실행

```bash
npm install
npm start          # Expo 개발 서버
npm run android    # 또는 npm run ios
npm test           # 순수 로직 테스트
npm run typecheck
```

캐릭터 음성을 쓰려면 `.env.example` 을 `.env` 로 복사하고 음성 서버 주소를 채운다.
비워 두면 앱은 시스템 TTS 로만 안내한다(측정 기능은 그대로 동작).

## iOS 실기기에서 테스트하기

이 앱은 **Expo Go 로는 전체 기능을 확인할 수 없다.** 백그라운드 위치 추적
(`startLocationUpdatesAsync` + TaskManager, iOS `UIBackgroundModes`)은 Expo Go 에서
지원되지 않기 때문이다. 다만 백그라운드 권한이 없으면 `watchPositionAsync` 로
폴백하도록 만들어 뒀으므로, **화면을 켜 둔 채라면** Expo Go 로도 화면 흐름과
거리/페이스 측정은 확인할 수 있다.

전체 기능(화면 끄고 달리기, 백그라운드 안내)을 보려면 development build 가 필요하다.

### 1. 시뮬레이터 (Apple 계정 불필요)

시뮬레이터용 빌드는 코드 서명이 없어 무료로 만들 수 있다. Xcode 의
Debug > Simulate Location (Freeway Drive 등)으로 좌표를 흘려 넣으면
거리 누적과 마일스톤 발화까지 확인된다. GPS 정확도 자체는 검증할 수 없다.

```bash
npm i -g eas-cli
eas login && eas init
eas build --profile development-simulator --platform ios
npx expo start --dev-client
```

### 2. 실기기 + 유료 Apple Developer Program ($99/년)

EAS 가 ad-hoc 프로비저닝을 만들어 주고, 빌드가 끝나면 QR/링크로 기기에 무선
설치된다. 가장 편한 경로이고 프로비저닝도 1년간 유효하다.

```bash
eas device:create                                   # 테스트할 기기 등록
eas build --profile development --platform ios      # 빌드 후 QR 로 설치
npx expo start --dev-client                          # 기기에서 앱 열고 개발 서버 연결
```

### 3. 실기기 + 무료 Apple ID (Mac 필요)

무료 계정은 EAS 클라우드 배포에 쓸 수 없다. Mac 에서 직접 서명해 설치해야 하고,
**앱이 7일마다 만료되어 재설치해야 한다.**

```bash
npx expo prebuild --platform ios     # ios/ 네이티브 프로젝트 생성
open ios/*.xcworkspace
# Xcode > Signing & Capabilities > Team 에 본인 Apple ID(Personal Team) 선택
# 기기 연결 후 Run. 기기에서 설정 > 일반 > VPN 및 기기 관리 에서 개발자 신뢰
```

`ios/` 는 생성물이라 커밋하지 않는다 (설정은 `app.json` 이 원본).

### 확인할 것

실기기에서만 검증되는 항목들이다.

- GPS 정확도 필터(20m)가 실제 환경에서 너무 빡빡하거나 느슨하지 않은지
- 화면을 끄고 달릴 때 측정이 끊기지 않는지 (iOS 는 배터리 정책으로 앱을 정지시킬 수 있다)
- 음악 재생 중 안내 음성이 ducking 으로 잘 끼어드는지
- 터널·건물 사이에서 속도 이상치 필터(7m/s)가 오작동하지 않는지

### 음성 서버 주소

`EXPO_PUBLIC_*` 값은 번들 시점에 박힌다. development build 는 번들을 개발 서버에서
받으므로 로컬 `.env` 가 그대로 반영되지만, `preview` 프로파일처럼 번들을 구워 넣는
빌드는 `eas.json` 의 `env` 나 EAS Secrets 로 넣어야 한다.


## 핵심 설계 결정

- **목표 모드**: 거리 달리기 / 시간 달리기 중 선택, 카운트다운 5초 후 측정 시작
- **음성 안내**: 구간 안내는 항상 거리 기준으로 통일 (예: 500m/1km마다). 완주 직전 안내만 목표 타입에 따라 분기 — 거리 목표는 완주 200m 전, 시간 목표는 완주 1분 전
- **GPS 처리**: 정확도 필터(20m) + 속도 이상치 필터(7m/s) + 정지 보정(2m 미만 이동 무시), haversine으로 누적 거리 계산, 페이스는 최근 30초 이동평균. 필터에 걸린 포인트는 다음 구간의 기준점으로도 쓰지 않는다
- **일시정지**: 위치 구독은 유지하되 거리/시간 누적에서 제외, 재개 직후 2개 포인트는 버퍼링
- **백그라운드**: 백그라운드 위치 권한이 있으면 TaskManager 기반 업데이트(Android는 foreground service 알림), 없으면 앱이 떠 있는 동안만 동작하는 `watchPositionAsync` 로 폴백
- **캐릭터 음성 응원**:
  - 마일스톤(구간/완주 직전) 멘트는 카운트다운이 도는 동안 미리 생성 후 로컬 캐싱 (LLM 텍스트 생성 + TTS + RVC 음성 변환, 서버리스 GPU 호출)
  - 구간 사이 일반 응원 멘트는 사용자가 설정한 간격(최소 2분)마다 실시간 생성
  - 두 경로 모두 재생 큐로 합쳐지며(마일스톤 우선, 재생 중인 음성은 끊지 않음), GPS 거리/페이스 계산과는 완전히 분리된 비동기 흐름이라 측정 정확도에 영향 없음
  - 생성 실패 시 마일스톤은 시스템 TTS 로 폴백, 일반 응원은 조용히 건너뜀
- **기록 저장**: SQLite. 세션당 날짜, 목표 타입/값, 실제 거리/시간, 평균 페이스, 완주 여부 저장

## 구조

```
app/                      expo-router 화면
  index.tsx               설정 (목표 / 안내 간격 / 응원 주기)
  countdown.tsx           카운트다운 5초 + 음성 사전 생성
  run.tsx                 측정 (거리/시간/페이스/진행률)
  result.tsx              결과 요약
  history.tsx             지난 기록 목록
src/services/
  location.ts             GPS 필터 + haversine
  locationTracking.ts     expo-location / TaskManager 구독
  runEngine.ts            거리·시간·페이스·마일스톤 계산 (순수 로직)
  announcer.ts            마일스톤 설계와 발화 판정
  pace.ts                 이동평균 페이스
  audioQueue.ts           마일스톤 우선 재생 큐
  characterVoice.ts       음성 파이프라인 클라이언트 + 캐시
  speech.ts               시스템 TTS 폴백
  audioPlayer.ts          생성된 음성 파일 재생 (ducking)
  coach.ts                위 조각들을 묶는 러닝 오케스트레이터
  db.ts                   SQLite 기록 저장
src/store/
  runSession.ts           세션 타입 / 기본값 / 검증
  useRunStore.ts          화면이 바라보는 zustand 스토어
```

`runEngine` / `announcer` / `pace` / `audioQueue` 는 expo 모듈에 의존하지 않는 순수 로직이라
`npm test` 로 그대로 검증된다 (현재 49개 테스트).

## 음성 서버 인터페이스

앱은 아래 한 개의 엔드포인트만 호출한다. 서버 구현은 이 저장소 밖에 있다.

```
POST {EXPO_PUBLIC_VOICE_ENDPOINT}/v1/line
Authorization: Bearer {EXPO_PUBLIC_VOICE_API_KEY}   # 선택

# 마일스톤 사전 생성
{ "characterId": "...", "kind": "interval" | "nearFinish" | "finish",
  "milestoneId": "interval:1000", "atMeters": 1000, "atSeconds": null,
  "goalType": "distance", "goalValue": 5000 }

# 실시간 응원
{ "characterId": "...", "kind": "cheer",
  "distanceMeters": 2340, "durationSeconds": 780, "paceSecondsPerKm": 333,
  "goalType": "distance", "goalValue": 5000 }

응답: { "audioUrl": "https://..." } 또는 { "audioBase64": "..." }   # m4a
```

## 다음 작업

- [ ] 실기기에서 GPS 정확도 / 백그라운드 지속성 검증 (위 "확인할 것" 참고)
- [ ] 캐릭터 음성 파이프라인 서버(서버리스 GPU) 구축 — 위 인터페이스 구현
- [ ] 러닝 경로 지도 표시 및 저장
- [ ] 기록 상세 화면 (구간별 스플릿)

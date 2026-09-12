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

- [ ] 실기기에서 GPS 정확도 / 백그라운드 지속성 검증 (에뮬레이터로는 확인 불가)
- [ ] 캐릭터 음성 파이프라인 서버(서버리스 GPU) 구축 — 위 인터페이스 구현
- [ ] 러닝 경로 지도 표시 및 저장
- [ ] 기록 상세 화면 (구간별 스플릿)

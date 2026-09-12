// expo/react-native 에 의존하지 않는 순수 로직(거리 계산, 마일스톤, 페이스, 재생 큐)만
// node 환경에서 테스트한다. 화면과 네이티브 모듈은 실기기에서 확인한다.
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts"],
};

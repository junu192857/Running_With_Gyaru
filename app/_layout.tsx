import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { theme } from "../src/theme";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bg },
          headerTintColor: theme.text,
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: theme.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: "러닝 준비" }} />
        {/* 카운트다운과 측정 화면에서는 실수로 뒤로 가지 않도록 헤더를 숨긴다 */}
        <Stack.Screen name="countdown" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="run" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="result" options={{ title: "결과", headerBackVisible: false }} />
        <Stack.Screen name="history" options={{ title: "기록" }} />
      </Stack>
    </>
  );
}

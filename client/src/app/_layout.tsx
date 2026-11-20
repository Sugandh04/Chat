import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SessionProvider, useSession } from "../lib/session";
import { useTheme } from "../lib/theme";

function Root() {
  const { ready, user } = useSession();
  const t = useTheme();
  if (!ready) return null;
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="index" />
          <Stack.Screen name="new" options={{ presentation: "modal" }} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="chat/[id]" />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="register" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <Root />
    </SessionProvider>
  );
}

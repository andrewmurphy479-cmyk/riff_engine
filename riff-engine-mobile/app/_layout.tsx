import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme/colors';
import RiffologyLoadingScreen from '../components/RiffologyLoadingScreen';
import { usePracticeStore } from '../store/usePracticeStore';

/** Track when the persisted practice store has finished rehydrating. */
function usePracticeHydrated() {
  const [hydrated, setHydrated] = useState(() =>
    usePracticeStore.persist.hasHydrated(),
  );
  useEffect(() => {
    const unsub = usePracticeStore.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    setHydrated(usePracticeStore.persist.hasHydrated());
    return unsub;
  }, []);
  return hydrated;
}

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const hydrated = usePracticeHydrated();
  const onboardingComplete = usePracticeStore((s) => s.onboardingComplete);

  // Hold the splash until both the intro timer and store hydration are done,
  // so returning users never flash the onboarding screen.
  if (isLoading || !hydrated) {
    return (
      <>
        <StatusBar style="light" />
        <RiffologyLoadingScreen onFinish={() => setIsLoading(false)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.background,
          },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: {
            fontWeight: '600',
          },
          contentStyle: {
            backgroundColor: colors.background,
          },
          headerShadowVisible: false,
        }}
      >
        <Stack.Protected guard={onboardingComplete}>
          <Stack.Screen
            name="(tabs)"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="settings"
            options={{ title: 'Settings', presentation: 'modal' }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!onboardingComplete}>
          <Stack.Screen
            name="onboarding"
            options={{ headerShown: false }}
          />
        </Stack.Protected>
      </Stack>
    </>
  );
}

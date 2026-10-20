import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AudioEngine } from '../audio/AudioEngine';
import { colors } from '../theme/colors';
import RiffologyLoadingScreen from '../components/RiffologyLoadingScreen';
import { useNewRiffStore } from '../store/useNewRiffStore';
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

  // The playhead offset is one global truth, not per-screen state (audit A7),
  // so it is pushed into the engine here rather than by whoever plays audio.
  const playheadOffsetMs = useNewRiffStore((s) => s.playheadOffsetMs);
  useEffect(() => {
    AudioEngine.setOutputLatency(playheadOffsetMs);
  }, [playheadOffsetMs]);

  // Rehydrate before routing; returning players need no added intro delay.
  if (!hydrated || (isLoading && !onboardingComplete)) {
    return (
      <>
        <StatusBar style="dark" />
        <RiffologyLoadingScreen onFinish={() => setIsLoading(false)} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
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

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme/colors';
import LoadingScreen from '../components/LoadingScreen';
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

  // Hold the splash until both the intro and store hydration are done, so
  // returning users never flash the onboarding screen. Until hydration we
  // don't know if this is a first launch, so show a bare background (matches
  // the native splash); hydration is near-instant, then first-launch users
  // get the full intro and returning users a sub-second fade.
  if (isLoading || !hydrated) {
    return (
      <>
        <StatusBar style="light" />
        {hydrated ? (
          <LoadingScreen
            fullIntro={!onboardingComplete}
            onFinish={() => setIsLoading(false)}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.background }} />
        )}
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

import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AudioEngine } from '../audio/AudioEngine';
import { colors } from '../theme/colors';
import { LPK_SPLASH_BG, LpkAppsSplash } from '../components/LpkAppsSplash';
import RiffologyLoadingScreen from '../components/RiffologyLoadingScreen';
import { syncAnalyticsConsent } from '../lib/analytics';
import { shouldPlayStudioIntro } from '../lib/studioIntro';
import { initMonetizationOnce } from '../lib/useAds';
import { useNewRiffStore } from '../store/useNewRiffStore';
import { usePracticeStore } from '../store/usePracticeStore';

/** Hard cap on the studio intro, in case the WebView never reports back. */
const STUDIO_INTRO_MAX_MS = 6000;
const STUDIO_INTRO_FADE_MS = 450;

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

type StudioIntroPhase = 'deciding' | 'playing' | 'fading' | 'done';

/**
 * The "LPK Apps" studio intro: once per day, tap to skip, capped at
 * STUDIO_INTRO_MAX_MS, then a crossfade into the app.
 */
function useStudioIntro() {
  const [phase, setPhase] = useState<StudioIntroPhase>('deciding');
  const opacity = useRef(new Animated.Value(1)).current;
  const advanced = useRef(false);

  useEffect(() => {
    shouldPlayStudioIntro().then((play) => setPhase(play ? 'playing' : 'done'));
  }, []);

  const finish = useCallback(() => {
    if (advanced.current) return;
    advanced.current = true;
    setPhase('fading');
    Animated.timing(opacity, {
      toValue: 0,
      duration: STUDIO_INTRO_FADE_MS,
      useNativeDriver: true,
    }).start(() => setPhase('done'));
  }, [opacity]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const id = setTimeout(finish, STUDIO_INTRO_MAX_MS);
    return () => clearTimeout(id);
  }, [phase, finish]);

  return { phase, opacity, finish };
}

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const hydrated = usePracticeHydrated();
  const onboardingComplete = usePracticeStore((s) => s.onboardingComplete);
  const intro = useStudioIntro();

  // Learn the consent region now, without a form, so a player outside GDPR
  // regions is counted from onboarding on.
  useEffect(() => {
    void syncAnalyticsConsent({ refresh: true });
  }, []);

  // The playhead offset is one global truth, not per-screen state (audit A7),
  // so it is pushed into the engine here rather than by whoever plays audio.
  const playheadOffsetMs = useNewRiffStore((s) => s.playheadOffsetMs);
  useEffect(() => {
    AudioEngine.setOutputLatency(playheadOffsetMs);
  }, [playheadOffsetMs]);

  // Ads and the store start after onboarding, so the consent form and the iOS
  // tracking prompt never interrupt the taste check — nor the studio intro.
  const appReady = hydrated && onboardingComplete && intro.phase === 'done';
  useEffect(() => {
    if (appReady) void initMonetizationOnce();
  }, [appReady]);

  // While the intro covers the screen, the brand reveal is held back so its
  // short timer isn't spent unseen; the app itself loads underneath so a
  // returning player lands in it the moment the intro fades.
  const introCovering = intro.phase === 'deciding' || intro.phase === 'playing';
  const showLoading = !hydrated || (isLoading && !onboardingComplete);

  let content: React.ReactNode;
  if (intro.phase === 'deciding' || (showLoading && introCovering)) {
    content = <View style={styles.paper} />;
  } else if (showLoading) {
    // Rehydrate before routing; returning players need no added delay.
    content = <RiffologyLoadingScreen onFinish={() => setIsLoading(false)} />;
  } else {
    content = (
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
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style={intro.phase === 'playing' ? 'light' : 'dark'} />
      {content}
      {(intro.phase === 'playing' || intro.phase === 'fading') && (
        <Animated.View style={[styles.introOverlay, { opacity: intro.opacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={intro.finish}
            accessibilityRole="button"
            accessibilityLabel="Skip intro"
          >
            <LpkAppsSplash onFinish={intro.finish} />
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  paper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  introOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: LPK_SPLASH_BG,
  },
});

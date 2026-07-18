import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors";

const DOG_IMG = require("../assets/rock-dog.png");

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// How long the returning-user fast path stays on screen in total.
const FAST_FADE_IN_MS = 350;
const FAST_HOLD_MS = 250;

interface Props {
  /**
   * Full animated intro (first launch only). Returning users get a fast
   * logo fade that hands off in well under a second.
   */
  fullIntro: boolean;
  onFinish: () => void;
}

export default function LoadingScreen({ fullIntro, onFinish }: Props) {
  return fullIntro ? (
    <IntroSequence onFinish={onFinish} />
  ) : (
    <FastFade onFinish={onFinish} />
  );
}

// ---------------------------------------------------------------------------
// Returning users: wordmark fade, < 800ms total
// ---------------------------------------------------------------------------

function FastFade({ onFinish }: { onFinish: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: FAST_FADE_IN_MS,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    const t = setTimeout(onFinish, FAST_FADE_IN_MS + FAST_HOLD_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity, alignItems: "center" }}>
        <Text style={styles.title}>RIFF ENGINE</Text>
        <View style={styles.decorLineStatic} />
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// First launch: full animated intro
// ---------------------------------------------------------------------------

interface NoteAnim {
  opacity: Animated.Value;
  translateY: Animated.Value;
  scale: Animated.Value;
}

interface Sparkle {
  opacity: Animated.Value;
  left: number;
  top: number;
  size: number;
  color: string;
}

function IntroSequence({ onFinish }: { onFinish: () => void }) {
  const dogOpacity = useRef(new Animated.Value(0)).current;
  const dogScale = useRef(new Animated.Value(0.9)).current;
  const strumRotate = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  const fistScale = useRef(new Animated.Value(0)).current;
  const fistRotate = useRef(new Animated.Value(-30)).current;
  const fistOpacity = useRef(new Animated.Value(0)).current;

  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(30)).current;
  const titleScale = useRef(new Animated.Value(0.8)).current;

  const lineWidth = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  const [showNotes, setShowNotes] = useState(false);
  const noteAnims = useRef<NoteAnim[]>(
    Array.from({ length: 5 }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(0),
      scale: new Animated.Value(0.5),
    })),
  ).current;

  // Cool blue sparkles to match the app accent.
  const sparkles = useRef<Sparkle[]>(
    Array.from({ length: 15 }, () => ({
      opacity: new Animated.Value(Math.random()),
      left: Math.random() * SCREEN_W,
      top: Math.random() * SCREEN_H,
      size: 3 + Math.random() * 4,
      color: `rgba(${90 + Math.floor(Math.random() * 60)}, ${
        130 + Math.floor(Math.random() * 60)
      }, 255, ${0.4 + Math.random() * 0.4})`,
    })),
  ).current;

  useEffect(() => {
    sparkles.forEach((s) => {
      const duration = 2000 + Math.random() * 3000;
      Animated.loop(
        Animated.sequence([
          Animated.timing(s.opacity, {
            toValue: 1,
            duration: duration / 2,
            useNativeDriver: true,
          }),
          Animated.timing(s.opacity, {
            toValue: 0,
            duration: duration / 2,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    });

    const sequence = Animated.sequence([
      // Phase 0: Fade in dog
      Animated.parallel([
        Animated.timing(dogOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(dogScale, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]),

      // Phase 1: Strum + glow
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.sequence(
          Array.from({ length: 3 }, () =>
            Animated.sequence([
              Animated.timing(strumRotate, {
                toValue: -3,
                duration: 75,
                useNativeDriver: true,
              }),
              Animated.timing(strumRotate, {
                toValue: 3,
                duration: 150,
                useNativeDriver: true,
              }),
              Animated.timing(strumRotate, {
                toValue: 0,
                duration: 75,
                useNativeDriver: true,
              }),
            ]),
          ),
        ),
      ]),

      // Phase 2: Rock fist
      Animated.parallel([
        Animated.spring(fistScale, {
          toValue: 1,
          tension: 200,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(fistOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fistRotate, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
      ]),

      Animated.delay(300),

      // Phase 3: Title
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.spring(titleTranslateY, {
          toValue: 0,
          tension: 120,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(titleScale, {
          toValue: 1,
          tension: 120,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),

      // Phase 4: Line + tagline
      Animated.parallel([
        Animated.timing(lineWidth, {
          toValue: 200,
          duration: 800,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false, // width can't use native driver
        }),
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 800,
          delay: 300,
          useNativeDriver: true,
        }),
      ]),

      // Let the tagline breathe, then hand off — no long dead wait.
      Animated.delay(400),
    ]);

    sequence.start(onFinish);

    // Notes animation (fire after strum starts)
    const notesTimer = setTimeout(() => {
      setShowNotes(true);
      noteAnims.forEach((n, i) => {
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.parallel([
            Animated.sequence([
              Animated.timing(n.opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.timing(n.opacity, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
              }),
            ]),
            Animated.timing(n.translateY, {
              toValue: -100,
              duration: 1100,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(n.scale, {
              toValue: 0.7,
              duration: 1100,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      });
    }, 600);

    return () => clearTimeout(notesTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const notes = ["🎵", "🎶", "🎸", "🎵", "🎶"];

  const strumInterpolate = strumRotate.interpolate({
    inputRange: [-3, 0, 3],
    outputRange: ["-3deg", "0deg", "3deg"],
  });

  const fistRotateInterpolate = fistRotate.interpolate({
    inputRange: [-30, 0],
    outputRange: ["-30deg", "0deg"],
  });

  return (
    <View style={styles.container}>
      {/* Sparkles */}
      {sparkles.map((s, i) => (
        <Animated.View
          key={`spark-${i}`}
          style={{
            position: "absolute",
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: s.color,
            left: s.left,
            top: s.top,
            opacity: s.opacity,
          }}
        />
      ))}

      {/* Dog container */}
      <Animated.View
        style={{
          opacity: dogOpacity,
          transform: [{ scale: dogScale }, { rotate: strumInterpolate }],
          alignItems: "center",
        }}
      >
        {/* Glow */}
        <Animated.View style={[styles.glow, { opacity: glowOpacity }]} />

        {/* Dog image with gradient-faded edges */}
        <View style={styles.imageContainer}>
          <Image source={DOG_IMG} style={styles.dogImage} resizeMode="cover" />
          <LinearGradient
            colors={[colors.background, "transparent"]}
            style={styles.fadeTop}
          />
          <LinearGradient
            colors={["transparent", colors.background]}
            style={styles.fadeBottom}
          />
          <LinearGradient
            colors={[colors.background, "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.fadeLeft}
          />
          <LinearGradient
            colors={["transparent", colors.background]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.fadeRight}
          />
        </View>

        {/* Music notes */}
        {showNotes &&
          notes.map((note, i) => (
            <Animated.Text
              key={`note-${i}`}
              style={{
                position: "absolute",
                fontSize: 20 + i * 3,
                left: i % 2 === 0 ? -10 - i * 8 : 230 + i * 8,
                top: 80 + i * 30,
                opacity: noteAnims[i].opacity,
                transform: [
                  { translateY: noteAnims[i].translateY },
                  { scale: noteAnims[i].scale },
                ],
              }}
            >
              {note}
            </Animated.Text>
          ))}

        {/* Rock fist */}
        <Animated.Text
          style={{
            position: "absolute",
            bottom: 0,
            right: -10,
            fontSize: 48,
            opacity: fistOpacity,
            transform: [{ scale: fistScale }, { rotate: fistRotateInterpolate }],
          }}
        >
          🤘
        </Animated.Text>
      </Animated.View>

      {/* Title */}
      <Animated.View
        style={{
          marginTop: 28,
          alignItems: "center",
          opacity: titleOpacity,
          transform: [{ translateY: titleTranslateY }, { scale: titleScale }],
        }}
      >
        <Text style={styles.title}>RIFF ENGINE</Text>

        <Animated.View style={[styles.decorLine, { width: lineWidth }]} />

        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          LET'S SHRED
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(74, 122, 255, 0.15)",
    top: 30,
    alignSelf: "center",
  },
  imageContainer: {
    width: 280,
    height: 360,
    overflow: "hidden",
    position: "relative",
  },
  dogImage: {
    width: 280,
    height: 360,
  },
  fadeTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 70,
  },
  fadeBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 90,
  },
  fadeLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 60,
  },
  fadeRight: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 60,
  },
  title: {
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: 5,
    color: colors.accent,
    fontStyle: "italic",
    textShadowColor: "rgba(74, 122, 255, 0.6)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  decorLine: {
    height: 2,
    backgroundColor: colors.accent,
    marginTop: 8,
    opacity: 0.6,
  },
  decorLineStatic: {
    height: 2,
    width: 200,
    backgroundColor: colors.accent,
    marginTop: 8,
    opacity: 0.6,
  },
  tagline: {
    color: "rgba(160, 190, 255, 0.7)",
    fontSize: 13,
    letterSpacing: 4,
    marginTop: 6,
  },
});

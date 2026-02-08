import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Animated,
  Easing,
  Dimensions,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

// Place your image at assets/rock-dog.png and update the path if needed
const DOG_IMG = require("../assets/rock-dog.png");

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export default function RiffologyLoadingScreen({ onFinish }) {
  // Animated values
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

  const dotOpacities = [
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
    useRef(new Animated.Value(0.3)).current,
  ];

  // Note animations
  const [showNotes, setShowNotes] = useState(false);
  const noteAnims = useRef(
    Array.from({ length: 5 }, () => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(0),
      scale: new Animated.Value(0.5),
    }))
  ).current;

  // Sparkle animations
  const sparkles = useRef(
    Array.from({ length: 15 }, () => ({
      opacity: new Animated.Value(Math.random()),
      left: Math.random() * SCREEN_W,
      top: Math.random() * SCREEN_H,
      size: 3 + Math.random() * 4,
      color: `rgba(255, ${180 + Math.floor(Math.random() * 75)}, ${80 + Math.floor(Math.random() * 60)}, ${0.4 + Math.random() * 0.4})`,
    }))
  ).current;

  useEffect(() => {
    // Sparkle loop
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
        ])
      ).start();
    });

    // Main sequence
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

      // Phase 1: Strum + glow + notes
      Animated.parallel([
        Animated.timing(glowOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.sequence([
          ...Array.from({ length: 3 }, () =>
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
            ])
          ),
        ]),
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

      // Small pause
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
    ]);

    sequence.start(() => {
      // Start loading dots loop
      startLoadingDots();
      // Optional callback when animation finishes
      if (onFinish) {
        setTimeout(onFinish, 2000);
      }
    });

    // Notes animation (fire after strum starts)
    setTimeout(() => {
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
  }, []);

  const startLoadingDots = () => {
    dotOpacities.forEach((dot, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(dot, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  };

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
        <Animated.View
          style={[
            styles.glow,
            { opacity: glowOpacity },
          ]}
        />

        {/* Dog image with gradient fade using a mask-like overlay */}
        <View style={styles.imageContainer}>
          <Image source={DOG_IMG} style={styles.dogImage} resizeMode="cover" />
          {/* Fade edges with gradient overlays */}
          <LinearGradient
            colors={[BG_COLOR, "transparent"]}
            style={styles.fadeTop}
          />
          <LinearGradient
            colors={["transparent", BG_COLOR]}
            style={styles.fadeBottom}
          />
          <LinearGradient
            colors={[BG_COLOR, "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.fadeLeft}
          />
          <LinearGradient
            colors={["transparent", BG_COLOR]}
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
            transform: [
              { scale: fistScale },
              { rotate: fistRotateInterpolate },
            ],
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
          transform: [
            { translateY: titleTranslateY },
            { scale: titleScale },
          ],
        }}
      >
        <Text style={styles.title}>RIFFOLOGY</Text>

        {/* Decorative line */}
        <Animated.View
          style={[
            styles.decorLine,
            { width: lineWidth },
          ]}
        />

        {/* Tagline */}
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          LET'S SHRED
        </Animated.Text>
      </Animated.View>

      {/* Loading dots */}
      <View style={styles.dotsContainer}>
        {dotOpacities.map((opacity, i) => (
          <Animated.View
            key={`dot-${i}`}
            style={[styles.dot, { opacity }]}
          />
        ))}
      </View>
    </View>
  );
}

const BG_COLOR = "#0d0805";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(255, 140, 40, 0.15)",
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
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: 6,
    color: "#FF8C00",
    fontStyle: "italic",
    textShadowColor: "rgba(255, 100, 0, 0.6)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  decorLine: {
    height: 2,
    backgroundColor: "#FF8C00",
    marginTop: 8,
    opacity: 0.6,
  },
  tagline: {
    color: "rgba(255, 200, 140, 0.7)",
    fontSize: 13,
    letterSpacing: 4,
    marginTop: 6,
  },
  dotsContainer: {
    position: "absolute",
    bottom: 60,
    flexDirection: "row",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF8C00",
    marginHorizontal: 4,
  },
});

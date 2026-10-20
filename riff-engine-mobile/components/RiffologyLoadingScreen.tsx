import React, { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from "react-native";
import { analog } from "../theme/analog";
import { BrandWordmark } from "./BrandWordmark";

/** A brief brand reveal; navigation never waits for an animation callback. */
export default function RiffologyLoadingScreen({ onFinish }: { onFinish: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => finishRef.current(), 800);
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!mounted || reduceMotion) return;
      opacity.setValue(0);
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }).catch(() => { /* A preference lookup must not delay startup. */ });
    return () => {
      mounted = false;
      clearTimeout(timer);
      opacity.stopAnimation();
    };
  }, [opacity]);

  return (
    <View style={styles.screen}>
      <Animated.View style={[styles.brand, { opacity }]}>
        <BrandWordmark width={264} />
        <View style={styles.rule} />
        <Text style={styles.tagline}>Make room for a riff.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: analog.paper, justifyContent: "center", alignItems: "center" },
  brand: { alignItems: "center", maxWidth: "100%", paddingHorizontal: 20 },
  rule: { width: 32, height: 4, backgroundColor: analog.butter, marginTop: 20, marginBottom: 18 },
  tagline: { color: analog.oxblood, fontSize: 17, fontFamily: analog.headingFont },
});

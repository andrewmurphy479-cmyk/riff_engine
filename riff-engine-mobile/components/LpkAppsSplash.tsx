import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { LPK_SPLASH_HTML } from "../assets/animations/lpkSplashHtml";

/** The intro's own backdrop; the overlay matches it so no seam shows. */
export const LPK_SPLASH_BG = "#18181a";

/**
 * "LPK Apps" studio intro — the same animation as Root Word and CallSign
 * Check (logo fade-in → curved shooting-star shimmer → twinkle → melt into
 * falling paint drips), running inside a WebView. When the melt finishes the
 * page posts "lpk-splash-done" and onFinish fires.
 *
 * Any failure finishes straight away — a studio intro must never be the
 * thing that keeps a player out of the app.
 */
export function LpkAppsSplash({ onFinish }: { onFinish: () => void }) {
  // Required in an effect, not at module scope, so a runtime without the
  // native module (web, an old dev build) skips the intro instead of throwing
  // during render.
  const [WebViewComp, setWebViewComp] = useState<React.ComponentType<any> | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") {
      setUnavailable(true);
      return;
    }
    try {
      const { default: WebView } = require("react-native-webview");
      setWebViewComp(() => WebView);
    } catch {
      setUnavailable(true);
    }
  }, []);

  useEffect(() => {
    if (unavailable) onFinish();
  }, [unavailable, onFinish]);

  if (!WebViewComp) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <WebViewComp
        source={{ html: LPK_SPLASH_HTML }}
        style={StyleSheet.absoluteFill}
        scrollEnabled={false}
        javaScriptEnabled
        androidLayerType="hardware"
        onMessage={(e: { nativeEvent: { data: string } }) => {
          if (e.nativeEvent.data === "lpk-splash-done") onFinish();
        }}
        onError={onFinish}
        containerStyle={styles.webviewContainer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LPK_SPLASH_BG,
  },
  webviewContainer: {
    backgroundColor: LPK_SPLASH_BG,
  },
});

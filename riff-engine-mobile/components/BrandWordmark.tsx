import React from "react";
import { Image } from "react-native";

/** Keep the exact brand lettering consistent across native and web. */
export function BrandWordmark({ width = 158 }: { width?: number }) {
  return (
    <Image
      source={require("../assets/brand/riffology-wordmark.png")}
      style={{ width, height: width / 3 }}
      resizeMode="contain"
      accessible
      accessibilityLabel="Riffology"
    />
  );
}

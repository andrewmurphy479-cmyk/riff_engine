import { Platform } from "react-native";

// Google's published sample IDs. Always serve test ads in development —
// clicking live ads on your own device can get the AdMob account suspended.
const TEST_INTERSTITIAL_IDS = {
  ios: "ca-app-pub-3940256099942544/4411468910",
  android: "ca-app-pub-3940256099942544/1033173712",
} as const;

// TODO(admob): Android isn't set up yet. When it is, paste its interstitial
// unit ID here and its app ID into app.json's react-native-google-mobile-ads
// plugin entry. Until then, Android release builds serve test ads (no revenue).
const PRODUCTION_INTERSTITIAL_IDS = {
  ios: "ca-app-pub-8042868551988044/4390744447",
  android: "",
} as const;

export function getInterstitialUnitId(): string {
  const prodId =
    Platform.OS === "ios"
      ? PRODUCTION_INTERSTITIAL_IDS.ios
      : PRODUCTION_INTERSTITIAL_IDS.android;
  if (!__DEV__ && prodId) return prodId;
  return Platform.OS === "ios"
    ? TEST_INTERSTITIAL_IDS.ios
    : TEST_INTERSTITIAL_IDS.android;
}

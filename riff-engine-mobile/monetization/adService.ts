import { getInterstitialUnitId } from "./adUnits";

// Guard the native module — it is absent in Expo Go and on web (see
// metro.config.js). Every export below degrades to a no-op without it.
let AdEventType: any;
let InterstitialAd: any;
let mobileAds: any;
let nativeAdsAvailable = false;

try {
  const mod = require("react-native-google-mobile-ads");
  AdEventType = mod.AdEventType;
  InterstitialAd = mod.InterstitialAd;
  mobileAds = mod.default;
  nativeAdsAvailable = true;
} catch {
  if (__DEV__) console.warn("react-native-google-mobile-ads not available (Expo Go?)");
}

let initialized = false;
let interstitial: any = null;
let interstitialLoaded = false;
let showing = false;

let retryDelay = 1000;
const MAX_RETRY_DELAY = 30000;

export function isAdsAvailable(): boolean {
  return nativeAdsAvailable;
}

export async function initializeAds(): Promise<void> {
  if (!nativeAdsAvailable || initialized) return;
  try {
    await mobileAds().initialize();
    initialized = true;
  } catch (e) {
    if (__DEV__) console.warn("Ad SDK init failed:", e);
  }
}

/** Preload the next interstitial. Reloads itself after each close or error. */
export function loadInterstitial(): void {
  if (!initialized) return;

  const ad = InterstitialAd.createForAdRequest(getInterstitialUnitId());
  interstitial = ad;
  interstitialLoaded = false;

  ad.addAdEventListener(AdEventType.LOADED, () => {
    interstitialLoaded = true;
    retryDelay = 1000;
  });

  ad.addAdEventListener(AdEventType.CLOSED, () => {
    interstitialLoaded = false;
    loadInterstitial(); // preload the next one
  });

  ad.addAdEventListener(AdEventType.ERROR, () => {
    interstitialLoaded = false;
    // A failed show leaves no CLOSED event to settle showInterstitial.
    showing = false;
    setTimeout(loadInterstitial, retryDelay);
    retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);
  });

  ad.load();
}

/**
 * Show the preloaded interstitial. Resolves true once the player closes it,
 * false straight away when nothing is loaded (no fill, offline, no SDK).
 */
export function showInterstitial(): Promise<boolean> {
  if (!interstitialLoaded || !interstitial || showing) {
    return Promise.resolve(false);
  }

  const ad = interstitial;
  showing = true;
  return new Promise<boolean>((resolve) => {
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      unsubClosed();
      unsubError();
      showing = false;
      resolve(true);
    });
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, () => {
      unsubClosed();
      unsubError();
      showing = false;
      resolve(false);
    });
    ad.show().catch(() => {
      unsubClosed();
      unsubError();
      showing = false;
      resolve(false);
    });
  });
}

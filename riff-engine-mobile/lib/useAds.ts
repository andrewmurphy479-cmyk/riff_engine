import { useCallback, useState } from "react";
import { PlaybackGraph } from "../audio/playbackGraph";
import { initializeAds, loadInterstitial, showInterstitial } from "../monetization/adService";
import { requestAdConsent, requestTrackingIfNeeded } from "../monetization/consent";
import { initIapOnce, isIapAvailable } from "../monetization/iapService";
import { useAdStore, whenAdStoreHydrated } from "../store/useAdStore";

let started = false;

/**
 * Bring up the store connection and the ad SDK. Called from the root layout
 * once onboarding is done, so neither the consent form nor the iOS tracking
 * prompt lands on top of the taste check. Idempotent; never throws.
 *
 * On iOS the ad SDK starts only after ATT is answered, so no IDFA-based
 * tracking can begin before the player has been asked.
 */
export async function initMonetizationOnce(): Promise<void> {
  if (started) return;
  started = true;
  void initIapOnce();
  try {
    await requestAdConsent();
    await requestTrackingIfNeeded();
    await initializeAds();
    // Purchasers never need an interstitial preloaded. A mid-session
    // purchase is handled by isInterstitialDue, not by unloading.
    await whenAdStoreHydrated();
    if (!useAdStore.getState().adsRemoved) loadInterstitial();
  } catch (e) {
    if (__DEV__) console.warn("initMonetizationOnce failed:", e);
  }
}

/**
 * Interstitials for the Create screen: call afterGeneration() each time the
 * player asks for a new riff. The first ad a player ever sees is followed by
 * the Remove Ads offer, exactly once.
 */
export function useGenerationAds() {
  const [removeAdsOfferVisible, setRemoveAdsOfferVisible] = useState(false);

  const afterGeneration = useCallback(async () => {
    const ads = useAdStore.getState();
    ads.recordGeneration();
    if (!useAdStore.getState().isInterstitialDue()) return;

    const shown = await showInterstitial();
    if (!shown) return;
    void PlaybackGraph.reclaimSession();

    const after = useAdStore.getState();
    after.recordInterstitialShown();
    if (!after.removeAdsOfferShown && !after.adsRemoved && isIapAvailable()) {
      after.markRemoveAdsOfferShown();
      setRemoveAdsOfferVisible(true);
    }
  }, []);

  const closeRemoveAdsOffer = useCallback(() => setRemoveAdsOfferVisible(false), []);

  return { afterGeneration, removeAdsOfferVisible, closeRemoveAdsOffer };
}

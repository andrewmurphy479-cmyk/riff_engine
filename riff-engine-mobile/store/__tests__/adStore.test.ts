/**
 * The ad cadence decides when a player gets interrupted, and the entitlement
 * flag is the only thing standing between a paying player and an ad. These
 * lock both: new players get 3 free riffs and then an ad every 2nd riff, a
 * no-fill leaves the next one due, and a purchaser is never due.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { AD_CONFIG } from "../../monetization/adConfig";
import { useAdStore, whenAdStoreHydrated } from "../useAdStore";

function reset() {
  useAdStore.setState({
    adsRemoved: false,
    totalGenerations: 0,
    generationsSinceAd: 0,
    interstitialsShown: 0,
    removeAdsOfferShown: false,
  });
}

/** Record generations until the free allowance is spent and the next is due. */
function generateUntilDue() {
  const s = useAdStore.getState();
  for (let i = 0; i <= AD_CONFIG.FREE_GENERATIONS_BEFORE_ADS; i++) {
    s.recordGeneration();
  }
  for (let i = 1; i < AD_CONFIG.GENERATIONS_PER_INTERSTITIAL; i++) {
    s.recordGeneration();
  }
}

describe("useAdStore", () => {
  beforeEach(async () => {
    await whenAdStoreHydrated();
    reset();
  });

  it("is not due before any generation", () => {
    expect(useAdStore.getState().isInterstitialDue()).toBe(false);
  });

  it("becomes due once the cadence is reached", () => {
    generateUntilDue();
    expect(useAdStore.getState().isInterstitialDue()).toBe(true);
  });

  it("resets the cadence only when an ad is actually shown", () => {
    generateUntilDue();
    // No fill: nothing recorded, so the next generation is still due.
    useAdStore.getState().recordGeneration();
    expect(useAdStore.getState().isInterstitialDue()).toBe(true);

    useAdStore.getState().recordInterstitialShown();
    expect(useAdStore.getState().generationsSinceAd).toBe(0);
    expect(useAdStore.getState().interstitialsShown).toBe(1);
  });

  it("gives 3 free riffs, then an ad every 2nd riff", () => {
    const adAfter: number[] = [];
    for (let gen = 1; gen <= 10; gen++) {
      useAdStore.getState().recordGeneration();
      if (useAdStore.getState().isInterstitialDue()) {
        adAfter.push(gen);
        useAdStore.getState().recordInterstitialShown();
      }
    }
    expect(adAfter).toEqual([5, 7, 9]);
  });

  it("is never due for a player who removed ads", () => {
    useAdStore.getState().setAdsRemoved(true);
    generateUntilDue();
    for (let i = 0; i < 5; i++) useAdStore.getState().recordGeneration();
    expect(useAdStore.getState().isInterstitialDue()).toBe(false);
  });

  it("persists the entitlement and the one-time offer flag", async () => {
    useAdStore.getState().setAdsRemoved(true);
    useAdStore.getState().markRemoveAdsOfferShown();
    const raw = await AsyncStorage.getItem(useAdStore.persist.getOptions().name!);
    const { state } = JSON.parse(raw!);
    expect(state.adsRemoved).toBe(true);
    expect(state.removeAdsOfferShown).toBe(true);
  });
});

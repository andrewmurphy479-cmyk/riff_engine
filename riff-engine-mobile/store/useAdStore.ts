import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { AD_CONFIG } from "../monetization/adConfig";

interface AdState {
  /** Remove Ads entitlement, reconciled against the store on every launch. */
  adsRemoved: boolean;
  totalGenerations: number;
  generationsSinceAd: number;
  interstitialsShown: number;
  /** The Remove Ads sheet has auto-opened after the first ad. */
  removeAdsOfferShown: boolean;

  setAdsRemoved: (removed: boolean) => void;
  /** Count a player-initiated riff generation. */
  recordGeneration: () => void;
  /** Whether the generation just recorded should be followed by an ad. */
  isInterstitialDue: () => boolean;
  recordInterstitialShown: () => void;
  markRemoveAdsOfferShown: () => void;
}

export const useAdStore = create<AdState>()(
  persist(
    (set, get) => ({
      adsRemoved: false,
      totalGenerations: 0,
      generationsSinceAd: 0,
      interstitialsShown: 0,
      removeAdsOfferShown: false,

      setAdsRemoved: (removed) => set({ adsRemoved: removed }),

      // Free generations don't count toward the cadence, so the first ad
      // comes a full cycle after the allowance rather than right at its end.
      recordGeneration: () =>
        set((s) => {
          const totalGenerations = s.totalGenerations + 1;
          const pastFree = totalGenerations > AD_CONFIG.FREE_GENERATIONS_BEFORE_ADS;
          return {
            totalGenerations,
            generationsSinceAd: s.generationsSinceAd + (pastFree ? 1 : 0),
          };
        }),

      isInterstitialDue: () => {
        const s = get();
        if (s.adsRemoved) return false;
        // Until the stored entitlement is read, a purchaser looks like a
        // free player — never risk interrupting them.
        if (!useAdStore.persist.hasHydrated()) return false;
        if (s.totalGenerations <= AD_CONFIG.FREE_GENERATIONS_BEFORE_ADS) {
          return false;
        }
        return s.generationsSinceAd >= AD_CONFIG.GENERATIONS_PER_INTERSTITIAL;
      },

      // The counter resets only on an ad actually shown, so a no-fill
      // generation leaves the next one due rather than skipping a cycle.
      recordInterstitialShown: () =>
        set((s) => ({
          generationsSinceAd: 0,
          interstitialsShown: s.interstitialsShown + 1,
        })),

      markRemoveAdsOfferShown: () => set({ removeAdsOfferShown: true }),
    }),
    {
      name: "riff-engine:ads:v1",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        adsRemoved: state.adsRemoved,
        totalGenerations: state.totalGenerations,
        generationsSinceAd: state.generationsSinceAd,
        interstitialsShown: state.interstitialsShown,
        removeAdsOfferShown: state.removeAdsOfferShown,
      }),
      version: 1,
    },
  ),
);

/** Resolves once the persisted ad state has loaded from disk. */
export function whenAdStoreHydrated(): Promise<void> {
  if (useAdStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = useAdStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

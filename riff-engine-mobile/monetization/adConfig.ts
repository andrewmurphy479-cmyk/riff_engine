/** Tuning constants for ad behavior. */
export const AD_CONFIG = {
  /** Show an interstitial every N riff generations (1 = after every one). */
  GENERATIONS_PER_INTERSTITIAL: 2,
  /**
   * Generations a brand-new player gets before ads start. The cadence counts
   * from the end of this allowance, so with 3 free and every 2, the first ad
   * follows the 5th generation.
   */
  FREE_GENERATIONS_BEFORE_ADS: 3,
} as const;

/**
 * One-time "Remove Ads" non-consumable. The same product ID must be created
 * in App Store Connect and Google Play Console.
 */
export const REMOVE_ADS_PRODUCT_ID = "com.riffengine.mobile.remove_ads";

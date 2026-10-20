import { useCallback, useEffect, useState } from "react";
import {
  ensureRemoveAdsProduct,
  getRemoveAdsProduct,
  isIapAvailable,
  purchaseRemoveAds,
  restoreRemoveAds,
  type PurchaseOutcome,
  type RemoveAdsProductInfo,
} from "../monetization/iapService";
import { useAdStore } from "../store/useAdStore";

/**
 * The Remove Ads purchase for UI: current entitlement, localized price, and
 * purchase/restore actions with a busy flag.
 */
export function useRemoveAds() {
  const adsRemoved = useAdStore((s) => s.adsRemoved);
  const [product, setProduct] = useState<RemoveAdsProductInfo | null>(
    getRemoveAdsProduct(),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (product) return;
    let mounted = true;
    ensureRemoveAdsProduct().then((p) => {
      if (mounted && p) setProduct(p);
    });
    return () => {
      mounted = false;
    };
  }, [product]);

  const purchase = useCallback(async (): Promise<PurchaseOutcome> => {
    setBusy(true);
    try {
      return await purchaseRemoveAds();
    } finally {
      setBusy(false);
    }
  }, []);

  const restore = useCallback(async () => {
    setBusy(true);
    try {
      return await restoreRemoveAds();
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    iapAvailable: isIapAvailable(),
    adsRemoved,
    product,
    busy,
    purchase,
    restore,
  };
}

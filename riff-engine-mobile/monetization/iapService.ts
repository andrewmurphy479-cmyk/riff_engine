import { Platform } from "react-native";
import { useAdStore, whenAdStoreHydrated } from "../store/useAdStore";
import { REMOVE_ADS_PRODUCT_ID } from "./adConfig";

// Guard the native module — it is absent in Expo Go, on web (see
// metro.config.js), and in dev builds that predate it being compiled in.
let iap: typeof import("expo-iap") | null = null;
try {
  iap = require("expo-iap");
} catch {
  if (__DEV__) console.warn("expo-iap not available (Expo Go?)");
}

export type PurchaseOutcome =
  | { status: "purchased" }
  | { status: "cancelled" }
  | { status: "pending" }
  | { status: "error"; message: string };

export type RemoveAdsProductInfo = {
  /** Localized price straight from the store, e.g. "$2.99". */
  displayPrice: string;
};

let connected = false;
let initStarted = false;
let cachedProduct: RemoveAdsProductInfo | null = null;

// Resolver for an in-flight requestPurchase, settled from the global purchase
// listeners (purchases complete via events, not the request promise).
let pendingResolve: ((r: PurchaseOutcome) => void) | null = null;

export function isIapAvailable(): boolean {
  return iap != null;
}

export function getRemoveAdsProduct(): RemoveAdsProductInfo | null {
  return cachedProduct;
}

// Writing before hydration would be overwritten by the stored value, so every
// entitlement change waits for it.
async function setEntitlement(removed: boolean): Promise<void> {
  await whenAdStoreHydrated();
  useAdStore.getState().setAdsRemoved(removed);
}

function settlePending(outcome: PurchaseOutcome) {
  const resolve = pendingResolve;
  pendingResolve = null;
  resolve?.(outcome);
}

/**
 * Connect to the store, attach purchase listeners, warm the price and
 * reconcile the local entitlement against the store. Idempotent; never throws.
 */
export async function initIapOnce(): Promise<void> {
  if (initStarted || !iap) return;
  initStarted = true;

  try {
    // Listeners go on before initConnection — iOS can replay unfinished
    // transactions as soon as the connection opens.
    iap.purchaseUpdatedListener(async (purchase) => {
      try {
        if (purchase.productId !== REMOVE_ADS_PRODUCT_ID) return;
        if (purchase.purchaseState === "purchased") {
          await iap!.finishTransaction({ purchase, isConsumable: false });
          await setEntitlement(true);
          settlePending({ status: "purchased" });
        } else if (purchase.purchaseState === "pending") {
          // Android "slow card" flows — the listener fires again once the
          // payment settles, possibly on a later launch.
          settlePending({ status: "pending" });
        }
      } catch (e) {
        if (__DEV__) console.warn("purchaseUpdated failed:", e);
        settlePending({ status: "error", message: "Purchase could not be completed." });
      }
    });

    iap.purchaseErrorListener((error) => {
      if (error.code === "user-cancelled") {
        settlePending({ status: "cancelled" });
        return;
      }
      settlePending({ status: "error", message: error.message });
    });

    connected = await iap.initConnection();
    if (!connected) return;

    fetchRemoveAdsProduct().catch(() => {});

    // Restores across reinstalls and revokes after refunds. StoreKit 2 reads
    // local entitlement state, so this does not prompt for credentials.
    await syncEntitlement();
  } catch (e) {
    if (__DEV__) console.warn("initIapOnce failed:", e);
  }
}

async function fetchRemoveAdsProduct(): Promise<RemoveAdsProductInfo | null> {
  if (!iap || !connected) return cachedProduct;
  const products = await iap.fetchProducts({
    skus: [REMOVE_ADS_PRODUCT_ID],
    type: "in-app",
  });
  const product = products?.find((p: any) => p.id === REMOVE_ADS_PRODUCT_ID);
  if (product) {
    cachedProduct = { displayPrice: product.displayPrice };
  }
  return cachedProduct;
}

/** Fetch the product if not cached yet (e.g. sheet opened before init finished). */
export async function ensureRemoveAdsProduct(): Promise<RemoveAdsProductInfo | null> {
  if (cachedProduct) return cachedProduct;
  try {
    return await fetchRemoveAdsProduct();
  } catch {
    return null;
  }
}

/** True/false from the store, or null when it couldn't be asked. */
async function ownsRemoveAds(): Promise<boolean | null> {
  if (!iap || !connected) return null;
  try {
    const purchases = await iap.getAvailablePurchases({
      onlyIncludeActiveItemsIOS: true,
    });
    return purchases.some(
      (p) => p.productId === REMOVE_ADS_PRODUCT_ID && p.purchaseState === "purchased",
    );
  } catch {
    return null;
  }
}

// Revokes only on a definitive "not owned" — never on a failed lookup.
async function syncEntitlement(): Promise<void> {
  const owns = await ownsRemoveAds();
  if (owns !== null) await setEntitlement(owns);
}

/** Run the native purchase sheet. Resolves when the store flow finishes. */
export async function purchaseRemoveAds(): Promise<PurchaseOutcome> {
  if (!iap || !connected) {
    return { status: "error", message: "The store isn't available right now." };
  }
  if (pendingResolve) {
    return { status: "error", message: "A purchase is already in progress." };
  }

  const outcome = new Promise<PurchaseOutcome>((resolve) => {
    pendingResolve = resolve;
  });

  try {
    await iap.requestPurchase({
      request: {
        apple: { sku: REMOVE_ADS_PRODUCT_ID },
        google: { skus: [REMOVE_ADS_PRODUCT_ID] },
      },
      type: "in-app",
    });
  } catch (e: any) {
    // Errors normally arrive via purchaseErrorListener too; this is the
    // fallback for a failure that never reaches it.
    settlePending({
      status: "error",
      message: e?.message ?? "Purchase could not be started.",
    });
  }

  return outcome;
}

/** Restore a previous purchase. App Review requires this to be reachable. */
export async function restoreRemoveAds(): Promise<"restored" | "none" | "error"> {
  if (!iap || !connected) return "error";
  try {
    if (Platform.OS === "ios") {
      await iap.restorePurchases();
    }
    const owns = await ownsRemoveAds();
    if (owns === true) {
      await setEntitlement(true);
      return "restored";
    }
    return owns === false ? "none" : "error";
  } catch (e) {
    if (__DEV__) console.warn("restoreRemoveAds failed:", e);
    return "error";
  }
}

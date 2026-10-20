import { Platform } from "react-native";
import type { ConsentSnapshot } from "../lib/analyticsConsent";

// Guard the native modules — they are absent in Expo Go and on web (see
// metro.config.js), and the app must still run without ads there.
let AdsConsent: any = null;
try {
  AdsConsent = require("react-native-google-mobile-ads").AdsConsent ?? null;
} catch {
  // Not available in this runtime
}

let TrackingTransparency: any = null;
try {
  TrackingTransparency = require("expo-tracking-transparency");
} catch {
  // Not available in this runtime
}

/**
 * Request GDPR consent via Google's UMP SDK. Shows the form only when the
 * user's region requires it. Never throws.
 */
export async function requestAdConsent(): Promise<void> {
  if (!AdsConsent) return;
  try {
    await AdsConsent.requestInfoUpdate();
    await AdsConsent.loadAndShowConsentFormIfRequired();
  } catch (e) {
    if (__DEV__) console.warn("Ad consent request failed:", e);
  }
}

/**
 * Ask for iOS App Tracking Transparency once. No-op when already answered,
 * on Android, or when the module is missing. Fails open: any error lets the
 * ad SDK start with non-personalized ads rather than stalling it.
 */
export async function requestTrackingIfNeeded(): Promise<void> {
  if (Platform.OS !== "ios" || !TrackingTransparency) return;
  try {
    const { status } = await TrackingTransparency.getTrackingPermissionsAsync();
    if (status === "undetermined") {
      await TrackingTransparency.requestTrackingPermissionsAsync();
    }
  } catch (e) {
    if (__DEV__) console.warn("Tracking permission request failed:", e);
  }
}

/**
 * Whether this player's region requires an in-app way to change ad consent
 * (EEA, UK, Switzerland). Google's policy requires the entry point there; it
 * is hidden everywhere else. False until requestAdConsent has run.
 */
export async function isAdPrivacyOptionsRequired(): Promise<boolean> {
  if (!AdsConsent) return false;
  try {
    const info = await AdsConsent.getConsentInfo();
    return info.privacyOptionsRequirementStatus === "REQUIRED";
  } catch {
    return false;
  }
}

/** Reopen Google's consent form so the player can change their choice. */
export async function showAdPrivacyOptions(): Promise<boolean> {
  if (!AdsConsent) return false;
  try {
    await AdsConsent.showPrivacyOptionsForm();
    return true;
  } catch (e) {
    if (__DEV__) console.warn("Privacy options form failed:", e);
    return false;
  }
}

/**
 * Refresh the consent status from Google without showing anything, so the
 * player's region is known before the consent form's turn after onboarding.
 */
export async function refreshAdConsentInfo(): Promise<void> {
  if (!AdsConsent) return;
  try {
    await AdsConsent.requestInfoUpdate();
  } catch (e) {
    if (__DEV__) console.warn("Ad consent info refresh failed:", e);
  }
}

/** The consent facts analytics decides on; null without the consent SDK. */
export async function getConsentSnapshot(): Promise<ConsentSnapshot | null> {
  if (!AdsConsent) return null;
  try {
    const { status } = await AdsConsent.getConsentInfo();
    const gdprApplies = await AdsConsent.getGdprApplies();
    let storeAndAccessInformationOnDevice = false;
    let measureContentPerformance = false;
    if (gdprApplies && status === "OBTAINED") {
      const choices = await AdsConsent.getUserChoices();
      storeAndAccessInformationOnDevice = !!choices.storeAndAccessInformationOnDevice;
      measureContentPerformance = !!choices.measureContentPerformance;
    }
    return { status, gdprApplies, storeAndAccessInformationOnDevice, measureContentPerformance };
  } catch (e) {
    if (__DEV__) console.warn("Consent snapshot failed:", e);
    return {
      status: "UNKNOWN",
      gdprApplies: true,
      storeAndAccessInformationOnDevice: false,
      measureContentPerformance: false,
    };
  }
}

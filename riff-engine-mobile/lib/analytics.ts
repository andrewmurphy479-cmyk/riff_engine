import { Platform } from "react-native";
import type { PostHog } from "posthog-react-native";
import { getConsentSnapshot, refreshAdConsentInfo } from "../monetization/consent";
import { analyticsAllowed } from "./analyticsConsent";

/**
 * First-party, anonymous product analytics (PostHog) — enough to see whether
 * players come back, which parts of practice they use, and whether the Remove
 * Ads offer converts, without building a profile of anybody.
 *
 * Deliberate constraints, all of which the privacy policy promises:
 *   - No identify(). Events carry PostHog's random install id and nothing else.
 *   - Properties stay categorical: a level, a feel, a count. Never free text.
 *   - No autocapture: PostHogProvider is never mounted.
 *   - No session replay, and no exception autocapture (see createClient).
 *   - Where GDPR applies, nothing is sent without consent (analyticsConsent).
 */

/** Write-only project key: it can send events but read nothing. Safe to ship. */
const POSTHOG_API_KEY = "phc_o3z84u8TYzHX8WooF2TcJnRRFiN8EeFYFPNrwAr9x2be";
/** The project lives on PostHog's US cloud; a US key fails against the EU host. */
const POSTHOG_HOST = "https://us.i.posthog.com";

/**
 * Dev builds log events to the Metro console instead of sending them, so test
 * taps don't pollute the funnels. Flip to true to watch a new event land in
 * PostHog from a dev build, then flip it back.
 */
const SEND_IN_DEV = false;

/** The full vocabulary — a closed union so a typo can't split a funnel. */
export type AnalyticsEvent =
  // Setup
  | "onboarding_completed"
  // Create
  | "riff_generated"
  | "riff_played"
  | "bar_looped"
  | "bar_rerolled"
  | "riff_saved"
  | "riff_shared"
  // Today
  | "session_riff_done"
  | "daily_goal_met"
  | "drill_ended"
  // Ads and Remove Ads
  | "interstitial_shown"
  // Due but nothing loaded: the fill-rate gap.
  | "interstitial_no_fill"
  | "remove_ads_viewed"
  | "purchase_started"
  | "purchase_completed"
  | "purchase_pending"
  | "purchase_cancelled"
  | "purchase_failed"
  | "restore_performed";

type EventProperties = Record<string, string | number | boolean>;

let client: PostHog | null = null;
let enabled = false;
let syncChain: Promise<void> = Promise.resolve();

const sendsToPostHog = !__DEV__ || SEND_IN_DEV;

function createClient(): PostHog | null {
  try {
    const { PostHog: PostHogClient } = require("posthog-react-native");
    return new PostHogClient(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      // Application Opened / Backgrounded / Installed / Updated: daily users,
      // session length and retention, for free.
      captureAppLifecycleEvents: true,
      // Never identified, so never a person profile.
      personProfiles: "never",
      enableSessionReplay: false,
      // Off explicitly, not by default: PostHog gates exception autocapture on
      // its remote config, so leaving it unset would let a dashboard toggle
      // start shipping stack traces the App Store privacy answers don't cover.
      errorTracking: { autocapture: false },
    });
  } catch (e) {
    // Analytics must never be able to break practice.
    if (__DEV__) console.warn("[analytics] init failed:", e);
    return null;
  }
}

async function applyConsent(refresh: boolean): Promise<void> {
  if (Platform.OS === "web") return;
  if (refresh) await refreshAdConsentInfo();
  const allowed = analyticsAllowed(await getConsentSnapshot());
  if (allowed === enabled) return;
  enabled = allowed;
  if (__DEV__) {
    console.log(`[analytics] ${allowed ? "on" : "off"}${sendsToPostHog ? "" : " (dev: logging only)"}`);
  }
  if (!sendsToPostHog) return;
  if (!allowed) {
    await client?.optOut();
  } else if (client) {
    await client.optIn();
  } else {
    client = createClient();
  }
}

/**
 * Turn analytics on or off to match the player's current consent. Call at
 * launch (refresh: true, to learn the region without showing a form), after
 * the consent form, and after the player changes their ad privacy choices.
 * Calls run one at a time; never throws.
 */
export function syncAnalyticsConsent({ refresh = false }: { refresh?: boolean } = {}): Promise<void> {
  syncChain = syncChain
    .then(() => applyConsent(refresh))
    .catch((e) => {
      if (__DEV__) console.warn("[analytics] consent sync failed:", e);
    });
  return syncChain;
}

export function track(event: AnalyticsEvent, properties?: EventProperties): void {
  if (!enabled) return;
  if (!sendsToPostHog) {
    console.log(`[analytics] ${event}`, properties ?? {});
    return;
  }
  try {
    client?.capture(event, properties);
  } catch (e) {
    if (__DEV__) console.warn(`[analytics] track(${event}) failed:`, e);
  }
}

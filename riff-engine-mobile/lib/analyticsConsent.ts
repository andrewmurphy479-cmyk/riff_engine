/** What Google's consent SDK knows about this player, as analytics needs it. */
export interface ConsentSnapshot {
  /** UMP consent status; UNKNOWN when the status could not be fetched. */
  status: "UNKNOWN" | "REQUIRED" | "NOT_REQUIRED" | "OBTAINED";
  gdprApplies: boolean;
  /** TCF Purpose 1. */
  storeAndAccessInformationOnDevice: boolean;
  /** TCF Purpose 8. */
  measureContentPerformance: boolean;
}

/**
 * Whether anonymous product analytics may run.
 *
 * Where GDPR applies, only with the player's consent to the two TCF purposes
 * analytics actually relies on: storing an identifier on the device, and
 * measuring how content is used. Finishing the consent form is not enough —
 * "reject all" also finishes it.
 *
 * Elsewhere analytics runs, since it is first-party, anonymous and never
 * shared for advertising. A status that couldn't be fetched fails closed for
 * this launch rather than guessing the player's region.
 *
 * null means no consent SDK at all (web, Expo Go), where there are no ads and
 * nothing to consent to.
 */
export function analyticsAllowed(consent: ConsentSnapshot | null): boolean {
  if (consent === null) return true;
  if (consent.status === "UNKNOWN") return false;
  if (!consent.gdprApplies) return true;
  return (
    consent.status === "OBTAINED" &&
    consent.storeAndAccessInformationOnDevice &&
    consent.measureContentPerformance
  );
}

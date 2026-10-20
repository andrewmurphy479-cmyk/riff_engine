/**
 * This rule decides whether a player's practice is counted at all, and where
 * GDPR applies it is the only thing between a "reject all" and an event being
 * sent. These lock that finishing the consent form is not the same as
 * consenting, and that an unknown region never defaults to sending.
 */
import { describe, expect, it } from "vitest";

import { analyticsAllowed, ConsentSnapshot } from "../analyticsConsent";

function consent(over: Partial<ConsentSnapshot> = {}): ConsentSnapshot {
  return {
    status: "OBTAINED",
    gdprApplies: true,
    storeAndAccessInformationOnDevice: true,
    measureContentPerformance: true,
    ...over,
  };
}

describe("analyticsAllowed", () => {
  it("runs outside GDPR regions", () => {
    expect(analyticsAllowed(consent({ status: "NOT_REQUIRED", gdprApplies: false }))).toBe(true);
  });

  it("runs outside GDPR regions even after a US-state privacy message", () => {
    expect(
      analyticsAllowed(
        consent({
          gdprApplies: false,
          storeAndAccessInformationOnDevice: false,
          measureContentPerformance: false,
        }),
      ),
    ).toBe(true);
  });

  it("runs where GDPR applies once both purposes are granted", () => {
    expect(analyticsAllowed(consent())).toBe(true);
  });

  it("stays off where GDPR applies before the form is answered", () => {
    expect(analyticsAllowed(consent({ status: "REQUIRED" }))).toBe(false);
  });

  it("stays off after reject-all, though the form was finished", () => {
    expect(
      analyticsAllowed(
        consent({ storeAndAccessInformationOnDevice: false, measureContentPerformance: false }),
      ),
    ).toBe(false);
  });

  it("needs both purposes, not either one", () => {
    expect(analyticsAllowed(consent({ measureContentPerformance: false }))).toBe(false);
    expect(analyticsAllowed(consent({ storeAndAccessInformationOnDevice: false }))).toBe(false);
  });

  it("fails closed when the consent status couldn't be fetched", () => {
    expect(analyticsAllowed(consent({ status: "UNKNOWN", gdprApplies: false }))).toBe(false);
  });

  it("runs where there is no consent SDK at all", () => {
    expect(analyticsAllowed(null)).toBe(true);
  });
});

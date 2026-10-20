/**
 * The studio intro plays once per local day: on the first launch of a day,
 * never on the quick repeat launches a daily practice habit is made of.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { beforeEach, describe, expect, it } from "vitest";

import { shouldPlayStudioIntro } from "../studioIntro";

const morning = new Date(2026, 9, 20, 8, 0);
const evening = new Date(2026, 9, 20, 22, 30);
const nextDay = new Date(2026, 9, 21, 7, 15);

describe("shouldPlayStudioIntro", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("plays on the first launch ever", async () => {
    expect(await shouldPlayStudioIntro(morning)).toBe(true);
  });

  it("skips later launches the same day", async () => {
    await shouldPlayStudioIntro(morning);
    expect(await shouldPlayStudioIntro(evening)).toBe(false);
  });

  it("plays again the next day", async () => {
    await shouldPlayStudioIntro(evening);
    expect(await shouldPlayStudioIntro(nextDay)).toBe(true);
  });
});

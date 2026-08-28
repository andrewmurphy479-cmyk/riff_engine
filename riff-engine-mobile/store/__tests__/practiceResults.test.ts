/**
 * Drill results are persisted history: once real users have them, the shape is
 * expensive to change. These lock the parts that would be painful to discover
 * later — that resuming an abandoned drill doesn't lose the earlier attempt,
 * that recording and mark-done credit the streak identically, and that an
 * upgrading user keeps the day they were halfway through.
 */
import { describe, expect, it } from "vitest";

import {
  isValidSession,
  RiffResult,
  usePracticeStore,
} from "../usePracticeStore";

function result(over: Partial<RiffResult> = {}): RiffResult {
  return {
    seed: 1,
    rhythm: "half_gallop",
    techniques: ["mute"],
    topTempoPct: 85,
    reps: 5,
    barsLooped: [1],
    seconds: 60,
    completed: true,
    ...over,
  };
}

/** A fresh store with a real generated session. */
function freshStore() {
  const store = usePracticeStore;
  store.setState({
    onboardingComplete: false,
    profile: null,
    session: null,
    streak: { current: 0, longest: 0, lastCompletedDate: null },
    stats: { totalRiffs: 0, totalSeconds: 0, daysPracticed: 0 },
  });
  store.getState().completeOnboarding({
    level: "intermediate",
    genres: ["rock"],
    preferredFeel: "driving",
  });
  return store;
}

describe("session shape", () => {
  it("starts every riff with a null result", () => {
    const { session } = freshStore().getState();
    expect(session!.results).toHaveLength(session!.riffs.length);
    expect(session!.results.every((r) => r === null)).toBe(true);
  });

  it("rejects a session whose results don't line up with its riffs", () => {
    const { session } = freshStore().getState();
    expect(isValidSession(session)).toBe(true);
    expect(isValidSession({ ...session, results: [] })).toBe(false);
    expect(isValidSession({ ...session, results: undefined })).toBe(false);
  });
});

describe("recordDrillResult", () => {
  it("stores the result and marks the riff practiced", () => {
    const store = freshStore();
    store.getState().recordDrillResult(0, result({ topTempoPct: 70 }));

    const { session, stats } = store.getState();
    expect(session!.results[0]!.topTempoPct).toBe(70);
    expect(session!.completed[0]).toBe(true);
    expect(stats.totalRiffs).toBe(1);
  });

  it("keeps the best tempo and sums effort across attempts", () => {
    // Abandoning a drill and coming back must not throw away the first attempt
    // — otherwise the record says a player is slower than they are.
    const store = freshStore();
    store.getState().recordDrillResult(0, result({
      topTempoPct: 85,
      reps: 4,
      seconds: 40,
      barsLooped: [1],
      completed: false,
    }));
    store.getState().recordDrillResult(0, result({
      topTempoPct: 70,
      reps: 3,
      seconds: 30,
      barsLooped: [2],
      completed: true,
    }));

    const merged = store.getState().session!.results[0]!;
    expect(merged.topTempoPct).toBe(85); // best, not latest
    expect(merged.reps).toBe(7);
    expect(merged.seconds).toBe(70);
    expect(merged.barsLooped).toEqual([1, 2]);
    expect(merged.completed).toBe(true); // sticky once earned
  });

  it("counts a riff once toward stats however many times it is drilled", () => {
    const store = freshStore();
    store.getState().recordDrillResult(0, result());
    store.getState().recordDrillResult(0, result());
    expect(store.getState().stats.totalRiffs).toBe(1);
  });

  it("credits the streak exactly like mark-done does", () => {
    const store = freshStore();
    const goal = store.getState().session!.goalCount;

    for (let i = 0; i < goal - 1; i++) {
      store.getState().recordDrillResult(i, result({ seed: i }));
    }
    expect(store.getState().streak.current).toBe(0);

    // Finish the last one the old way; the day must still credit.
    store.getState().markRiffPracticed(goal - 1);
    const { streak, session } = store.getState();
    expect(streak.current).toBe(1);
    expect(session!.credited).toBe(true);
  });

  it("records a result for a riff already marked done the old way", () => {
    // Mark-done then drill: the riff is already complete, but the result is
    // still worth keeping — it is the only evidence of what was played.
    const store = freshStore();
    store.getState().markRiffPracticed(0);
    store.getState().recordDrillResult(0, result({ topTempoPct: 90 }));
    expect(store.getState().session!.results[0]!.topTempoPct).toBe(90);
    expect(store.getState().stats.totalRiffs).toBe(1);
  });

  it("ignores an out-of-range index", () => {
    const store = freshStore();
    const before = JSON.stringify(store.getState().session);
    store.getState().recordDrillResult(-1, result());
    store.getState().recordDrillResult(99, result());
    expect(JSON.stringify(store.getState().session)).toBe(before);
  });

  it("carries the riff's identifying features, not just the numbers", () => {
    // A later skill model needs to ask "how do palm-mute riffs go?" without
    // the RiffSpec, which is heavy and may not survive an engine change.
    const store = freshStore();
    store.getState().recordDrillResult(0, result({
      rhythm: "doom_chug",
      techniques: ["mute", "hammer"],
    }));
    const stored = store.getState().session!.results[0]!;
    expect(stored.rhythm).toBe("doom_chug");
    expect(stored.techniques).toEqual(["mute", "hammer"]);
  });
});

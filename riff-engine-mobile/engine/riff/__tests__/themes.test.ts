/**
 * Property tests for themed practice sessions.
 *
 * A theme's whole value is that the day's riffs genuinely share something. The
 * risk is silent degradation: a pin the level can't satisfy, or an acceptance
 * test nothing passes, both fail *quietly* — generateSafe relaxes and the user
 * gets "Palm-mute bootcamp" with no palm mutes in it. These tests assert the
 * constraints survive all the way to the generated riff.
 */
import { describe, expect, it } from "vitest";

import { generateSafe } from "../generate";
import { allowedForLevel, Feel, Level, templateByName } from "../rhythm";
import { RiffSpec } from "../spec";
import { MIXED_SET_THEME, planSession } from "../themes";

const KEYS = ["E", "A", "D", "G", "C", "B", "F#"] as const;
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const FEELS: (Feel | null)[] = [null, "driving", "heavy", "bouncy", "laid_back"];
const COUNT = 4;
/** Mirrors THEME_ACCEPT_ATTEMPTS in usePracticeStore. */
const RETRY_BUDGET = 20;

/** A run of consecutive day keys starting from a fixed date. */
function days(n: number, from = "2026-08-20"): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) =>
    new Date(start + i * 86_400_000).toISOString().slice(0, 10),
  );
}

function plan(dayKey: string, level: Level = "intermediate", feel: Feel | null = null) {
  return planSession({ level, feel, keys: KEYS, count: COUNT, dayKey });
}

/**
 * The theme family — which builder produced it. Rhythm and key themes encode
 * their parameter after the colon; technique themes are each their own family
 * (palm-mute and legato are different lessons, not two of the same one).
 */
function family(id: string): string {
  return id.startsWith("technique:") ? id : id.split(":")[0];
}

function techniqueCount(riff: RiffSpec, ...kinds: string[]): number {
  return riff.bars.reduce(
    (n, bar) => n + bar.notes.filter((x) => kinds.includes(x.technique)).length,
    0,
  );
}

describe("planSession", () => {
  it("is deterministic in the day key", () => {
    for (const day of days(10)) {
      expect(JSON.stringify(plan(day))).toBe(JSON.stringify(plan(day)));
    }
  });

  it("never repeats a theme family on consecutive days", () => {
    for (const level of LEVELS) {
      for (const feel of FEELS) {
        const ids = days(12).map((d) => family(plan(d, level, feel).theme.id));
        for (let i = 1; i < ids.length; i++) {
          expect(ids[i]).not.toBe(ids[i - 1]);
        }
      }
    }
  });

  it("produces one plan per riff for every level/feel combination", () => {
    for (const level of LEVELS) {
      for (const feel of FEELS) {
        for (const day of days(8)) {
          const p = plan(day, level, feel);
          expect(p.plans).toHaveLength(COUNT);
          expect(p.theme.label.length).toBeGreaterThan(0);
          expect(p.theme.focus.length).toBeGreaterThan(0);
          expect(p.theme.blurb.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("only pins templates the level is actually allowed to play", () => {
    // A pin above the density cap makes generate() throw, and generateSafe
    // silently drops it — the theme would be a lie rather than a crash.
    for (const level of LEVELS) {
      for (const feel of FEELS) {
        for (const day of days(12)) {
          for (const opts of plan(day, level, feel).plans) {
            if (!opts.rhythm_name) continue;
            const template = templateByName(opts.rhythm_name);
            expect(template).not.toBeNull();
            expect(allowedForLevel(template!, level)).toBe(true);
          }
        }
      }
    }
  });

  it("never pairs a pedal template with a key it can't be muted in", () => {
    // Pedal templates always chug and their blurbs say so. In D the pedal root
    // lands on the open D string, out of tagMutes' reach, so such a pairing
    // renders a riff that contradicts the text shown above it.
    for (const level of LEVELS) {
      for (const feel of FEELS) {
        for (const day of days(40)) {
          for (const opts of plan(day, level, feel).plans) {
            if (!opts.rhythm_name) continue;
            if (!templateByName(opts.rhythm_name)?.pedal) continue;
            expect(opts.key).not.toBe("D");
          }
        }
      }
    }
  });

  it("passes the requested level through to every plan", () => {
    for (const level of LEVELS) {
      for (const day of days(8)) {
        for (const opts of plan(day, level).plans) {
          expect(opts.level).toBe(level);
        }
      }
    }
  });
});

describe("theme families", () => {
  /** Find the next day that yields the given family, so each is testable. */
  function firstDayOf(fam: string, level: Level = "intermediate"): string {
    const day = days(40).find((d) => family(plan(d, level).theme.id) === fam);
    if (!day) throw new Error(`no day produced family ${fam}`);
    return day;
  }

  it("rhythm drill: one pinned rhythm across differing keys", () => {
    const p = plan(firstDayOf("rhythm"));
    const names = new Set(p.plans.map((o) => o.rhythm_name));
    expect(names.size).toBe(1);
    expect([...names][0]).toBeTruthy();
    expect(new Set(p.plans.map((o) => o.key)).size).toBeGreaterThan(1);
  });

  it("key command: one key across differing rhythms", () => {
    const p = plan(firstDayOf("key"));
    expect(new Set(p.plans.map((o) => o.key)).size).toBe(1);
    expect(new Set(p.plans.map((o) => o.rhythm_name)).size).toBeGreaterThan(1);
  });

  it("palm-mute bootcamp: forces mutes and varies the rhythm", () => {
    const p = plan(firstDayOf("technique:palm_mute"));
    expect(p.plans.every((o) => o.force_mutes === true)).toBe(true);
    expect(p.accept).toBeDefined();
    // A technique theme holds the technique constant, not the rhythm —
    // otherwise it is a rhythm drill with a different label.
    expect(new Set(p.plans.map((o) => o.rhythm_name)).size).toBeGreaterThan(1);
  });

  it("legato day: pins legato-capable rhythms and filters the output", () => {
    const p = plan(firstDayOf("technique:legato"));
    expect(p.theme.id).toBe("technique:legato");
    // Pinned, not free-rolled: unpinned legato days measured as low as 5%.
    expect(p.plans.every((o) => Boolean(o.rhythm_name))).toBe(true);
    expect(p.accept).toBeDefined();
    expect(new Set(p.plans.map((o) => o.rhythm_name)).size).toBeGreaterThan(1);
  });

  it("palm-mute bootcamp never picks a key the chug can't be muted in", () => {
    // In D the pedal root lands on the open D string, out of tagMutes' reach,
    // and the day yields zero mutes 100% of the time. See MUTE_KEYS.
    for (const level of LEVELS) {
      for (const day of days(40)) {
        const p = plan(day, level);
        if (family(p.theme.id) !== "technique:palm_mute") continue;
        expect(p.plans.map((o) => o.key)).not.toContain("D");
      }
    }
  });
});

/**
 * Fraction of a theme's riffs that satisfy its own acceptance test within the
 * session builder's retry budget, sampled across levels.
 */
function themeSuccessRate(themeId: string, ...techniques: string[]): number {
  let total = 0;
  let passed = 0;
  for (const level of LEVELS) {
    const day = days(40).find((d) => family(plan(d, level).theme.id) === themeId);
    if (!day) continue; // this level has no eligible template for the theme
    const p = plan(day, level);
    for (let sample = 0; sample < 8; sample++) {
      for (const opts of p.plans) {
        let riff = generateSafe({ ...opts, seed: null });
        let rolls = 0;
        while (rolls < RETRY_BUDGET && !p.accept!(riff)) {
          riff = generateSafe({ ...opts, seed: null });
          rolls++;
        }
        total++;
        if (techniqueCount(riff, ...techniques) >= 2) passed++;
      }
    }
  }
  expect(total).toBeGreaterThan(0);
  return passed / total;
}

describe("themes survive generation", () => {
  it("keeps the pinned rhythm on the generated riff", () => {
    for (const level of LEVELS) {
      for (const day of days(12)) {
        const p = plan(day, level);
        for (const opts of p.plans) {
          if (!opts.rhythm_name) continue;
          expect(generateSafe(opts).rhythm_name).toBe(opts.rhythm_name);
        }
      }
    }
  });

  it("palm-mute days reach their mute threshold within the retry budget", () => {
    // Mirrors buildSession's retry loop. If this needs the whole budget the
    // theme is mispinned — tagMutes only reaches short notes on the two
    // lowest strings.
    expect(themeSuccessRate("technique:palm_mute", "mute")).toBe(1);
  });

  it("legato days reach their slur threshold within the retry budget", () => {
    // Rate rather than an absolute, because this theme filters after
    // generation rather than constraining it: the weakest eligible template
    // clears the threshold about a third of the time per roll, so "every riff,
    // every run" is not a property the design actually has. What matters is
    // that a session essentially never ships an off-theme riff.
    expect(themeSuccessRate("technique:legato", "hammer", "pull"))
      .toBeGreaterThan(0.98);
  });
});

describe("MIXED_SET_THEME", () => {
  it("is a complete theme, since the v3 migration backfills it", () => {
    expect(MIXED_SET_THEME.id).toBe("mixed");
    expect(MIXED_SET_THEME.label.length).toBeGreaterThan(0);
    expect(MIXED_SET_THEME.blurb.length).toBeGreaterThan(0);
    expect(MIXED_SET_THEME.focus.length).toBeGreaterThan(0);
  });
});

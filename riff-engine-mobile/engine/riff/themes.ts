import {
  RHYTHM_DESCRIPTIONS,
  RHYTHM_DISPLAY_NAMES,
  snakeCaseToTitle,
} from "./display";
import type { GenerateOptions } from "./generate";
import { Feel, Level, templateByName, templateNamesForLevel } from "./rhythm";
import { Rng } from "./rng";
import type { RiffSpec } from "./spec";

/**
 * A day's practice theme.
 *
 * The generator's real advantage over a fixed tab library is that it can
 * produce endless *variations of one constrained thing* — which is also how
 * practice actually works. A themed session spends that advantage: instead of
 * four unrelated riffs, the day drills a single rhythm, key, or technique
 * across varied material.
 *
 * Themes are persisted inside the session, so this shape must stay
 * JSON-serializable and backward-tolerant.
 */
export interface SessionTheme {
  /** Stable id, e.g. `rhythm:half_gallop`. Prefix is the theme family. */
  id: string;
  /** Headline for the session, e.g. "Half Gallop drill". */
  label: string;
  /** What this rhythm/technique *is* — the teaching paragraph. */
  blurb: string;
  /** The one thing to concentrate on while playing. Imperative, one sentence. */
  focus: string;
}

export interface SessionPlan {
  theme: SessionTheme;
  /** One GenerateOptions per riff in the session. */
  plans: GenerateOptions[];
  /**
   * Optional per-riff acceptance test. Some themes (legato) can't be pinned by
   * constraint and have to be filtered after generation instead; the session
   * builder retries a bounded number of times, then takes what it has.
   */
  accept?: (spec: RiffSpec) => boolean;
}

interface ThemeContext {
  level: Level;
  feel: Feel | null;
  keys: readonly string[];
  count: number;
  rng: Rng;
}

type ThemeBuilder = (ctx: ThemeContext) => SessionPlan | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** `count` keys drawn without replacement, wrapping if the pool is smaller. */
function pickKeys(
  ctx: ThemeContext,
  count: number,
  from: readonly string[] = ctx.keys,
): string[] {
  const pool = from.length > 0 ? [...from] : [...ctx.keys];
  const out: string[] = [];
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(ctx.rng.randrange(pool.length), 1)[0]);
  }
  // Fewer distinct keys than riffs: cycle what we drew rather than repeating one.
  for (let i = 0; out.length < count; i++) {
    out.push(out[i % Math.max(out.length, 1)] ?? "E");
  }
  return out;
}

/** `count` items drawn without replacement, wrapping if the pool is smaller. */
function pickDistinct<T>(items: readonly T[], count: number, rng: Rng): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(rng.randrange(pool.length), 1)[0]);
  }
  for (let i = 0; out.length < count && out.length > 0; i++) {
    out.push(out[i % out.length]);
  }
  return out;
}

/**
 * Keys whose chug actually lands where palm muting can reach it.
 *
 * tagMutes only touches the two lowest strings. In D the pedal root (D3, midi
 * 50) sits on the *open* D string, and assignPositions prefers it because open
 * strings cost nothing to move to — so a D chug riff comes out with zero mutes
 * 100% of the time, on every chug template and every level. Measured across all
 * seven guitar keys; D is the only one that fails, and it fails absolutely.
 */
const MUTE_KEYS = ["E", "A", "G", "C", "B", "F#"] as const;

/** Restrict `ctx.keys` to those palm muting can reach. */
function mutableKeys(ctx: ThemeContext): string[] {
  return ctx.keys.filter((k) => (MUTE_KEYS as readonly string[]).includes(k));
}

/** Mute-safe keys for a pedal template; the full pool for anything else. */
function mutableKeysIfPedal(ctx: ThemeContext, name: string): readonly string[] {
  return templateByName(name)?.pedal ? mutableKeys(ctx) : ctx.keys;
}

function prettyRhythm(name: string): string {
  return RHYTHM_DISPLAY_NAMES[name] ?? snakeCaseToTitle(name);
}

/** The feel a pinned template belongs to, so the plan stays self-consistent. */
function feelOf(name: string, fallback: Feel | null): Feel | null {
  return templateByName(name)?.feel ?? fallback;
}

function countLegato(spec: RiffSpec): number {
  let n = 0;
  for (const bar of spec.bars) {
    for (const note of bar.notes) {
      if (note.technique === "hammer" || note.technique === "pull") n++;
    }
  }
  return n;
}

function countMutes(spec: RiffSpec): number {
  let n = 0;
  for (const bar of spec.bars) {
    for (const note of bar.notes) {
      if (note.technique === "mute") n++;
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Theme builders
// ---------------------------------------------------------------------------

/** One rhythm, four keys. The purest "same pocket, new fingers" drill. */
const rhythmDrill: ThemeBuilder = (ctx) => {
  const names = templateNamesForLevel(ctx.level, ctx.feel);
  if (names.length === 0) return null;

  const name = ctx.rng.choice(names);
  const pretty = prettyRhythm(name);
  // Pedal templates always chug, and their blurb says so ("relentless
  // palm-muted eighths"). Keys where the chug can't be muted would put the
  // riff at odds with the description we're showing above it.
  const keys = pickKeys(ctx, ctx.count, mutableKeysIfPedal(ctx, name));

  return {
    theme: {
      id: `rhythm:${name}`,
      label: `${pretty} drill`,
      blurb: RHYTHM_DESCRIPTIONS[name] ?? `Today's rhythm: ${pretty}.`,
      focus:
        `Every riff today rides ${pretty.toLowerCase()} — only the key changes. ` +
        `Lock the rhythm first and let your fretting hand catch up to it.`,
    },
    plans: keys.map((key) => ({
      key,
      level: ctx.level,
      feel: feelOf(name, ctx.feel),
      rhythm_name: name,
    })),
  };
};

/** One key, four rhythms. Builds fretboard familiarity instead of pattern recall. */
const keyCommand: ThemeBuilder = (ctx) => {
  const names = templateNamesForLevel(ctx.level, ctx.feel);
  if (names.length < 2) return null;

  const key = ctx.rng.choice(ctx.keys.length > 0 ? ctx.keys : ["E"]);
  // Same invariant as rhythmDrill, from the other direction: the key is fixed
  // here, so it's the pedal templates that have to go if it can't be muted.
  const usable = (MUTE_KEYS as readonly string[]).includes(key)
    ? names
    : names.filter((n) => !templateByName(n)?.pedal);
  if (usable.length < 2) return null;
  const chosen = pickDistinct(usable, ctx.count, ctx.rng);

  return {
    theme: {
      id: `key:${key}`,
      label: `Command of ${key}`,
      blurb:
        `Four riffs, four different rhythms, all in ${key}. Staying in one key ` +
        `lets your hand stop hunting for the shape and start hearing where the ` +
        `notes sit — which is the whole point of learning a position.`,
      focus:
        `Don't re-learn the box each riff. Notice you're reaching for the same ` +
        `notes in a different order.`,
    },
    plans: chosen.map((name) => ({
      key,
      level: ctx.level,
      feel: feelOf(name, ctx.feel),
      rhythm_name: name,
    })),
  };
};

// Templates whose notes actually land where tagMutes can reach them — short
// notes on the two lowest strings. Pinning outside this set would produce a
// "palm-mute day" with nothing muted.
const MUTE_CANDIDATES = [
  "highway_chug",
  "war_march",
  "doom_chug",
  "gallop_drive",
  "half_gallop",
  "overdrive_8ths",
  "full_gallop",
  "thunder_gallop",
] as const;

/** Palm-mute bootcamp: chuggy low-string templates with mutes forced on. */
const palmMuteBootcamp: ThemeBuilder = (ctx) => {
  const allowed = templateNamesForLevel(ctx.level);
  const names = MUTE_CANDIDATES.filter((n) => allowed.includes(n));
  if (names.length === 0) return null;

  // A technique theme varies the rhythm and holds the *technique* constant —
  // otherwise it's just a rhythm drill wearing a different hat.
  const picks = pickDistinct(names, ctx.count, ctx.rng);
  const keys = pickKeys(ctx, ctx.count, mutableKeys(ctx));

  return {
    theme: {
      id: "technique:palm_mute",
      label: "Palm-mute bootcamp",
      blurb:
        `Palm muting is the difference between a riff that chugs and one that ` +
        `just rings. Rest the edge of your picking hand on the strings right ` +
        `where they cross the bridge — barely touching. Too far forward and the ` +
        `note dies; too far back and nothing changes.`,
      focus:
        `Today is about the heel of your picking hand. The accented hits ring ` +
        `open — everything else should be tight and percussive.`,
    },
    plans: picks.map((name, i) => ({
      key: keys[i],
      level: ctx.level,
      feel: feelOf(name, ctx.feel),
      rhythm_name: name,
      force_mutes: true,
    })),
    accept: (spec) => countMutes(spec) >= 2,
  };
};

// Hammer/pull tagging needs consecutive same-string notes a fret or two apart,
// which only some templates reliably produce. Measured over 300 riffs each at
// every level: these all land >=2 slurs at least a third of the time, while
// pedal templates (highway_chug, doom_chug, war_march, full_gallop,
// thunder_gallop) score ~0% — they repeat one fret, so there's no fret delta to
// slur. Leaving the template unpinned dropped as low as 5% and produced
// "legato days" with no legato in them.
const LEGATO_CANDIDATES = [
  "straight_8ths",
  "overdrive_8ths",
  "push_and_4",
  "rest_on_one",
  "shuffle_skip",
  "half_gallop",
  "midnight_answer",
  "funk_skip",
  "ac_dc_bounce",
  "porch_swing",
] as const;

/**
 * Legato day. Hammer-ons and pull-offs are tagged after generation from
 * whatever same-string motion the phrase happens to contain, so there's no
 * constraint that guarantees them — this stacks the odds with a pinned
 * template and then filters on the result.
 */
const legatoDay: ThemeBuilder = (ctx) => {
  const allowed = templateNamesForLevel(ctx.level);
  const names = LEGATO_CANDIDATES.filter((n) => allowed.includes(n));
  if (names.length === 0) return null;

  const picks = pickDistinct(names, ctx.count, ctx.rng);
  const keys = pickKeys(ctx, ctx.count);

  return {
    theme: {
      id: "technique:legato",
      label: "Legato day",
      blurb:
        `Hammer-ons and pull-offs let you sound notes without picking them. ` +
        `The fretting hand does the work: hammer down hard enough to sound the ` +
        `note, and pull *sideways* off the string rather than lifting straight ` +
        `up — that little flick is what makes a pull-off speak.`,
      focus:
        `Pick only the first note of each slurred pair. If you hear a gap, ` +
        `you're hammering too softly.`,
    },
    plans: picks.map((name, i) => ({
      key: keys[i],
      level: ctx.level,
      feel: feelOf(name, ctx.feel),
      rhythm_name: name,
    })),
    // Two slurs in four bars is enough to make the day honest. Three was
    // reachable often enough to look fine in testing and still left ~1 riff in
    // 6 short at beginner level, where the eligible templates are sparsest.
    accept: (spec) => countLegato(spec) >= 2,
  };
};

/**
 * The unthemed session. Also the backfill for sessions persisted before themes
 * existed, which is why it's a standalone const rather than built inline.
 */
export const MIXED_SET_THEME: SessionTheme = {
  id: "mixed",
  label: "Mixed set",
  blurb:
    `A spread of rhythms and keys — no single focus today. Good for testing ` +
    `what's stuck and what still needs work.`,
  focus: `Play each one twice: once to read it, once to mean it.`,
};

/** Fallback: the old behaviour, four unconstrained riffs in varied keys. */
const mixedSet: ThemeBuilder = (ctx) => ({
  theme: MIXED_SET_THEME,
  plans: pickKeys(ctx, ctx.count).map((key) => ({
    key,
    level: ctx.level,
    feel: ctx.feel,
  })),
});

// Rotation order. The day index walks this list, so consecutive days get
// different families and the whole cycle repeats every four days.
const BUILDERS: readonly ThemeBuilder[] = [
  rhythmDrill,
  palmMuteBootcamp,
  keyCommand,
  legatoDay,
];

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Whole days since the epoch for a YYYY-MM-DD key; 0 if unparseable. */
function dayIndex(dayKey: string): number {
  const t = Date.parse(`${dayKey}T00:00:00Z`);
  if (Number.isNaN(t)) return 0;
  return Math.floor(t / 86_400_000);
}

export interface PlanSessionOptions {
  level: Level;
  feel: Feel | null;
  keys: readonly string[];
  count: number;
  /** Local YYYY-MM-DD. Drives both which theme runs and its parameters. */
  dayKey: string;
}

/**
 * Pick and resolve the theme for a given day.
 *
 * Deterministic in `dayKey`: re-rolling a session keeps the day's lesson and
 * only replaces the riffs. The theme family rotates with the date rather than
 * being drawn at random, so a user never gets the same family twice running.
 */
export function planSession(opts: PlanSessionOptions): SessionPlan {
  const { level, feel, keys, count, dayKey } = opts;
  const idx = dayIndex(dayKey);
  // Mix the day index into a seed so the *parameters* (which rhythm, which key)
  // also vary day to day, not just which family runs.
  const rng = new Rng(Math.imul(idx, 2654435761) >>> 0);
  const ctx: ThemeContext = { level, feel, keys, count, rng };

  for (let i = 0; i < BUILDERS.length; i++) {
    const plan = BUILDERS[(idx + i) % BUILDERS.length](ctx);
    if (plan) return plan;
  }
  // Every family declined (a very restricted level/feel combo) — still give
  // the user a session.
  return mixedSet(ctx)!;
}

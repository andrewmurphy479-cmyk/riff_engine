import { Rng } from "./rng";

export type Feel = "driving" | "heavy" | "bouncy" | "laid_back";

export type Level = "beginner" | "intermediate" | "advanced";

export interface RhythmTemplate {
  name: string;
  feel: Feel;
  steps: readonly (readonly [number, number])[];
  /** Grid positions (step values) played as accented hits. */
  accents?: readonly number[];
  /** Grid positions played as ghost notes — barely-there dynamics. */
  ghosts?: readonly number[];
  /**
   * Pedal-tone template: unaccented steps chug the low root while accents
   * stab color notes. Melody fill and mutation treat these bars specially.
   */
  pedal?: boolean;
  /**
   * Swung template: playback delays off-beat 8ths to ~57-62% of the beat
   * (ratio seeded per riff). Only meaningful for templates without 16ths.
   */
  swing?: boolean;
}

/** Per-feel dynamic profile, in MIDI velocity (1-127). Values are chosen to
 * land in different sample layers (pp/p/mf/f/ff bucket at velocity/127 =
 * 0.2/0.4/0.6/0.8) so accents and ghosts change timbre, not just volume. */
export interface FeelDynamics {
  accent: number;
  normal: number;
  ghost: number;
}

export const FEEL_DYNAMICS: Record<Feel, FeelDynamics> = {
  driving: { accent: 112, normal: 92, ghost: 58 },
  heavy: { accent: 118, normal: 86, ghost: 50 },
  bouncy: { accent: 108, normal: 78, ghost: 48 },
  laid_back: { accent: 96, normal: 74, ghost: 50 },
};

// Max notes/bar by level
export const LEVEL_NOTE_CAP: Record<Level, number> = {
  beginner: 5,
  intermediate: 7,
  advanced: 8,
};

/** Pedal templates repeat one fret position, so denser bars stay easy to
 * play — the note cap loosens accordingly. */
export const PEDAL_CAP_BONUS = 3;

function hasSixteenths(t: RhythmTemplate): boolean {
  return t.steps.some(([, d]) => d === 1);
}

export function allowedForLevel(t: RhythmTemplate, level: Level): boolean {
  const cap = LEVEL_NOTE_CAP[level] + (t.pedal ? PEDAL_CAP_BONUS : 0);
  if (t.steps.length > cap) return false;
  // Beginners avoid 16th-note subdivisions (half_gallop, funk_skip, gallops)
  if (level === "beginner" && hasSixteenths(t)) return false;
  return true;
}

export const RHYTHM_LIBRARY: readonly RhythmTemplate[] = [
  {
    name: "four_on_floor",
    feel: "driving",
    steps: [[0, 4], [4, 4], [8, 4], [12, 4]],
    accents: [0, 8],
  },
  {
    name: "straight_8ths",
    feel: "driving",
    steps: [[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]],
    accents: [0, 8],
  },
  {
    name: "push_and_4",
    feel: "driving",
    steps: [[0, 2], [4, 2], [6, 2], [10, 2], [12, 2], [14, 2]],
    accents: [0, 6, 14],
  },
  {
    name: "half_gallop",
    feel: "driving",
    steps: [[0, 1], [1, 1], [2, 2], [8, 1], [9, 1], [10, 2]],
    accents: [2, 10],
    ghosts: [1, 9],
  },
  {
    name: "highway_chug",
    feel: "driving",
    steps: [[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]],
    accents: [0, 6, 12],
    pedal: true,
  },
  {
    name: "gallop_drive",
    feel: "driving",
    steps: [
      [0, 2], [2, 1], [3, 1], [4, 2], [6, 1], [7, 1],
      [8, 2], [10, 1], [11, 1], [12, 2], [14, 2],
    ],
    accents: [0, 4, 8, 12],
    pedal: true,
  },
  {
    name: "rest_on_one",
    feel: "driving",
    // The hard-rock trick: beat 1 is silent, the riff slams in on the "and".
    steps: [[2, 2], [4, 2], [6, 2], [8, 2], [12, 2]],
    accents: [4, 12],
  },
  {
    name: "redline_push",
    feel: "driving",
    // Straight drive with an anticipated hit pushing into the next bar.
    steps: [[0, 2], [4, 2], [8, 2], [10, 2], [14, 2]],
    accents: [0, 14],
  },
  {
    name: "overdrive_8ths",
    feel: "driving",
    steps: [[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [12, 2], [14, 2]],
    accents: [0, 8, 12],
    ghosts: [2, 6],
  },
  {
    name: "sabbath_space",
    feel: "heavy",
    steps: [[0, 4], [6, 2], [10, 2], [14, 2]],
    accents: [0, 10],
  },
  {
    name: "iron_stomp",
    feel: "heavy",
    steps: [[0, 4], [4, 4], [10, 2], [12, 2], [14, 2]],
    accents: [0, 4, 12],
  },
  {
    name: "doom_chug",
    feel: "heavy",
    steps: [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4]],
    accents: [4, 12],
    pedal: true,
  },
  {
    name: "thunder_gallop",
    feel: "heavy",
    steps: [
      [0, 4], [4, 1], [5, 1], [6, 2],
      [8, 4], [12, 1], [13, 1], [14, 2],
    ],
    accents: [0, 8],
    ghosts: [4, 12],
    pedal: true,
  },
  {
    name: "sludge_stomp",
    feel: "heavy",
    steps: [[0, 4], [6, 2], [8, 4], [14, 2]],
    accents: [0, 8],
    ghosts: [14],
  },
  {
    name: "war_march",
    feel: "heavy",
    // Beginner-reachable pedal chug: paired 8ths marching in half-bar cells.
    steps: [[0, 2], [2, 2], [4, 2], [8, 2], [10, 2], [12, 2]],
    accents: [4, 12],
    pedal: true,
  },
  {
    name: "full_gallop",
    feel: "heavy",
    // Wall-to-wall gallop cells ending on a long bomb. Intermediate+.
    steps: [
      [0, 1], [1, 1], [2, 2], [4, 1], [5, 1], [6, 2],
      [8, 1], [9, 1], [10, 2], [12, 4],
    ],
    accents: [2, 12],
    ghosts: [1, 5, 9],
    pedal: true,
  },
  {
    name: "ac_dc_bounce",
    feel: "bouncy",
    steps: [[0, 2], [4, 2], [8, 2], [10, 2], [12, 2]],
    accents: [0, 8],
  },
  {
    name: "funk_skip",
    feel: "bouncy",
    steps: [[0, 2], [3, 1], [6, 2], [10, 2], [13, 1]],
    accents: [3, 13],
    ghosts: [10],
  },
  {
    name: "porch_swing",
    feel: "bouncy",
    steps: [[0, 2], [4, 2], [6, 2], [10, 2], [14, 2]],
    accents: [0, 6],
  },
  {
    name: "two_step",
    feel: "bouncy",
    steps: [[0, 2], [4, 2], [6, 2], [12, 2]],
    accents: [0, 6],
    swing: true,
  },
  {
    name: "offbeat_strut",
    feel: "bouncy",
    // Rest on 1, then strut across the off-beats.
    steps: [[2, 2], [4, 2], [8, 2], [10, 2], [14, 2]],
    accents: [2, 10],
    swing: true,
  },
  {
    name: "shuffle_skip",
    feel: "bouncy",
    steps: [[0, 2], [2, 2], [6, 2], [8, 2], [10, 2], [14, 2]],
    accents: [0, 8],
    ghosts: [2, 10],
    swing: true,
  },
  {
    name: "sparse_hook",
    feel: "laid_back",
    steps: [[0, 4], [6, 2], [10, 4]],
    accents: [0, 6],
  },
  {
    name: "laid_answer",
    feel: "laid_back",
    steps: [[0, 4], [4, 4], [10, 2], [12, 2]],
    accents: [0],
  },
  {
    name: "slow_nod",
    feel: "laid_back",
    steps: [[0, 4], [6, 2], [10, 2], [12, 4]],
    accents: [0, 12],
    swing: true,
  },
  {
    name: "dusty_stroll",
    feel: "laid_back",
    steps: [[0, 2], [4, 4], [10, 2], [14, 2]],
    accents: [0, 10],
    ghosts: [14],
    swing: true,
  },
  {
    name: "midnight_answer",
    feel: "laid_back",
    steps: [[0, 2], [2, 2], [4, 4], [10, 2], [12, 2], [14, 2]],
    accents: [0, 10],
    ghosts: [2, 14],
  },
];

export function byFeel(feel: Feel): readonly RhythmTemplate[] {
  return RHYTHM_LIBRARY.filter((t) => t.feel === feel);
}

export function pickTemplate(
  rng: Rng,
  feel: Feel | null = null,
  level: Level = "intermediate",
): RhythmTemplate {
  const feelPool = feel ? byFeel(feel) : RHYTHM_LIBRARY;
  const pool = feelPool.filter((t) => allowedForLevel(t, level));
  if (pool.length === 0) {
    throw new Error(
      `no rhythm templates for feel=${feel} at level=${level}`,
    );
  }
  return rng.choice(pool);
}

/**
 * Look up a template by name. Themed sessions pin one rhythm across the day's
 * riffs, so they need name -> template resolution the random picker skips.
 */
export function templateByName(name: string): RhythmTemplate | null {
  return RHYTHM_LIBRARY.find((t) => t.name === name) ?? null;
}

/** Names of every template a given level is allowed to play, in library order. */
export function templateNamesForLevel(
  level: Level,
  feel: Feel | null = null,
): string[] {
  const pool = feel ? byFeel(feel) : RHYTHM_LIBRARY;
  return pool.filter((t) => allowedForLevel(t, level)).map((t) => t.name);
}

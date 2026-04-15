import { Rng } from "./rng";

export type Feel = "driving" | "heavy" | "bouncy" | "laid_back";

export interface RhythmTemplate {
  name: string;
  feel: Feel;
  steps: readonly (readonly [number, number])[];
}

export const RHYTHM_LIBRARY: readonly RhythmTemplate[] = [
  {
    name: "four_on_floor",
    feel: "driving",
    steps: [[0, 4], [4, 4], [8, 4], [12, 4]],
  },
  {
    name: "straight_8ths",
    feel: "driving",
    steps: [[0, 2], [2, 2], [4, 2], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]],
  },
  {
    name: "push_and_4",
    feel: "driving",
    steps: [[0, 2], [4, 2], [6, 2], [10, 2], [12, 2], [14, 2]],
  },
  {
    name: "half_gallop",
    feel: "driving",
    steps: [[0, 1], [1, 1], [2, 2], [8, 1], [9, 1], [10, 2]],
  },
  {
    name: "sabbath_space",
    feel: "heavy",
    steps: [[0, 4], [6, 2], [10, 2], [14, 2]],
  },
  {
    name: "iron_stomp",
    feel: "heavy",
    steps: [[0, 4], [4, 4], [10, 2], [12, 2], [14, 2]],
  },
  {
    name: "ac_dc_bounce",
    feel: "bouncy",
    steps: [[0, 2], [4, 2], [8, 2], [10, 2], [12, 2]],
  },
  {
    name: "funk_skip",
    feel: "bouncy",
    steps: [[0, 2], [3, 1], [6, 2], [10, 2], [13, 1]],
  },
  {
    name: "sparse_hook",
    feel: "laid_back",
    steps: [[0, 4], [6, 2], [10, 4]],
  },
  {
    name: "laid_answer",
    feel: "laid_back",
    steps: [[0, 4], [4, 4], [10, 2], [12, 2]],
  },
];

export function byFeel(feel: Feel): readonly RhythmTemplate[] {
  return RHYTHM_LIBRARY.filter((t) => t.feel === feel);
}

export function pickTemplate(rng: Rng, feel: Feel | null = null): RhythmTemplate {
  const pool = feel ? byFeel(feel) : RHYTHM_LIBRARY;
  if (pool.length === 0) throw new Error(`no rhythm templates for feel=${feel}`);
  return rng.choice(pool);
}

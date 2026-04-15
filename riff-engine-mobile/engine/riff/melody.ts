import { RhythmTemplate } from "./rhythm";
import { Rng } from "./rng";
import { PitchedStep } from "./spec";

type PoolEntry = readonly [number, string];

export interface FillMelodyOptions {
  startingMidi?: number | null;
  endingRule?: string | null;
  anchorMidi?: number | null;
}

export function fillMelody(
  template: RhythmTemplate,
  pool: readonly PoolEntry[],
  rng: Rng,
  opts: FillMelodyOptions = {},
): PitchedStep[] {
  const { startingMidi = null, endingRule = null, anchorMidi = null } = opts;
  const poolSorted: PoolEntry[] = [...pool].sort((a, b) => a[0] - b[0]);
  const poolMidis = poolSorted.map(([m]) => m);
  const steps: PitchedStep[] = [];
  const noteCount = template.steps.length;

  for (let i = 0; i < noteCount; i++) {
    const [step, duration] = template.steps[i];
    const isFirst = i === 0;
    const isLast = i === noteCount - 1;

    let midi: number;
    if (isFirst && startingMidi !== null) {
      midi = startingMidi;
    } else {
      midi = pickNote(
        rng,
        poolSorted,
        poolMidis,
        steps,
        anchorMidi,
        isFirst,
        isLast,
        endingRule,
      );
    }
    steps.push({ step, duration, midi });
  }

  return steps;
}

function pickNote(
  rng: Rng,
  pool: readonly PoolEntry[],
  poolMidis: readonly number[],
  prevSteps: readonly PitchedStep[],
  anchorMidi: number | null,
  isFirst: boolean,
  isLast: boolean,
  endingRule: string | null,
): number {
  let candidates: PoolEntry[] = [...pool];

  if (isFirst) {
    candidates = weightedFirstNote(rng, pool);
  }

  if (isLast && endingRule === "root") {
    const roots = candidates.filter((p) => p[1] === "root");
    if (roots.length > 0) candidates = roots;
  } else if (isLast && endingRule === "not_root") {
    const nonRoots = candidates.filter((p) => p[1] !== "root");
    if (nonRoots.length > 0) candidates = nonRoots;
  }

  const reference =
    prevSteps.length > 0 ? prevSteps[prevSteps.length - 1].midi : anchorMidi;
  if (reference !== null) {
    const refIdx = nearestIndex(reference, poolMidis);
    const nearby = candidates.filter(
      (p) => Math.abs(nearestIndex(p[0], poolMidis) - refIdx) <= 4,
    );
    if (nearby.length > 0) candidates = nearby;
  }

  if (
    prevSteps.length >= 2 &&
    prevSteps[prevSteps.length - 1].midi === prevSteps[prevSteps.length - 2].midi
  ) {
    const lastMidi = prevSteps[prevSteps.length - 1].midi;
    const filtered = candidates.filter((p) => p[0] !== lastMidi);
    if (filtered.length > 0) candidates = filtered;
  }

  return rng.choice(candidates)[0];
}

function weightedFirstNote(rng: Rng, pool: readonly PoolEntry[]): PoolEntry[] {
  const roll = rng.random();
  let target: string;
  if (roll < 0.7) target = "root";
  else if (roll < 0.9) target = "b3";
  else target = "5";
  const matches = pool.filter((p) => p[1] === target);
  return matches.length > 0 ? matches : [...pool];
}

function nearestIndex(midi: number, poolMidis: readonly number[]): number {
  let bestI = 0;
  let bestD = Infinity;
  for (let i = 0; i < poolMidis.length; i++) {
    const d = Math.abs(poolMidis[i] - midi);
    if (d < bestD) {
      bestD = d;
      bestI = i;
    }
  }
  return bestI;
}

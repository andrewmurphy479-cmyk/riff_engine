import { fillMelody } from "./melody";
import { RhythmTemplate } from "./rhythm";
import { Rng } from "./rng";
import { PitchedStep } from "./spec";

type PoolEntry = readonly [number, string];

export function buildPhrase(
  template: RhythmTemplate,
  pool: readonly PoolEntry[],
  rng: Rng,
  _key?: string,
): PitchedStep[][] {
  const barA = fillMelody(template, pool, rng, { endingRule: "not_root" });
  const barAPrime = mutateBar(barA, pool, rng, template);
  const barARepeat: PitchedStep[] = barA.map((s) => ({ ...s }));
  const barB = fillMelody(template, pool, rng, {
    anchorMidi: barA[barA.length - 1]?.midi ?? null,
    endingRule: "root",
  });
  return [barA, barAPrime, barARepeat, barB];
}

function mutateBar(
  bar: readonly PitchedStep[],
  pool: readonly PoolEntry[],
  rng: Rng,
  template?: RhythmTemplate,
): PitchedStep[] {
  if (bar.length === 0) return [];
  const mutated: PitchedStep[] = bar.map((s) => ({ ...s }));

  let idx: number;
  if (template?.pedal) {
    // Vary a color stab, never the chug — the pedal IS the bar's identity.
    const accentSet = new Set(template.accents ?? []);
    const stabIdxs = bar
      .map((s, i) => (accentSet.has(s.step) ? i : -1))
      .filter((i) => i >= 0);
    if (stabIdxs.length === 0) return mutated;
    idx = stabIdxs[rng.randrange(stabIdxs.length)];
  } else {
    // 70% chance to alter the last note (tail variation); otherwise random slot.
    idx = rng.random() < 0.7 ? bar.length - 1 : rng.randrange(bar.length);
  }
  const current = mutated[idx].midi;

  const poolMidis = pool.map(([m]) => m);
  const curIdx = poolMidis.includes(current) ? poolMidis.indexOf(current) : 0;

  let nearby = poolMidis.filter(
    (m) => m !== current && Math.abs(poolMidis.indexOf(m) - curIdx) <= 2,
  );
  if (nearby.length === 0) {
    nearby = poolMidis.filter((m) => m !== current);
  }
  if (nearby.length > 0) {
    mutated[idx] = { ...mutated[idx], midi: rng.choice(nearby) };
  }
  return mutated;
}

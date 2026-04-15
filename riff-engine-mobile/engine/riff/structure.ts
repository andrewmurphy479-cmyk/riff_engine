import { fillMelody } from "./melody";
import { RhythmTemplate } from "./rhythm";
import { Rng } from "./rng";
import { PitchedStep } from "./spec";

type PoolEntry = readonly [number, string];

export function buildPhrase(
  template: RhythmTemplate,
  pool: readonly PoolEntry[],
  rng: Rng,
): PitchedStep[][] {
  const barA = fillMelody(template, pool, rng, { endingRule: "not_root" });
  const barAPrime = mutateBar(barA, pool, rng);
  const barARepeat: PitchedStep[] = barA.map((s) => ({ ...s }));
  const barB = fillMelody(template, pool, rng, {
    anchorMidi: barA[barA.length - 1].midi,
    endingRule: "root",
  });
  return [barA, barAPrime, barARepeat, barB];
}

function mutateBar(
  bar: readonly PitchedStep[],
  pool: readonly PoolEntry[],
  rng: Rng,
): PitchedStep[] {
  if (bar.length === 0) return [];
  const mutated: PitchedStep[] = bar.map((s) => ({ ...s }));

  // 70% chance to alter the last note (tail variation); otherwise random slot.
  const idx = rng.random() < 0.7 ? bar.length - 1 : rng.randrange(bar.length);
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

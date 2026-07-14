/**
 * Shared definition of the snapshot corpus: a deterministic matrix of
 * (seed, feel, level) combos frozen to __fixtures__/corpus.json.
 *
 * The corpus is a change-detector, not a spec: when the engine changes
 * deliberately, regenerate with `npm run corpus:regen` and review the JSON
 * diff like any other code change.
 */
import { generate, GenerateOptions } from "../generate";
import { Feel, Level } from "../rhythm";
import { RiffSpec } from "../spec";

const SEEDS = [1, 42, 2024];
const FEELS: (Feel | null)[] = [null, "driving", "heavy", "bouncy", "laid_back"];
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];

export interface CorpusEntry {
  name: string;
  opts: GenerateOptions;
}

export const CORPUS_MATRIX: CorpusEntry[] = FEELS.flatMap((feel) =>
  LEVELS.flatMap((level) =>
    SEEDS.map((seed) => ({
      name: `${feel ?? "any"}_${level}_s${seed}`,
      opts: { seed, feel, level },
    })),
  ),
);

/**
 * Deterministic generation for corpus entries: if a (seed, combo) is
 * over-constrained, bump the seed by a fixed prime until one succeeds.
 * Same inputs always yield the same riff, unlike generateSafe's fresh-seed
 * fallbacks.
 */
export function generateForCorpus(opts: GenerateOptions): RiffSpec {
  const baseSeed = opts.seed ?? 0;
  for (let bump = 0; bump < 20; bump++) {
    try {
      return generate({ ...opts, seed: baseSeed + bump * 1_000_003, max_attempts: 30 });
    } catch {
      // over-constrained at this seed; try the next deterministic bump
    }
  }
  throw new Error(`corpus entry unexpectedly hard: ${JSON.stringify(opts)}`);
}

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    const src = obj as Record<string, unknown>;
    for (const key of Object.keys(src).sort()) {
      sorted[key] = sortKeys(src[key]);
    }
    return sorted;
  }
  return obj;
}

export function buildCorpus(): Record<string, unknown> {
  const corpus: Record<string, unknown> = {};
  for (const entry of CORPUS_MATRIX) {
    corpus[entry.name] = sortKeys(generateForCorpus(entry.opts) as unknown);
  }
  return corpus;
}

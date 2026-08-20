import { addDiads } from "./diads";
import { assignPositions, passesStretchCheck } from "./playability";
import {
  allowedForLevel,
  Feel,
  FEEL_DYNAMICS,
  Level,
  pickTemplate,
  RhythmTemplate,
  templateByName,
} from "./rhythm";
import { Rng } from "./rng";
import { notePool } from "./scale";
import { Bar, Note, RiffSpec } from "./spec";
import { buildPhrase } from "./structure";
import { tagMutes, tagTechniques } from "./techniques";

const DEFAULT_KEY = "E";
const DEFAULT_TEMPO = 110;
const DEFAULT_LOW_MIDI = 40;
const DEFAULT_HIGH_MIDI = 64;
const DEFAULT_LEVEL: Level = "intermediate";

export const LEVEL_STRETCH_LIMIT: Record<Level, number> = {
  beginner: 3,
  intermediate: 4,
  advanced: 5,
};

// Chance that a non-pedal heavy/driving riff gets the palm-mute chug
// treatment (pedal templates always do).
const MUTE_CHANCE: Record<Feel, number> = {
  driving: 0.35,
  heavy: 0.6,
  bouncy: 0,
  laid_back: 0,
};

// Per-note velocity humanization: +/- this many MIDI velocity units.
const VELOCITY_JITTER = 3;

// Swung templates delay off-beat 8ths to this fraction of the beat
// (0.5 = straight). The exact ratio is seeded per riff for variety.
const SWING_MIN = 0.57;
const SWING_MAX = 0.62;

function clampVelocity(v: number): number {
  return Math.max(1, Math.min(127, v));
}

// Chance of blue notes when level permits and include_blue isn't explicit.
const LEVEL_BLUE_CHANCE: Record<Level, number> = {
  beginner: 0,
  intermediate: 0,
  advanced: 0.5,
};

export interface GenerateOptions {
  key?: string;
  tempo_bpm?: number;
  feel?: Feel | null;
  level?: Level;
  seed?: number | null;
  include_blue?: boolean;
  max_attempts?: number;
  /**
   * Pin the rhythm template by name instead of drawing one from the feel pool.
   * Themed sessions drill a single rhythm across the day's riffs. Throws if the
   * name is unknown or the template is above `level`'s density cap —
   * {@link generateSafe} relaxes it rather than silently ignoring it.
   */
  rhythm_name?: string | null;
  /**
   * Force palm-mute tagging regardless of the per-feel mute roll. Mutes still
   * only land where {@link tagMutes} allows (short notes, two lowest strings),
   * so this raises the odds rather than guaranteeing them.
   */
  force_mutes?: boolean;
}

export function generate(opts: GenerateOptions = {}): RiffSpec {
  const {
    key = DEFAULT_KEY,
    tempo_bpm = DEFAULT_TEMPO,
    feel = null,
    level = DEFAULT_LEVEL,
    seed: providedSeed = null,
    include_blue: explicitBlue,
    max_attempts = 10,
    rhythm_name = null,
    force_mutes = false,
  } = opts;

  // Resolve a pinned template up front: an unknown or over-cap name is a
  // constraint failure, not a per-attempt one, so fail before the loop and let
  // generateSafe drop the pin.
  let pinned: RhythmTemplate | null = null;
  if (rhythm_name) {
    pinned = templateByName(rhythm_name);
    if (!pinned) {
      throw new Error(`unknown rhythm template ${JSON.stringify(rhythm_name)}`);
    }
    if (!allowedForLevel(pinned, level)) {
      throw new Error(
        `rhythm template ${rhythm_name} exceeds the ${level} density cap`,
      );
    }
  }

  const seed = providedSeed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = new Rng(seed);

  // Resolve include_blue: explicit call wins; otherwise derive from level.
  const include_blue =
    explicitBlue !== undefined
      ? explicitBlue
      : rng.random() < LEVEL_BLUE_CHANCE[level];

  const stretchLimit = LEVEL_STRETCH_LIMIT[level];

  const pool = notePool(key, DEFAULT_LOW_MIDI, DEFAULT_HIGH_MIDI, include_blue);
  if (pool.length === 0) {
    throw new Error(`empty scale pool for key=${JSON.stringify(key)}`);
  }

  for (let attempt = 0; attempt < max_attempts; attempt++) {
    const template = pinned ?? pickTemplate(rng, feel, level);
    const phrase = buildPhrase(template, pool, rng, key);

    const flatMidi = phrase.flat().map((s) => s.midi);
    const path = assignPositions(flatMidi, stretchLimit);
    if (path === null) continue;

    // Force Bar A-repeat (index 2) to reuse Bar A's fingering so the hook
    // reads identically in tab and on the fretboard.
    const barSizes = phrase.map((bar) => bar.length);
    const offsets = [0];
    for (const sz of barSizes) {
      offsets.push(offsets[offsets.length - 1] + sz);
    }
    for (let i = 0; i < barSizes[0]; i++) {
      path[offsets[2] + i] = path[offsets[0] + i];
    }
    if (!passesStretchCheck(path, stretchLimit)) continue;

    const accentSet = new Set(template.accents ?? [0]);
    const ghostSet = new Set(template.ghosts ?? []);
    const dynamics = FEEL_DYNAMICS[template.feel];

    const bars: Bar[] = [];
    let k = 0;
    for (const barSteps of phrase) {
      const notes: Note[] = [];
      for (const s of barSteps) {
        const [stringIdx, fret] = path[k];
        const base = accentSet.has(s.step)
          ? dynamics.accent
          : ghostSet.has(s.step)
            ? dynamics.ghost
            : dynamics.normal;
        const jitter = rng.randrange(VELOCITY_JITTER * 2 + 1) - VELOCITY_JITTER;
        notes.push({
          step: s.step,
          duration: s.duration,
          string: stringIdx,
          fret,
          velocity: clampVelocity(base + jitter),
          technique: "pluck",
        });
        k++;
      }
      bars.push({ notes });
    }

    let tagged = tagTechniques(bars);
    const muteRoll = rng.random();
    if (force_mutes || template.pedal || muteRoll < MUTE_CHANCE[template.feel]) {
      tagged = tagMutes(tagged, accentSet);
    }

    tagged = addDiads(tagged, {
      rng,
      feel: template.feel,
      level,
      accents: accentSet,
      stretchLimit,
      key,
      includeBlue: include_blue,
    });

    const swing = template.swing
      ? SWING_MIN + rng.random() * (SWING_MAX - SWING_MIN)
      : undefined;

    const spec: RiffSpec = {
      key,
      scale: "minor_pentatonic" + (include_blue ? "+blue" : ""),
      tempo_bpm,
      time_sig: [4, 4],
      bars: tagged,
      motif_structure: "AA'AB",
      seed,
      rhythm_name: template.name,
      feel: template.feel,
    };
    if (swing !== undefined) spec.swing = swing;
    return spec;
  }

  throw new Error(
    `failed to generate a playable riff after ${max_attempts} attempts ` +
      `(seed=${seed}); rules may be over-constrained`,
  );
}

/**
 * Crash-proof wrapper around {@link generate}. A single call can throw when a
 * key/feel/level combo is over-constrained and it exhausts its attempts. Each
 * call uses a fresh random seed, so this retries — and progressively relaxes
 * the rhythm pin, then feel, then key — until it gets a playable riff,
 * guaranteeing a RiffSpec.
 *
 * Use this anywhere a throw would reach the UI (generation on user actions).
 */
export function generateSafe(opts: GenerateOptions = {}): RiffSpec {
  const plans: GenerateOptions[] = [
    { ...opts, max_attempts: opts.max_attempts ?? 30 },
    { ...opts, seed: null, max_attempts: 30 }, // fresh seed, same constraints
    // A pin is a promise the UI has already made ("today is gallop day"), so
    // spend a bigger attempt budget before breaking it. Tight beginner stretch
    // limits plus a pedal template is the combination that needs this.
    ...(opts.rhythm_name
      ? [{ ...opts, seed: null, max_attempts: 200 } as GenerateOptions]
      : []),
    // Drop the rhythm pin before the feel: a themed session would rather keep
    // its feel and lose the exact template than the other way round.
    { ...opts, seed: null, rhythm_name: null, max_attempts: 30 },
    { ...opts, seed: null, rhythm_name: null, feel: null, max_attempts: 30 },
    {
      ...opts,
      seed: null,
      rhythm_name: null,
      feel: null,
      key: undefined,
      max_attempts: 50,
    },
  ];
  for (const plan of plans) {
    try {
      return generate(plan);
    } catch {
      // fall through to the next, more relaxed plan
    }
  }
  // Last resort: the most permissive call possible — but keep the level;
  // its stretch/density caps are a promise to the player, never relaxed.
  return generate({ level: opts.level, max_attempts: 100 });
}

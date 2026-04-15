import { assignPositions, passesStretchCheck } from "./playability";
import { Feel, pickTemplate } from "./rhythm";
import { Rng } from "./rng";
import { notePool } from "./scale";
import { Bar, Note, RiffSpec } from "./spec";
import { buildPhrase } from "./structure";

const DEFAULT_KEY = "E";
const DEFAULT_TEMPO = 110;
const DEFAULT_LOW_MIDI = 40;
const DEFAULT_HIGH_MIDI = 64;

export interface GenerateOptions {
  key?: string;
  tempo_bpm?: number;
  feel?: Feel | null;
  seed?: number | null;
  include_blue?: boolean;
  max_attempts?: number;
}

export function generate(opts: GenerateOptions = {}): RiffSpec {
  const {
    key = DEFAULT_KEY,
    tempo_bpm = DEFAULT_TEMPO,
    feel = null,
    seed: providedSeed = null,
    include_blue = false,
    max_attempts = 10,
  } = opts;

  const seed = providedSeed ?? Math.floor(Math.random() * 2 ** 31);
  const rng = new Rng(seed);

  const pool = notePool(key, DEFAULT_LOW_MIDI, DEFAULT_HIGH_MIDI, include_blue);
  if (pool.length === 0) {
    throw new Error(`empty scale pool for key=${JSON.stringify(key)}`);
  }

  for (let attempt = 0; attempt < max_attempts; attempt++) {
    const template = pickTemplate(rng, feel);
    const phrase = buildPhrase(template, pool, rng);

    const flatMidi = phrase.flat().map((s) => s.midi);
    const path = assignPositions(flatMidi);
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
    if (!passesStretchCheck(path)) continue;

    const bars: Bar[] = [];
    let k = 0;
    for (const barSteps of phrase) {
      const notes: Note[] = [];
      for (const s of barSteps) {
        const [stringIdx, fret] = path[k];
        notes.push({
          step: s.step,
          duration: s.duration,
          string: stringIdx,
          fret,
          velocity: 96,
          technique: "pluck",
        });
        k++;
      }
      bars.push({ notes });
    }

    return {
      key,
      scale: "minor_pentatonic" + (include_blue ? "+blue" : ""),
      tempo_bpm,
      time_sig: [4, 4],
      bars,
      motif_structure: "AA'AB",
      seed,
      rhythm_name: template.name,
      feel: template.feel,
    };
  }

  throw new Error(
    `failed to generate a playable riff after ${max_attempts} attempts ` +
      `(seed=${seed}); rules may be over-constrained`,
  );
}

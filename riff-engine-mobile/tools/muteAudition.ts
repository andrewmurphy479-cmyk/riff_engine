/**
 * Palm-mute A/B audition: renders the same chug riffs with several mute
 * characters so the winner can be picked by ear and promoted to
 * DEFAULT_MUTE_PARAMS in audio/KarplusStrong.ts.
 *
 * Usage:
 *   npx tsx tools/muteAudition.ts
 *
 * Output: out/mute-audition/<riff>__<variant>.wav
 * Reverb is rendered at the app's realtime mix (0.08) so what you hear
 * matches in-app playback, not the wetter export mix.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { generate } from "../engine/riff/generate";
import { Feel } from "../engine/riff/rhythm";
import { RiffSpec } from "../engine/riff/spec";
import { riffSpecToEvents } from "../engine/riff/toEvents";
import { createStereoWavBuffer, MuteParams } from "../audio/KarplusStrong";
import { renderEventsToStereo } from "../audio/offlineRender";

const OUT_DIR = path.join("out", "mute-audition");

// Same knobs, different characters. "old_flabby" approximates the pre-fix
// sound (no fast envelope) for reference.
const VARIANTS: Record<string, Partial<MuteParams>> = {
  a_tight: {
    chunkDecayMs: 22, bodyDecayMs: 120, bodyBlend: 0.25,
    tailMs: 50, bodyResScale: 0.3, gain: 1.12,
    transientScale: 1.0, noiseScale: 0.6, toneOffset: -0.3,
  },
  b_thump: {
    chunkDecayMs: 30, bodyDecayMs: 160, bodyBlend: 0.32,
    tailMs: 70, bodyResScale: 0.4, gain: 1.15,
    transientScale: 0.9, noiseScale: 0.55, toneOffset: -0.34,
  },
  c_chunk: {
    chunkDecayMs: 15, bodyDecayMs: 90, bodyBlend: 0.18,
    tailMs: 40, bodyResScale: 0.25, gain: 1.2,
    transientScale: 1.3, noiseScale: 0.7, toneOffset: -0.26,
  },
  d_open_palm: {
    chunkDecayMs: 40, bodyDecayMs: 220, bodyBlend: 0.4,
    tailMs: 90, bodyResScale: 0.5, gain: 1.08,
    transientScale: 1.0, noiseScale: 0.6, toneOffset: -0.28,
  },
  old_flabby: {
    // Effectively disables the new envelope: very long decays, full tail.
    chunkDecayMs: 10000, bodyDecayMs: 10000, bodyBlend: 0.5,
    tailMs: 120, bodyResScale: 1.0, gain: 1.0,
    transientScale: 1.1, noiseScale: 0.5, toneOffset: -0.25,
  },
};

/** Find a seed whose riff uses the wanted rhythm template. */
function riffWithTemplate(feel: Feel, templateName: string, tempo: number): RiffSpec {
  for (let seed = 1; seed < 5000; seed++) {
    let riff: RiffSpec;
    try {
      riff = generate({ feel, level: "intermediate", key: "E", seed, tempo_bpm: tempo, max_attempts: 30 });
    } catch {
      continue;
    }
    if (riff.rhythm_name === templateName) return riff;
  }
  throw new Error(`no seed found for ${feel}/${templateName}`);
}

function main(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const riffs: [string, RiffSpec][] = [
    ["doom_chug_92bpm", riffWithTemplate("heavy", "doom_chug", 92)],
    ["highway_chug_140bpm", riffWithTemplate("driving", "highway_chug", 140)],
    ["thunder_gallop_92bpm", riffWithTemplate("heavy", "thunder_gallop", 92)],
  ];

  for (const [riffName, riff] of riffs) {
    const events = riffSpecToEvents(riff);
    for (const [variantName, muteParams] of Object.entries(VARIANTS)) {
      const { left, right } = renderEventsToStereo(events, riff.tempo_bpm, {
        reverbMix: 0.08,
        muteParams,
      });
      const wav = createStereoWavBuffer(left, right);
      const file = path.join(OUT_DIR, `${riffName}__${variantName}.wav`);
      fs.writeFileSync(file, Buffer.from(wav));
      console.log(`wrote ${file}`);
    }
  }

  console.log("\nListen in order per riff: old_flabby -> a_tight -> b_thump -> c_chunk -> d_open_palm");
  console.log("Pick a winner (or 'X but more/less Y') and the defaults get updated.");
}

main();

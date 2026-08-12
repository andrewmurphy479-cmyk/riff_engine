/**
 * Offline measurements for the F1 audio audit (findings A4, A5, A6, A8).
 *
 * These are the audit items that need no device: they are pure logic over
 * generated riffs, plus a Node timing of the synth. Everything here runs the
 * app's REAL code paths — `generateSafe` -> `riffSpecToEvents`, the real
 * `ToneBank` cache key, the real `synthesizeTone` — so the numbers are the
 * app's numbers, not a re-implementation's.
 *
 * A1/A2/A3/A7 are device-only (or device-self-reporting) and are not here.
 *
 * Usage:
 *   npm run audit:audio
 *   npm run audit:audio -- --riffs 400 --synth-samples 24
 */
import { generateSafe } from "../engine/riff/generate";
import { Feel, Level } from "../engine/riff/rhythm";
import { RiffSpec } from "../engine/riff/spec";
import { riffSpecToEvents } from "../engine/riff/toEvents";
import { TabEvent } from "../engine/types";
import { SAMPLE_RATE, synthesizeMono, synthesizeTone } from "../audio/KarplusStrong";
import { totalStepsFor as totalStepsFixed } from "../audio/loopLength";
import { ToneBank, ToneSpec, velocityToLayer } from "../audio/toneBank";
import { fretToMidiNote } from "../audio/noteMapping";

const FEELS: Feel[] = ["driving", "heavy", "bouncy", "laid_back"];
const LEVELS: Level[] = ["beginner", "intermediate", "advanced"];
const KEYS = ["E", "A", "D", "G", "C", "B", "F#"]; // GUITAR_KEYS

const STEPS_PER_BAR = 16;
const STEPS_PER_BEAT = 4;
const BARS_PER_RIFF = 4;
const EXPECTED_STEPS = STEPS_PER_BAR * BARS_PER_RIFF; // 64

// Mirrors audio/toneBank.ts (not exported there). Asserted against a real
// synthesizeTone() call below so this can't silently drift.
const RING_MS: Record<string, number> = { E: 3500, A: 3500, D: 2800, G: 2800, B: 2200, e: 2200 };
const MUTE_RING_MS = 700;
const BYTES_PER_SAMPLE = 4; // float32
// ToneBank caches MONO and pans at playback (A4 fix). The pre-fix cache was
// stereo — CHANNELS_BEFORE is kept so the report still shows what was saved.
const CHANNELS = 1;
const CHANNELS_BEFORE = 2;

interface Args {
  riffs: number;
  synthSamples: number;
  seed: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { riffs: 400, synthSamples: 20, seed: 90210 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--riffs") args.riffs = parseInt(argv[++i], 10);
    else if (a === "--synth-samples") args.synthSamples = parseInt(argv[++i], 10);
    else if (a === "--seed") args.seed = parseInt(argv[++i], 10);
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

// ---------------------------------------------------------------------------
// Shared helpers

/** Same shape AudioEngine.eventToneSpec builds. */
function eventToneSpec(event: TabEvent): ToneSpec {
  return {
    midiNote: fretToMidiNote(event.string, event.fret),
    velocity: event.velocity ?? 0.7,
    guitarString: event.string,
    technique: event.technique ?? undefined,
  };
}

/** The REAL private ToneBank.key(), so cache-size numbers can't drift. */
const toneKey: (spec: ToneSpec) => string = (() => {
  const fn = (ToneBank as unknown as { key?: (s: ToneSpec) => string }).key;
  if (typeof fn !== "function") {
    throw new Error("ToneBank.key() not found — audio/toneBank.ts changed shape");
  }
  return fn.bind(ToneBank);
})();

function ringMsFor(spec: ToneSpec): number {
  return spec.technique === "mute" ? MUTE_RING_MS : RING_MS[spec.guitarString];
}

function bytesFor(spec: ToneSpec): number {
  return Math.floor((SAMPLE_RATE * ringMsFor(spec)) / 1000) * CHANNELS * BYTES_PER_SAMPLE;
}

/** Loop length the engine used before the A5 fix. */
function totalStepsBefore(events: TabEvent[]): number {
  return Math.max(...events.map((e) => e.step + (e.swingOffset ?? 0) + e.duration));
}

function mb(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

function pct(n: number, total: number): string {
  return total === 0 ? "0.0%" : ((n / total) * 100).toFixed(1) + "%";
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

interface Sample {
  riff: RiffSpec;
  events: TabEvent[];
  feel: Feel;
  level: Level;
  key: string;
}

/** A deterministic spread across the app's real feel/level/key space. */
function buildCorpus(count: number, seedBase: number): Sample[] {
  const out: Sample[] = [];
  for (let i = 0; i < count; i++) {
    const feel = FEELS[i % FEELS.length];
    const level = LEVELS[Math.floor(i / FEELS.length) % LEVELS.length];
    const key = KEYS[Math.floor(i / (FEELS.length * LEVELS.length)) % KEYS.length];
    const riff = generateSafe({ feel, level, key, seed: seedBase + i * 7919 });
    out.push({ riff, events: riffSpecToEvents(riff), feel, level, key });
  }
  return out;
}

// ---------------------------------------------------------------------------
// A5 — loop length = last note's end, not the riff's bar count

function measureA5(corpus: Sample[]): void {
  console.log("\n=== A5 · Loop length vs. bar count ===");
  console.log(
    `Engine loop end is max(step + swingOffset + duration) over all events.\n` +
      `Musically correct end is bars x 16 steps = ${EXPECTED_STEPS} steps.\n`,
  );

  // The 64-step baseline is only valid if every riff really is 4 bars.
  const barCounts = new Set(corpus.map((s) => s.riff.bars.length));
  console.log(
    `Baseline check: bar counts observed = {${[...barCounts].join(", ")}} ` +
      `(${barCounts.size === 1 && barCounts.has(BARS_PER_RIFF) ? "all 4 bars — 64-step baseline valid" : "NOT uniformly 4 bars — baseline below is wrong"})\n`,
  );

  let early = 0;
  let late = 0;
  let exact = 0;
  const shortfalls: number[] = [];
  const overshoots: number[] = [];
  const byFeel = new Map<string, { n: number; early: number; sumShort: number }>();
  let worst: { sample: Sample; maxStep: number } | null = null;

  for (const s of corpus) {
    const maxStep = totalStepsBefore(s.events);
    const bucket = byFeel.get(s.feel) ?? { n: 0, early: 0, sumShort: 0 };
    bucket.n++;

    const delta = maxStep - EXPECTED_STEPS;
    if (delta < -1e-9) {
      early++;
      shortfalls.push(-delta);
      bucket.early++;
      bucket.sumShort += -delta;
      if (!worst || maxStep < worst.maxStep) worst = { sample: s, maxStep };
    } else if (delta > 1e-9) {
      late++;
      overshoots.push(delta);
    } else {
      exact++;
    }
    byFeel.set(s.feel, bucket);
  }

  console.log(`Riffs measured: ${corpus.length}`);
  console.log(
    `  loops EARLY (rushed turnaround): ${early}  (${pct(early, corpus.length)})`,
  );
  console.log(`  loops LATE  (swing overhang):    ${late}  (${pct(late, corpus.length)})`);
  console.log(`  exactly ${EXPECTED_STEPS} steps:              ${exact}  (${pct(exact, corpus.length)})`);

  if (shortfalls.length) {
    shortfalls.sort((a, b) => a - b);
    const mean = shortfalls.reduce((a, b) => a + b, 0) / shortfalls.length;
    const p50 = percentile(shortfalls, 50);
    const p90 = percentile(shortfalls, 90);
    const max = shortfalls[shortfalls.length - 1];
    console.log(`\n  Shortfall when early (16th-note steps): mean ${mean.toFixed(2)}, p50 ${p50.toFixed(2)}, p90 ${p90.toFixed(2)}, max ${max.toFixed(2)}`);
    for (const bpm of [80, 110, 140]) {
      const msPerStep = (60 / bpm / STEPS_PER_BEAT) * 1000;
      console.log(
        `    @${bpm} bpm: mean ${(mean * msPerStep).toFixed(0)}ms, p90 ${(p90 * msPerStep).toFixed(0)}ms, max ${(max * msPerStep).toFixed(0)}ms cut from the turnaround`,
      );
    }
  }
  if (overshoots.length) {
    overshoots.sort((a, b) => a - b);
    console.log(
      `\n  Overhang when late: mean ${(overshoots.reduce((a, b) => a + b, 0) / overshoots.length).toFixed(3)} steps, max ${overshoots[overshoots.length - 1].toFixed(3)} steps (swing offset on a final off-beat)`,
    );
  }

  console.log("\n  By feel:");
  for (const [feel, b] of byFeel) {
    const avg = b.early ? (b.sumShort / b.early).toFixed(2) : "-";
    console.log(
      `    ${feel.padEnd(10)} early ${String(b.early).padStart(3)}/${b.n}  (${pct(b.early, b.n)})   mean shortfall ${avg} steps`,
    );
  }

  if (worst) {
    const w = worst;
    console.log(
      `\n  Worst case: ${w.sample.feel}/${w.sample.level}/${w.sample.key} seed=${w.sample.riff.seed} ends at step ${w.maxStep.toFixed(2)} of ${EXPECTED_STEPS} ` +
        `(${((1 - w.maxStep / EXPECTED_STEPS) * 100).toFixed(0)}% of the riff's final bar is missing)`,
    );
  }

  // Metronome beat-count error inherits the same maxStep.
  let wrongBeats = 0;
  const beatErrors = new Map<number, number>();
  for (const s of corpus) {
    const maxStep = totalStepsBefore(s.events);
    const beats = Math.max(1, Math.round(maxStep / STEPS_PER_BEAT));
    if (beats !== 16) {
      wrongBeats++;
      beatErrors.set(beats, (beatErrors.get(beats) ?? 0) + 1);
    }
  }
  console.log(
    `\n  Metronome beat count (AudioEngine.ts round(totalDurationS/secPerBeat)): wrong on ${wrongBeats}/${corpus.length} (${pct(wrongBeats, corpus.length)}) — should always be 16.`,
  );
  if (beatErrors.size) {
    const dist = [...beatErrors.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([beats, n]) => `${beats} beats x${n}`)
      .join(", ");
    console.log(`    distribution: ${dist}`);
  }

  // --- AFTER the fix ---
  let derivedOk = 0;
  let explicitOk = 0;
  let derivedWrong: Sample[] = [];
  for (const s of corpus) {
    // Screens now pass riff.bars.length; the derivation is the fallback for
    // callers that only have events (e.g. a re-based single-bar loop).
    if (totalStepsFixed(s.events, s.riff.bars.length) === EXPECTED_STEPS) explicitOk++;
    if (totalStepsFixed(s.events) === EXPECTED_STEPS) derivedOk++;
    else derivedWrong.push(s);
  }
  console.log("\n  AFTER FIX (AudioEngine.totalStepsFor):");
  console.log(
    `    with explicit bars (what the screens pass): ${explicitOk}/${corpus.length} correct (${pct(explicitOk, corpus.length)})`,
  );
  console.log(
    `    derived from events (fallback path):        ${derivedOk}/${corpus.length} correct (${pct(derivedOk, corpus.length)})`,
  );
  if (derivedWrong.length) {
    console.log(
      `    derivation misses ${derivedWrong.length} riff(s) — their final bar has no note onsets, which events alone cannot reveal. Explicit bars covers them.`,
    );
  }
  // Single-bar loops (Explore/Create bar tiles) re-base steps to 0-15.
  const barLoopOk = corpus.every((s) => {
    const bar = s.events.filter((e) => e.step >= 48).map((e) => ({ ...e, step: e.step - 48 }));
    return bar.length === 0 || totalStepsFixed(bar, 1) === STEPS_PER_BAR;
  });
  console.log(
    `    single-bar loop length: ${barLoopOk ? "16 steps on every riff — correct" : "WRONG"}`,
  );
  console.log(
    `    metronome beats: totalSteps / 4 is exact by construction — no rounding left to be wrong.`,
  );
}

// ---------------------------------------------------------------------------
// A4 — unbounded ToneBank cache

function measureA4(corpus: Sample[]): void {
  console.log("\n\n=== A4 · ToneBank cache growth (unbounded) ===");

  // Verify the byte model against the real synth before quoting MB.
  const probe: ToneSpec = { midiNote: 40, velocity: 0.7, guitarString: "E" };
  const real = synthesizeTone({
    midiNote: probe.midiNote,
    durationMs: ringMsFor(probe),
    velocity: 0.5,
    guitarString: "E",
    sustainTailMs: 0,
  });
  const predicted = bytesFor(probe);
  const actual = real.left.length * CHANNELS * BYTES_PER_SAMPLE;
  console.log(
    `Byte model check: predicted ${predicted} B/buffer, real synth ${actual} B ` +
      `(${actual === predicted ? "MATCH" : "MISMATCH — RING_MS in this script has drifted from toneBank.ts"})`,
  );
  console.log(
    `  ${(predicted / 1024 / 1024).toFixed(2)} MB per low-string buffer (3.5s MONO float32 @ ${SAMPLE_RATE}Hz), ` +
      `was ${((predicted * CHANNELS_BEFORE) / CHANNELS / 1024 / 1024).toFixed(2)} MB stereo before the A4 fix; ` +
      `mute buffers ${(bytesFor({ ...probe, technique: "mute" }) / 1024 / 1024).toFixed(2)} MB\n`,
  );

  const cache = new Map<string, number>(); // key -> bytes
  const milestones = new Set([1, 5, 10, 25, 50, 100, 200, 400, corpus.length]);
  const perRiffNew: number[] = [];

  console.log("Cumulative cache after N riffs played (cold start, never evicted):");
  console.log("   riffs   entries      MB   (was, stereo)   new entries/riff");
  corpus.forEach((s, i) => {
    let before = cache.size;
    for (const e of s.events) {
      const spec = eventToneSpec(e);
      const k = toneKey(spec);
      if (!cache.has(k)) cache.set(k, bytesFor(spec));
    }
    perRiffNew.push(cache.size - before);
    const n = i + 1;
    if (milestones.has(n)) {
      const bytes = [...cache.values()].reduce((a, b) => a + b, 0);
      const recentNew = perRiffNew.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, n);
      console.log(
        `  ${String(n).padStart(6)}  ${String(cache.size).padStart(8)}  ${mb(bytes).padStart(6)}   ${("(" + mb((bytes * CHANNELS_BEFORE) / CHANNELS) + ")").padStart(11)}   ${recentNew.toFixed(1).padStart(10)} (last 10)`,
      );
    }
  });

  const totalBytes = [...cache.values()].reduce((a, b) => a + b, 0);
  console.log(
    `\n  ${corpus.length} riffs across ${FEELS.length} feels x ${LEVELS.length} levels x ${KEYS.length} keys -> ${cache.size} distinct buffers = ${mb(totalBytes)} MB resident ` +
      `(was ${mb((totalBytes * CHANNELS_BEFORE) / CHANNELS)} MB before the mono fix).`,
  );

  // Single-riff and single-session cost.
  const firstRiffKeys = new Set(corpus[0].events.map((e) => toneKey(eventToneSpec(e))));
  console.log(
    `  A single riff needs ${firstRiffKeys.size} distinct buffers (~${mb([...firstRiffKeys].length * predicted)} MB) on a cold cache.`,
  );

  // Growth rate late in the session — is it saturating or still climbing?
  const tail = perRiffNew.slice(-Math.min(50, perRiffNew.length));
  const tailAvg = tail.reduce((a, b) => a + b, 0) / tail.length;
  console.log(
    `  Still adding ${tailAvg.toFixed(1)} new buffers/riff (~${((tailAvg * predicted) / 1024 / 1024).toFixed(2)} MB/riff) after ${corpus.length - tail.length} riffs — ` +
      `${tailAvg < 0.5 ? "close to saturated" : "NOT saturated; growth continues"}.`,
  );

  // Reachable ceiling: every note the generator can produce, every layer.
  const allKeys = new Set<string>();
  let ceilingBytes = 0;
  for (const s of corpus) {
    for (const e of s.events) {
      const spec = eventToneSpec(e);
      for (const v of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        const k = toneKey({ ...spec, velocity: v });
        if (!allKeys.has(k)) {
          allKeys.add(k);
          ceilingBytes += bytesFor(spec);
        }
      }
    }
  }
  console.log(
    `  Ceiling if velocity jitter eventually hits all 5 layers for these notes: ${allKeys.size} buffers = ${mb(ceilingBytes)} MB.`,
  );

  // Layer spread actually observed — how much of the growth is jitter?
  const byNoteTech = new Map<string, Set<string>>();
  for (const k of cache.keys()) {
    const [midi, layer, tech, str] = k.split("_");
    const group = `${midi}_${tech}_${str}`;
    if (!byNoteTech.has(group)) byNoteTech.set(group, new Set());
    byNoteTech.get(group)!.add(layer);
  }
  const multiLayer = [...byNoteTech.values()].filter((set) => set.size > 1).length;
  const avgLayers =
    [...byNoteTech.values()].reduce((a, s) => a + s.size, 0) / byNoteTech.size;
  console.log(
    `  Velocity-layer duplication: ${byNoteTech.size} distinct (note,technique,string) combos held at ${avgLayers.toFixed(2)} layers each; ` +
      `${multiLayer} (${pct(multiLayer, byNoteTech.size)}) are cached at 2+ layers.`,
  );

  // What would an LRU cap actually cost? A miss = one synthesizeTone() on the
  // next play of that riff, i.e. it converts memory into A8 latency.
  console.log("\n  LRU cap simulation over the same 400-riff session:");
  console.log("    cap   peak MB   re-synths   misses/riff   riffs fully warm");
  for (const cap of [16, 32, 48, 64, 96, 128]) {
    const lru = new Map<string, number>(); // key -> bytes, insertion = recency
    let misses = 0;
    let peak = 0;
    let fullyWarm = 0;
    corpus.forEach((s, i) => {
      const keys = new Set(s.events.map((e) => toneKey(eventToneSpec(e))));
      let riffMisses = 0;
      for (const e of s.events) {
        const spec = eventToneSpec(e);
        const k = toneKey(spec);
        if (lru.has(k)) {
          const b = lru.get(k)!;
          lru.delete(k); // refresh recency
          lru.set(k, b);
        } else {
          misses++;
          riffMisses++;
          lru.set(k, bytesFor(spec));
          while (lru.size > cap) lru.delete(lru.keys().next().value as string);
        }
      }
      if (riffMisses === 0 && i > 0) fullyWarm++;
      void keys;
      peak = Math.max(peak, [...lru.values()].reduce((a, b) => a + b, 0));
    });
    console.log(
      `    ${String(cap).padStart(3)}   ${mb(peak).padStart(7)}   ${String(misses).padStart(9)}   ${(misses / corpus.length).toFixed(2).padStart(11)}   ${pct(fullyWarm, corpus.length - 1).padStart(16)}`,
    );
  }
  console.log(
    `    (unbounded, for comparison: ${mb(totalBytes)} MB peak, ${cache.size} re-synths, 0 misses after first play)`,
  );
}

// ---------------------------------------------------------------------------
// A8 — first-play latency on an uncached riff

function measureA8(corpus: Sample[], synthSamples: number): void {
  console.log("\n\n=== A8 · Cold-cache synthesis cost (first play) ===");
  console.log(
    "NODE timings — order-of-magnitude and RELATIVE cost only. Hermes on an\n" +
      "A-series device will differ; this does NOT give the on-device number.\n",
  );

  const perRiff: number[] = [];
  const perTone: number[] = [];
  let totalTones = 0;
  let audioSecondsRendered = 0;

  const sampled = corpus.slice(0, Math.min(synthSamples, corpus.length));
  for (const s of sampled) {
    const specs = new Map<string, ToneSpec>();
    for (const e of s.events) {
      const spec = eventToneSpec(e);
      const k = toneKey(spec);
      if (!specs.has(k)) specs.set(k, spec);
    }
    const start = process.hrtime.bigint();
    for (const spec of specs.values()) {
      const t0 = process.hrtime.bigint();
      synthesizeMono({
        midiNote: spec.midiNote,
        durationMs: ringMsFor(spec),
        velocity: [0.1, 0.3, 0.5, 0.7, 0.9][["pp", "p", "mf", "f", "ff"].indexOf(velocityToLayer(spec.velocity))],
        technique: spec.technique,
        guitarString: spec.guitarString,
        sustainTailMs: 0,
      });
      perTone.push(Number(process.hrtime.bigint() - t0) / 1e6);
      audioSecondsRendered += ringMsFor(spec) / 1000;
    }
    perRiff.push(Number(process.hrtime.bigint() - start) / 1e6);
    totalTones += specs.size;
  }

  perTone.sort((a, b) => a - b);
  perRiff.sort((a, b) => a - b);
  const meanTone = perTone.reduce((a, b) => a + b, 0) / perTone.length;
  const meanRiff = perRiff.reduce((a, b) => a + b, 0) / perRiff.length;

  console.log(`Riffs timed: ${sampled.length}   distinct tones synthesized: ${totalTones}`);
  console.log(
    `  per tone:  mean ${meanTone.toFixed(1)}ms, p50 ${percentile(perTone, 50).toFixed(1)}ms, p90 ${percentile(perTone, 90).toFixed(1)}ms, max ${perTone[perTone.length - 1].toFixed(1)}ms`,
  );
  console.log(
    `  per riff (synth only): mean ${meanRiff.toFixed(0)}ms, p50 ${percentile(perRiff, 50).toFixed(0)}ms, p90 ${percentile(perRiff, 90).toFixed(0)}ms, max ${perRiff[perRiff.length - 1].toFixed(0)}ms`,
  );

  const synthMs = perTone.reduce((a, b) => a + b, 0);
  console.log(
    `  throughput: ${(audioSecondsRendered / (synthMs / 1000)).toFixed(0)}x realtime ` +
      `(${(synthMs / audioSecondsRendered).toFixed(1)}ms of CPU per second of audio rendered)`,
  );

  const meanTonesPerRiff = totalTones / sampled.length;
  console.log(
    `  ToneBank.ensure() also awaits setTimeout(0) after EVERY clip: +${meanTonesPerRiff.toFixed(1)} event-loop yields per cold riff ` +
      `(>=1ms each in RN, so >=${meanTonesPerRiff.toFixed(0)}ms on top of synthesis).`,
  );
  console.log(
    `  Estimated cold first-play delay in Node terms: ~${(meanRiff + meanTonesPerRiff).toFixed(0)}ms mean / ~${(percentile(perRiff, 90) + meanTonesPerRiff).toFixed(0)}ms p90, ` +
      `vs the H-phase <150ms target. Warm replay is ~0ms (cache hit, no yields).`,
  );
  console.log(
    `  A8 FIX: this cost is now paid on riff DISPLAY, not on the play tap — Today, Create,\n` +
      `  Explore and the Library detail sheet all call audio.prepare() when the riff changes,\n` +
      `  and the warm-up cancels itself if the user taps play mid-way.`,
  );
}

// ---------------------------------------------------------------------------
// A6 — timers never pruned while looping

function measureA6(corpus: Sample[]): void {
  console.log("\n\n=== A6 · this.timers growth during a long loop ===");

  const stepsPerRiff =
    corpus.reduce((a, s) => a + new Set(s.events.map((e) => e.step)).size, 0) / corpus.length;
  console.log(
    `Timers pushed per loop iteration = distinct steps (playhead callbacks) + 1 loop timer = ~${(stepsPerRiff + 1).toFixed(1)}`,
  );
  console.log("  (cleared only by clearTimers() on stop/finish)\n");
  console.log("   bpm   riff len   iters/30min   dead timer IDs held");
  for (const bpm of [80, 110, 140]) {
    const riffS = (EXPECTED_STEPS * 60) / bpm / STEPS_PER_BEAT;
    const iters = Math.floor((30 * 60) / riffS);
    const timers = Math.round(iters * (stepsPerRiff + 1));
    console.log(
      `  ${String(bpm).padStart(4)}   ${riffS.toFixed(1)}s      ${String(iters).padStart(6)}        ${timers.toLocaleString("en-US").padStart(8)}`,
    );
  }
  console.log(
    "\n  Array of ints — the memory itself is small (~8 B each, well under 1 MB);\n" +
      "  the real cost is clearTimers() iterating the whole array on stop. Low severity confirmed.",
  );
}

// ---------------------------------------------------------------------------

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  console.log("F1 audio audit — offline measurements (A4, A5, A6, A8)");
  console.log(`Corpus: ${args.riffs} riffs, seed base ${args.seed}\n`);

  const t0 = Date.now();
  const corpus = buildCorpus(args.riffs, args.seed);
  console.log(`Generated ${corpus.length} riffs in ${Date.now() - t0}ms.`);

  measureA5(corpus);
  measureA4(corpus);
  measureA8(corpus, args.synthSamples);
  measureA6(corpus);
  console.log("");
}

main();

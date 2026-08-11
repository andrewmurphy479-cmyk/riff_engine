# F1 audio audit — offline measurements

Run: `npm run audit:audio` (source: `tools/audioAudit.ts`).
Date: 2026-08-11. Baseline commit: `990d964`. Corpus: 400 riffs, seed base 90210,
spread across 4 feels × 3 levels × 7 keys, generated through the app's real
`generateSafe` → `riffSpecToEvents` path and keyed with the real private
`ToneBank.key()`.

These cover the audit findings that need no device: **A4, A5, A6, A8**.
A1/A2/A7 are device-only. **A3** now self-reports — `playbackGraph.ts` logs
`[audio] sampleRate: …` at init, visible in the Metro console on next launch.

---

## A5 — Loop length is wrong on half of all riffs · **confirmed, worse than estimated**

The engine ends an iteration at `max(step + swingOffset + duration)` instead of
the riff's 64-step bar count. Every riff in the corpus is exactly 4 bars, so 64
is the correct baseline.

| Outcome | Riffs | Share |
|---|---|---|
| Loops **early** (rushed turnaround) | 144 | **36.0%** |
| Loops **late** (swing overhang) | 52 | 13.0% |
| Correct (exactly 64 steps) | 204 | 51.0% |

Shortfall when early: mean **2.06 steps**, p90 2.00, max 4.00 (a full beat).

| Tempo | mean cut | p90 | max |
|---|---|---|---|
| 80 bpm | 385 ms | 375 ms | 750 ms |
| 110 bpm | 280 ms | 273 ms | 545 ms |
| 140 bpm | 220 ms | 214 ms | 429 ms |

Swung riffs are worst hit (`laid_back` 49%, `bouncy` 47%, vs `driving`/`heavy`
24% each). The 13% that loop *late* overhang by only ~0.38 steps (≈50 ms) —
a swing offset on a final off-beat note; audible as a slightly slack seam
rather than a rush.

**Metronome inherits it:** `Math.round(totalDurationS / secPerBeat)` yields
**15 beats instead of 16 on 1.0%** of riffs — one missing click per loop.

Only half the catalogue loops in time. Fix is arithmetic: derive
`totalDurationS` from `bars.length × 16 × secPerStep` and hard-code the
metronome to 16 beats. Ring tails carry across the seam already, so nothing
else changes.

---

## A4 — Cache growth · **confirmed; the per-buffer estimate was exact, the ceiling is bounded**

Byte model verified against a real `synthesizeTone()` call: **1,234,800 B =
1.18 MB** per low/mid-string buffer (3.5 s × 44.1 kHz × 2 ch × float32); palm
mutes are 0.24 MB. A single riff needs only ~9 distinct buffers (~10.6 MB) cold.

| Riffs played | Entries | Resident |
|---|---|---|
| 1 | 9 | 7.3 MB |
| 10 | 57 | 51.2 MB |
| 25 | 102 | 93.7 MB |
| 50 | 149 | 137.2 MB |
| 100 | 223 | 205.7 MB |
| 400 | 356 | **327.0 MB** |

Correction to the audit's wording: the cache is *never evicted*, but it is not
truly unbounded — the generator only emits MIDI 40–64, so the space saturates.
Growth is down to 0.3 new buffers/riff by riff 350. Ceiling if velocity jitter
eventually touches all 5 layers for those notes: **592 MB**. Still far too much
for a phone, and a realistic heavy session (50–100 riffs) already sits at
137–206 MB of audio buffers alone.

**Velocity layers are the main multiplier:** 136 distinct
(note, technique, string) combos are held at **2.62 layers each**; 72.8% are
cached at 2 or more.

### LRU is the wrong lever

| Cap | Peak | Re-synths | Misses/riff | Riffs fully warm |
|---|---|---|---|---|
| 32 | 35.2 MB | 2067 | 5.17 | 2.3% |
| 64 | 66.8 MB | 1348 | 3.37 | 8.8% |
| 128 | 128.7 MB | 983 | 2.46 | 16.0% |
| ∞ | 327.0 MB | 356 | 0 (after first play) | 100% |

A 64-entry cap trades 260 MB for ~3.4 extra synths per riff — it converts the
memory problem straight into the A8 latency problem, and only 8.8% of riffs
still play warm.

### Cheaper levers, in order

1. **Store mono, pan at playback.** `synthesizeTone` computes a mono signal and
   writes `left[i] = mono[i] * gains.left` / `right[i] = mono[i] * gains.right`
   with static constant-power gains (`KarplusStrong.ts` ~line 381). A
   `StereoPannerNode` fed a mono buffer applies the identical
   `cos/sin((pan+1)/2 · π/2)` law, so this is **bit-identical output at exactly
   half the memory** — 327 MB → 164 MB, zero tonal risk.
2. **Drop 5 velocity layers to 3.** Roughly another 40% off, given the 2.62
   layers/combo measured. Costs some dynamic nuance — worth a listen test.
3. Shorter ring on treble strings is already in place (2.2 s vs 3.5 s).

(1) and (2) together land a 400-riff session near 100 MB with no added latency.
Decide the budget before F2 layers real samples on the same cache.

---

## A8 — Cold first-play cost · **likely under-ranked at MED**

Node timings, `synthesizeTone` only — **order-of-magnitude and relative cost
only**. Hermes on an A-series device will differ and this is *not* the on-device
number.

- Per tone: mean **95.6 ms**, p50 99.8, p90 141.1, max 187.6
- Per riff (9 distinct tones): mean **836 ms**, p90 1240 ms, max 1522 ms
- Throughput: **29× realtime** (34 ms CPU per second of audio rendered)
- Plus `ToneBank.ensure()` awaits `setTimeout(0)` after every clip: ~8.8 yields
  per cold riff, ≥1 ms each in RN

Estimated cold first-play delay: **~845 ms mean / ~1250 ms p90 in Node terms**,
against the H-phase <150 ms target. Warm replay is effectively 0 ms.

`prepareTones()` exists for exactly this and is called from **only**
`components/ChordArmoryReference.tsx:70` — not on riff load in Today or Create.
Calling it when a riff is displayed (rather than when play is tapped) moves the
whole cost off the tap.

Worth noting against history: the reverted ring-length attempt (`34661aa`) was
rejected partly for "play lag." Longer buffers cost proportionally more synth
time, and F1 kept the same 3.5 s rings — so this cost is still present, just
hidden behind the cache after the first play of each riff.

---

## A6 — Timer array · **confirmed LOW, no action needed**

~21.8 timer IDs pushed per loop iteration (distinct playhead steps + 1 loop
timer), cleared only on stop/finish.

| Tempo | Riff length | Iterations/30 min | Dead IDs held |
|---|---|---|---|
| 80 | 12.0 s | 150 | 3,264 |
| 110 | 8.7 s | 206 | 4,483 |
| 140 | 6.9 s | 262 | 5,701 |

An array of integers — under 50 KB even at 140 bpm. The only real cost is
`clearTimers()` walking the whole array on stop. Not worth fixing on its own;
fold it in if that code is touched anyway.

---

## Also observed

`AudioContext` in react-native-audio-api exposes **no `outputLatency` or
`baseLatency`** (checked `lib/typescript/core/BaseAudioContext.d.ts` and
`AudioContext.d.ts`). A7's Bluetooth playhead compensation would need a
measured/hard-coded offset rather than a queryable one.

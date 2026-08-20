# F1 audio audit — offline measurements

Run: `npm run audit:audio` (source: `tools/audioAudit.ts`).
Date: 2026-08-11. Baseline commit: `990d964`. Corpus: 400 riffs, seed base 90210,
spread across 4 feels × 3 levels × 7 keys, generated through the app's real
`generateSafe` → `riffSpecToEvents` path and keyed with the real private
`ToneBank.key()`.

These cover the audit findings that need no device: **A4, A5, A6, A8**.
A1/A2/A7 are device-only. **A3** now self-reports — `playbackGraph.ts` logs
`[audio] sampleRate: …` at init, visible in the Metro console on next launch.

## Status after the fix pass (branch `f1-audio-audit-fixes`)

| # | Finding | Status |
|---|---|---|
| A1 | Audio-session interruptions | **Fixed** — `PlaybackGraph.observeSession` stops on `interruption: began`, revives on `ended` |
| A2 | Background → foreground | **Fixed** — `AppState` listener stops on background, revives the context on active |
| A3 | Context sample rate | **Self-reporting** — reads out in Metro at startup; still needs one launch to answer |
| A4 | Cache memory | **Halved** — mono buffers + `StereoPannerNode`. 327 MB → 163.5 MB at 400 riffs |
| A5 | Loop length | **Fixed** — whole-bar iterations; 100% correct across the corpus, locked by `audio/loopLength.test.ts` |
| A6 | Timer array | **Won't fix** — measured under 50 KB, not worth the churn |
| A7 | Bluetooth latency | **Open** — needs device measurement; the library exposes no `outputLatency`. Re-homed from F2 to land with O1 (guided drill), where the playhead becomes load-bearing |
| A8 | Cold first-play | **Moved off the tap** — screens warm the cache on riff display |
| A9 | Export/live divergence | **Fixed** 2026-08-20 — export renders through the live signal path; shared IR/limiter (`audio/masterChain.ts`) and shared scheduling rules (`audio/timing.ts`) |

Numbers below are the *measured* before/after. Everything except A3 is JS-only;
no rebuild needed.

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

Only half the catalogue loops in time.

**Fixed** in `audio/loopLength.ts` (`totalStepsFor`). A loop iteration is now a
whole number of bars: callers holding a `RiffSpec` pass `bars`, and the
fallback derives the count from note *onsets* so a note ringing past the
barline doesn't buy an extra empty bar. Metronome clicks are now
`totalSteps / 4` — exact, no rounding. Re-measured over the same 400 riffs:

| Path | Correct |
|---|---|
| Explicit `bars` (what every screen passes) | **400/400** |
| Derived from events (fallback) | **400/400** |
| Single-bar loop (Explore/Create bar tiles) | 16 steps on every riff |

The one case derivation still cannot see is a final bar with *no notes at all* —
nothing in an event list marks it — which is why the screens pass `bars`.

---

## A4 — Cache growth · **confirmed; the per-buffer estimate was exact, the ceiling is bounded**

Byte model verified against a real synth call: **1,234,800 B = 1.18 MB** per
low/mid-string buffer (3.5 s × 44.1 kHz × 2 ch × float32); palm mutes 0.24 MB.

**Fixed by storing mono** (see "Cheaper levers" below): 0.59 MB and 0.12 MB.

| Riffs played | Entries | Resident (now) | Was (stereo) |
|---|---|---|---|
| 1 | 9 | 3.6 MB | 7.3 MB |
| 10 | 57 | 25.6 MB | 51.2 MB |
| 25 | 102 | 46.9 MB | 93.7 MB |
| 50 | 149 | 68.6 MB | 137.2 MB |
| 100 | 223 | 102.9 MB | 205.7 MB |
| 400 | 356 | **163.5 MB** | 327.0 MB |

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

1. **Store mono, pan at playback — DONE.** `synthesizeTone` computed a mono
   signal then wrote `left[i] = mono[i] * gains.left` /
   `right[i] = mono[i] * gains.right` with static constant-power gains. A
   `StereoPannerNode` fed a mono buffer applies the identical
   `cos/sin((pan+1)/2 · π/2)` law, so this is **identical output at exactly half
   the memory** — measured 327 MB → 163.5 MB, zero tonal risk. The synth is now
   split into `synthesizeMono` (live path) and `synthesizeTone` (the stereo
   wrapper the offline/export render still uses).
2. **Drop 5 velocity layers to 3.** Not done. Roughly another 40% off, given
   the 2.62 layers/combo measured. Costs some dynamic nuance — worth a listen
   test, and worth deciding *with* the F2 sample budget rather than before it.
3. Shorter ring on treble strings is already in place (2.2 s vs 3.5 s).

With (1) done, a 400-riff browsing session sits at 163.5 MB; adding (2) would
land it near 100 MB. Decide the budget before F2 layers real samples on the
same cache.

---

## A8 — Cold first-play cost · **likely under-ranked at MED**

Node timings, `synthesizeTone` only — **order-of-magnitude and relative cost
only**. Hermes on an A-series device will differ and this is *not* the on-device
number.

Before the fixes (stereo synth):

- Per tone: mean **95.6 ms**, p50 99.8, p90 141.1, max 187.6
- Per riff (9 distinct tones): mean **836 ms**, p90 1240 ms, max 1522 ms
- Throughput: **29× realtime** (34 ms CPU per second of audio rendered)
- Plus `ToneBank.ensure()` awaits `setTimeout(0)` after every clip: ~8.8 yields
  per cold riff, ≥1 ms each in RN

Estimated cold first-play delay: **~845 ms mean / ~1250 ms p90 in Node terms**,
against the H-phase <150 ms target. Warm replay is effectively 0 ms.

After (mono synth — one fewer 617 KB allocation and one fewer 154 k-sample pass
per tone, so much less GC pressure):

- Per tone: mean **36.3 ms**, p90 47.1 — **2.6× faster**
- Per riff: mean **318 ms**, p90 416 ms
- Throughput: **77× realtime**

Still over the 150 ms target, so the cost was also **moved off the play tap**:
Today, Create, Explore and the Library detail sheet now call `audio.prepare()`
when the riff on screen changes. The warm-up is debounced by 350 ms (riffs
scrolled past are never synthesized) and cancels itself if the user taps play
mid-way, since `play()` does its own `ensure()`.

The trade this makes is worth watching on device: synthesis now happens while
the user is *looking* at a riff rather than after they tap play, so if anything
feels janky it will be riff generation/navigation, not the play button.

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
`clearTimers()` walking the whole array on stop. Left as-is.

---

## Also observed

`AudioContext` in react-native-audio-api exposes **no `outputLatency` or
`baseLatency`** (checked `lib/typescript/core/BaseAudioContext.d.ts` and
`AudioContext.d.ts`). A7's Bluetooth playhead compensation would need a
measured/hard-coded offset rather than a queryable one.

Voice nodes were never disconnected after a note finished — pre-existing, but
each voice now builds two nodes (gain + panner) instead of one, so finished
chains are unhooked from the bus in `source.onEnded`.

---

## Device checks for the fixed build

Session handling (A1/A2) is written blind — the behavior is well-defined but
unverified on hardware:

- phone call mid-playback → hang up → play still works
- background mid-riff → return → play still works; Siri; another app's audio
- lock/unlock mid-loop; silent switch (must still sound — `playback` category)
- yank wired headphones / drop Bluetooth mid-playback → stops, doesn't blast
  the phone speaker
- **stereo image unchanged** (mono + panner): low strings left, high right
- metronome clicks still centred and audible
- loop a riff whose last bar ends in a rest → turnaround no longer rushed
- 20+ loops with metronome → no drift; ~30 riffs across keys → Xcode memory
- browsing/generating riffs feels smooth (the A8 warm-up runs there now)
- first-tap vs replay latency; rapid play/stop spam; densest chug at max tempo
- the `[audio] sampleRate:` line in Metro on first launch (A3)

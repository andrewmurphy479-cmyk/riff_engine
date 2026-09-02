# Riffology — Master Plan

*Written 2026-07-14, after a full codebase audit (engine, audio, UI/UX, ship-readiness). Revised 2026-07-18 after Sprints 1–4 — see "The pay-worthiness pivot" below. Revised again 2026-08-20 after F1 — see "The teaching pivot".*

---

## Revision 2026-08-20 — the teaching pivot (F2 deferred)

F1 landed and the listen gate passed, twice: *"sounds soooooooo much better"* after the architecture swap, *"sounding really nice"* after the audit fixes. A follow-up listen confirmed the sound is no longer the thing holding the app back.

**So F2 (real multisampled guitar) is deferred, not cancelled.** It moves to the post-beta bucket alongside A5–A7, to be informed by beta feedback rather than guessed at now. The reasoning:

- **F1 already taught this lesson once.** Choppiness was assumed to be a timbre problem; fixing the architecture made it disappear with the Karplus-Strong timbre untouched. Perceived synthiness plausibly had the same cause, and the listen test is the evidence.
- **F2 is the riskiest item on the roadmap and the only one blocked externally** — it cannot start until a commercial-use-safe multisampled guitar is *found and licensed*. Everything else is a code problem.
- **It reverses work just done.** Audit A4 took resident memory from 327 MB to 163.5 MB with mono buffers; velocity-layered samples push straight back the other way, plus bundle size.
- **Sound is a ceiling on enjoyment; product depth is the reason to subscribe.** With the sound no longer a dealbreaker, Phase G is strictly higher leverage — and it shapes the persisted data model, so it only gets more expensive to retrofit.
- **F2 stays a cheap swap later.** `SynthOptions`/ToneBank already abstract tone production.

**A7 and A9 were parked "with F2" and are re-homed** — the pivot raises both:

- **A9 (export/live divergence) — DONE**, and it was a prerequisite, not a footnote. Exports rendered through a completely different signal path, so sharing a riff (or judging the sound from an export) measured the wrong renderer.
- **A7 (Bluetooth playhead latency) — still open, moves to sit with O1.** Guided practice makes the playhead *load-bearing*: it stops being decoration and becomes the thing telling a learner where the beat is. On Bluetooth, a playhead running ahead of the audio teaches wrong timing. Needs device measurement or a user-facing calibration; the library exposes no `outputLatency`.

**Sprint 6 becomes the teaching sprint** (Phase G, pulled forward). See "Phase G" below for the ranked options and what shipped.

---

## Revision 2026-07-18 — the pay-worthiness pivot

Sprints 1–4 delivered Phases A1–A4 and essentially all of Phase B. The original plan said Sprint 5 = ship infra → TestFlight. **That step is cancelled for now.** The owner's verdict: the app is not yet something people would pay for, and the gaps are, in priority order:

1. **How it sounds (timbre/playback).** Real-time playback is "choppy but clean" — the ring-length fix was reverted (`c641f61`) because the JS-synthesis + one-WAV-per-note + expo-av architecture fundamentally can't do long rings, shared reverb, or sample-accurate chokes. More Karplus-Strong tuning is a dead end; the fix is a real audio engine + recorded samples. This is now **Phase F**, and it goes first.
2. **Not enough product.** A generator + daily streak isn't a subscription by itself. Users need a content ladder — Chord Armory depth, curriculum-style paths. This is now **Phase G**.
3. **Overall polish/feel.** The app should feel finished before anyone is asked to trust it with money. This is now **Phase H**.

Explicitly **not** the gap: riff variety/musicality (A5–A7). Those stay parked until after the beta gate — and A6's bends/slides get dramatically cheaper on the Phase F audio architecture anyway (playbackRate automation).

---

## Where the app stands

**The verdict in one line:** the hard, defensible parts are built and genuinely good — the generation architecture, the Karplus-Strong synth, and the daily-habit loop — but the app currently sounds thinner than its engine deserves, looks less coherent than its design tokens allow, and has *zero* of the ship/operate/monetize layer.

### Grades by area

| Area | Grade | One-line assessment |
|---|---|---|
| Engine architecture | A- | Rhythm-first pipeline (rhythm → scale → structure → playability → techniques) is exactly right; it's what the research audit called for |
| Musical content | C- | 10 rhythm templates, 1 scale, monophonic only, constant velocity 96 — riffs are correct but samey and thin |
| Audio synthesis | A- | 5 velocity layers, body resonance, per-string stereo, reverb, technique rendering — far better than typical JS synth |
| Audio experience | C | No metronome, no count-in, no playhead on Create tab, export built but unwired |
| UI/UX core loop | B | Onboarding → Today → streak loop works and is coherent; Today/onboarding screens are best-in-class |
| Design consistency | C+ | Tokens exist but half the components use raw hex; two card systems; two accent pinks; "Riffology" splash vs "Riff Engine" app |
| Ship infrastructure | F | 1×1 placeholder icon, no eas.json, no notifications, no analytics, no crash reporting, no IAP, no tests, no lint |

### Key discovery: the "rebuild" note is already resolved

`DO THIS NEXT SESSION/READTHIS.txt` says to rebuild the system from the ChatGPT research audit. **That audit critiques the old blueprint engine (deleted in commit 88c005d), and the current `engine/riff/` pipeline already implements its #1 recommendation** (rhythm skeleton first, riff-core as a first-class role). No rebuild needed. What remains from the audit is its *content* wishlist, which is Phase A below: pedal tones, power chords, palm-mute chugs, repeated-note hooks, dynamics.

### The strategic frame

The moat is the generator. A beginner opens this app and either thinks *"whoa, that sounds like a real riff I want to learn"* or *"that sounds like a MIDI exercise."* Everything else — streaks, paywalls, notifications — only compounds if that first 30 seconds lands. So the plan is sequenced: **make it sound undeniable → make practicing it feel great → make people come back → make it shippable → make it money.**

---

## Phase A — Make it sound undeniable (engine + musicality)

*The single highest-leverage phase. Your own feedback notes say "riff gen needs work." Almost every item here has the audio side already built and waiting.*

### A0. Unfreeze the engine + harvest the Python lab (prerequisite)
The golden-fixture harness (`engine/riff/__validate__.ts`) byte-locks the TS engine to the Python reference at `../updated_engine_logic/`. **The TS engine is already ahead of Python** (the level system and `generateSafe` exist only in TS; Python still has the original 10 templates and no levels), so the parity relationship is inverted: Python is now the stale copy. Every musical improvement breaks the fixtures.
- [x] Declare TS the source of truth. Retire Python byte-parity (`__validate__.ts` deleted); `updated_engine_logic/` is an archived reference.
- [x] Property tests (`engine/riff/__tests__/generate.test.ts`, vitest): generateSafe never throws; stretch limits; scale membership; bar 3 === bar 1; bar 4 ends on root; level caps; velocity range; mute placement; pedal chug invariant; determinism; template coverage.
- [x] Snapshot corpus: 45 riffs (3 seeds × 5 feels × 3 levels) in `__fixtures__/corpus.json`; `npm run corpus:regen` for deliberate changes.
- [x] `metrics.py` ported → `engine/riff/metrics.ts` (+ technique/velocity fingerprints, text report renderer).
- [x] Batch-listening harness: `npm run batch` (`tools/batch.ts`) → ASCII tabs + variety report + WAVs via `audio/offlineRender.ts`, the same render path as the app's exporter (AudioExporter now delegates to it).

### A1. Dynamics & accents (cheapest, biggest audible win)
Velocity is hardcoded to 96 (`generate.ts:96`) while the synth has **five velocity layers sitting unused**.
- [x] Accent + ghost maps hand-authored on every rhythm template (`accents`/`ghosts` fields in `rhythm.ts`).
- [x] Per-feel dynamic character via `FEEL_DYNAMICS` — values chosen to cross the pp/p/mf/f/ff sample-layer boundaries so dynamics change timbre, not just volume; `laid_back` never reaches ff, `heavy` spans p→ff.
- [x] Seeded ±3 velocity humanization inside `generate` (keeps riffs deterministic per seed).

### A2. Palm-mute chugs (the "sounds like guitar" moment)
`mute` is in the Technique union and **the synth already renders a convincing palm-mute chug** (`techniqueParams` in KarplusStrong) — the engine just never emits it.
- [x] `tagMutes` pass palm-mutes unaccented short low-string notes for `heavy`/`driving` (always on pedal templates, chance-based otherwise); accent hits ring through.
- [x] 4 pedal-tone chug templates (highway_chug, gallop_drive, doom_chug, thunder_gallop) with pedal-aware melody fill (root chug + color-note stabs on accents) and pedal-aware A′ mutation; pedal templates get a note-cap bonus since repeated positions are easy to play. Bonus: porch_swing fills the beginner-bouncy gap.

### A3. Power chords / double stops (polyphony)
Engine is strictly monophonic; **the audio engine already handles simultaneous notes** (polyphony scaling, 12ms strum stagger, one voice per string).
- [x] Bar model carries 2 notes per step (root+5th diad; root+octave) — `engine/riff/diads.ts` pass after mute tagging.
- [x] Diads on accented strong beats for `heavy`/`driving` (per-riff seeded roll: heavy 0.85, driving 0.6); beginner gets a single power-chord landing on the riff's final hit; bar 3 always mirrors bar 1's diads so the hook reads identically. Muted roots produce muted diads (chugged power chords).
- [x] `RiffTabView`/`RiffFretboardView` render stacked frets natively (fretboard already had chord ordinals); notes/bar readouts count hits, not stacked notes.
- [x] Playability: diad grips are fixed (+2 frets, one/two strings up, 4ths-tuned strings only), validated as a unit — each addition re-runs the full-riff stretch check and is dropped if it breaks the level limit. Harmony notes stay inside the riff's scale (no fifths above the 5/blue degrees).

### A4. Rhythm template expansion + swing
10 templates, badly imbalanced (driving 4, bouncy 2 — and a beginner in bouncy has exactly **1**).
- [x] 27 templates, min 4 per feel *after* the beginner filter (property-tested).
- [x] Per-template `swing` flag on `bouncy`/`laid_back` templates; ratio seeded per riff (0.57–0.62) into `RiffSpec.swing`, carried as per-event `swingOffset` in `toEvents` so app playback, bar loops, WAV export, and batch audits all swing identically (grid `step` stays straight for views/playhead).
- [x] Syncopation-forward templates: rest-on-1 (`rest_on_one`, `offbeat_strut`), push (`redline_push`), full gallop for heavy at intermediate+ (`full_gallop`).

> **Status 2026-07-18:** A1–A4 shipped (Sprints 1–2). A5–A7 below are **parked** — the owner's verdict is that riff variety is not the pay-worthiness gap. Revisit after the beta gate. Note: A6 (bends/slides) becomes much cheaper once Phase F's Web Audio path lands — pitch glides are playbackRate automation instead of new synthesis code.

### A5. Scale & key color
One scale (minor pentatonic + optional b5), and intermediate players get the same 5 notes as beginners.
- [ ] Add natural minor (Aeolian), major pentatonic, full blues scale; feel→scale affinity (heavy→minor/aeolian, bouncy→major pent option, laid_back→major pent/mixolydian color).
- [ ] Give intermediate a blue-note chance (currently 0 — intermediate has no melodic color distinction from beginner at all).
- [ ] Widen the MIDI window by level (beginner stays 40–64; advanced up to ~76) so advanced riffs can live above the 5th fret.

### A6. Expressive techniques at higher levels
`bend` renders in the synth but is never generated; slides don't exist.
- [ ] Emit `bend` at advanced (b3→3-ish curl on phrase peaks; the synth already brightens/shortens bent notes).
- [ ] Add `slide` to the Technique union + a portamento render in KarplusStrong (pitch-glide over the first ~60ms is enough).
- [ ] Level-gate articulation density: beginner = plucks only, intermediate = hammer/pull, advanced = + bends/slides.

### A7. Structure variety (later in phase)
- [ ] Activate the AABA/ABAB/AAAB structures already defined in `display.ts` (currently dead config) — pick per feel/seed.
- [ ] Call-and-response bar B option: rest-heavy answer phrase instead of dense variation.

**Exit criteria for Phase A:** generate 10 riffs per feel; a guitarist listens blind and says "these sound like riffs, not exercises." Feels sound *different from each other* with eyes closed.

---

## Phase B — Make practicing feel great (UX + audio experience)

### B1. Playback experience (highest priority in phase)
- [x] **Playhead on the Create tab.** `onStepPlay` callback already exists and Explore uses it; Create's `RiffTabView` renders static tab with no cursor. Wire it through — this is table stakes for a practice app.
- [x] **Count-in + metronome.** Synthesize a click (two pitched ticks — the KS synth or a simple sine burst), 1-bar count-in before play, optional click during playback. Already on your Ideas list.
- [x] **Live tempo.** Tempo change currently requires stop/replay. At minimum, restart seamlessly on tempo change; ideally recompute schedule live.
- [x] Explore tab: add full-riff playback (currently the prominent play tile plays only the selected bar — confusing).

### B2. Share/export (built and unwired — a free viral loop)
`AudioExporter.exportToWav` is complete (reverb, compression, normalization) and `expo-sharing` is installed. **No UI calls either.**
- [x] Add "Share riff" to Create + Library: renders WAV → share sheet. Watermark idea for later: a spoken/tag audio bumper for free tier.
- [ ] Stretch: share a riff *card* (image of the tab + branding) alongside audio — image shares travel further than audio files.

### B3. Design system consolidation
- [x] One card style: promoted `#12121e` into the theme as `colors.cardSolid`; RiffTabView, RiffContextCard, RiffBarMetaStrip, ExploreIntroCard all use it.
- [x] One accent: `#FF4E78` promoted to `colors.heart` (+`heartBg`/`heartBorder`) for save/remove affordances; `colors.error` reserved for failure states.
- [ ] Adopt `typography`/`spacing` tokens in the ~6 components using raw values. *(Remaining: raw fontSize/paddings persist in several components — low-risk cleanup, fold into future touches.)*
- [x] Decide on `components/ui/` kit: deleted the orphaned `Button`/`Card`/`ChipSelector`/`Slider` (never imported); kept `MetaPair` (used by RiffBarMetaStrip).
- [x] Replace the `Alert.alert` bar-tap menu on Create with a designed bottom sheet (`components/BarActionSheet.tsx`).
- [x] Replace text glyphs (`▶`/`■`) in Library/Armory with Ionicons like everywhere else.

### B4. Branding & first impression
- [x] **Pick the name.** Decision (2026-07-18): the app is **RIFFOLOGY**. app.json name, Create-tab header, and settings footer all say Riffology; the orange RIFFOLOGY splash is the brand mark, and the native splash background matches its `#0d0805`.
- [x] ~~Cut the cold-start animation for returning users.~~ Reverted by request — the full Riffology splash animation plays on every launch; it's part of the brand.
- [x] Convert `RiffologyLoadingScreen.js` → TS (`components/RiffologyLoadingScreen.tsx`); no .js source files remain.

### B5. Settings screen (missing entirely)
- [x] New route: `app/settings.tsx` (modal, gear in Today's header) — profile (level/genres, redo setup via `resetOnboarding()`), audio prefs (metronome/count-in switches), version, privacy-policy link (placeholder URL), "restore purchases" placeholder for Phase E.

### B6. Feel & accessibility
- [x] `expo-haptics` (`lib/haptics.ts` wrappers): light impact on play/stop/share/new, selection ticks on chips/steppers/locks/toggles, success notification when a mark-done completes the daily goal.
- [x] `accessibilityLabel`/`Role` on all icon-only controls (play/stop, done checks, locks, tempo ±, closes, chord card, settings gear, explore tiles).

---

## Phase C — Make them come back (retention loop)

- [ ] **Push notifications** (`expo-notifications`): daily practice reminder at user-chosen time (ask during onboarding or after first completed session — *after* the win, when goodwill is highest); streak-at-risk nudge in the evening if today is incomplete.
- [ ] **Streak insurance:** one freeze/week (earned by completing all 4 riffs) — Duolingo's single best retention mechanic, trivial to add to `usePracticeStore`.
- [ ] **Weekly recap card:** minutes, riffs practiced, streak — shareable image (compounds with B2).
- [ ] **Practice history calendar** on Today or a stats detail screen (data already tracked: `daysPracticed`, day-keys).
- [ ] **Level velocity:** after N sessions at high completion, suggest level-up (from your next-features notes).
- [ ] Vary the daily session recipe: e.g., 1 riff from your best feel, 2 from preferred, 1 "stretch" riff one level up — gives sessions narrative ("today's stretch riff").
- [ ] **Overflow rewards** (user request 2026-07-18): completing riffs beyond the daily goal currently earns nothing — the session has a built-in stopping point right where momentum peaks. Ideas: bonus riffs appear after goal met ("keep going?" + fresh riff), an overflow counter on the goal card ("4/4 +2"), weekly bonus-riff tally feeding the recap card, and/or streak insurance earned via overflow (ties into the freeze mechanic above).

---

## Phase D — Make it shippable (infrastructure)

*Mostly parallelizable with B/C. Ordered by "blocks submission" first.*

### D1. Store-submission blockers
- [ ] Real app icon + splash (currently a **1×1-pixel placeholder PNG** wired to icon, splash, adaptive icon, and favicon).
- [ ] Remove `NSAllowsArbitraryLoads: true` from app.json (App Review flag; app makes no network calls).
- [ ] `eas.json` with dev/preview/production profiles; set `ios.buildNumber` / `android.versionCode` strategy.
- [ ] Run `npx expo install --check` — expo-av `~14.0.7` looks stale against SDK 54.

### D2. Migrate expo-av → expo-audio — **superseded by Phase F1**
expo-av is deprecated and **removed in SDK 55**. The original plan was a like-for-like migration to expo-audio; Phase F1 instead replaces the whole playback layer with `react-native-audio-api`, after which expo-av should be *removed entirely* (its remaining uses — `SamplePlayer`, `setAudioModeAsync` — all have equivalents in the new stack). The two sub-items fold into F1:
- [ ] Fix init swallowing failures (`catch` must not mark audio initialized → silent no-op audio).
- [ ] Tone/sample cache that persists across launches (moot for buffers loaded from bundled sample assets, but keep it for any synthesized fallback).

### D3. Observability
- [ ] Sentry (`sentry-expo`): crash reporting + an app-level ErrorBoundary (none exists).
- [ ] Analytics (PostHog or Amplitude). Core taxonomy: `onboarding_step`, `onboarding_complete`, `riff_generated` (feel/key/level), `riff_played`, `riff_saved`, `riff_shared`, `session_riff_done`, `daily_goal_met`, `streak_continued/lost`, `notification_opened`. Without this, Phase E pricing/paywall decisions are guesses.

### D4. Safety net
- [ ] Jest + the Phase A0 engine property tests; store migration tests (v8 chain in `useNewRiffStore` is good — test it).
- [x] **Add a `migrate` + version bump to `usePracticeStore`** — done in Sprint 2, before A3 landed: v2 migrate validates the persisted session structurally (drops it if unparseable), and `ensureTodaySession` re-validates on every launch so a stale-shape session is rebuilt instead of trusted.
- [ ] ESLint + Prettier + `typecheck`/`lint`/`test` scripts; GitHub Actions CI on push.
- [ ] README for the mobile app; move the Python prototype out of the app repo (or to `/prototype`).

---

## Phase E — Make it money (monetization + launch)

- [ ] **RevenueCat** (`react-native-purchases`) — monthly + annual (annual anchored ~40% off), 7-day trial on annual.
- [ ] **Free/Pro split** (keep the free daily habit intact — the streak IS the retention engine; never paywall the streak):
  - Free: daily session (4 riffs), beginner+intermediate, limited feels (2), limited regens/day, save cap (~10).
  - Pro: all feels/keys/levels/scales, unlimited generation + re-rolls, bar locks, audio/card export, streak insurance, (Phase 4 curriculum later).
- [ ] Paywall placement: after first completed daily session (post-win), on hitting a gate (locked feel, regen limit), from Settings. Never before first riff sound.
- [ ] Store listing: screenshots (Today with streak, tab view + playhead, fretboard explore, chord armory), preview video with *actual generated audio*, ASO around "guitar practice," "guitar riffs," "learn guitar riffs."
- [ ] Privacy policy + support page (one static site).
- [ ] TestFlight/internal beta with ~10–20 guitarists **at the end of Phase B** — before building more retention/monetization on unvalidated sound. Their blind reaction to Phase A output is the go/no-go.

---

## Phase F — Make it sound real (audio fidelity rewrite) *(added 2026-07-18)*

*The ceiling on everything musical. The choppiness post-mortem (2026-07-17/18) proved the current architecture — JS-thread Karplus-Strong synthesis → one base64 WAV per note → expo-av clip players — cannot deliver: per-clip baked reverb stacks wet tails, bridge-latency volume ramps can't choke cleanly, and pre-generation cost scales with clip length (the reverted ring-length fix lagged the play button for seconds). Architecture first, timbre second, so failures are attributable.*

### F1. Playback architecture: Web Audio via `react-native-audio-api` — **DONE** (Sprint 5, `98c0cab`; audit fixes `6f8f329` + `5035506`)
Software Mansion's [react-native-audio-api](https://docs.swmansion.com/react-native-audio-api/) — a Web Audio API implementation for React Native, active, with an [Expo config plugin](https://docs.swmansion.com/react-native-audio-api/docs/other/audio-api-plugin/). Requires an **Expo dev build** (not Expo Go) — which drags `eas.json` + the dev-build workflow (part of D1) forward as a side effect.
- [ ] Add the plugin, set up EAS dev builds (iOS first), verify the audio session/silent-switch behavior `setAudioModeAsync` used to handle.
- [ ] New playback core: tones decoded once into `AudioBuffer`s; notes scheduled as `AudioBufferSourceNode`s on the audio clock (no per-note WAV writes, no `setTimeout` scheduling).
- [ ] **Shared** effects at the graph level — one reverb (ConvolverNode or equivalent) + one compressor on the master bus, not baked per clip. This is what makes long natural rings viable (the reverted `34661aa` idea, on an architecture that can do it).
- [ ] Sample-accurate gain-envelope chokes on same-string re-onset; ring-length decays restored.
- [ ] Re-wire metronome, count-in, live tempo, and the `onStepPlay` playhead to the audio clock (it's a better clock than the current one anyway).
- [ ] Fix the old D2 items: init must not swallow failures into silent no-op audio.
- [ ] Keep the KS *timbre* this sprint — same sound source, new scheduling/mixing. **Gate: on-device listen** (post-mortem lesson: offline RMS probes are not validation). Expected wins even before samples: no dead-air chop, clean chokes, instant play button.

### F2. Real instrument samples — **DEFERRED 2026-08-20** (post-beta bucket; see the teaching pivot above)
- [ ] Source a multisampled electric guitar with a commercial-use-safe license (velocity layers; a palm-mute articulation set is near-mandatory — check FreePats, Karoryfer, VSCO/Versilian, etc.). License review before integration.
- [ ] Sample pipeline (offline tool): trim/normalize/loop-check → app-bundled assets; mapping table midi+velocityLayer+technique → sample file + playbackRate (pitch-shift between sampled semitones).
- [ ] Techniques on samples: `mute` → dedicated PM samples; hammer/pull → attack shaping/fast retrigger; (bends/slides later via playbackRate automation — unlocks A6 cheaply).
- [ ] Metronome clicks stay synthesized; KS synth demoted to fallback.
- [x] ~~AudioExporter/share + `npm run batch` render from the same samples so exports match in-app sound.~~ **Superseded by A9 (done):** export and live now share one impulse response, one limiter, and one set of scheduling rules (`audio/masterChain.ts`, `audio/timing.ts`), so whatever the tone source is, both paths use it.
- [ ] **Gate: the 30-second test, on device** — a generated riff sounds like a guitar, not a synth. This is the phase the whole strategic frame has been waiting on.

---

## Phase G — Make it worth paying for (product depth) *(added 2026-07-18; started Sprint 6, 2026-08-20)*

*Owner verdict: generator + streak alone isn't a subscription. Scope this phase properly at sprint start — but ranked candidates, strongest evidence first:*

### Sprint 6 — the teaching slice — **CLOSED 2026-08-28**

*All four pieces shipped and play-tested on device (O3 `206368a`, A9 + O2 `ac8211a`, O1 + A7 `1a0a3cc`). Today now teaches: the day drills one theme, each riff explains what it asks of your hands, and practising it is a guided drill that records tempo and reps instead of a checkbox.*

The diagnosis going in: **the app had teaching content but no teaching structure.** `display.ts` holds genuinely good writing (the rhythm descriptions are the best copy in the app) but it lived only in Explore, the tab a habit user opens least. Today — where the habit actually happens — taught nothing: four unrelated riffs and a checkbox. Nothing sequenced, nothing adapted, and "mark done" recorded a single self-reported bit.

Options were ranked O1–O7; O3 → O2 → O1 shipped first because each makes the next worth more.

- [x] **O3 — themed sessions** (`206368a`). The day drills one thing, rotating across four families (a rhythm across four keys, one key across four rhythms, palm-mute bootcamp, legato day). Theme derives from the date, so a re-roll keeps the lesson and swaps the riffs. `GenerateOptions` gained `rhythm_name` and `force_mutes`. **The generator's real advantage over a fixed tab library is endless variations of one *constrained* thing — which is also how practice works — and the session had been spending that on random draws.**
- [x] **O2 — derived coaching** (`ac8211a`). "How to play it", derived per *feature* from the spec (technique tags, reach vs. travel, subdivision, repeated bars) rather than authored per riff. In Today's practice sheet.
- [x] **O1 — guided practice drill.** Count-in → loop the hard bar slow → tempo ramp → full play-through, over primitives Sprint 3 already shipped. The product decision it was blocked on is settled: three named steps, every one skippable, recording tempo *and* reps per riff. `RiffResult` and the drill model landed first (`f5876c0`) so the persisted shape could be reviewed on its own; the sheet replaces Today's practice modal. "Mark done" stays alongside it — the drill is the offer, not a toll, and both credit the day through the same `creditRiff`. **The one line the UI must never cross: the app cannot hear the player.** A rep is "a pass finished at this tempo" and nothing else; the summary says so out loud. O4's skill model now has data to sit on.
- [x] **A7 — playhead latency.** The visual playhead is now offset from the audio clock by a user-set `playheadOffsetMs`, adjusted by ear in Settings against a four-beat loop (react-native-audio-api still exposes no `outputLatency` to query — see the audit). Bluetooth runs 150-250ms behind; a playhead that leads teaches wrong timing, which was cosmetic until the drill made it the thing telling a learner where the beat is.

**Two findings worth carrying forward.** Both were cases where a themed feature would have *silently lied* rather than failed, and both were only caught by measuring rather than reasoning:

1. **Pedal templates in the key of D yield zero palm mutes — 100% of the time, at every level.** The pedal root (D3) sits on the *open* D string, which `assignPositions` prefers because open strings cost nothing to move to, and `tagMutes` only reaches the two lowest strings. "Palm-mute bootcamp" in D would have contained no palm muting.
2. **Unpinned legato days cleared the slur threshold as rarely as 5% of the time.** Hammer/pull needs consecutive same-string notes a fret or two apart; pedal templates repeat one fret and score ~0%.

*Any future theme needs the same treatment: measure whether the constraint actually produces the thing it promises, across every key and level, before shipping the copy that promises it.*

### Remaining Phase G candidates

- [ ] **Chord Armory expansion** — historically the owner's favorite feature alongside the tab visualizer. Custom chord adding, more voicings/qualities, richer theory info, and a chord→riff bridge ("generate a riff over this chord") that ties the Armory into the moat.
- [ ] **Curriculum-lite paths** (Phase 4 of the product roadmap, pulled forward): multi-day structured arcs ("Palm-mute bootcamp," "Pentatonic positions week") that sequence generated riffs + Armory content with a narrative. This is the clearest "thing you subscribe to."
- [ ] **Session narrative + overflow rewards** (from Phase C backlog): varied daily recipe (best feel / preferred / one "stretch" riff), bonus riffs after the goal, overflow counter. Cheap, makes the daily loop feel designed.
- [ ] **Refinement actions — REVISIT BEFORE COMMITTING** *(added 2026-08-31, from an external product-strategy review)*: one-tap transforms that preserve a riff's musical identity instead of rolling a fresh seed — **Variation**, **Make Harder**, **Make Easier**, **Same Idea / New Key** (transpose), and **Keep This Part** (lock bars 1–2, regenerate 3–4 — the "bar locks" already listed under Phase E's Pro split). The pitch: the generator currently has no notion of *this* riff, only of the constraints that produced it, so every re-roll discards what the user just liked. Refinement turns the Create loop from a slot machine into a collaboration, and it is plausibly a *cheaper* subscription argument than curriculum-lite paths.

  **Why it's parked, not scheduled.** It is a real engine project, not a UI one, and nobody has costed it yet. `generate()` is seed-in → riff-out; there is no transform layer, and "preserve the identity, change the difficulty" needs a definition of identity (motif contour? rhythm skeleton? both?) that the pipeline does not currently name. Transpose looks cheap and probably isn't — `assignPositions`/`passesStretchCheck` mean a key change can make a playable riff unplayable, and the theme gotchas note already shows technique yield swinging wildly by key. So: **before committing, spike the cheapest one (transpose) and see what breaks.** If the pipeline can't preserve structure across a key change, the whole family is more expensive than it looks.

  Sequencing note: this competes with **Curriculum-lite paths** for the same slot. Decide between them once the practice log (Sprint 7) exists — the log is a prerequisite for curriculum but not for refinement, which may settle the order on its own.
- [ ] Stretch: riff→song seeds (chain riffs into a structure — Phase 5 teaser), backing drums under playback (only after F, and only if samples land well).

---

## Phase H — Make it feel finished (polish audit) *(added 2026-07-18)*

- [ ] **Real app icon + splash assets** (pulled from D1 — it's the most visible polish item; currently a 1×1 placeholder PNG).
- [ ] Finish B3's remainder: adopt `typography`/`spacing` tokens in the ~6 components still using raw values.
- [ ] App-wide feel pass: screen transitions, loading/empty/error states everywhere (Library empty state, generation failure, audio init failure), copy/tone pass.
- [ ] Performance targets: cold-start time, tap-play latency (<150ms feels instant — F1 should get us most of the way).
- [ ] A fresh end-to-end walkthrough on device: onboarding → first riff → practice → share, fixing every rough edge found.

---

## Recommended execution order *(revised 2026-07-18)*

```
Sprint 1  A0 unfreeze + A1 dynamics + A2 palm-mute chugs                    ← DONE
Sprint 2  A3 power chords + A4 templates/swing (+ D4 store-migrate prereq)  ← DONE
Sprint 3  B1 playhead/metronome/count-in + B2 share export                  ← DONE
Sprint 4  B3 design + B4 branding + B5 settings + B6 haptics                ← DONE
Sprint 5  F1 audio architecture (react-native-audio-api, dev build, shared FX)  ← DONE
Sprint 6  G teaching slice: O3 themes + O2 coaching + A9 export/live
          + O1 guided drill + A7 playhead latency                          ← DONE
Sprint 7  G wave 2: O4 skill model → O5 curriculum paths
Sprint 8  H polish audit + real icon/splash
Sprint 9  D remainder (D1 minus icon, D3 Sentry/analytics, D4 tests/CI)
          → TestFlight beta gate: would guitarists pay for this?
Sprint 10 C retention loop (notifications, streak insurance, recap)
Sprint 11 E monetization + store listing → launch
          (F2 real samples + A5/A6: post-beta, informed by feedback)
```

Hard sequencing rules:
1. ~~`usePracticeStore` migration hygiene before A3~~ — done (Sprint 2).
2. **Every audio change is judged by an on-device listen** — never by offline probes alone (lesson of the `34661aa` revert).
3. ~~**F1 before F2**~~ — F1 done; F2 deferred post-beta (2026-08-20). The rule it encoded still stands: never swap architecture and timbre at once.
4. **Beta gate after Sprint 9, before retention/monetization** — and the gate question has changed from "do they like the sound?" to "would they pay?"
5. **O1 before O4/O5.** A skill model and curriculum paths both need practice data that does not exist yet; "mark done" is one self-reported bit. Building them on it would mean adapting to a number that measures nothing.
6. **A theme must be measured, not reasoned about.** Before shipping copy that promises a technique, verify the constraint produces it across every key and level — two themes silently promised techniques they did not deliver (see Phase G).

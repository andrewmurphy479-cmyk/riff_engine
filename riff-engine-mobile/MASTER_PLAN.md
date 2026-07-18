# Riff Engine — Master Plan

*Written 2026-07-14, after a full codebase audit (engine, audio, UI/UX, ship-readiness).*

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
- [ ] **Playhead on the Create tab.** `onStepPlay` callback already exists and Explore uses it; Create's `RiffTabView` renders static tab with no cursor. Wire it through — this is table stakes for a practice app.
- [ ] **Count-in + metronome.** Synthesize a click (two pitched ticks — the KS synth or a simple sine burst), 1-bar count-in before play, optional click during playback. Already on your Ideas list.
- [ ] **Live tempo.** Tempo change currently requires stop/replay. At minimum, restart seamlessly on tempo change; ideally recompute schedule live.
- [ ] Explore tab: add full-riff playback (currently the prominent play tile plays only the selected bar — confusing).

### B2. Share/export (built and unwired — a free viral loop)
`AudioExporter.exportToWav` is complete (reverb, compression, normalization) and `expo-sharing` is installed. **No UI calls either.**
- [ ] Add "Share riff" to Create + Library: renders WAV → share sheet. Watermark idea for later: a spoken/tag audio bumper for free tier.
- [ ] Stretch: share a riff *card* (image of the tab + branding) alongside audio — image shares travel further than audio files.

### B3. Design system consolidation
- [ ] One card style: migrate the hardcoded `#12121e` cards (RiffTabView, RiffContextCard, ExploreIntroCard) to theme `colors.card` glass style, or promote `#12121e` into the theme — pick one, apply everywhere.
- [ ] One accent: reconcile `#FF4E78` vs `colors.error`.
- [ ] Adopt `typography`/`spacing` tokens in the ~6 components using raw values.
- [ ] Decide on `components/ui/` kit: either adopt `Button`/`Card`/`ChipSelector` (the 4 selector components each re-implement the same chip pattern) or delete the kit.
- [ ] Replace the `Alert.alert` bar-tap menu on Create with a designed bottom sheet.
- [ ] Replace text glyphs (`▶`/`■`) in Library/Armory with Ionicons like everywhere else.

### B4. Branding & first impression
- [ ] **Pick the name.** App is "Riff Engine"; the splash screams "RIFFOLOGY / LET'S SHRED" with different background color. One brand, everywhere.
- [ ] Cut the cold-start animation for returning users (currently a scripted animation + `setTimeout(2000)` on *every* launch). First-launch: full intro. Returning: fast fade, < 800ms.
- [ ] Convert `RiffologyLoadingScreen.js` → TS while touching it (only .js file in the codebase).

### B5. Settings screen (missing entirely)
- [ ] New route: profile (level/genres, re-run taste check via existing `resetOnboarding()`), audio prefs (metronome on/off, count-in), about/version, privacy policy link, "restore purchases" placeholder for Phase E.

### B6. Feel & accessibility
- [ ] `expo-haptics`: light impact on play/stop, selection ticks on chips/steppers, success notification on daily-goal completion. Cheap, huge perceived quality.
- [ ] `accessibilityLabel`/`Role` on all icon-only controls (play/stop, done checks, locks, tempo ±) — currently zero in the app.

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

### D2. Migrate expo-av → expo-audio
expo-av is deprecated and **removed in SDK 55** — this is a when-not-if migration. Touches `SamplePlayer` and `AudioEngine.setAudioModeAsync`. Do it before adding more playback features on the old API. While in there:
- [ ] Fix `AudioEngine.initialize` swallowing failures (`catch` still sets `isInitialized = true` → silent no-op audio).
- [ ] Persist the tone cache across launches (currently cleared every init; every session re-synthesizes everything).

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

## Recommended execution order

```
Sprint 1  A0 unfreeze + A1 dynamics + A2 palm-mute chugs        ← DONE
Sprint 2  A3 power chords + A4 templates/swing                   ← DONE (incl. the D4 practice-store migrate prereq)
Sprint 3  B1 playhead/metronome/count-in + B2 share export       ← practice-app table stakes
Sprint 4  B3 design consolidation + B4 branding + B5 settings + B6 haptics
Sprint 5  D1 blockers + D2 expo-audio + D3 Sentry/analytics + D4 tests/CI
          → TestFlight beta gate: do guitarists like the sound?
Sprint 6  C retention loop (notifications, streak insurance, recap)
Sprint 7  A5–A7 second engine wave (scales, bends/slides, structures)
Sprint 8  E monetization + store listing → launch
```

Two hard sequencing rules:
1. **`usePracticeStore` migration hygiene (D4) must land before A3** changes the event/spec shape.
2. **Beta gate after Sprint 5** — validate the sound with real guitarists before investing in monetization.

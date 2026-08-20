/**
 * How to *play* a riff, derived from the riff itself.
 *
 * The existing narrative layer (display.ts, RiffContextCard) explains what a
 * riff *is* — its scale, its phrase shape, what the b3 does. That's theory
 * about the music. None of it tells a player where to put their hands.
 *
 * Everything needed for that is already in the spec: technique tags say
 * whether there are mutes or slurs, the positions say whether the hand sits
 * still or shifts, durations say whether it's eighths or sixteenths, and the
 * motif structure says which bars repeat. So coaching is derived per *feature*
 * rather than authored per riff — the same trick RHYTHM_DESCRIPTIONS uses,
 * applied to technique instead of rhythm.
 */
import { RHYTHM_DISPLAY_NAMES, snakeCaseToTitle } from "./display";
import { Bar, RiffSpec } from "./spec";

/** Strings 0 and 1 are the low E and A — where palm muting lives. */
const LOW_STRING_MAX = 1;
/** A reach this wide within one hand position is worth warning about. */
const WIDE_STRETCH = 4;
/**
 * Notes per sliding window when measuring what the hand must actually span.
 * Matches playability.ts's STRETCH_WINDOW — that is the window the generator
 * constrains, so it is the window that describes a real hand position.
 */
const HAND_WINDOW = 4;
/**
 * How much further the riff must travel than the hand can span before it
 * counts as shifting position rather than stretching.
 */
const SHIFT_MARGIN = 3;
/** Duration 1 is a sixteenth on the 16-step grid. */
const SIXTEENTH = 1;

export interface RiffAnalysis {
  muteCount: number;
  hammerCount: number;
  pullCount: number;
  /** Steps carrying more than one note — diads/power chords. */
  diadCount: number;
  /** Fret range across fretted (non-open) notes; null if everything is open. */
  minFret: number | null;
  maxFret: number | null;
  /** Total travel: the whole riff's fret range. */
  fretSpan: number;
  /**
   * Reach: the widest span the hand must cover *at once*, measured over a
   * sliding window of consecutive notes. A riff can travel the neck without
   * ever stretching, so this is the number that describes the fingers while
   * fretSpan describes the arm.
   */
  handSpan: number;
  /** True when the riff travels further than the hand can hold at once. */
  shiftsPosition: boolean;
  openStringCount: number;
  /** True when every note sits on the low E or A string. */
  lowStringsOnly: boolean;
  hasSixteenths: boolean;
  swung: boolean;
  /** Indices of bars whose fingering is identical, e.g. [0, 2]. */
  repeatedBars: [number, number] | null;
  /** The bar most worth drilling first. */
  hardestBarIndex: number;
}

export interface CoachingTip {
  /** Stable id, so the UI can key and the drill can reference one. */
  id: string;
  /** Short label, e.g. "Palm muting". */
  label: string;
  /** The instruction itself. Second person, imperative where possible. */
  body: string;
}

export interface RiffCoaching {
  /** The one-line answer to "what is this riff asking of me?". */
  headline: string;
  /** Ranked most-important-first. */
  tips: CoachingTip[];
  analysis: RiffAnalysis;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

function barFingerprint(bar: Bar): string {
  return JSON.stringify(
    [...bar.notes]
      .sort((a, b) => a.step - b.step || a.string - b.string)
      .map((n) => [n.step, n.duration, n.string, n.fret]),
  );
}

/**
 * Which bar to drill first: the one with the most going on. Note count is the
 * base, with technique tags and a wide reach adding to it, so a dense bar with
 * a stretch and a couple of slurs outranks a dense bar of repeated chugs.
 */
function scoreBar(bar: Bar): number {
  if (bar.notes.length === 0) return -1;
  let score = bar.notes.length;
  let lo = Infinity;
  let hi = -Infinity;
  for (const n of bar.notes) {
    if (n.technique === "hammer" || n.technique === "pull") score += 1.5;
    if (n.duration === SIXTEENTH) score += 0.5;
    if (n.fret > 0) {
      lo = Math.min(lo, n.fret);
      hi = Math.max(hi, n.fret);
    }
  }
  if (Number.isFinite(lo)) score += Math.max(0, hi - lo) * 0.5;
  return score;
}

/**
 * The widest fret span the hand must cover at once, over a sliding window of
 * consecutive notes.
 *
 * Takes the full note sequence *including* open strings and filters fretted
 * notes inside each window, exactly as playability.passesStretchCheck does.
 * Filtering opens out beforehand would be wrong: a riff can play fret 12, three
 * open strings, then fret 2, and dropping the opens would make those two
 * adjacent and report an impossible ten-fret reach when the hand had four
 * notes' worth of time to move.
 */
function widestReach(allFrets: readonly number[]): number {
  let widest = 0;
  for (let i = 0; i < allFrets.length; i++) {
    const window = allFrets
      .slice(Math.max(0, i - HAND_WINDOW + 1), i + 1)
      .filter((f) => f > 0);
    if (window.length === 0) continue;
    widest = Math.max(widest, Math.max(...window) - Math.min(...window));
  }
  return widest;
}

export function analyzeRiff(riff: RiffSpec): RiffAnalysis {
  let muteCount = 0;
  let hammerCount = 0;
  let pullCount = 0;
  let openStringCount = 0;
  let lo = Infinity;
  let hi = -Infinity;
  let hasSixteenths = false;
  let lowStringsOnly = true;

  const stepCounts = new Map<string, number>();
  /** Every note's fret in playing order — opens included, see widestReach. */
  const fretsInOrder: number[] = [];

  riff.bars.forEach((bar, barIdx) => {
    for (const n of [...bar.notes].sort((x, y) => x.step - y.step)) {
      if (n.technique === "mute") muteCount++;
      if (n.technique === "hammer") hammerCount++;
      if (n.technique === "pull") pullCount++;
      if (n.duration === SIXTEENTH) hasSixteenths = true;
      if (n.string > LOW_STRING_MAX) lowStringsOnly = false;
      fretsInOrder.push(n.fret);
      if (n.fret === 0) {
        openStringCount++;
      } else {
        lo = Math.min(lo, n.fret);
        hi = Math.max(hi, n.fret);
      }
      const key = `${barIdx}:${n.step}`;
      stepCounts.set(key, (stepCounts.get(key) ?? 0) + 1);
    }
  });

  let diadCount = 0;
  for (const count of stepCounts.values()) if (count > 1) diadCount++;

  // Bars 0 and 2 are the A-repeat in the default AA'AB structure, but compare
  // rather than assume — the structure is a field, not a guarantee.
  let repeatedBars: [number, number] | null = null;
  const prints = riff.bars.map(barFingerprint);
  outer: for (let i = 0; i < prints.length; i++) {
    for (let j = i + 1; j < prints.length; j++) {
      if (riff.bars[i].notes.length > 0 && prints[i] === prints[j]) {
        repeatedBars = [i, j];
        break outer;
      }
    }
  }

  const scores = riff.bars.map(scoreBar);
  const hardestBarIndex = scores.reduce(
    (best, score, idx) => (score > scores[best] ? idx : best),
    0,
  );

  const hasFretted = Number.isFinite(lo);
  const fretSpan = hasFretted ? hi - lo : 0;
  const handSpan = widestReach(fretsInOrder);

  return {
    muteCount,
    hammerCount,
    pullCount,
    diadCount,
    minFret: hasFretted ? lo : null,
    maxFret: hasFretted ? hi : null,
    fretSpan,
    handSpan,
    shiftsPosition: fretSpan - handSpan >= SHIFT_MARGIN,
    openStringCount,
    lowStringsOnly,
    hasSixteenths,
    swung: riff.swing !== undefined && riff.swing > 0.5,
    repeatedBars,
    hardestBarIndex,
  };
}

// ---------------------------------------------------------------------------
// Coaching
// ---------------------------------------------------------------------------

/** Sentence-initial subject: "One note" / "7 notes". */
function noteSubject(n: number): string {
  return n === 1 ? "One note" : `${n} notes`;
}

/** Verb agreeing with {@link noteSubject}. */
function agree(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

/**
 * Build the tip list, ranked. Order is deliberate: what your hands must *do*
 * comes before where they must be, which comes before how to count it, which
 * comes before how to practice it efficiently.
 */
export function coachingFor(riff: RiffSpec): RiffCoaching {
  const a = analyzeRiff(riff);
  const tips: CoachingTip[] = [];

  if (a.muteCount > 0) {
    tips.push({
      id: "palm_mute",
      label: "Palm muting",
      body:
        `Rest the edge of your picking hand on the strings right where they ` +
        `cross the bridge — barely touching. Too far forward and the note dies; ` +
        `too far back and nothing changes. ${noteSubject(a.muteCount)} ` +
        `${agree(a.muteCount, "is", "are")} muted here; the accented hits ring ` +
        `open by contrast.`,
    });
  }

  if (a.hammerCount + a.pullCount > 0) {
    const parts: string[] = [];
    if (a.hammerCount > 0) {
      parts.push(
        `hammer-ons (${a.hammerCount}) — bring the finger down hard enough to ` +
          `sound the note without picking it`,
      );
    }
    if (a.pullCount > 0) {
      parts.push(
        `pull-offs (${a.pullCount}) — flick the finger sideways off the string ` +
          `rather than lifting straight up; that flick is what makes it speak`,
      );
    }
    tips.push({
      id: "legato",
      label: "Slurs",
      body:
        `Pick only the first note of each pair, then ${parts.join(", and ")}. ` +
        `If you hear a gap, you're not committing enough with the fretting hand.`,
    });
  }

  if (a.diadCount > 0) {
    tips.push({
      id: "diads",
      label: "Two at once",
      body:
        `${a.diadCount} ${a.diadCount === 1 ? "beat has" : "beats have"} two ` +
        `notes stacked. Hit them as one motion rather than two — the pick ` +
        `should cross both strings in a single stroke.`,
    });
  }

  if (a.minFret !== null && a.maxFret !== null) {
    if (a.shiftsPosition) {
      tips.push({
        id: "shift",
        label: "Position shift",
        body:
          `This one travels from fret ${a.minFret} up to ${a.maxFret}, so your ` +
          `hand has to move. Work out where the shift happens and practice ` +
          `just that move — the note before the shift is the one to nail, ` +
          `because it buys you the time to land.`,
      });
    } else if (a.handSpan >= WIDE_STRETCH) {
      tips.push({
        id: "stretch",
        label: "Wide reach",
        body:
          `Frets ${a.minFret} to ${a.maxFret}, and you need ${a.handSpan} frets ` +
          `under your fingers at once. Anchor your first finger and reach with ` +
          `the others rather than sliding the hand — sliding is what makes the ` +
          `timing slip.`,
      });
    } else {
      tips.push({
        id: "position",
        label: "One position",
        body:
          `Your fretting hand never leaves the ${a.minFret}–${a.maxFret} fret ` +
          `box. Set it once and let your fingers do the work; if you find ` +
          `yourself moving your arm, you're working too hard.`,
      });
    }
  }

  if (a.openStringCount > 0 && !a.lowStringsOnly) {
    tips.push({
      id: "open_strings",
      label: "Open strings",
      body:
        `${noteSubject(a.openStringCount)} ` +
        `${agree(a.openStringCount, "rings", "ring")} open. Open strings keep ` +
        `sounding after you've moved on, so damp them with the side of your ` +
        `palm when the next note lands.`,
    });
  }

  if (a.swung) {
    tips.push({
      id: "swing",
      label: "Swung eighths",
      body:
        `The eighths here are uneven — long, then short, like "doo-ba doo-ba" ` +
        `rather than an even "doo-doo". Feel it before you play it; counting ` +
        `it straight will fight you.`,
    });
  } else if (a.hasSixteenths) {
    tips.push({
      id: "sixteenths",
      label: "Sixteenths",
      body:
        `There are sixteenth notes in here — four per beat. Count "1-e-and-a" ` +
        `out loud at half speed until the fast notes land where you expect ` +
        `them, then bring the tempo up.`,
    });
  }

  if (a.repeatedBars) {
    const [first, second] = a.repeatedBars;
    tips.push({
      id: "repeat",
      label: "Free bar",
      body:
        `Bar ${second + 1} is bar ${first + 1} again, note for note and finger ` +
        `for finger. Learn it once and you've learned half the riff.`,
    });
  }

  return { headline: headlineFor(riff, a), tips, analysis: a };
}

/**
 * The single most useful sentence about this riff. Technique wins over
 * position, which wins over rhythm, because technique is what a player
 * actually has to change to get it right.
 */
function headlineFor(riff: RiffSpec, a: RiffAnalysis): string {
  const rhythm = riff.rhythm_name
    ? (RHYTHM_DISPLAY_NAMES[riff.rhythm_name] ??
      snakeCaseToTitle(riff.rhythm_name))
    : null;

  if (a.muteCount > 0 && a.lowStringsOnly) {
    return `A palm-muted chug on the low strings${rhythm ? ` — ${rhythm.toLowerCase()}` : ""}.`;
  }
  if (a.muteCount > 0) {
    return `Palm-muted picking with the accents ringing open.`;
  }
  if (a.hammerCount + a.pullCount >= 3) {
    return `A legato riff — the fretting hand does most of the sounding.`;
  }
  if (a.shiftsPosition) {
    return `A travelling riff — frets ${a.minFret} to ${a.maxFret}, with a shift on the way.`;
  }
  if (a.handSpan >= WIDE_STRETCH) {
    return `A stretchy one: ${a.handSpan} frets under the fingers at once.`;
  }
  if (a.diadCount > 0) {
    return `Two-note stabs${rhythm ? ` over ${rhythm.toLowerCase()}` : ""}.`;
  }
  if (rhythm) {
    return `Single-note lead in the ${rhythm.toLowerCase()} pocket.`;
  }
  return `A single-note riff in ${riff.key}.`;
}

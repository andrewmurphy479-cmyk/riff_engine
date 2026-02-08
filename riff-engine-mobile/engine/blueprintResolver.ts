import { TabEvent, NotePosition, GuitarString } from './types';
import { BlueprintNote, RiffBlueprint } from './blueprints';
import { BarConfig } from './styles';
import {
  CHORD_BASS,
  CHORD_ALT_BASS,
} from './chords';
import { fretboardDistance, getAbsolutePitch } from './voiceLeading';

// Open string MIDI notes: E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
const STRING_MIDI: Record<GuitarString, number> = {
  'E': 40,
  'A': 45,
  'D': 50,
  'G': 55,
  'B': 59,
  'e': 64,
};

// Chord root MIDI notes
const CHORD_ROOT_MIDI: Record<string, number> = {
  'C': 48, 'Cm': 48,
  'D': 50, 'Dm': 50,
  'E': 52, 'Em': 52,
  'F': 53, 'Fm': 53,
  'G': 55, 'Gm': 55,
  'A': 57, 'Am': 57,
  'B': 59, 'Bm': 59, 'B7': 59,
};

// Bass strings and treble strings for register filtering
const BASS_STRINGS: GuitarString[] = ['E', 'A', 'D'];
const TREBLE_STRINGS: GuitarString[] = ['G', 'B', 'e'];

// ===== CHORD-QUALITY-AWARE INTERVAL MAPPING =====
// Blueprints use "generic" intervals (4 = "the 3rd", 11 = "the 7th").
// This function adjusts them for the actual chord quality.
function isMinorChord(chord: string): boolean {
  // Em, Am, Dm, Cm, Fm, Gm, Bm — contains 'm' but NOT 'maj'
  return chord.includes('m') && !chord.includes('maj');
}

function isDominant7(chord: string): boolean {
  return chord.endsWith('7') && !chord.includes('maj7');
}

// Remap blueprint interval to match chord quality
function adjustIntervalForChord(interval: number, chord: string): number {
  const minor = isMinorChord(chord);
  const dom7 = isDominant7(chord);

  switch (interval) {
    case 3:
      // Minor 3rd — keep for minor, but for major chords raise to 4
      return minor ? 3 : 4;
    case 4:
      // Major 3rd — keep for major, but for minor chords lower to 3
      return minor ? 3 : 4;
    case 10:
      // Minor 7th — keep as-is (works for minor and dom7)
      return 10;
    case 11:
      // Major 7th — lower to 10 for minor chords and dom7
      return (minor || dom7) ? 10 : 11;
    default:
      return interval;
  }
}

// Find all valid fretboard positions for a target MIDI pitch within fret limit
function findPositionsForPitch(
  targetMidi: number,
  maxFret: number,
  registerStrings: GuitarString[]
): NotePosition[] {
  const positions: NotePosition[] = [];
  for (const str of registerStrings) {
    const fret = targetMidi - STRING_MIDI[str];
    if (fret >= 0 && fret <= maxFret) {
      positions.push({ string: str, fret });
    }
  }
  return positions;
}

function getAltBassForChord(chord: string): NotePosition {
  return CHORD_ALT_BASS[chord] || CHORD_BASS[chord] || { string: 'E' as GuitarString, fret: 0 };
}

// Pick the best position from candidates using voice leading
function pickBestPosition(
  candidates: NotePosition[],
  lastNote: NotePosition | null
): NotePosition {
  if (candidates.length === 0) {
    return { string: 'G', fret: 0 };
  }
  if (candidates.length === 1 || !lastNote) {
    return candidates[0];
  }

  let best = candidates[0];
  let bestDist = fretboardDistance(candidates[0], lastNote);

  for (let i = 1; i < candidates.length; i++) {
    const dist = fretboardDistance(candidates[i], lastNote);
    if (dist < bestDist) {
      bestDist = dist;
      best = candidates[i];
    }
  }
  return best;
}

// Resolve a single blueprint note to a concrete TabEvent
function resolveBlueprintNote(
  bpNote: BlueprintNote,
  chord: string,
  chordRootMidi: number,
  maxFret: number,
  lastNote: NotePosition | null,
  isAltBassSlot: boolean
): { event: TabEvent; position: NotePosition } | null {
  const registerStrings = bpNote.register === 'bass' ? BASS_STRINGS : TREBLE_STRINGS;

  // Special case: bass register, interval 0, alt bass slot
  if (bpNote.register === 'bass' && bpNote.interval === 0 && isAltBassSlot) {
    const altBass = getAltBassForChord(chord);
    return {
      event: {
        string: altBass.string,
        fret: altBass.fret,
        step: bpNote.step,
        duration: bpNote.duration,
        velocity: bpNote.accent ? 0.85 : 0.7,
      },
      position: altBass,
    };
  }

  // Special case: bass register, interval 0, use chord's designated bass note
  if (bpNote.register === 'bass' && bpNote.interval === 0) {
    const bass = CHORD_BASS[chord] || { string: 'E' as GuitarString, fret: 0 };
    return {
      event: {
        string: bass.string,
        fret: bass.fret,
        step: bpNote.step,
        duration: bpNote.duration,
        velocity: bpNote.accent ? 0.85 : 0.7,
      },
      position: bass,
    };
  }

  // Adjust interval for chord quality (major/minor 3rd, 7th)
  const adjustedInterval = adjustIntervalForChord(bpNote.interval, chord);
  const targetMidi = chordRootMidi + adjustedInterval;

  // Try all octaves that could land on the fretboard
  let allPositions: NotePosition[] = [];
  for (let octaveShift = -12; octaveShift <= 12; octaveShift += 12) {
    const positions = findPositionsForPitch(targetMidi + octaveShift, maxFret, registerStrings);
    allPositions.push(...positions);
  }

  if (allPositions.length === 0) {
    // Fallback: try the other register's strings
    const fallbackStrings = bpNote.register === 'bass' ? TREBLE_STRINGS : BASS_STRINGS;
    for (let octaveShift = -12; octaveShift <= 12; octaveShift += 12) {
      const positions = findPositionsForPitch(targetMidi + octaveShift, maxFret, fallbackStrings);
      allPositions.push(...positions);
    }
  }

  if (allPositions.length === 0) {
    return null;
  }

  const position = pickBestPosition(allPositions, lastNote);

  return {
    event: {
      string: position.string,
      fret: position.fret,
      step: bpNote.step,
      duration: bpNote.duration,
      velocity: bpNote.accent ? 0.85 : 0.7,
    },
    position,
  };
}

// Determine which bass steps are "alt bass" slots
function isAltBassStep(step: number, blueprint: RiffBlueprint): boolean {
  const bassRootSteps = blueprint.notes
    .filter(n => n.register === 'bass' && n.interval === 0)
    .map(n => n.step)
    .sort((a, b) => a - b);

  if (bassRootSteps.length >= 2) {
    const idx = bassRootSteps.indexOf(step);
    return idx > 0 && idx % 2 === 1;
  }
  return false;
}

// Get chord tones for cross-bar voice leading
function getChordToneIntervals(chord: string): number[] {
  if (isMinorChord(chord)) return [0, 3, 7];
  if (isDominant7(chord)) return [0, 4, 7, 10];
  return [0, 4, 7];
}

// Main resolver: blueprint + chord → TabEvent[]
export function resolveBlueprint(
  blueprint: RiffBlueprint,
  chord: string,
  barIndex: number,
  barOffset: number,
  config: BarConfig,
  lastNote: NotePosition | null,
  nextChord?: string
): { events: TabEvent[]; lastNote: NotePosition | null } {
  const chordRootMidi = CHORD_ROOT_MIDI[chord] || 48;
  const events: TabEvent[] = [];
  const usedSlots = new Set<string>();
  let currentLastNote = lastNote;

  // Filter notes by difficulty
  let blueprintNotes = [...blueprint.notes];

  const trebleNotes = blueprintNotes.filter(n => n.register === 'treble');
  if (trebleNotes.length > config.maxMelodyNotesPerBar) {
    const bassNotes = blueprintNotes.filter(n => n.register === 'bass');
    const keepCount = config.maxMelodyNotesPerBar;
    const stride = trebleNotes.length / keepCount;
    const keptTreble: BlueprintNote[] = [];
    for (let i = 0; i < keepCount; i++) {
      keptTreble.push(trebleNotes[Math.floor(i * stride)]);
    }
    blueprintNotes = [...bassNotes, ...keptTreble];
  }

  blueprintNotes.sort((a, b) => a.step - b.step);

  const embellishableSteps = new Set<number>();

  for (const bpNote of blueprintNotes) {
    const isAlt = isAltBassStep(bpNote.step, blueprint);
    const result = resolveBlueprintNote(
      bpNote,
      chord,
      chordRootMidi,
      config.maxFret,
      bpNote.register === 'treble' ? currentLastNote : null,
      isAlt
    );

    if (!result) continue;

    const slotKey = `${result.event.string}:${bpNote.step}`;
    if (usedSlots.has(slotKey)) continue;
    usedSlots.add(slotKey);

    result.event.step = bpNote.step + barOffset;
    events.push(result.event);

    if (bpNote.embellishable) {
      embellishableSteps.add(bpNote.step + barOffset);
    }

    if (bpNote.register === 'treble') {
      currentLastNote = result.position;
    }
  }

  // Cross-bar connection: adjust last treble note to smooth into next chord
  if (nextChord && currentLastNote) {
    const nextRootMidi = CHORD_ROOT_MIDI[nextChord] || 48;
    const currentMidi = STRING_MIDI[currentLastNote.string] + currentLastNote.fret;
    const intervalInNextChord = ((currentMidi - nextRootMidi) % 12 + 12) % 12;
    const nextChordTones = getChordToneIntervals(nextChord);
    const isCommonTone = nextChordTones.includes(intervalInNextChord);

    if (!isCommonTone && events.length > 0) {
      for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i];
        if (TREBLE_STRINGS.includes(ev.string as GuitarString)) {
          let bestPos: NotePosition | null = null;
          let bestDist = Infinity;

          for (const interval of nextChordTones) {
            const targetMidi = nextRootMidi + interval;
            for (const octave of [0, 12]) {
              const positions = findPositionsForPitch(targetMidi + octave, config.maxFret, TREBLE_STRINGS);
              for (const pos of positions) {
                const dist = fretboardDistance(pos, currentLastNote);
                if (dist < bestDist) {
                  bestDist = dist;
                  bestPos = pos;
                }
              }
            }
          }

          if (bestPos && bestDist <= 4) {
            ev.string = bestPos.string;
            ev.fret = bestPos.fret;
            currentLastNote = bestPos;
          }
          break;
        }
      }
    }
  }

  // Tag embellishable events
  for (const ev of events) {
    if (embellishableSteps.has(ev.step)) {
      (ev as any)._embellishable = true;
    }
  }

  return { events, lastNote: currentLastNote };
}

// Resolve only bass-register notes
export function resolveBlueprintBass(
  blueprint: RiffBlueprint,
  chord: string,
  barIndex: number,
  barOffset: number,
  config: BarConfig
): TabEvent[] {
  const chordRootMidi = CHORD_ROOT_MIDI[chord] || 48;
  const events: TabEvent[] = [];
  const usedSlots = new Set<string>();

  const bassNotes = blueprint.notes.filter(n => n.register === 'bass');

  for (const bpNote of bassNotes) {
    const isAlt = isAltBassStep(bpNote.step, blueprint);
    const result = resolveBlueprintNote(
      bpNote, chord, chordRootMidi, config.maxFret, null, isAlt
    );

    if (!result) continue;
    const slotKey = `${result.event.string}:${bpNote.step}`;
    if (usedSlots.has(slotKey)) continue;
    usedSlots.add(slotKey);

    result.event.step = bpNote.step + barOffset;
    result.event.layer = 'bass';
    events.push(result.event);
  }

  return events;
}

// Resolve only treble-register notes
export function resolveBlueprintTreble(
  blueprint: RiffBlueprint,
  chord: string,
  barIndex: number,
  barOffset: number,
  config: BarConfig,
  lastNote: NotePosition | null,
  nextChord?: string
): { events: TabEvent[]; lastNote: NotePosition | null } {
  const chordRootMidi = CHORD_ROOT_MIDI[chord] || 48;
  const events: TabEvent[] = [];
  const usedSlots = new Set<string>();
  let currentLastNote = lastNote;

  let trebleNotes = blueprint.notes.filter(n => n.register === 'treble');

  if (trebleNotes.length > config.maxMelodyNotesPerBar) {
    const stride = trebleNotes.length / config.maxMelodyNotesPerBar;
    const kept: BlueprintNote[] = [];
    for (let i = 0; i < config.maxMelodyNotesPerBar; i++) {
      kept.push(trebleNotes[Math.floor(i * stride)]);
    }
    trebleNotes = kept;
  }

  trebleNotes.sort((a, b) => a.step - b.step);

  for (const bpNote of trebleNotes) {
    const result = resolveBlueprintNote(
      bpNote, chord, chordRootMidi, config.maxFret, currentLastNote, false
    );

    if (!result) continue;
    const slotKey = `${result.event.string}:${bpNote.step}`;
    if (usedSlots.has(slotKey)) continue;
    usedSlots.add(slotKey);

    result.event.step = bpNote.step + barOffset;
    result.event.layer = 'melody';
    events.push(result.event);
    currentLastNote = result.position;
  }

  // Cross-bar voice leading
  if (nextChord && currentLastNote && events.length > 0) {
    const nextRootMidi = CHORD_ROOT_MIDI[nextChord] || 48;
    const currentMidi = STRING_MIDI[currentLastNote.string] + currentLastNote.fret;
    const intervalInNextChord = ((currentMidi - nextRootMidi) % 12 + 12) % 12;
    const nextChordTones = getChordToneIntervals(nextChord);
    const isCommonTone = nextChordTones.includes(intervalInNextChord);

    if (!isCommonTone) {
      const lastEvent = events[events.length - 1];
      let bestPos: NotePosition | null = null;
      let bestDist = Infinity;

      for (const interval of nextChordTones) {
        for (const octave of [0, 12]) {
          const positions = findPositionsForPitch(nextRootMidi + interval + octave, config.maxFret, TREBLE_STRINGS);
          for (const pos of positions) {
            const dist = fretboardDistance(pos, currentLastNote);
            if (dist < bestDist) {
              bestDist = dist;
              bestPos = pos;
            }
          }
        }
      }

      if (bestPos && bestDist <= 4) {
        lastEvent.string = bestPos.string;
        lastEvent.fret = bestPos.fret;
        currentLastNote = bestPos;
      }
    }
  }

  return { events, lastNote: currentLastNote };
}

// Find gaps in blueprint for fill placement
export function findBlueprintGaps(blueprint: RiffBlueprint, barOffset: number): number[] {
  const occupiedSteps = new Set(blueprint.notes.map(n => n.step));
  const gaps: number[] = [];
  for (let step = 0; step < 16; step++) {
    if (!occupiedSteps.has(step)) {
      gaps.push(step + barOffset);
    }
  }
  return gaps;
}

import { Style, Mood } from './types';

// A single note within a blueprint, defined as interval from chord root + rhythmic position
export interface BlueprintNote {
  interval: number;       // semitones from chord root: 0=root, 4=3rd(adj by resolver), 7=5th, etc.
  step: number;           // rhythmic position (0-15, 16th notes)
  duration: number;       // note length in steps
  register: 'bass' | 'treble';  // which hand/register
  accent?: boolean;       // velocity emphasis
  embellishable?: boolean; // can ornaments be applied here?
}

// A complete 1-bar melodic+rhythmic template
export interface RiffBlueprint {
  id: string;
  name: string;
  notes: BlueprintNote[];
  tags: string[];                  // mood tags for matching
  energy: [number, number];        // energy range this works for (1-5)
  complexity: [number, number];    // complexity range (1-5)
  style: Style;
}

// ===== BLUEPRINTS — 4 per style (16 total) =====
// Intervals use "generic" values: 4 = "the 3rd" (resolver adjusts for minor/major)

const BLUEPRINTS: RiffBlueprint[] = [

  // ════════════════════════════════════════════
  // TRAVIS (4)
  // ════════════════════════════════════════════

  {
    id: 'travis-steady',
    name: 'Steady Travis',
    style: 'travis',
    tags: ['warm', 'gentle', 'nostalgic', 'sad', 'dreamy'],
    energy: [1, 3],
    complexity: [1, 3],
    notes: [
      // Classic alternating bass + treble on quarter notes
      { interval: 0, step: 0, duration: 4, register: 'bass', accent: true },
      { interval: 7, step: 4, duration: 4, register: 'treble' },
      { interval: 0, step: 8, duration: 4, register: 'bass', accent: true },
      { interval: 4, step: 12, duration: 4, register: 'treble' },
    ],
  },
  {
    id: 'travis-walking',
    name: 'Walking Travis',
    style: 'travis',
    tags: ['driving', 'uplifting', 'gritty', 'soulful'],
    energy: [3, 5],
    complexity: [3, 5],
    notes: [
      { interval: 0, step: 0, duration: 2, register: 'bass', accent: true },
      { interval: 4, step: 2, duration: 2, register: 'treble' },
      { interval: 7, step: 4, duration: 2, register: 'treble', embellishable: true },
      { interval: 0, step: 8, duration: 2, register: 'bass', accent: true },
      { interval: 0, step: 10, duration: 2, register: 'treble' },
      { interval: 4, step: 12, duration: 2, register: 'treble', embellishable: true },
      { interval: 5, step: 14, duration: 2, register: 'treble' },
    ],
  },
  {
    id: 'travis-syncopated',
    name: 'Syncopated Travis',
    style: 'travis',
    tags: ['soulful', 'mysterious', 'gritty', 'tense'],
    energy: [2, 4],
    complexity: [2, 4],
    notes: [
      // Off-beat treble creates push-pull feel
      { interval: 0, step: 0, duration: 3, register: 'bass', accent: true },
      { interval: 4, step: 3, duration: 2, register: 'treble' },         // syncopated!
      { interval: 7, step: 6, duration: 2, register: 'treble', embellishable: true },
      { interval: 0, step: 8, duration: 3, register: 'bass', accent: true },
      { interval: 4, step: 11, duration: 2, register: 'treble' },        // syncopated!
      { interval: 0, step: 14, duration: 2, register: 'treble' },
    ],
  },
  {
    id: 'travis-sparse',
    name: 'Breathing Travis',
    style: 'travis',
    tags: ['sad', 'cinematic', 'dreamy', 'nostalgic'],
    energy: [1, 2],
    complexity: [1, 2],
    notes: [
      // Lots of space — just bass and one treble per half
      { interval: 0, step: 0, duration: 4, register: 'bass', accent: true },
      { interval: 7, step: 6, duration: 4, register: 'treble' },
      { interval: 0, step: 8, duration: 4, register: 'bass', accent: true },
      // beat 4 is empty — deliberate rest
    ],
  },

  // ════════════════════════════════════════════
  // ARPEGGIO (4)
  // ════════════════════════════════════════════

  {
    id: 'arpeggio-classical',
    name: 'Classical Ascend',
    style: 'arpeggio',
    tags: ['cinematic', 'dreamy', 'mysterious', 'nostalgic'],
    energy: [2, 4],
    complexity: [2, 4],
    notes: [
      // p-i-m-a ascending then descending
      { interval: 0, step: 0, duration: 2, register: 'bass', accent: true },
      { interval: 0, step: 2, duration: 2, register: 'treble' },
      { interval: 4, step: 4, duration: 2, register: 'treble' },
      { interval: 7, step: 6, duration: 2, register: 'treble', embellishable: true },
      { interval: 4, step: 8, duration: 2, register: 'treble' },
      { interval: 0, step: 10, duration: 2, register: 'treble' },
      { interval: 7, step: 12, duration: 2, register: 'treble', embellishable: true },
      { interval: 4, step: 14, duration: 2, register: 'treble' },
    ],
  },
  {
    id: 'arpeggio-gentle',
    name: 'Gentle Roll',
    style: 'arpeggio',
    tags: ['sad', 'dreamy', 'gentle', 'cinematic', 'nostalgic'],
    energy: [1, 2],
    complexity: [1, 2],
    notes: [
      // Quarter-note arpeggio — spacious
      { interval: 0, step: 0, duration: 4, register: 'bass', accent: true },
      { interval: 7, step: 4, duration: 4, register: 'treble' },
      { interval: 4, step: 8, duration: 4, register: 'treble' },
      { interval: 0, step: 12, duration: 4, register: 'treble' },
    ],
  },
  {
    id: 'arpeggio-descend',
    name: 'Waterfall',
    style: 'arpeggio',
    tags: ['sad', 'mysterious', 'cinematic', 'tense'],
    energy: [2, 4],
    complexity: [2, 4],
    notes: [
      // High to low — melancholy descending
      { interval: 0, step: 0, duration: 2, register: 'bass', accent: true },
      { interval: 7, step: 2, duration: 2, register: 'treble' },
      { interval: 4, step: 4, duration: 2, register: 'treble', embellishable: true },
      { interval: 0, step: 6, duration: 2, register: 'treble' },
      { interval: 0, step: 8, duration: 2, register: 'bass', accent: true },
      { interval: 7, step: 10, duration: 3, register: 'treble' },
      { interval: 4, step: 14, duration: 2, register: 'treble' },
      // step 13 is a gap — breathing room
    ],
  },
  {
    id: 'arpeggio-wide',
    name: 'Wide Arpeggio',
    style: 'arpeggio',
    tags: ['uplifting', 'cinematic', 'driving'],
    energy: [3, 5],
    complexity: [3, 5],
    notes: [
      // Root-5th-octave spread — dramatic intervals
      { interval: 0, step: 0, duration: 2, register: 'bass', accent: true },
      { interval: 7, step: 2, duration: 2, register: 'treble' },
      { interval: 0, step: 4, duration: 2, register: 'treble', accent: true },  // octave up
      { interval: 5, step: 6, duration: 2, register: 'treble', embellishable: true },  // 4th for color
      { interval: 0, step: 8, duration: 2, register: 'bass', accent: true },
      { interval: 4, step: 10, duration: 2, register: 'treble' },
      { interval: 7, step: 12, duration: 2, register: 'treble', accent: true, embellishable: true },
      { interval: 0, step: 14, duration: 2, register: 'treble' },
    ],
  },

  // ════════════════════════════════════════════
  // CROSSPICKING (4)
  // ════════════════════════════════════════════

  {
    id: 'cross-barn',
    name: 'Barn Dance',
    style: 'crosspicking',
    tags: ['uplifting', 'driving', 'nostalgic', 'gritty'],
    energy: [2, 4],
    complexity: [2, 4],
    notes: [
      // low-mid-high-mid rolling on 8th notes
      { interval: 0, step: 0, duration: 2, register: 'bass', accent: true },
      { interval: 4, step: 2, duration: 2, register: 'treble' },
      { interval: 7, step: 4, duration: 2, register: 'treble', accent: true },
      { interval: 4, step: 6, duration: 2, register: 'treble' },
      { interval: 0, step: 8, duration: 2, register: 'bass', accent: true },
      { interval: 4, step: 10, duration: 2, register: 'treble' },
      { interval: 7, step: 12, duration: 2, register: 'treble', accent: true, embellishable: true },
      { interval: 4, step: 14, duration: 2, register: 'treble' },
    ],
  },
  {
    id: 'cross-tight',
    name: 'Tight Roll',
    style: 'crosspicking',
    tags: ['driving', 'tense', 'gritty', 'cinematic'],
    energy: [4, 5],
    complexity: [4, 5],
    notes: [
      // 16th-note rolling: root-5th-3rd-root pattern
      { interval: 0, step: 0, duration: 1, register: 'bass', accent: true },
      { interval: 7, step: 1, duration: 1, register: 'treble' },
      { interval: 4, step: 2, duration: 1, register: 'treble' },
      { interval: 0, step: 3, duration: 1, register: 'treble' },
      { interval: 0, step: 4, duration: 1, register: 'bass', accent: true },
      { interval: 7, step: 5, duration: 1, register: 'treble' },
      { interval: 4, step: 6, duration: 1, register: 'treble', embellishable: true },
      { interval: 0, step: 7, duration: 1, register: 'treble' },
      { interval: 0, step: 8, duration: 1, register: 'bass', accent: true },
      { interval: 7, step: 9, duration: 1, register: 'treble' },
      { interval: 4, step: 10, duration: 1, register: 'treble' },
      { interval: 0, step: 11, duration: 1, register: 'treble' },
      { interval: 0, step: 12, duration: 1, register: 'bass', accent: true },
      { interval: 7, step: 13, duration: 1, register: 'treble' },
      { interval: 4, step: 14, duration: 1, register: 'treble', embellishable: true },
      { interval: 0, step: 15, duration: 1, register: 'treble' },
    ],
  },
  {
    id: 'cross-swing',
    name: 'Swing Roll',
    style: 'crosspicking',
    tags: ['soulful', 'nostalgic', 'warm', 'uplifting'],
    energy: [2, 3],
    complexity: [2, 3],
    notes: [
      // Triplet-ish feel using dotted rhythms, with gaps for breath
      { interval: 0, step: 0, duration: 3, register: 'bass', accent: true },
      { interval: 4, step: 3, duration: 2, register: 'treble' },
      { interval: 7, step: 6, duration: 2, register: 'treble', embellishable: true },
      // step 5, 8 = rest
      { interval: 0, step: 8, duration: 3, register: 'bass', accent: true },
      { interval: 7, step: 11, duration: 2, register: 'treble' },
      { interval: 4, step: 14, duration: 2, register: 'treble' },
    ],
  },
  {
    id: 'cross-melodic',
    name: 'Melodic Cross',
    style: 'crosspicking',
    tags: ['cinematic', 'mysterious', 'dreamy', 'sad'],
    energy: [1, 3],
    complexity: [1, 3],
    notes: [
      // Wider intervals, scale-wise movement
      { interval: 0, step: 0, duration: 2, register: 'bass', accent: true },
      { interval: 0, step: 2, duration: 2, register: 'treble' },
      { interval: 2, step: 4, duration: 2, register: 'treble' },   // 2nd — scale step
      { interval: 4, step: 6, duration: 2, register: 'treble', embellishable: true },
      { interval: 0, step: 8, duration: 2, register: 'bass', accent: true },
      { interval: 7, step: 10, duration: 2, register: 'treble' },
      { interval: 5, step: 12, duration: 2, register: 'treble' },  // 4th — color
      { interval: 4, step: 14, duration: 2, register: 'treble' },
    ],
  },

  // ════════════════════════════════════════════
  // STRUM (4)
  // ════════════════════════════════════════════

  {
    id: 'strum-campfire',
    name: 'Campfire',
    style: 'strum',
    tags: ['warm', 'uplifting', 'nostalgic', 'gentle', 'soulful'],
    energy: [1, 3],
    complexity: [1, 3],
    notes: [
      // Beat 1: full strum (bass + 2 treble)
      { interval: 0, step: 0, duration: 4, register: 'bass', accent: true },
      { interval: 4, step: 0, duration: 4, register: 'treble', accent: true },
      { interval: 7, step: 0, duration: 4, register: 'treble' },
      // Beat 2: light upstroke (1 treble)
      { interval: 4, step: 4, duration: 4, register: 'treble' },
      // Beat 3: bass + 1 treble
      { interval: 0, step: 8, duration: 2, register: 'bass', accent: true },
      { interval: 7, step: 8, duration: 2, register: 'treble' },
      // "and" of 3: quick upstroke
      { interval: 4, step: 10, duration: 2, register: 'treble' },
      // Beat 4: 2 treble
      { interval: 0, step: 12, duration: 4, register: 'treble' },
      { interval: 7, step: 12, duration: 4, register: 'treble' },
    ],
  },
  {
    id: 'strum-driving',
    name: 'Driving 8ths',
    style: 'strum',
    tags: ['driving', 'gritty', 'tense', 'uplifting'],
    energy: [3, 5],
    complexity: [3, 5],
    notes: [
      // Strong beats: bass + 2 treble. Weak beats: 1 treble only.
      { interval: 0, step: 0, duration: 2, register: 'bass', accent: true },
      { interval: 4, step: 0, duration: 2, register: 'treble', accent: true },
      { interval: 7, step: 0, duration: 2, register: 'treble' },
      { interval: 4, step: 2, duration: 2, register: 'treble' },             // light
      { interval: 0, step: 4, duration: 2, register: 'bass', accent: true },
      { interval: 4, step: 4, duration: 2, register: 'treble' },
      { interval: 7, step: 4, duration: 2, register: 'treble' },
      { interval: 7, step: 6, duration: 2, register: 'treble', embellishable: true },  // light
      { interval: 0, step: 8, duration: 2, register: 'bass', accent: true },
      { interval: 4, step: 8, duration: 2, register: 'treble' },
      { interval: 7, step: 8, duration: 2, register: 'treble' },
      { interval: 4, step: 10, duration: 2, register: 'treble' },            // light
      { interval: 0, step: 12, duration: 2, register: 'bass', accent: true },
      { interval: 4, step: 12, duration: 2, register: 'treble' },
      { interval: 7, step: 12, duration: 2, register: 'treble' },
      { interval: 4, step: 14, duration: 2, register: 'treble', embellishable: true },  // light
    ],
  },
  {
    id: 'strum-boom-chuck',
    name: 'Boom-Chuck',
    style: 'strum',
    tags: ['nostalgic', 'uplifting', 'warm', 'driving'],
    energy: [2, 4],
    complexity: [1, 3],
    notes: [
      // Classic country: bass on 1&3, treble chord on 2&4
      { interval: 0, step: 0, duration: 4, register: 'bass', accent: true },
      { interval: 4, step: 4, duration: 4, register: 'treble', accent: true },
      { interval: 7, step: 4, duration: 4, register: 'treble' },
      { interval: 0, step: 8, duration: 4, register: 'bass', accent: true },
      { interval: 4, step: 12, duration: 4, register: 'treble', accent: true },
      { interval: 7, step: 12, duration: 4, register: 'treble' },
    ],
  },
  {
    id: 'strum-muted',
    name: 'Reggae Chop',
    style: 'strum',
    tags: ['soulful', 'dreamy', 'mysterious', 'gritty'],
    energy: [2, 4],
    complexity: [2, 4],
    notes: [
      // Off-beat emphasis — chords on the "and"s, bass on downbeats
      { interval: 0, step: 0, duration: 2, register: 'bass', accent: true },
      // beat "and" of 1
      { interval: 4, step: 2, duration: 2, register: 'treble', accent: true },
      { interval: 7, step: 2, duration: 2, register: 'treble' },
      // rest on beat 2 (step 4-5)
      // "and" of 2
      { interval: 4, step: 6, duration: 2, register: 'treble', accent: true },
      { interval: 7, step: 6, duration: 2, register: 'treble' },
      { interval: 0, step: 8, duration: 2, register: 'bass', accent: true },
      // "and" of 3
      { interval: 4, step: 10, duration: 2, register: 'treble', accent: true },
      { interval: 7, step: 10, duration: 2, register: 'treble' },
      // rest on beat 4 (step 12-13)
      // "and" of 4
      { interval: 4, step: 14, duration: 2, register: 'treble', embellishable: true },
      { interval: 0, step: 14, duration: 2, register: 'treble' },
    ],
  },
];

// ===== SELECTION =====

export function selectBlueprint(style: Style, config: { energy: number; complexity: number; mood: Mood }): RiffBlueprint {
  let candidates = BLUEPRINTS.filter(bp => bp.style === style);

  // Filter by energy range
  let energyMatches = candidates.filter(bp =>
    config.energy >= bp.energy[0] && config.energy <= bp.energy[1]
  );
  if (energyMatches.length > 0) candidates = energyMatches;

  // Filter by complexity range
  let complexityMatches = candidates.filter(bp =>
    config.complexity >= bp.complexity[0] && config.complexity <= bp.complexity[1]
  );
  if (complexityMatches.length > 0) candidates = complexityMatches;

  // Prefer blueprints with matching mood tags
  const moodTagged = candidates.filter(bp => bp.tags.includes(config.mood));
  if (moodTagged.length > 0) candidates = moodTagged;

  return candidates[Math.floor(Math.random() * candidates.length)];
}

// ===== VARIATION =====
// Much stronger bar-to-bar development than before

export function varyBlueprint(blueprint: RiffBlueprint, barIndex: number, totalBars: number): RiffBlueprint {
  const cyclePos = barIndex % 4;

  if (cyclePos === 0) {
    // Bar 0: original — introduce the pattern
    return blueprint;
  }

  // Deep copy notes for mutation
  const notes = blueprint.notes.map(n => ({ ...n }));

  if (cyclePos === 1) {
    // Bar 1: subtle melodic variation — swap some intervals on treble notes
    // This prevents exact repetition while keeping the same rhythm
    const trebleNotes = notes.filter(n => n.register === 'treble');
    if (trebleNotes.length >= 2) {
      // Pick one non-accented treble note to substitute
      const nonAccent = trebleNotes.filter(n => !n.accent);
      const target = nonAccent.length > 0
        ? nonAccent[Math.floor(Math.random() * nonAccent.length)]
        : null;

      if (target) {
        // Substitute with a nearby interval: 7↔5, 4↔2, 0↔0
        const subs: Record<number, number[]> = {
          0: [0],      // root stays root
          2: [4, 0],   // 2nd → 3rd or root
          4: [5, 2],   // 3rd → 4th or 2nd (passing tone!)
          5: [7, 4],   // 4th → 5th or 3rd
          7: [5, 4],   // 5th → 4th or 3rd
          10: [7, 0],  // b7 → 5th or root
        };
        const options = subs[target.interval];
        if (options && options.length > 0) {
          target.interval = options[Math.floor(Math.random() * options.length)];
        }
      }
    }

    return { ...blueprint, notes };
  }

  if (cyclePos === 2) {
    // Bar 2: extend + add energy — add 1-2 notes in gaps AND maybe shift a register
    const occupiedSteps = new Set(notes.map(n => `${n.step}-${n.register}`));

    // Try to add notes at common gap positions
    const gapSlots = [1, 3, 5, 6, 9, 11, 13, 14].filter(
      s => !occupiedSteps.has(`${s}-treble`)
    );

    // Add up to 2 notes in gaps
    const trebleIntervals = notes.filter(n => n.register === 'treble').map(n => n.interval);
    const palette = trebleIntervals.length > 0 ? trebleIntervals : [0, 4, 7];
    let added = 0;

    for (const step of gapSlots) {
      if (added >= 2) break;
      if (Math.random() < 0.5) {
        notes.push({
          interval: palette[Math.floor(Math.random() * palette.length)],
          step,
          duration: 2,
          register: 'treble',
          embellishable: true,
        });
        added++;
      }
    }

    // Melodic variation: swap one existing treble note's interval
    const trebleNotes = notes.filter(n => n.register === 'treble' && !n.accent);
    if (trebleNotes.length > 0 && Math.random() < 0.6) {
      const t = trebleNotes[Math.floor(Math.random() * trebleNotes.length)];
      // Use passing tones for color: 2nd, 4th, 6th
      const passingTones = [2, 5, 9];
      t.interval = passingTones[Math.floor(Math.random() * passingTones.length)];
    }

    return { ...blueprint, notes };
  }

  if (cyclePos === 3) {
    // Bar 3: resolve — strip back, ensure root landing, add space
    const trebleNotes = notes.filter(n => n.register === 'treble');

    // Remove ~30% of non-essential treble notes for breathing room
    const removable = trebleNotes.filter(n => !n.accent && n.step !== 0);
    const removeCount = Math.max(1, Math.floor(removable.length * 0.3));
    const toRemove = new Set<BlueprintNote>();

    // Remove from the end first (creates trailing space)
    const sorted = [...removable].sort((a, b) => b.step - a.step);
    for (let i = 0; i < removeCount && i < sorted.length; i++) {
      toRemove.add(sorted[i]);
    }

    const filteredNotes = notes.filter(n => !toRemove.has(n));

    // Ensure last treble note resolves to root
    const remainingTreble = filteredNotes.filter(n => n.register === 'treble');
    if (remainingTreble.length > 0) {
      remainingTreble.sort((a, b) => b.step - a.step);
      const lastTreble = remainingTreble[0];
      lastTreble.interval = 0;  // resolve to root
      lastTreble.duration = Math.max(lastTreble.duration, 4);
      lastTreble.embellishable = false;
    }

    return { ...blueprint, notes: filteredNotes };
  }

  return blueprint;
}

// Get all blueprints (for testing/debugging)
export function getAllBlueprints(): RiffBlueprint[] {
  return BLUEPRINTS;
}

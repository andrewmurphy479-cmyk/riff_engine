import { Mood } from './types';

// Root rankings for smooth progressions
const ROOT_RANK: Record<string, number> = {
  Em: 0,
  E: 0.5,
  C: 1,
  Am: 1.5,
  G: 2,
  D: 3,
  Dm: 3.5,
  A: 4,
  F: 5,
  B7: 6,
};

// Available chords
const CHORD_POOL = ['Em', 'C', 'G', 'D', 'Am', 'A', 'E', 'Dm', 'F', 'B7'];

// Chord templates by mood - expanded with more musical variety
// Each template is designed around common song patterns and harmonic progressions
const MOOD_TEMPLATES: Record<Mood, string[][]> = {
  uplifting: [
    // Classic I-V-vi-IV pop progressions in G
    ['G', 'D', 'Em', 'C'],
    ['C', 'G', 'Am', 'F'],
    // I-IV-V-IV rock pattern
    ['G', 'C', 'D', 'C'],
    ['A', 'D', 'E', 'D'],
    // vi-IV-I-V (Axis progression)
    ['Em', 'C', 'G', 'D'],
    // I-vi-IV-V classic pop
    ['G', 'Em', 'C', 'D'],
    // Rising motion
    ['C', 'D', 'Em', 'G'],
  ],
  sad: [
    // Minor key progressions
    ['Am', 'F', 'C', 'G'],
    ['Em', 'C', 'G', 'D'],
    // i-iv-VII-III (Aeolian)
    ['Am', 'Dm', 'G', 'C'],
    // i-VI-III-VII
    ['Em', 'C', 'G', 'D'],
    // Descending bass line feel
    ['Am', 'Am', 'F', 'E'],
    ['Em', 'D', 'C', 'D'],
    // i-VII-VI-VII turnaround
    ['Am', 'G', 'F', 'G'],
    ['Em', 'D', 'C', 'B7'],
  ],
  mysterious: [
    // Modal interchange and unexpected moves
    ['Em', 'B7', 'Am', 'Em'],
    ['Am', 'E', 'Am', 'Dm'],
    // Phrygian flavored
    ['Em', 'F', 'Em', 'D'],
    // Unexpected resolutions
    ['Em', 'C', 'B7', 'Em'],
    ['Am', 'Dm', 'E', 'Am'],
    // Chromatic approach
    ['Em', 'D', 'C', 'B7'],
    ['Am', 'E', 'F', 'E'],
  ],
  nostalgic: [
    // Gentle, familiar progressions
    ['G', 'Em', 'C', 'D'],
    ['C', 'Am', 'F', 'G'],
    // ii-V-I feel
    ['Am', 'D', 'G', 'C'],
    // Classic folk patterns
    ['Em', 'C', 'G', 'D'],
    ['G', 'C', 'G', 'D'],
    // Bittersweet
    ['Em', 'G', 'C', 'D'],
    ['Am', 'C', 'G', 'F'],
  ],
  gritty: [
    // Power chord friendly, driving
    ['E', 'A', 'D', 'A'],
    ['Am', 'E', 'Am', 'E'],
    // Blues rock
    ['E', 'D', 'A', 'E'],
    ['A', 'D', 'E', 'A'],
    // Aggressive minor
    ['Am', 'F', 'E', 'Am'],
    ['Em', 'D', 'C', 'D'],
    // Punchy
    ['G', 'D', 'Am', 'C'],
    ['E', 'G', 'D', 'A'],
  ],
  cinematic: [
    // Epic, building progressions
    ['Em', 'C', 'G', 'D'],
    ['Am', 'F', 'C', 'G'],
    // Dramatic tension
    ['Em', 'B7', 'C', 'D'],
    ['Am', 'Dm', 'E', 'Am'],
    // Sweeping motion
    ['C', 'G', 'Am', 'Em'],
    ['G', 'D', 'Em', 'C'],
    // Film score staples
    ['Em', 'G', 'D', 'C'],
    ['Am', 'C', 'G', 'Em'],
  ],
  driving: [
    // High energy, forward motion
    ['A', 'D', 'E', 'A'],
    ['E', 'A', 'B7', 'E'],
    ['G', 'D', 'Em', 'C'],
    // Relentless
    ['D', 'A', 'G', 'A'],
    ['E', 'D', 'A', 'E'],
    // Punk/rock patterns
    ['G', 'C', 'D', 'G'],
    ['A', 'E', 'D', 'E'],
    // Anthemic
    ['G', 'D', 'C', 'D'],
  ],
  dreamy: [
    // Floating, suspended feel
    ['Am', 'C', 'G', 'F'],
    ['Em', 'C', 'G', 'D'],
    // Gentle ambiguity
    ['C', 'Am', 'Em', 'G'],
    ['Am', 'F', 'C', 'E'],
    // Ethereal
    ['Em', 'Am', 'C', 'G'],
    ['G', 'Em', 'Am', 'D'],
    // Shoegaze-influenced
    ['Em', 'G', 'C', 'Am'],
    ['Am', 'Em', 'F', 'C'],
  ],
  tense: [
    // Unresolved, building tension
    ['Em', 'B7', 'Am', 'B7'],
    ['Am', 'E', 'Dm', 'E'],
    // Dissonant motion
    ['Em', 'F', 'Am', 'B7'],
    ['Am', 'Dm', 'E', 'E'],
    // Suspenseful
    ['Em', 'Am', 'D', 'B7'],
    ['Am', 'Dm', 'Am', 'E'],
    // Thriller-like
    ['Em', 'C', 'Am', 'B7'],
    ['Am', 'E', 'Am', 'Dm'],
  ],
  soulful: [
    // R&B influenced, smooth
    ['Am', 'Dm', 'G', 'C'],
    ['Em', 'A', 'D', 'G'],
    // ii-V-I jazz feel
    ['Dm', 'G', 'C', 'Am'],
    ['Am', 'D', 'G', 'Em'],
    // Gospel-influenced
    ['C', 'F', 'G', 'Am'],
    ['G', 'C', 'Am', 'D'],
    // Smooth grooves
    ['Em', 'Am', 'D', 'G'],
    ['Am', 'F', 'C', 'E'],
  ],
};

// Turnarounds - optional endings that create smooth loops
const TURNAROUNDS: Record<string, string[]> = {
  'G': ['D', 'Em', 'D'],
  'C': ['G', 'Am', 'G'],
  'Em': ['B7', 'Am', 'B7'],
  'Am': ['E', 'Dm', 'E'],
  'A': ['E', 'D', 'E'],
  'E': ['B7', 'A', 'B7'],
  'D': ['A', 'G', 'A'],
};

// Calculate how smooth a progression is
function progressionScore(prog: string[], loop = true): number {
  let score = 0;
  for (let i = 1; i < prog.length; i++) {
    const prevRank = ROOT_RANK[prog[i - 1]] ?? 0;
    const currRank = ROOT_RANK[prog[i]] ?? 0;
    score += 1.0 - Math.min(1.0, Math.abs(currRank - prevRank) / 3.0);
  }
  if (loop && prog.length > 1) {
    const firstRank = ROOT_RANK[prog[0]] ?? 0;
    const lastRank = ROOT_RANK[prog[prog.length - 1]] ?? 0;
    score += 1.0 - Math.min(1.0, Math.abs(firstRank - lastRank) / 3.0);
  }
  return score;
}

// Random choice from array
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Weighted random choice
function weightedChoice<T>(items: T[], weights: number[]): T {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) return items[i];
  }
  return items[items.length - 1];
}

// Generate a chord progression
export function generateProgression(
  mood: Mood,
  length = 4,
  bluesyFeel = 3,
  energy = 3,
  allowedChords?: string[]
): string[] {
  const templates = MOOD_TEMPLATES[mood] || MOOD_TEMPLATES.uplifting;

  // Filter chord pool by allowed chords if specified
  const chordPool = allowedChords
    ? CHORD_POOL.filter((c) => allowedChords.includes(c))
    : CHORD_POOL;

  // Filter templates to only use allowed chords
  const filteredTemplates = allowedChords
    ? templates.filter((t) => t.every((chord) => allowedChords.includes(chord)))
    : templates;

  // Higher energy = more likely to use non-template progressions
  const templateProb = Math.max(0.3, 0.8 - (energy - 1) * 0.1);

  // Bluesy feel increases weight of B7 and E chords
  const bluesWeight = 1.0 + (bluesyFeel - 1) * 0.3;

  let prog: string[];

  if (filteredTemplates.length > 0 && Math.random() < templateProb) {
    // Use a template and pick the best scoring one
    const template = [...filteredTemplates].sort(
      (a, b) => progressionScore(b) - progressionScore(a)
    )[Math.floor(Math.random() * Math.min(2, filteredTemplates.length))];
    prog = [...template];
  } else {
    // Generate random progression
    const weights = chordPool.map((c) => {
      let w = 1.0;
      if (['B7', 'E', 'D'].includes(c)) w *= bluesWeight;
      return w;
    });

    prog = [];
    while (prog.length < length) {
      const candidates = chordPool.filter((c) => c !== prog[prog.length - 1]);
      if (candidates.length === 0) break;
      const candWeights = candidates.map(
        (c) => weights[chordPool.indexOf(c)]
      );
      prog.push(weightedChoice(candidates, candWeights));
    }
  }

  // Extend if needed
  while (prog.length < length) {
    if (Math.random() < 0.3) {
      const candidates = chordPool.filter((c) => c !== prog[prog.length - 1]);
      if (candidates.length > 0) {
        prog.push(randomChoice(candidates));
      }
    } else if (prog.length > 0) {
      prog.push(prog[prog.length % prog.length]);
    }
  }

  return prog.slice(0, length);
}

// Generate 12-bar blues progression
export function generate12BarBlues(): string[] {
  // Classic E blues with B7
  return ['E', 'E', 'E', 'E', 'A', 'A', 'E', 'E', 'B7', 'A', 'E', 'B7'];
}

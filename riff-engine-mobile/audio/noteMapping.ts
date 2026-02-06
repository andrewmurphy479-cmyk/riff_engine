import { GuitarString, TabEvent } from '../engine/types';

// String to MIDI note mapping (standard tuning)
const STRING_MIDI_BASE: Record<GuitarString, number> = {
  E: 40, // Low E string (E2)
  A: 45, // A string (A2)
  D: 50, // D string (D3)
  G: 55, // G string (G3)
  B: 59, // B string (B3)
  e: 64, // High e string (E4)
};

// Convert fret to MIDI note number
export function fretToMidiNote(string: GuitarString, fret: number): number {
  const base = STRING_MIDI_BASE[string] ?? 40;
  return base + fret;
}

// Convert MIDI note number to frequency (Hz)
export function midiToFrequency(midiNote: number): number {
  // A4 = MIDI 69 = 440 Hz
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// Convert guitar note to frequency
export function noteToFrequency(string: GuitarString, fret: number): number {
  const midiNote = fretToMidiNote(string, fret);
  return midiToFrequency(midiNote);
}

// Convert event to frequency
export function eventToFrequency(event: TabEvent): number {
  return noteToFrequency(event.string, event.fret);
}

// Convert note name to frequency (for reference)
export function noteNameToFrequency(name: string): number {
  const noteMap: Record<string, number> = {
    'E2': 82.41, 'F2': 87.31, 'F#2': 92.50, 'G2': 98.00, 'G#2': 103.83,
    'A2': 110.00, 'A#2': 116.54, 'B2': 123.47,
    'C3': 130.81, 'C#3': 138.59, 'D3': 146.83, 'D#3': 155.56, 'E3': 164.81,
    'F3': 174.61, 'F#3': 185.00, 'G3': 196.00, 'G#3': 207.65,
    'A3': 220.00, 'A#3': 233.08, 'B3': 246.94,
    'C4': 261.63, 'C#4': 277.18, 'D4': 293.66, 'D#4': 311.13, 'E4': 329.63,
    'F4': 349.23, 'F#4': 369.99, 'G4': 392.00, 'G#4': 415.30,
    'A4': 440.00, 'A#4': 466.16, 'B4': 493.88,
  };
  return noteMap[name] ?? 440;
}

// Generate schedule for Tone.js playback
export interface ToneEvent {
  frequency: number;
  time: number;      // in seconds
  duration: number;  // in seconds
}

export function generateToneSchedule(
  events: TabEvent[],
  bpm: number,
  stepsPerBeat = 4
): ToneEvent[] {
  const secondsPerStep = 60 / bpm / stepsPerBeat;

  return events.map((event) => ({
    frequency: eventToFrequency(event),
    time: event.step * secondsPerStep,
    duration: event.duration * secondsPerStep,
  }));
}

// Get the total duration of events in seconds
export function getTotalDuration(
  events: TabEvent[],
  bpm: number,
  stepsPerBeat = 4
): number {
  if (events.length === 0) return 0;

  const maxStep = Math.max(...events.map((e) => e.step + e.duration));
  const secondsPerStep = 60 / bpm / stepsPerBeat;
  return maxStep * secondsPerStep;
}

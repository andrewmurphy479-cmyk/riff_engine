import { Preset } from './types';

export const PRESETS: Preset[] = [
  {
    id: 'chill-blues',
    name: 'Chill Blues',
    mood: 'soulful',
    style: 'travis',
    tempo: 85,
    bass: 4,
    blues: 5,
    complexity: 2,
    energy: 2,
  },
  {
    id: 'driving-rock',
    name: 'Driving Rock',
    mood: 'driving',
    style: 'strum',
    tempo: 130,
    bass: 4,
    blues: 2,
    complexity: 3,
    energy: 4,
  },
  {
    id: 'mellow-jazz',
    name: 'Mellow Jazz',
    mood: 'dreamy',
    style: 'arpeggio',
    tempo: 75,
    bass: 3,
    blues: 3,
    complexity: 4,
    energy: 2,
  },
  {
    id: 'indie-folk',
    name: 'Indie Folk',
    mood: 'nostalgic',
    style: 'travis',
    tempo: 95,
    bass: 3,
    blues: 2,
    complexity: 2,
    energy: 2,
  },
  {
    id: 'cinematic',
    name: 'Cinematic',
    mood: 'cinematic',
    style: 'arpeggio',
    tempo: 70,
    bass: 4,
    blues: 1,
    complexity: 3,
    energy: 4,
  },
  {
    id: 'gritty-punk',
    name: 'Gritty Punk',
    mood: 'gritty',
    style: 'strum',
    tempo: 140,
    bass: 5,
    blues: 2,
    complexity: 2,
    energy: 5,
  },
];

export function getPresetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export interface ChordCardMeta {
  nickname: string;
  flavorText: string;
  quality: 'major' | 'minor' | 'dom7';
  pairsWellWith: string[];
  difficultyTier: 1 | 2 | 3;
}

export const CHORD_CARD_DATA: Record<string, ChordCardMeta> = {
  Em: {
    nickname: 'The Wanderer',
    flavorText: 'Haunting and introspective, the foundation of countless ballads',
    quality: 'minor',
    pairsWellWith: ['C', 'G', 'Am', 'Bm'],
    difficultyTier: 1,
  },
  C: {
    nickname: 'The Anchor',
    flavorText: 'Bright and resolved, where every journey begins',
    quality: 'major',
    pairsWellWith: ['G', 'Am', 'F', 'G7'],
    difficultyTier: 1,
  },
  G: {
    nickname: 'The Storyteller',
    flavorText: 'Full and ringing, the backbone of folk and rock',
    quality: 'major',
    pairsWellWith: ['C', 'D', 'Em', 'Cadd9'],
    difficultyTier: 1,
  },
  D: {
    nickname: 'The Spark',
    flavorText: 'Compact and bright, its F# gives it a distinctive sparkle',
    quality: 'major',
    pairsWellWith: ['G', 'A', 'Em', 'A7'],
    difficultyTier: 1,
  },
  Am: {
    nickname: 'The Poet',
    flavorText: 'Melancholy but versatile, the relative minor of C',
    quality: 'minor',
    pairsWellWith: ['C', 'Em', 'F', 'E7'],
    difficultyTier: 1,
  },
  A: {
    nickname: 'The Troubadour',
    flavorText: 'Warm and open, fueling rock and country alike',
    quality: 'major',
    pairsWellWith: ['D', 'E', 'B7', 'A7'],
    difficultyTier: 2,
  },
  E: {
    nickname: 'The Titan',
    flavorText: 'The fullest open chord, a natural home key for guitar',
    quality: 'major',
    pairsWellWith: ['A', 'B7', 'Am', 'E7'],
    difficultyTier: 2,
  },
  Dm: {
    nickname: 'The Drifter',
    flavorText: 'A compact minor voice on the upper strings, quietly intense',
    quality: 'minor',
    pairsWellWith: ['Am', 'F', 'C'],
    difficultyTier: 2,
  },
  F: {
    nickname: 'The Gatekeeper',
    flavorText: 'The IV chord in C major, a rite of passage for every player',
    quality: 'major',
    pairsWellWith: ['C', 'Am', 'Dm', 'G7'],
    difficultyTier: 3,
  },
  B7: {
    nickname: 'The Provocateur',
    flavorText: 'Dominant tension that demands resolution, dripping with blues',
    quality: 'dom7',
    pairsWellWith: ['Em', 'E', 'A', 'E7'],
    difficultyTier: 3,
  },
  A7: {
    nickname: 'The Instigator',
    flavorText: 'One lifted finger transforms A major into a bluesy troublemaker',
    quality: 'dom7',
    pairsWellWith: ['D', 'E', 'Em', 'B7'],
    difficultyTier: 1,
  },
  E7: {
    nickname: 'The Catalyst',
    flavorText: 'The full six-string dominant that kickstarts every blues turnaround',
    quality: 'dom7',
    pairsWellWith: ['Am', 'A', 'B7', 'E'],
    difficultyTier: 1,
  },
  D7: {
    nickname: 'The Trickster',
    flavorText: 'Compact and sly, sneaking dominant tension into the upper strings',
    quality: 'dom7',
    pairsWellWith: ['G', 'C', 'Am', 'A7'],
    difficultyTier: 2,
  },
  G7: {
    nickname: 'The Herald',
    flavorText: 'Announces the arrival of C major with irresistible dominant pull',
    quality: 'dom7',
    pairsWellWith: ['C', 'F', 'Am', 'D7'],
    difficultyTier: 2,
  },
  Bm: {
    nickname: 'The Dark Knight',
    flavorText: 'Your first barre chord — a rite of passage with a brooding voice',
    quality: 'minor',
    pairsWellWith: ['G', 'D', 'A', 'Em'],
    difficultyTier: 3,
  },
  Cadd9: {
    nickname: 'The Dreamer',
    flavorText: 'A shimmering open voicing that turns ordinary pop into something luminous',
    quality: 'major',
    pairsWellWith: ['G', 'Em', 'D', 'Am'],
    difficultyTier: 1,
  },
};

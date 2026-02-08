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
    pairsWellWith: ['C', 'G', 'Am'],
    difficultyTier: 1,
  },
  C: {
    nickname: 'The Anchor',
    flavorText: 'Bright and resolved, where every journey begins',
    quality: 'major',
    pairsWellWith: ['G', 'Am', 'F'],
    difficultyTier: 1,
  },
  G: {
    nickname: 'The Storyteller',
    flavorText: 'Full and ringing, the backbone of folk and rock',
    quality: 'major',
    pairsWellWith: ['C', 'D', 'Em'],
    difficultyTier: 1,
  },
  D: {
    nickname: 'The Spark',
    flavorText: 'Compact and bright, its F# gives it a distinctive sparkle',
    quality: 'major',
    pairsWellWith: ['G', 'A', 'Em'],
    difficultyTier: 1,
  },
  Am: {
    nickname: 'The Poet',
    flavorText: 'Melancholy but versatile, the relative minor of C',
    quality: 'minor',
    pairsWellWith: ['C', 'Em', 'F'],
    difficultyTier: 1,
  },
  A: {
    nickname: 'The Troubadour',
    flavorText: 'Warm and open, fueling rock and country alike',
    quality: 'major',
    pairsWellWith: ['D', 'E', 'B7'],
    difficultyTier: 2,
  },
  E: {
    nickname: 'The Titan',
    flavorText: 'The fullest open chord, a natural home key for guitar',
    quality: 'major',
    pairsWellWith: ['A', 'B7', 'Am'],
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
    pairsWellWith: ['C', 'Am', 'Dm'],
    difficultyTier: 3,
  },
  B7: {
    nickname: 'The Provocateur',
    flavorText: 'Dominant tension that demands resolution, dripping with blues',
    quality: 'dom7',
    pairsWellWith: ['Em', 'E', 'A'],
    difficultyTier: 3,
  },
};

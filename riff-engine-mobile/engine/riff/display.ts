export const ROLE_COLORS: Record<string, string> = {
  root: "#4A7AFF",
  b3:   "#C8B560",
  "4":  "#5AAFA8",
  "5":  "#FF7043",
  b7:   "#B968D6",
  blue: "#FF8F00",
  "?":  "#888888",
};

export const ROLE_ORDER = ["root", "b3", "4", "5", "b7", "blue"] as const;

export const PHRASE_LABELS: Record<string, readonly string[]> = {
  "AA'AB": ["A", "A'", "A", "B"],
  AABA:    ["A", "A", "B", "A"],
  ABAB:    ["A", "B", "A", "B"],
  AAAB:    ["A", "A", "A", "B"],
};

export const SCALE_PRETTY: Record<string, string> = {
  minor_pentatonic:        "1 b3 4 5 b7",
  "minor_pentatonic+blue": "1 b3 4 b5 5 b7",
};

export const SCALE_DESCRIPTIONS: Record<string, string> = {
  minor_pentatonic:
    "The rock and blues pocket. Five notes — root, flat third, fourth, fifth, flat seventh — that fit under the fingers of a single hand position. Almost every rock and blues solo you know lives inside this shape.",
  "minor_pentatonic+blue":
    "Minor pentatonic with the blue note (b5) added. The b5 is pure tension with no resolution — guitarists lean on it for the gritty, bluesy bite that defines the style. Use it in passing, not as a landing point.",
};

export const PHRASE_NARRATIVES: Record<string, string> = {
  "AA'AB":
    "Statement, variation, restate, answer. Bars 1 and 3 repeat the hook verbatim so it burns into your ear. Bar 2 keeps the same rhythm but varies the notes — a fresh take on the same phrase. Bar 4 answers with new material, giving the riff a landing point. It's the grammar of almost every memorable riff.",
  AABA:
    "Statement, restate, answer, return. The hook opens, repeats itself, takes a detour in bar 3, then comes home for the final bar. Common in jazz standards and folk tunes.",
  ABAB:
    "Call and response. Bars 1 and 3 make the statement; bars 2 and 4 answer it. Simple, conversational, and easy for the ear to track.",
  AAAB:
    "Three statements, one answer. The hook lands three times before the final bar cuts away. Builds hypnotic repetition, then breaks it.",
};

export const RHYTHM_DESCRIPTIONS: Record<string, string> = {
  four_on_floor:
    "A note on every beat — steady, relentless, no gaps. The most propulsive rhythm in rock; the heart of driving rhythms.",
  straight_8ths:
    "Eighth notes, no rests — a constant stream of activity. Busy, forward, and urgent. Classic punk and rock engine.",
  push_and_4:
    "Pairs of eighths clustered around the downbeats with gaps in between. Gives the riff a push-and-pull feel — driving, but with room to breathe.",
  half_gallop:
    "Short-short-long, short-short-long. The galloping rhythm that defines metal riffs from Iron Maiden to Metallica. Urgent and percussive.",
  sabbath_space:
    "One long note at the top, then three shorter ones spaced across the bar. Heavy, patient, ominous — Black Sabbath's signature pocket. The space is what makes it hit.",
  iron_stomp:
    "Two long notes up front, then a tight cluster at the end. Plants the riff firmly, then punctuates. Stomping, physical, no-nonsense heavy.",
  ac_dc_bounce:
    "Pairs of notes skipping across the bar with rests between them. That unmistakable AC/DC bounce — loose, swaggering, impossible to sit still to.",
  funk_skip:
    "Syncopated single notes hitting off the beat. Tight, percussive, and groove-forward — funk's answer to the rock riff.",
  sparse_hook:
    "Just three notes across the whole bar. Minimal, confident, and memorable — leaves enormous space around each hit. The riff is what you don't play.",
  laid_answer:
    "Two long notes, then a short answer phrase at the end. Relaxed and conversational — states an idea and lets it breathe before replying.",
};

export const ROLE_NARRATIVES: Record<string, string> = {
  root: "The root grounds the phrase. Coming home to it is how the ear knows the riff has resolved.",
  b3: "The flat third is what makes it minor. Without it, the riff would sound bright and major — the b3 is the dark color.",
  "4": "The fourth adds suspended tension. It pulls toward the fifth but can also sit on its own for a moment of ambiguity.",
  "5": "The fifth is the second-most-stable note after the root. Big, open, and unshakeable — always safe to land on.",
  b7: "The flat seventh is the blues color tone. It creates that yearning, unresolved pull that defines rock and blues phrasing.",
  blue: "The blue note (b5) is pure grit. No resolution — it's there for tension and bite. This is what makes a riff snarl.",
};

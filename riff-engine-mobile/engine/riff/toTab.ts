/**
 * Human-readable ASCII tab + theory readout for a RiffSpec, for terminal
 * batch audits. Ported from updated_engine_logic/render/to_tab.py and
 * extended with technique glyphs and a dynamics row so palm mutes and
 * accents are visible without listening.
 */
import { midiAt } from "./fretboard";
import { roleOf } from "./scale";
import { Bar, RiffSpec } from "./spec";

const STRING_LABELS = ["E", "A", "D", "G", "B", "e"] as const; // low to high
const STEPS_PER_BAR = 16;
const SECTION_WIDTH = 72;

const PHRASE_LABELS: Record<string, readonly string[]> = {
  "AA'AB": ["A", "A'", "A", "B"],
  AABA: ["A", "A", "B", "A"],
  ABAB: ["A", "B", "A", "B"],
  AAAB: ["A", "A", "A", "B"],
};

const PHRASE_NARRATIVES: Record<string, string> = {
  "AA'AB": "statement -> variation -> restate -> answer",
  AABA: "statement -> restate -> answer -> restate",
  ABAB: "statement -> answer -> statement -> answer",
  AAAB: "statement x3 -> answer",
};

const SCALE_DESCRIPTIONS: Record<string, string> = {
  minor_pentatonic: "1, b3, 4, 5, b7 -- the rock/blues pocket",
  "minor_pentatonic+blue": "1, b3, 4, b5, 5, b7 -- pentatonic with the blue note",
};

const TECHNIQUE_GLYPH: Record<string, string> = {
  hammer: "h",
  pull: "p",
  bend: "^",
  mute: "x",
};

function gridLines(riff: RiffSpec): string[] {
  const totalSteps = riff.bars.length * STEPS_PER_BAR;
  const grid: string[][] = Array.from({ length: 6 }, () =>
    new Array<string>(totalSteps).fill("--"),
  );

  riff.bars.forEach((bar, barIdx) => {
    for (const note of bar.notes) {
      const col = barIdx * STEPS_PER_BAR + note.step;
      grid[note.string][col] = String(note.fret).padStart(2);
    }
  });

  const lines: string[] = [];
  for (let s = 5; s >= 0; s--) {
    const barStrs: string[] = [];
    for (let barIdx = 0; barIdx < riff.bars.length; barIdx++) {
      const start = barIdx * STEPS_PER_BAR;
      barStrs.push(grid[s].slice(start, start + STEPS_PER_BAR).join(""));
    }
    lines.push(`   ${STRING_LABELS[s]}|` + barStrs.join("|") + "|");
  }
  return lines;
}

/** One row per bar: '>' accent, '-' normal, '.' ghost, by absolute velocity. */
function dynamicsLine(riff: RiffSpec): string {
  const totalSteps = riff.bars.length * STEPS_PER_BAR;
  const row = new Array<string>(totalSteps).fill("  ");
  riff.bars.forEach((bar, barIdx) => {
    for (const note of bar.notes) {
      const col = barIdx * STEPS_PER_BAR + note.step;
      const glyph = note.velocity >= 100 ? ">" : note.velocity <= 60 ? "." : "-";
      row[col] = ` ${glyph}`;
    }
  });
  const barStrs: string[] = [];
  for (let barIdx = 0; barIdx < riff.bars.length; barIdx++) {
    const start = barIdx * STEPS_PER_BAR;
    barStrs.push(row.slice(start, start + STEPS_PER_BAR).join(""));
  }
  return "   d|" + barStrs.join("|") + "|";
}

function barRoles(bar: Bar, key: string, includeBlue: boolean): string[] {
  return [...bar.notes]
    .sort((a, b) => a.step - b.step)
    .map((note) => {
      const midi = midiAt(note.string, note.fret);
      const role = roleOf(midi, key, includeBlue) ?? "?";
      const glyph = TECHNIQUE_GLYPH[note.technique];
      return glyph ? `${role}${glyph}` : role;
    });
}

export function renderTab(riff: RiffSpec, title?: string): string {
  const includeBlue = riff.scale.includes("blue");
  const scalePretty = riff.scale.replace(/_/g, " ").replace("+blue", " + blue note");
  const scaleDesc = SCALE_DESCRIPTIONS[riff.scale] ?? "";
  const phraseTags =
    PHRASE_LABELS[riff.motif_structure] ?? riff.bars.map(() => "?");
  const phraseStory = PHRASE_NARRATIVES[riff.motif_structure] ?? "";
  const notesPerBar = riff.bars[0]?.notes.length ?? 0;

  const lines: string[] = [];
  lines.push("=".repeat(SECTION_WIDTH));
  lines.push(title ? ` ${title}      seed ${riff.seed}` : ` seed ${riff.seed}`);
  lines.push("=".repeat(SECTION_WIDTH));
  lines.push("");

  let keyValue = `${riff.key} ${scalePretty}`;
  if (scaleDesc) keyValue += `   (${scaleDesc})`;
  lines.push(`   Key            ${keyValue}`);
  lines.push(`   Tempo          ${riff.tempo_bpm} BPM`);
  if (riff.feel) lines.push(`   Feel           ${riff.feel}`);
  if (riff.rhythm_name) {
    lines.push(
      `   Rhythm motif   ${riff.rhythm_name}   (${notesPerBar} notes per bar)`,
    );
  } else {
    lines.push(`   Notes/bar      ${notesPerBar}`);
  }
  const phraseStr = phraseTags.join("  ");
  lines.push(
    phraseStory
      ? `   Phrase         ${phraseStr}   (${phraseStory})`
      : `   Phrase         ${phraseStr}`,
  );

  lines.push("");
  lines.push("   Tab            (dynamics row: > accent, - normal, . ghost)");
  lines.push(...gridLines(riff));
  lines.push(dynamicsLine(riff));
  lines.push("");

  lines.push(
    "   Note roles per bar  (suffix: h hammer, p pull, x palm-mute, ^ bend)",
  );
  const roleColWidths = riff.bars.map((bar) => {
    const roles = barRoles(bar, riff.key, includeBlue);
    return Math.max(...roles.map((r) => r.length), 1);
  });
  riff.bars.forEach((bar, i) => {
    const tag = phraseTags[i] ?? "?";
    const roles = barRoles(bar, riff.key, includeBlue);
    const width = Math.max(roleColWidths[i], 4);
    const rolesStr = roles.map((r) => r.padEnd(width)).join("  ");
    lines.push(`     Bar ${i + 1}  (${tag.padEnd(2)}) :  ${rolesStr}`);
  });

  return lines.join("\n");
}

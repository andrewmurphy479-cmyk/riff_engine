/**
 * Diversity metrics for batches of generated riffs.
 *
 * Ported from updated_engine_logic/engine/metrics.py (the TS engine is now
 * the source of truth). Extracts per-riff fingerprints (rhythm + interval
 * shape + role usage + fret region + dynamics + techniques), groups
 * transposition-clones, and aggregates histograms across a batch so you can
 * see *where* variety is thin without listening to 200 riffs.
 *
 * Failure modes this catches that the ear misses:
 *   - one rhythm template eating the distribution
 *   - the same melodic shape reproduced in different keys
 *   - every riff parked in frets 0-5
 *   - scale-role usage heavily skewed toward root
 *
 * The Python original also rendered an HTML report; here the renderer is
 * plain text for terminal batch audits.
 */
import { midiAt } from "./fretboard";
import { roleOf } from "./scale";
import { RiffSpec } from "./spec";

export interface RiffFingerprint {
  riffId: string;
  key: string;
  tempo: number;
  feel: string | null;
  blue: boolean;
  rhythmName: string | null;
  intervals: readonly number[];
  roles: readonly string[];
  techniques: readonly string[];
  fretMin: number;
  fretMax: number;
  fretMean: number;
  velocityMin: number;
  velocityMax: number;
  notesBar0: number;
}

export function fingerprint(riffId: string, riff: RiffSpec): RiffFingerprint {
  const flat = riff.bars.flatMap((bar) => bar.notes);
  const midis = flat.map((n) => midiAt(n.string, n.fret));
  const includeBlue = riff.scale.includes("blue");
  const roles = midis.map((m) => roleOf(m, riff.key, includeBlue) ?? "?");
  const intervals = midis.slice(1).map((m, i) => m - midis[i]);
  const frets = flat.map((n) => n.fret);
  const velocities = flat.map((n) => n.velocity);
  return {
    riffId,
    key: riff.key,
    tempo: riff.tempo_bpm,
    feel: riff.feel,
    blue: includeBlue,
    rhythmName: riff.rhythm_name,
    intervals,
    roles,
    techniques: flat.map((n) => n.technique),
    fretMin: Math.min(...frets),
    fretMax: Math.max(...frets),
    fretMean: frets.reduce((a, b) => a + b, 0) / frets.length,
    velocityMin: Math.min(...velocities),
    velocityMax: Math.max(...velocities),
    notesBar0: riff.bars[0]?.notes.length ?? 0,
  };
}

const FRET_REGIONS: readonly (readonly [string, number, number])[] = [
  ["open (0-2)", 0, 2],
  ["low (3-5)", 3, 5],
  ["mid (6-9)", 6, 9],
  ["high (10+)", 10, 24],
];

export function fretRegion(meanFret: number): string {
  for (const [name, lo, hi] of FRET_REGIONS) {
    if (meanFret >= lo && meanFret <= hi) return name;
  }
  return FRET_REGIONS[FRET_REGIONS.length - 1][0];
}

/**
 * Group fingerprints by (rhythm, intervals). Same rhythm + same melodic
 * shape = transposition-clone, even across keys.
 */
export function findCloneClusters(
  fps: readonly RiffFingerprint[],
): RiffFingerprint[][] {
  const groups = new Map<string, RiffFingerprint[]>();
  for (const fp of fps) {
    const key = `${fp.rhythmName}|${fp.intervals.join(",")}`;
    const group = groups.get(key);
    if (group) group.push(fp);
    else groups.set(key, [fp]);
  }
  const clusters = [...groups.values()].filter((g) => g.length > 1);
  clusters.sort((a, b) => b.length - a.length);
  return clusters;
}

export type Hist = Map<string, number>;

function count(items: Iterable<string>): Hist {
  const hist: Hist = new Map();
  for (const item of items) {
    hist.set(item, (hist.get(item) ?? 0) + 1);
  }
  return hist;
}

function mostCommon(hist: Hist): [string, number] | null {
  let best: [string, number] | null = null;
  for (const [k, v] of hist) {
    if (!best || v > best[1]) best = [k, v];
  }
  return best;
}

export interface DiversityReport {
  label: string;
  total: number;
  cloneClusters: RiffFingerprint[][];
  rhythmHist: Hist;
  roleHist: Hist;
  intervalHist: Hist;
  techniqueHist: Hist;
  fretRegionHist: Hist;
  keyHist: Hist;
  tempoHist: Hist;
  perFeel: Map<string, DiversityReport>;
  flags: string[];
}

function computeSubReport(
  label: string,
  fps: readonly RiffFingerprint[],
  splitByFeel: boolean,
): DiversityReport {
  const rhythmHist = count(fps.map((fp) => String(fp.rhythmName)));
  const roleHist = count(fps.flatMap((fp) => [...fp.roles]));
  const intervalHist = count(
    fps.flatMap((fp) => fp.intervals.map((iv) => (iv > 0 ? `+${iv}` : `${iv}`))),
  );
  const techniqueHist = count(fps.flatMap((fp) => [...fp.techniques]));
  const fretRegionHist = count(fps.map((fp) => fretRegion(fp.fretMean)));
  const keyHist = count(fps.map((fp) => fp.key));
  const tempoHist = count(fps.map((fp) => `${fp.tempo} BPM`));

  const cloneClusters = findCloneClusters(fps);

  const flags: string[] = [];
  const total = fps.length;
  if (total && cloneClusters.length) {
    const cloned = cloneClusters.reduce((a, c) => a + c.length, 0);
    flags.push(
      `${cloned} riffs (${Math.round((cloned / total) * 100)}%) are ` +
        `transposition-clones in ${cloneClusters.length} cluster` +
        `${cloneClusters.length !== 1 ? "s" : ""}.`,
    );
  }
  const topRhythm = mostCommon(rhythmHist);
  if (total && topRhythm && topRhythm[1] / total > 0.3) {
    flags.push(
      `Rhythm '${topRhythm[0]}' dominates: ${topRhythm[1]} riffs ` +
        `(${Math.round((topRhythm[1] / total) * 100)}%).`,
    );
  }
  const topRegion = mostCommon(fretRegionHist);
  if (total && topRegion && topRegion[1] / total > 0.6) {
    flags.push(
      `Fret region '${topRegion[0]}' dominates: ` +
        `${Math.round((topRegion[1] / total) * 100)}% of riffs live here.`,
    );
  }
  const roleTotal = [...roleHist.values()].reduce((a, b) => a + b, 0);
  const rootShare = roleTotal ? (roleHist.get("root") ?? 0) / roleTotal : 0;
  if (total && rootShare > 0.45 && !isPedalHeavy(rhythmHist)) {
    flags.push(
      `Root note is ${Math.round(rootShare * 100)}% of all notes - ` +
        `melodies may feel stuck on the tonic.`,
    );
  }

  const perFeel = new Map<string, DiversityReport>();
  if (splitByFeel) {
    const feels = [...new Set(fps.map((fp) => fp.feel).filter(Boolean))] as string[];
    feels.sort();
    for (const feel of feels) {
      perFeel.set(
        feel,
        computeSubReport(feel, fps.filter((fp) => fp.feel === feel), false),
      );
    }
  }

  return {
    label,
    total,
    cloneClusters,
    rhythmHist,
    roleHist,
    intervalHist,
    techniqueHist,
    fretRegionHist,
    keyHist,
    tempoHist,
    perFeel,
    flags,
  };
}

/** Pedal chugs are root-heavy by design; skip the tonic-share flag when the
 * batch is dominated by pedal templates so audits don't cry wolf. */
function isPedalHeavy(rhythmHist: Hist): boolean {
  const pedalNames = ["highway_chug", "gallop_drive", "doom_chug", "thunder_gallop"];
  const total = [...rhythmHist.values()].reduce((a, b) => a + b, 0);
  if (!total) return false;
  const pedal = pedalNames.reduce((a, n) => a + (rhythmHist.get(n) ?? 0), 0);
  return pedal / total > 0.4;
}

export function computeReport(fps: readonly RiffFingerprint[]): DiversityReport {
  return computeSubReport("all riffs", fps, true);
}

// --- Text rendering --------------------------------------------------------

const BAR_WIDTH = 30;

function histLines(title: string, hist: Hist, total: number, sortByKey = false): string[] {
  if (hist.size === 0) return [`  ${title}: (empty)`];
  let items = [...hist.entries()];
  if (sortByKey) {
    items.sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }));
  } else {
    items.sort((a, b) => b[1] - a[1]);
  }
  const labelWidth = Math.max(...items.map(([k]) => k.length), 8);
  const lines = [`  ${title}`];
  for (const [k, v] of items) {
    const frac = total ? v / total : 0;
    const filled = Math.round(frac * BAR_WIDTH);
    const bar = "#".repeat(filled).padEnd(BAR_WIDTH, ".");
    lines.push(
      `    ${k.padEnd(labelWidth)}  ${bar}  ${String(v).padStart(4)}  (${Math.round(frac * 100)}%)`,
    );
  }
  return lines;
}

export function renderReportText(report: DiversityReport): string {
  const lines: string[] = [];
  const total = report.total;
  const clonedIds = new Set(
    report.cloneClusters.flatMap((c) => c.map((fp) => fp.riffId)),
  );

  lines.push("=".repeat(72));
  lines.push(` VARIETY REPORT — ${report.label}`);
  lines.push("=".repeat(72));
  lines.push("");
  lines.push(`  total riffs     ${total}`);
  lines.push(`  unique shapes   ${total - clonedIds.size}`);
  lines.push(`  clone clusters  ${report.cloneClusters.length}`);
  lines.push(`  rhythms used    ${report.rhythmHist.size}`);
  lines.push("");

  if (report.flags.length) {
    lines.push("  FLAGS");
    for (const flag of report.flags) lines.push(`    ! ${flag}`);
  } else {
    lines.push("  No diversity flags tripped.");
  }
  lines.push("");

  lines.push(...histLines("Rhythm templates", report.rhythmHist, total));
  lines.push("");
  const intervalTotal = [...report.intervalHist.values()].reduce((a, b) => a + b, 0);
  lines.push(
    ...histLines("Interval distribution (semitones)", report.intervalHist, intervalTotal, true),
  );
  lines.push("");
  const roleTotal = [...report.roleHist.values()].reduce((a, b) => a + b, 0);
  lines.push(...histLines("Scale-role usage", report.roleHist, roleTotal));
  lines.push("");
  const techTotal = [...report.techniqueHist.values()].reduce((a, b) => a + b, 0);
  lines.push(...histLines("Technique usage", report.techniqueHist, techTotal));
  lines.push("");
  lines.push(...histLines("Mean-fret region", report.fretRegionHist, total));
  lines.push("");

  if (report.cloneClusters.length) {
    lines.push(`  Clone clusters (${report.cloneClusters.length})`);
    report.cloneClusters.forEach((cluster, i) => {
      lines.push(
        `    ${i + 1}. ${cluster.length} riffs share rhythm ` +
          `"${cluster[0].rhythmName}" and interval shape:`,
      );
      for (const fp of cluster) {
        lines.push(`         ${fp.riffId} (${fp.key} @ ${fp.tempo} BPM, feel=${fp.feel})`);
      }
    });
    lines.push("");
  }

  for (const sub of report.perFeel.values()) {
    const topRhythm = mostCommon(sub.rhythmHist);
    const cloneCt = sub.cloneClusters.reduce((a, c) => a + c.length, 0);
    lines.push(
      `  [${sub.label}] riffs=${sub.total} clones=${cloneCt} ` +
        `rhythms=${sub.rhythmHist.size} top=${topRhythm ? `${topRhythm[0]} (${topRhythm[1]})` : "-"}`,
    );
    for (const flag of sub.flags) lines.push(`      ! ${flag}`);
  }

  return lines.join("\n");
}

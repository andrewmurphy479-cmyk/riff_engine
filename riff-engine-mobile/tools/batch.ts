/**
 * Batch-listening harness: generate N riffs per feel, dump ASCII tabs, a
 * diversity-metrics report, and WAV renders through the app's real audio
 * path (KarplusStrong + offlineRender) so you can audit output by ear.
 *
 * This recreates updated_engine_logic/test_harness/batch.py against the
 * TypeScript engine — the tune-by-ear loop that made the engine good.
 *
 * Usage:
 *   npm run batch                          # 8 riffs x 4 feels, intermediate
 *   npm run batch -- --count 12 --level beginner
 *   npm run batch -- --feels heavy,driving --key A --no-wav
 *   npm run batch -- --out out/my-audit --seed 5000
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { generate } from "../engine/riff/generate";
import { fingerprint, computeReport, renderReportText } from "../engine/riff/metrics";
import { Feel, Level } from "../engine/riff/rhythm";
import { RiffSpec } from "../engine/riff/spec";
import { riffSpecToEvents } from "../engine/riff/toEvents";
import { renderTab } from "../engine/riff/toTab";
import { createStereoWavBuffer } from "../audio/KarplusStrong";
import { renderEventsToStereo } from "../audio/offlineRender";

const ALL_FEELS: Feel[] = ["driving", "heavy", "bouncy", "laid_back"];

// Realistic audit tempos per feel (the app's own default is 110 everywhere).
const FEEL_TEMPO: Record<Feel, number> = {
  driving: 140,
  heavy: 92,
  bouncy: 120,
  laid_back: 96,
};

interface Args {
  count: number;
  level: Level;
  key: string;
  feels: Feel[];
  seed: number;
  wav: boolean;
  out: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    count: 8,
    level: "intermediate",
    key: "E",
    feels: ALL_FEELS,
    seed: 1000,
    wav: true,
    out: "",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--count") args.count = parseInt(argv[++i], 10);
    else if (a === "--level") args.level = argv[++i] as Level;
    else if (a === "--key") args.key = argv[++i];
    else if (a === "--feels") args.feels = argv[++i].split(",") as Feel[];
    else if (a === "--seed") args.seed = parseInt(argv[++i], 10);
    else if (a === "--no-wav") args.wav = false;
    else if (a === "--out") args.out = argv[++i];
    else throw new Error(`unknown argument: ${a}`);
  }
  if (!args.out) args.out = path.join("out", `batch-${args.level}`);
  return args;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.out, { recursive: true });

  const fingerprints = [];
  const failures: string[] = [];
  let wavCount = 0;

  for (const feel of args.feels) {
    const feelDir = path.join(args.out, feel);
    fs.mkdirSync(feelDir, { recursive: true });
    const tabs: string[] = [];

    for (let i = 0; i < args.count; i++) {
      const seed = args.seed + i * 7919 + ALL_FEELS.indexOf(feel) * 104729;
      let riff: RiffSpec;
      try {
        riff = generate({
          feel,
          level: args.level,
          key: args.key,
          seed,
          tempo_bpm: FEEL_TEMPO[feel],
          max_attempts: 30,
        });
      } catch {
        failures.push(`${feel} seed=${seed}`);
        continue;
      }

      const riffId = `${feel}_s${seed}`;
      fingerprints.push(fingerprint(riffId, riff));
      tabs.push(renderTab(riff, riffId));

      if (args.wav) {
        const events = riffSpecToEvents(riff);
        const { left, right } = renderEventsToStereo(events, riff.tempo_bpm);
        const wav = createStereoWavBuffer(left, right);
        fs.writeFileSync(path.join(feelDir, `${riffId}.wav`), Buffer.from(wav));
        wavCount++;
        process.stdout.write(".");
      }
    }

    fs.writeFileSync(path.join(feelDir, "tabs.txt"), tabs.join("\n\n") + "\n", "utf-8");
    console.log(` ${feel}: ${tabs.length} riffs`);
  }

  const report = computeReport(fingerprints);
  const reportText = renderReportText(report);
  const failText = failures.length
    ? `\n\n  GENERATION FAILURES (${failures.length}): ${failures.join(", ")}\n`
    : "\n\n  No generation failures.\n";
  fs.writeFileSync(path.join(args.out, "report.txt"), reportText + failText, "utf-8");

  console.log("");
  console.log(reportText);
  console.log(failText);
  console.log(
    `Wrote ${fingerprints.length} tabs${args.wav ? ` + ${wavCount} WAVs` : ""} to ${args.out}${path.sep}`,
  );
  if (args.wav) {
    console.log("Open the WAVs in any player and audit by ear.");
  }
}

main();

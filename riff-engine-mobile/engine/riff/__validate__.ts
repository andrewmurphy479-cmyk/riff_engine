/**
 * Dev-only validation harness: runs the 12-fixture golden matrix through the
 * ported TypeScript engine and byte-compares the JSON output against the
 * frozen Python fixtures. Not shipped with the app.
 *
 * Run:
 *   cd riff-engine-mobile
 *   npx tsx engine/riff/__validate__.ts
 *
 * Any mismatch prints the fixture name and writes <name>.actual.json to the
 * fixtures dir for easy diffing.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { generate, GenerateOptions } from "./generate";
import { RiffSpec } from "./spec";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Relative hop from riff-engine-mobile/engine/riff/ to the Python freeze dir.
const FIXTURE_DIR = path.resolve(
  __dirname,
  "../../../../updated_engine_logic/tests/fixtures/freeze",
);

type MatrixEntry = [string, GenerateOptions];

const MATRIX: MatrixEntry[] = [
  ["no_feel_s1",          { seed: 1,    feel: null,        include_blue: false }],
  ["no_feel_s42",         { seed: 42,   feel: null,        include_blue: false }],
  ["no_feel_s1337_blue",  { seed: 1337, feel: null,        include_blue: true  }],
  ["driving_s1",          { seed: 1,    feel: "driving",   include_blue: false }],
  ["driving_s42",         { seed: 42,   feel: "driving",   include_blue: false }],
  ["heavy_s7",            { seed: 7,    feel: "heavy",     include_blue: false }],
  ["heavy_s13_blue",      { seed: 13,   feel: "heavy",     include_blue: true  }],
  ["bouncy_s101",         { seed: 101,  feel: "bouncy",    include_blue: false }],
  ["bouncy_s202",         { seed: 202,  feel: "bouncy",    include_blue: false }],
  ["laid_back_s303",      { seed: 303,  feel: "laid_back", include_blue: false }],
  ["laid_back_s404_blue", { seed: 404,  feel: "laid_back", include_blue: true  }],
  ["no_feel_s2024",       { seed: 2024, feel: null,        include_blue: false }],
];

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === "object") {
    const sorted: Record<string, unknown> = {};
    const src = obj as Record<string, unknown>;
    for (const key of Object.keys(src).sort()) {
      sorted[key] = sortKeys(src[key]);
    }
    return sorted;
  }
  return obj;
}

function canonicalJson(riff: RiffSpec): string {
  return JSON.stringify(sortKeys(riff), null, 2) + "\n";
}

let failures = 0;
for (const [name, params] of MATRIX) {
  const riff = generate(params);
  const actual = canonicalJson(riff);
  const expectedPath = path.join(FIXTURE_DIR, `${name}.json`);

  if (!fs.existsSync(expectedPath)) {
    console.log(`MISSING  ${name} (no Python fixture at ${expectedPath})`);
    failures++;
    continue;
  }

  const expected = fs.readFileSync(expectedPath, "utf-8");
  if (actual === expected) {
    console.log(`  ok     ${name}`);
  } else {
    console.log(`FAIL     ${name}`);
    failures++;
    const actualPath = path.join(FIXTURE_DIR, `${name}.actual.json`);
    fs.writeFileSync(actualPath, actual, "utf-8");
    console.log(`         wrote ${path.basename(actualPath)} for diffing`);
  }
}

console.log("");
if (failures > 0) {
  console.log(`${failures}/${MATRIX.length} fixtures FAILED`);
  process.exit(1);
}
console.log(`${MATRIX.length}/${MATRIX.length} fixtures match Python golden`);

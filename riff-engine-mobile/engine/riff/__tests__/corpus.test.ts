/**
 * Snapshot-corpus test: the engine's exact output for a fixed matrix of
 * (seed, feel, level) combos must match __fixtures__/corpus.json.
 *
 * A failure here means engine output changed. If the change is deliberate,
 * run `npm run corpus:regen` and review the corpus.json diff; if not, you
 * just caught an accidental behavior change.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

import { buildCorpus } from "../__fixtures__/corpusMatrix";

const CORPUS_PATH = path.resolve(__dirname, "../__fixtures__/corpus.json");

describe("snapshot corpus", () => {
  it("matches __fixtures__/corpus.json (run `npm run corpus:regen` for deliberate changes)", () => {
    expect(
      fs.existsSync(CORPUS_PATH),
      "corpus.json missing — run `npm run corpus:regen` once to create it",
    ).toBe(true);
    const frozen = JSON.parse(fs.readFileSync(CORPUS_PATH, "utf-8"));
    const current = JSON.parse(JSON.stringify(buildCorpus()));
    expect(current).toEqual(frozen);
  });
});

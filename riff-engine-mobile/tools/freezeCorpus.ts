/**
 * Regenerate the engine snapshot corpus.
 *
 * Run after any deliberate engine change:
 *   npm run corpus:regen
 * then review the corpus.json diff in code review like any other change.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { buildCorpus } from "../engine/riff/__fixtures__/corpusMatrix";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(
  __dirname,
  "../engine/riff/__fixtures__/corpus.json",
);

const corpus = buildCorpus();
fs.writeFileSync(OUT_PATH, JSON.stringify(corpus, null, 2) + "\n", "utf-8");
console.log(
  `wrote ${Object.keys(corpus).length} riffs to ${path.relative(process.cwd(), OUT_PATH)}`,
);

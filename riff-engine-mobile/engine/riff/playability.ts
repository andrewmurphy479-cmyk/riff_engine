import { positionsForMidi } from "./fretboard";

type Position = readonly [number, number];

const STRETCH_WINDOW = 4;
const STRETCH_HARD_LIMIT = 5;
const FRET_MOVE_COST = 1.0;
const STRING_SKIP_COST = 0.5;
const INF = Infinity;

function transitionCost(prev: Position, nxt: Position): number {
  const [prevS, prevF] = prev;
  const [nxtS, nxtF] = nxt;
  const fretDelta =
    prevF === 0 || nxtF === 0 ? 0 : Math.abs(nxtF - prevF) * FRET_MOVE_COST;
  const stringDelta = Math.abs(nxtS - prevS) * STRING_SKIP_COST;
  return fretDelta + stringDelta;
}

export function passesStretchCheck(path: readonly Position[]): boolean {
  for (let i = 0; i < path.length; i++) {
    const start = Math.max(0, i - STRETCH_WINDOW + 1);
    const window = path.slice(start, i + 1);
    const fretted = window.filter(([, f]) => f > 0).map(([, f]) => f);
    if (fretted.length === 0) continue;
    if (Math.max(...fretted) - Math.min(...fretted) > STRETCH_HARD_LIMIT) {
      return false;
    }
  }
  return true;
}

export function assignPositions(
  midiSequence: readonly number[],
): [number, number][] | null {
  if (midiSequence.length === 0) return [];

  const candidates: [number, number][][] = midiSequence.map((m) =>
    positionsForMidi(m),
  );
  if (candidates.some((c) => c.length === 0)) return null;

  const n = midiSequence.length;
  const cost: number[][] = candidates.map((c) => new Array(c.length).fill(INF));
  const back: number[][] = candidates.map((c) => new Array(c.length).fill(-1));

  for (let j = 0; j < candidates[0].length; j++) {
    cost[0][j] = 0.0;
  }

  for (let i = 1; i < n; i++) {
    for (let j = 0; j < candidates[i].length; j++) {
      const posJ = candidates[i][j];
      let best = INF;
      let bestK = -1;
      for (let k = 0; k < candidates[i - 1].length; k++) {
        const posK = candidates[i - 1][k];
        const c = cost[i - 1][k] + transitionCost(posK, posJ);
        if (c < best) {
          best = c;
          bestK = k;
        }
      }
      cost[i][j] = best;
      back[i][j] = bestK;
    }
  }

  let last = 0;
  let lastCost = cost[n - 1][0];
  for (let j = 1; j < candidates[n - 1].length; j++) {
    if (cost[n - 1][j] < lastCost) {
      last = j;
      lastCost = cost[n - 1][j];
    }
  }

  const path: [number, number][] = [candidates[n - 1][last]];
  for (let i = n - 1; i > 0; i--) {
    last = back[i][last];
    path.push(candidates[i - 1][last]);
  }
  path.reverse();

  if (!passesStretchCheck(path)) return null;
  return path;
}

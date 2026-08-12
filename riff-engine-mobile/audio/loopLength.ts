// How long one loop iteration is worth, in 16th-note steps.
//
// Kept apart from AudioEngine so it can be tested without pulling in
// react-native-audio-api: this is pure arithmetic, and getting it wrong is
// silent — the riff just feels rushed at the turnaround. It was wrong on 49%
// of generated riffs before the A5 fix (see F1_AUDIO_AUDIT_MEASUREMENTS.md).

import { TabEvent } from '../engine/types';

export const STEPS_PER_BAR = 16;

/**
 * A loop iteration is a whole number of bars.
 *
 * `bars` (from `RiffSpec.bars.length`) wins when the caller has it. Otherwise
 * the count is derived from note ONSETS, not note ends: a final note whose
 * duration or swing offset spills past the barline belongs to the bar it was
 * struck in and must not buy the loop an extra empty bar.
 *
 * The derivation cannot see a trailing bar that contains no notes at all —
 * nothing in the event list marks it — which is exactly why callers holding a
 * RiffSpec should pass `bars`.
 */
export function totalStepsFor(events: TabEvent[], bars?: number): number {
  if (bars !== undefined && bars > 0) {
    return Math.round(bars) * STEPS_PER_BAR;
  }
  if (events.length === 0) return STEPS_PER_BAR;
  let lastOnset = 0;
  for (const e of events) {
    if (e.step > lastOnset) lastOnset = e.step;
  }
  return (Math.floor(lastOnset / STEPS_PER_BAR) + 1) * STEPS_PER_BAR;
}

/**
 * Scheduling rules shared by live playback and offline rendering.
 *
 * Audit A9: the two paths each had their own copy of these numbers and drifted
 * — offline had the humanization but not the polyphony scaling, the strum
 * spread or the choke, so an exported riff was mixed differently from the one
 * the user had just listened to. Both sides import from here now, so a change
 * lands on both or on neither.
 *
 * Pure arithmetic, no platform imports: AudioEngine uses these to place nodes
 * on the audio clock, offlineRender to place samples in a buffer.
 */

/** Same-string choke: fade the ringing note out over this long, from the new onset. */
export const CHOKE_FADE_S = 0.025;

/** Spacing between simultaneous notes, so a diad reads as a strum not a block. */
export const STRUM_INTERVAL_S = 0.012;

/** Grouped humanization: downbeats sit tighter than off-beats. */
export const DOWNBEAT_JITTER_S = 0.003;
export const OFFBEAT_JITTER_S = 0.008;

export const STEPS_PER_BEAT = 4;
const STEPS_PER_BAR = 16;

/** Jitter half-range for a step, in seconds. */
export function jitterRangeFor(step: number): number {
  const isDownbeat = (step % STEPS_PER_BAR) % STEPS_PER_BEAT === 0;
  return isDownbeat ? DOWNBEAT_JITTER_S : OFFBEAT_JITTER_S;
}

/**
 * One jitter offset per unique step, so notes that should land together do.
 * `random` is injectable purely so tests can pin it.
 */
export function groupedJitter(
  steps: Iterable<number>,
  random: () => number = Math.random,
): Map<number, number> {
  const jitter = new Map<number, number>();
  for (const step of steps) {
    if (jitter.has(step)) continue;
    jitter.set(step, (random() - 0.5) * 2 * jitterRangeFor(step));
  }
  return jitter;
}

/**
 * Attenuation for `count` notes sounding at once. Equal-power, so a diad is
 * about as loud as a single note rather than twice as loud.
 */
export function polyphonyScale(count: number): number {
  return count > 1 ? 1 / Math.sqrt(count) : 1;
}

/**
 * Gain applied to a ringing note `offset` samples into its own buffer, given
 * that its string is re-struck `chokeAt` samples in.
 *
 * 1 before the re-strike, a linear ramp to 0 across the fade, silent after —
 * the offline equivalent of the live graph's
 * `linearRampToValueAtTime(0, t + CHOKE_FADE_S)`.
 */
export function chokeGain(
  offset: number,
  chokeAt: number,
  fadeSamples: number,
): number {
  if (offset < chokeAt) return 1;
  const t = offset - chokeAt;
  if (t >= fadeSamples) return 0;
  return 1 - t / fadeSamples;
}

/** Strum offset for the nth note of a simultaneous group. */
export function strumDelay(index: number, count: number): number {
  return count > 1 ? index * STRUM_INTERVAL_S : 0;
}

/**
 * Overlap-add FFT convolution.
 *
 * The offline renderer has to convolve a mix against the shared 1.3-second
 * impulse response (~57k taps at 44.1kHz). Direct convolution would be ~2.5e10
 * multiply-adds for a ten-second riff; overlap-add with an FFT is a few dozen
 * transforms. Pure arithmetic, no platform dependencies, so the Node CLIs get
 * the same room as the app.
 */

/** In-place iterative radix-2 FFT. `re`/`im` must have power-of-two length. */
function fft(re: Float32Array, im: Float32Array, inverse: boolean): void {
  const n = re.length;
  if (n <= 1) return;

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (sign * 2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const aRe = re[i + k];
        const aIm = im[i + k];
        const bRe = re[i + k + half] * curRe - im[i + k + half] * curIm;
        const bIm = re[i + k + half] * curIm + im[i + k + half] * curRe;
        re[i + k] = aRe + bRe;
        im[i + k] = aIm + bIm;
        re[i + k + half] = aRe - bRe;
        im[i + k + half] = aIm - bIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * Convolve `signal` with `kernel`, returning `signal.length` samples.
 *
 * The result is truncated to the input length rather than the full
 * `n + m - 1`: the caller has already allocated a tail (see
 * `OfflineRenderOptions.tailSeconds`), so anything past the end would be
 * reverb ringing into silence that was never going to be written out.
 */
export function convolve(
  signal: Float32Array,
  kernel: Float32Array,
): Float32Array {
  const n = signal.length;
  const m = kernel.length;
  const out = new Float32Array(n);
  if (n === 0 || m === 0) return out;

  // Block size is chosen so each FFT carries a full kernel plus a useful
  // chunk of signal; 2x the kernel is the usual sweet spot.
  const fftSize = nextPowerOfTwo(Math.max(m * 2, 2));
  const blockSize = fftSize - m + 1;

  // The kernel's spectrum is constant across blocks — transform it once.
  const kRe = new Float32Array(fftSize);
  const kIm = new Float32Array(fftSize);
  kRe.set(kernel);
  fft(kRe, kIm, false);

  const bRe = new Float32Array(fftSize);
  const bIm = new Float32Array(fftSize);

  for (let start = 0; start < n; start += blockSize) {
    const len = Math.min(blockSize, n - start);

    bRe.fill(0);
    bIm.fill(0);
    for (let i = 0; i < len; i++) bRe[i] = signal[start + i];

    fft(bRe, bIm, false);
    for (let i = 0; i < fftSize; i++) {
      const re = bRe[i] * kRe[i] - bIm[i] * kIm[i];
      const im = bRe[i] * kIm[i] + bIm[i] * kRe[i];
      bRe[i] = re;
      bIm[i] = im;
    }
    fft(bRe, bIm, true);

    // Overlap-add: each block contributes len + m - 1 samples.
    const contribution = Math.min(len + m - 1, n - start);
    for (let i = 0; i < contribution; i++) out[start + i] += bRe[i];
  }

  return out;
}

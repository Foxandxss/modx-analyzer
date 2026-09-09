import { LIVE_WINDOW, SAMPLE_RATE } from './constants';
import { fft } from './fft';

/**
 * The spectrum of a window of samples: one Hann window, one FFT, magnitudes in
 * decibels.
 *
 * **One reference: full scale.** Both the bins and the floor are in dBFS — a
 * full-scale sine reads 0 dB — because that is a property of the signal and does
 * not move when somebody plays louder. Fase 0 published its floors the other way
 * (`suelo de ruido (mediana de bins): −105.4 dB rel. al pico`), and every quote
 * of those figures carries that qualifier: subtract {@link Spectrum.peakDb} from
 * the floor below and the fase 0 number comes back. Comparing the two references
 * without the qualifier is how a floor that never changed appears to.
 *
 * The window is Hann, cached per size, and its amplitude correction is applied so
 * that a sine of amplitude A lands at A and not at A/2: the coherent gain of a
 * Hann window is 0.5, so the bin is scaled by `2 / Σw`.
 */

/** Hann windows, built once per size. The vista viva asks for 4 096 for ever. */
const windows = new Map<number, Float64Array>();

function hann(size: number): Float64Array {
  const cached = windows.get(size);
  if (cached !== undefined) {
    return cached;
  }
  const built = new Float64Array(size);
  for (let index = 0; index < size; index += 1) {
    built[index] = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / size);
  }
  windows.set(size, built);
  return built;
}

/** Below this a bin is called silence: −200 dBFS, far under any floor measured. */
const FLOOR_FLOOR = 1e-10;

export interface Spectrum {
  /** dBFS per bin, `window / 2 + 1` of them. A full-scale sine reads 0 dB. */
  readonly db: Float32Array;
  /** Hz per bin: 10.77 at 4 096, 0.673 at 65 536. */
  readonly binHz: number;
  /** The strongest bin, in dBFS. */
  readonly peakDb: number;
  /** The bin the peak fell in, before any interpolation. */
  readonly peakBin: number;
  /**
   * The noise floor: the median bin, in **absolute dBFS**.
   *
   * One word, one meaning — the readout, the live frame and the capture all say
   * `FLOOR` about this figure, so a floor from one panel can be compared with a
   * floor from another. Fase 0 §3's −100 to −109 dB are the same medians taken
   * `rel. al pico`; this figure minus {@link peakDb} is that one.
   */
  readonly floorDb: number;
}

/**
 * One window of samples turned into decibels.
 *
 * The last `window` samples are the ones analysed: what the vista viva wants is
 * the newest audio, not the oldest, and the caller keeps a longer history than
 * one window on purpose (the scope needs four cycles of a low note).
 */
export function spectrum(
  samples: Float32Array,
  window: number = LIVE_WINDOW,
  sampleRate: number = SAMPLE_RATE,
): Spectrum {
  if (samples.length < window) {
    throw new Error(`espectro de ${window}: sólo hay ${samples.length} muestras`);
  }

  const shape = hann(window);
  const re = new Float64Array(window);
  const im = new Float64Array(window);
  const first = samples.length - window;
  let sum = 0;
  for (let index = 0; index < window; index += 1) {
    re[index] = samples[first + index]! * shape[index]!;
    sum += shape[index]!;
  }

  fft(re, im);

  const bins = window / 2 + 1;
  const db = new Float32Array(bins);
  const scale = 2 / sum;
  let peakDb = -Infinity;
  let peakBin = 0;
  for (let bin = 0; bin < bins; bin += 1) {
    const magnitude = Math.hypot(re[bin]!, im[bin]!) * scale;
    const value = 20 * Math.log10(Math.max(magnitude, FLOOR_FLOOR));
    db[bin] = value;
    if (value > peakDb) {
      peakDb = value;
      peakBin = bin;
    }
  }

  return { db, binHz: sampleRate / window, peakDb, peakBin, floorDb: medianOf(db) };
}

/**
 * The loudest sample of the window that is about to be analysed.
 *
 * Both callers use it for the same decision — whether there is anything in this
 * window at all — and they must make it the same way: the vista viva drawing a
 * frame the medida would call silent, or the other way round, would be the two
 * analyses disagreeing about whether the note is still sounding.
 */
export function windowPeak(samples: Float32Array, window: number): number {
  let peak = 0;
  for (let index = Math.max(0, samples.length - window); index < samples.length; index += 1) {
    const magnitude = Math.abs(samples[index]!);
    if (magnitude > peak) {
      peak = magnitude;
    }
  }
  return peak;
}

/** The median of the bins, in dBFS. Copies, because sorting in place is a lie. */
function medianOf(db: Float32Array): number {
  const sorted = Float32Array.from(db).sort();
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

import {
  AXIS_HIGH_MULTIPLE,
  AXIS_LOW_MULTIPLE,
  CURVE_POINTS,
  HARMONIC_BARS,
  LIVE_WINDOW,
  NOTHING_ENTERING,
  SAMPLE_RATE,
} from './constants';
import { Partial, artefactChipHz, findPartials } from './partials';
import { Spectrum, spectrum, windowPeak } from './spectrum';

/**
 * One trama of the vista viva: everything the espectro, the armónicos and the
 * waterfall draw, computed once, in the worker, from one window of audio.
 *
 * The three panels share a transform because they are three readings of the same
 * 4 096 samples. Computing it three times would be three times the cost of the
 * one thing the 33 ms budget is spent on.
 *
 * A vista viva is audio entering **now**, so it never dies and it never carries
 * anything from the patch: no algorithm, no operator, no ancla. What it does
 * carry is the note it was read against, because the axis is in multiples of the
 * note and the comb's sidebands cannot be found without it.
 */

export interface LiveTrama {
  /** The note the trace was triggered at, or `null` when nothing is periodic. */
  readonly fundamentalHz: number | null;
  /** The strongest bin, in dBFS. The working level of fase 0 is −15 to −25. */
  readonly peakDb: number;
  /** The noise floor relative to the peak: what the readout says as `SUELO`. */
  readonly floorDb: number;
  /**
   * The curve on the `1×–32×` log axis, in dB relative to the peak, or `null`
   * with no note — an axis in multiples of a note that is not there cannot be
   * drawn, and a flat line at the floor would be a claim.
   */
  readonly curve: Float32Array | null;
  /** n1 … n16 in dB relative to the peak, or `null` with no note. */
  readonly harmonics: Float32Array | null;
  /** The lines found, strongest first, each one content or comb. */
  readonly partials: readonly Partial[];
  /** The comb line the chip names, or `null` when the comb was not seen. */
  readonly artefactHz: number | null;
}

/** The dead trama: no audio, no note, nothing claimed. */
export const NO_TRAMA: LiveTrama = {
  fundamentalHz: null,
  peakDb: -Infinity,
  floorDb: 0,
  curve: null,
  harmonics: null,
  partials: [],
  artefactHz: null,
};

/**
 * The whole vista viva of one window.
 *
 * `fundamentalHz` is the note the axis is drawn against: the played one when the
 * keyboard says which, the scope's period otherwise. It is deliberately not the
 * strongest bin — with a high modulation index that is the 9th harmonic (fase 0
 * §3), and an axis that called it 1× would redraw the whole spectrum every time
 * somebody turned a knob.
 */
export function liveTrama(
  samples: Float32Array,
  fundamentalHz: number | null,
  sampleRate: number = SAMPLE_RATE,
  window: number = LIVE_WINDOW,
): LiveTrama {
  if (samples.length < window || windowPeak(samples, window) < NOTHING_ENTERING) {
    return NO_TRAMA;
  }

  const analysed = spectrum(samples, window, sampleRate);
  const partials = findPartials(analysed, fundamentalHz);

  return {
    fundamentalHz,
    peakDb: analysed.peakDb,
    floorDb: analysed.floorDb,
    curve: fundamentalHz === null ? null : logCurve(analysed, fundamentalHz),
    harmonics: fundamentalHz === null ? null : harmonicBars(analysed, fundamentalHz),
    partials,
    artefactHz: artefactChipHz(partials),
  };
}

/**
 * The spectrum resampled onto the `1×–32×` log axis, in dB relative to the peak.
 *
 * Each point takes the **loudest** bin that falls in its cell, never the average:
 * a partial that is one bin wide has to survive being drawn at a fiftieth of the
 * width, and averaging is how a spectrum display quietly loses its lines.
 */
export function logCurve(
  analysed: Spectrum,
  fundamentalHz: number,
  points = CURVE_POINTS,
): Float32Array {
  const { db, binHz, peakDb } = analysed;
  const curve = new Float32Array(points);
  const ratio = Math.log(AXIS_HIGH_MULTIPLE / AXIS_LOW_MULTIPLE);

  for (let point = 0; point < points; point += 1) {
    const from = axisHz(fundamentalHz, ratio, (point - 0.5) / (points - 1));
    const to = axisHz(fundamentalHz, ratio, (point + 0.5) / (points - 1));
    const firstBin = Math.max(0, Math.round(from / binHz));
    const lastBin = Math.min(db.length - 1, Math.max(firstBin, Math.round(to / binHz)));

    let loudest = -Infinity;
    for (let bin = firstBin; bin <= lastBin; bin += 1) {
      if (db[bin]! > loudest) {
        loudest = db[bin]!;
      }
    }
    curve[point] = loudest - peakDb;
  }
  return curve;
}

/** Where a point of the axis falls, in hertz. */
function axisHz(fundamentalHz: number, ratio: number, fraction: number): number {
  return fundamentalHz * AXIS_LOW_MULTIPLE * Math.exp(ratio * fraction);
}

/**
 * n1 … n16 in dB relative to the peak of the spectrum.
 *
 * A bar is the loudest bin within one bin of `n·f0`: the estimate of the note is
 * good to about a bin at 4 096 (fase 0 measured +1.13 cents of bias on a low
 * fundamental), so reading the exact bin would make the 16th bar wander.
 */
export function harmonicBars(analysed: Spectrum, fundamentalHz: number): Float32Array {
  const { db, binHz, peakDb } = analysed;
  const bars = new Float32Array(HARMONIC_BARS);
  for (let harmonic = 1; harmonic <= HARMONIC_BARS; harmonic += 1) {
    const centre = (harmonic * fundamentalHz) / binHz;
    const first = Math.max(0, Math.floor(centre) - 1);
    const last = Math.min(db.length - 1, Math.ceil(centre) + 1);
    let loudest = -Infinity;
    for (let bin = first; bin <= last; bin += 1) {
      if (db[bin]! > loudest) {
        loudest = db[bin]!;
      }
    }
    bars[harmonic - 1] = loudest - peakDb;
  }
  return bars;
}

import { SAMPLE_RATE } from './constants';

/**
 * The scope: where to start drawing so that the waveform stands still.
 *
 * A scope that starts at the beginning of every bloque draws a shape that slides
 * sideways at the beat frequency between the note and 33.3 Hz, which reads as
 * «the sound is moving» when the sound is doing nothing at all. So the trace is
 * triggered on a **rising crossing of zero aligned to the note's period**: the
 * period is found first and the crossing is taken on the fundamental, not on the
 * raw signal. A bright FM timbre crosses zero going up three or five times per
 * period and a trigger that took the first of them would pick a different one
 * every trama; the fundamental crosses once, always in the same place.
 *
 * The trace is then exactly two periods long, so the shape fills the frame
 * whatever the note is. With no period to align to — noise, a transient, a
 * percussive tail — it falls back to the plain hysteresis trigger of a bench
 * scope and a fixed 20 ms window.
 *
 * Pure functions over `Float32Array`, as everything in this package (ADR-0001).
 */

/** Below this peak there is nothing to trigger on: −80 dBFS. */
const PEAK_FLOOR = 1e-4;

/** The lowest note of an 88-key MODX8 is A0, 27.5 Hz. */
const MIN_HZ = 25;

/** The highest is C8, 4 186 Hz. */
const MAX_HZ = 4200;

/** Samples correlated per lag. Enough to be sure, cheap enough for 33 fps. */
const CORRELATION_WINDOW = 1024;

/** A correlation below this is not a note; the trace then has no period. */
const PERIODIC_ENOUGH = 0.6;

/**
 * How close to the best correlation a lag has to be to be preferred for being
 * earlier. Without it a note rich in even harmonics correlates just as well at
 * twice its period and the scope draws four cycles calling them two.
 */
const OCTAVE_GUARD = 0.9;

/** Hysteresis, as a fraction of the peak, that has to be crossed to re-arm. */
const ARM_FRACTION = 0.25;

/** Drawn from the trigger when no period was found: 20 ms of whatever it is. */
const APERIODIC_SECONDS = 0.02;

export interface ScopeTrace {
  /** Index of the rising zero crossing the trace starts at. */
  readonly trigger: number;
  /** How many samples to draw from {@link trigger}. */
  readonly length: number;
  /** The period found, in samples, fractional. `null` when nothing periodic. */
  readonly periodSamples: number | null;
  /** The same period as a frequency, for the readout. `null` with no period. */
  readonly frequencyHz: number | null;
}

/**
 * Where the trace starts and how long it is, or `null` when there is nothing to
 * draw: digital silence, a buffer too short, or no rising crossing to trigger on.
 *
 * A `null` is drawn as an empty frame, never as a flat line at zero — a flat line
 * is a measurement and this is the absence of one.
 */
export function scopeTrace(
  samples: Float32Array,
  sampleRate: number = SAMPLE_RATE,
  cycles = 2,
): ScopeTrace | null {
  const peak = peakOf(samples);
  if (peak < PEAK_FLOOR) {
    return null;
  }

  const periodSamples = estimatePeriod(samples, sampleRate);
  const trigger =
    periodSamples === null
      ? findRisingTrigger(samples, peak * ARM_FRACTION)
      : fundamentalTrigger(samples, periodSamples);
  if (trigger === null) {
    return null;
  }

  const wanted =
    periodSamples === null
      ? Math.round(APERIODIC_SECONDS * sampleRate)
      : Math.round(periodSamples * cycles);
  const length = Math.min(wanted, samples.length - trigger);
  if (length < 2) {
    return null;
  }

  return {
    trigger,
    length,
    periodSamples,
    frequencyHz: periodSamples === null ? null : sampleRate / periodSamples,
  };
}

/**
 * Where the fundamental of a known period crosses zero going up, first time.
 *
 * The fundamental's amplitude and phase come from one bin of a DFT at exactly that
 * period — `x[n] ≈ A·sin(2πn/P + φ)` — and the crossing is then read off the
 * phase instead of hunted for in the samples. That is what makes the shape stand
 * still: two tramas of the same held note give the same φ, so they give the same
 * starting point, however the bloque happened to be cut.
 */
export function fundamentalTrigger(samples: Float32Array, periodSamples: number): number | null {
  const whole = Math.floor(samples.length / periodSamples) * periodSamples;
  const length = Math.floor(whole);
  if (length < 2) {
    return null;
  }

  const omega = (2 * Math.PI) / periodSamples;
  let sine = 0;
  let cosine = 0;
  for (let index = 0; index < length; index += 1) {
    sine += samples[index]! * Math.sin(omega * index);
    cosine += samples[index]! * Math.cos(omega * index);
  }
  if (sine === 0 && cosine === 0) {
    return null;
  }

  // `sine` is A·cos φ and `cosine` is A·sin φ, up to the same positive factor.
  const phase = Math.atan2(cosine, sine);
  const turns = Math.ceil(phase / (2 * Math.PI));
  const trigger = Math.round(periodSamples * (turns - phase / (2 * Math.PI)));

  return trigger >= 0 && trigger < samples.length ? trigger : null;
}

/**
 * The first rising crossing of zero that comes after the signal has been below
 * `-armBelow`. The fallback for a sound with no period to align to.
 */
export function findRisingTrigger(samples: Float32Array, armBelow: number): number | null {
  let armed = false;
  for (let index = 0; index + 1 < samples.length; index += 1) {
    const here = samples[index]!;
    if (here < -armBelow) {
      armed = true;
      continue;
    }
    if (armed && here <= 0 && samples[index + 1]! > 0) {
      return index;
    }
  }
  return null;
}

/**
 * The period of the note in the buffer, in fractional samples, by normalised
 * autocorrelation — or `null` when the buffer is not periodic enough to say.
 *
 * This is a period, not a pitch measurement: it exists so the trace is two cycles
 * wide and stands still. The number the app publishes as a frequency comes from
 * MEDIR (#10), stamped, and from the note at equal temperament, stamped `TEORÍA`.
 */
export function estimatePeriod(
  samples: Float32Array,
  sampleRate: number = SAMPLE_RATE,
): number | null {
  const minLag = Math.max(2, Math.floor(sampleRate / MAX_HZ));
  const maxLag = Math.floor(sampleRate / MIN_HZ);
  const window = Math.min(CORRELATION_WINDOW, samples.length - maxLag);
  if (window < 64) {
    return null;
  }

  const correlations = new Float64Array(maxLag + 1);
  let energyAtZero = 0;
  for (let index = 0; index < window; index += 1) {
    energyAtZero += samples[index]! * samples[index]!;
  }
  if (energyAtZero === 0) {
    return null;
  }

  let best = minLag;
  let bestCorrelation = -1;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let dot = 0;
    let energy = 0;
    for (let index = 0; index < window; index += 1) {
      const shifted = samples[index + lag]!;
      dot += samples[index]! * shifted;
      energy += shifted * shifted;
    }
    const correlation = energy === 0 ? 0 : dot / Math.sqrt(energyAtZero * energy);
    correlations[lag] = correlation;
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      best = lag;
    }
  }

  if (bestCorrelation < PERIODIC_ENOUGH) {
    return null;
  }

  // The earliest lag that is nearly as good as the best one, which is the real
  // period rather than a multiple of it.
  const threshold = bestCorrelation * OCTAVE_GUARD;
  for (let lag = minLag + 1; lag < best; lag += 1) {
    const isPeak =
      correlations[lag]! > correlations[lag - 1]! && correlations[lag]! >= correlations[lag + 1]!;
    if (isPeak && correlations[lag]! >= threshold) {
      best = lag;
      break;
    }
  }

  return refinePeak(correlations, best);
}

/** Parabolic interpolation on the three points around the peak. */
function refinePeak(values: Float64Array, peak: number): number {
  if (peak <= 0 || peak + 1 >= values.length) {
    return peak;
  }
  const before = values[peak - 1]!;
  const here = values[peak]!;
  const after = values[peak + 1]!;
  const denominator = before - 2 * here + after;
  if (denominator === 0) {
    return peak;
  }
  return peak + (0.5 * (before - after)) / denominator;
}

function peakOf(samples: Float32Array): number {
  let peak = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const magnitude = Math.abs(samples[index]!);
    if (magnitude > peak) {
      peak = magnitude;
    }
  }
  return peak;
}

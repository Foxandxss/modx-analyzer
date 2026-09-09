import { SAMPLE_RATE } from './constants';

/**
 * The scope: what it locks to, how much of it it draws, and when it refuses.
 *
 * **The caption is the specification.** `LOCKED 349.23 Hz · 4 CYCLES · 11.5 ms`
 * is a claim about three things, and every one of them is decided here: the note
 * the trace is aligned to, that the alignment was verified against the audio, and
 * how long the drawn stretch is.
 *
 * The lock is the **fundamental of the note being held** — the fc of the last
 * Medida when a fit exists, the played note at equal temperament otherwise —
 * never a count of zero crossings and never the autocorrelation's own guess. A
 * bright FM timbre crosses zero going up three or five times per period, and the
 * autocorrelation of one picks a sub-multiple of the period: that is what turned
 * 349,23 Hz into 43,8 on the MODX8 and drew a near-flat line under a caption that
 * read like a measurement.
 *
 * Autocorrelation still has a job, and it is the opposite one: it **verifies**.
 * The lock is only granted when the audio correlates with itself at the locked
 * period — so a held key over an inharmonic or noisy sound says `pitch unstable`
 * rather than standing a shape still that is not there.
 *
 * The trace is then exactly {@link SCOPE_CYCLES} periods long, so the shape fills
 * the frame whatever the note is, and the window is reported in ms. When there is
 * no lock the raw window is drawn in the predicted register and the reason is
 * named; when what is there is noise, that is said instead.
 *
 * Pure functions over `Float32Array`, as everything in this package (ADR-0001).
 */

/**
 * How many periods the trace draws. **Always four**, and this is the only copy of
 * the number: the trace is cut to it here and the caption reads it from here.
 */
export const SCOPE_CYCLES = 4;

/**
 * How far the trace has to stand over the noise floor before it is a signal at
 * all: 6 dB, peak to peak against the median bin, both in absolute dBFS (#30).
 *
 * Under it there is nothing to lock to and nothing worth drawing, and the honest
 * caption is that the floor is what is on screen.
 */
export const SCOPE_OVER_FLOOR_DB = 6;

/** The lowest note of an 88-key MODX8 is A0, 27.5 Hz. */
const MIN_HZ = 25;

/** The highest is C8, 4 186 Hz. */
const MAX_HZ = 4200;

/** Samples correlated per lag. Enough to be sure, cheap enough for 33 fps. */
const CORRELATION_WINDOW = 1024;

/**
 * A correlation below this is not a note.
 *
 * One threshold, two callers: {@link estimatePeriod} refuses to name a period
 * under it and {@link scopeLock} refuses to grant a lock under it, so «periodic
 * enough to draw» means the same thing on both sides of the panel.
 */
export const PERIODIC_ENOUGH = 0.6;

/**
 * How close to the best correlation a lag has to be to be preferred for being
 * earlier. Without it a note rich in even harmonics correlates just as well at
 * twice its period and the period found is twice the real one.
 */
const OCTAVE_GUARD = 0.9;

/** Drawn with no lock: the newest 20 ms of whatever is arriving, untriggered. */
const RAW_WINDOW_SECONDS = 0.02;

/** Why there is no lock. The screen's words for these live in the tab panel. */
export type LockRefusal = 'noHeldNote' | 'pitchUnstable' | 'moreThanOneNote';

/** What every reading says, locked or not: which slice of the window to draw. */
interface DrawnWindow {
  /** First sample of the buffer to draw. */
  readonly trigger: number;
  /** How many samples from {@link trigger}. */
  readonly length: number;
  /** The same length in ms. The locked caption says this figure. */
  readonly windowMs: number;
}

/** Locked to the note: four periods, aligned, with the period drawn on them. */
export interface LockedScope extends DrawnWindow {
  readonly kind: 'locked';
  /** The frequency the lock was granted at — the note's, never a guess. */
  readonly frequencyHz: number;
  /** Its period in fractional samples, so the boundaries can be drawn. */
  readonly periodSamples: number;
  /** What the audio correlated with itself at that period: the verification. */
  readonly periodicity: number;
}

/** No lock, and which of the three reasons. The window is drawn raw. */
export interface UnlockedScope extends DrawnWindow {
  readonly kind: 'noLock';
  readonly reason: LockRefusal;
}

/** What is arriving does not clear the floor: the band is drawn, not a trace. */
export interface BelowFloorScope extends DrawnWindow {
  readonly kind: 'belowFloor';
  /** Half the peak-to-peak of the window: how tall the band is above zero. */
  readonly band: number;
}

export type ScopeLock = LockedScope | UnlockedScope | BelowFloorScope;

/** Where the lock comes from, and what would stop it. */
export interface LockSource {
  /**
   * The fc of the last Medida, ahead of the played note because it is measured
   * off the sound itself.
   *
   * **Nothing produces it yet**: no fit exists, so this is `null` in the running
   * build and the branch below waits for the fit ticket. It is written because
   * the priority is part of the contract, not because it fires.
   */
  readonly capturedFcHz: number | null;
  /** The held note at equal temperament, or `null` when nothing is held. */
  readonly heldHz: number | null;
  /**
   * How many distinct pitches the keyboard is holding. More than one and there
   * is no fundamental to lock to — two notes are two of them.
   */
  readonly heldPitches: number;
  /** The window's noise floor in absolute dBFS, as `FLOOR` reports it (#30). */
  readonly floorDb: number;
}

/**
 * What the scope draws and what its caption says, for one window of audio.
 *
 * The order of the three refusals is the order of the questions: is there a
 * signal at all, is there one note, and is that note actually in the audio. A
 * silence with nothing held is `belowFloor` and not `noHeldNote`, because what is
 * on screen is the floor and saying anything else about it would be a claim.
 */
export function scopeLock(
  samples: Float32Array,
  source: LockSource,
  sampleRate: number = SAMPLE_RATE,
): ScopeLock {
  const raw = rawWindow(samples, sampleRate);

  const swing = peakToPeak(samples);
  const swingDb = 20 * Math.log10(swing / 2);
  // A floor of `-Infinity` is `NO_TRAMA`'s: nothing entered, so there is no
  // level to stand over and no arithmetic to do on it.
  if (
    !Number.isFinite(swingDb) ||
    !Number.isFinite(source.floorDb) ||
    swingDb < source.floorDb + SCOPE_OVER_FLOOR_DB
  ) {
    return { kind: 'belowFloor', band: swing / 2, ...raw };
  }

  if (source.heldPitches > 1) {
    return { kind: 'noLock', reason: 'moreThanOneNote', ...raw };
  }

  const lockHz = source.capturedFcHz ?? source.heldHz;
  if (lockHz === null || lockHz < MIN_HZ || lockHz > MAX_HZ) {
    return { kind: 'noLock', reason: 'noHeldNote', ...raw };
  }

  const periodSamples = sampleRate / lockHz;
  const cut = cutCycles(samples, periodSamples);
  const measured = periodicity(samples, periodSamples);
  // The lock is a claim about **this** audio, so it is checked against it. The
  // cut is checked too: four cycles that do not fit in the window cannot be
  // verified any more than they can be drawn, and the buffer the caller keeps is
  // sized so that this cannot happen above A0.
  if (cut === null || measured < PERIODIC_ENOUGH) {
    return { kind: 'noLock', reason: 'pitchUnstable', ...raw };
  }

  return {
    kind: 'locked',
    frequencyHz: lockHz,
    periodSamples,
    periodicity: measured,
    trigger: cut.trigger,
    length: cut.length,
    windowMs: (cut.length / sampleRate) * 1000,
  };
}

/** The newest {@link RAW_WINDOW_SECONDS}, untriggered, which is what «raw» is. */
function rawWindow(samples: Float32Array, sampleRate: number): DrawnWindow {
  const length = Math.min(samples.length, Math.round(RAW_WINDOW_SECONDS * sampleRate));
  return {
    trigger: samples.length - length,
    length,
    windowMs: (length / sampleRate) * 1000,
  };
}

/**
 * The newest {@link SCOPE_CYCLES} whole periods of the buffer, or `null` when
 * that many do not fit.
 *
 * The crossing comes from {@link fundamentalTrigger} and the cut is then pushed
 * forward by whole periods, which is what keeps two things true at once: the
 * trace is the newest audio in the buffer — a scope showing the oldest 11 ms of
 * a 210 ms history is a fifth of a second behind the keyboard — and it starts on
 * the same crossing every trama, so the shape still stands still.
 */
function cutCycles(
  samples: Float32Array,
  periodSamples: number,
): { trigger: number; length: number } | null {
  const first = fundamentalTrigger(samples, periodSamples);
  if (first === null) {
    return null;
  }
  const length = Math.round(periodSamples * SCOPE_CYCLES);
  const spare = samples.length - length - first;
  if (spare < 0 || length < 2) {
    return null;
  }
  // The multiple is taken on the fractional period and rounded once, at the end:
  // stepping by a rounded period would drift a sample per cycle and the shape
  // would crawl at the very rate this function exists to stop.
  const trigger = Math.round(first + Math.floor(spare / periodSamples) * periodSamples);
  return { trigger: Math.min(trigger, samples.length - length), length };
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
 * How well the newest audio correlates with itself one period later, normalised
 * to ±1. **This is the verification and not the measurement**: the period is
 * given, and what comes back is whether the audio agrees with it.
 *
 * The lag is fractional — the note is a frequency and not a whole number of
 * samples — so the shifted sample is interpolated. It is read off the end of the
 * buffer because a lock is a claim about what is arriving now.
 */
export function periodicity(samples: Float32Array, periodSamples: number): number {
  const lag = Math.ceil(periodSamples) + 1;
  const window = Math.min(CORRELATION_WINDOW, samples.length - lag);
  if (window < 64) {
    return 0;
  }

  const first = samples.length - window - lag;
  let dot = 0;
  let here = 0;
  let there = 0;
  for (let index = 0; index < window; index += 1) {
    const at = first + index;
    const a = samples[at]!;
    const b = interpolate(samples, at + periodSamples);
    dot += a * b;
    here += a * a;
    there += b * b;
  }

  return here === 0 || there === 0 ? 0 : dot / Math.sqrt(here * there);
}

/** The sample at a fractional index, linearly. */
function interpolate(samples: Float32Array, at: number): number {
  const whole = Math.floor(at);
  const fraction = at - whole;
  const before = samples[whole] ?? 0;
  const after = samples[whole + 1] ?? before;
  return before + (after - before) * fraction;
}

/**
 * The period of the note in the buffer, in fractional samples, by normalised
 * autocorrelation — or `null` when the buffer is not periodic enough to say.
 *
 * **The scope does not use this and must not**: on a bright FM timbre it picks a
 * sub-multiple of the period, which is the whole reason the trace locks to the
 * note instead. What it is for is the espectro's axis, which is drawn in
 * multiples of the note and needs *some* note when the MIDI port is gone — a
 * fallback for an axis, never a frequency anybody reads.
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

/** The whole swing of the window: the loudest sample above zero minus below. */
function peakToPeak(samples: Float32Array): number {
  let low = 0;
  let high = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const value = samples[index]!;
    if (value < low) {
      low = value;
    }
    if (value > high) {
      high = value;
    }
  }
  return high - low;
}

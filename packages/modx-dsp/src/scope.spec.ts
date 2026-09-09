import { describe, expect, it } from 'vitest';
import { SAMPLE_RATE } from './constants';
import { GOLDEN_F0, GoldenName, readGolden } from './golden';
import { liveTrama } from './live';
import {
  LockSource,
  SCOPE_CYCLES,
  estimatePeriod,
  fundamentalTrigger,
  periodicity,
  scopeLock,
} from './scope';

/** Seven bloques' worth of samples, which is what the scope keeps. */
const LENGTH = 1323 * 7;

function tone(
  frequency: number,
  partials: readonly number[] = [1],
  phase = 0,
  length = LENGTH,
): Float32Array {
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const t = (index / SAMPLE_RATE) * frequency * 2 * Math.PI + phase;
    let value = 0;
    partials.forEach((amplitude, harmonic) => {
      value += amplitude * Math.sin(t * (harmonic + 1));
    });
    samples[index] = value * 0.5;
  }
  return samples;
}

function noise(seed = 7, length = LENGTH, amplitude = 0.5): Float32Array {
  const samples = new Float32Array(length);
  let state = seed;
  for (let index = 0; index < length; index += 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    samples[index] = (state / 0x3fffffff - 1) * amplitude;
  }
  return samples;
}

/** A held note, one pitch, over a floor 80 dB down: the ordinary case. */
function holding(hz: number | null, floorDb = -80): LockSource {
  return {
    capturedFcHz: null,
    heldHz: hz,
    heldPitches: hz === null ? 0 : 1,
    floorDb,
  };
}

describe('estimatePeriod', () => {
  it('finds the fundamental of a pure sine', () => {
    const period = estimatePeriod(tone(261.626));

    expect(period).not.toBeNull();
    expect(SAMPLE_RATE / period!).toBeCloseTo(261.626, 0);
  });

  it('finds the fundamental and not a harmonic when the timbre is bright', () => {
    // The third harmonic louder than the fundamental: three rising zero crossings
    // per period, which is exactly what a naive trigger falls over on.
    const period = estimatePeriod(tone(220, [0.4, 0, 1]));

    expect(SAMPLE_RATE / period!).toBeCloseTo(220, 0);
  });

  it('does not answer twice the period of a note rich in even harmonics', () => {
    const period = estimatePeriod(tone(110, [1, 0.9, 0.5, 0.4]));

    expect(SAMPLE_RATE / period!).toBeCloseTo(110, 0);
  });

  it('says nothing rather than a number when there is no note', () => {
    expect(estimatePeriod(noise())).toBeNull();
  });
});

describe('fundamentalTrigger', () => {
  it('lands on a crossing of zero going up', () => {
    const samples = tone(261.626);
    const period = SAMPLE_RATE / 261.626;

    const trigger = fundamentalTrigger(samples, period)!;

    expect(samples[trigger]).toBeLessThanOrEqual(0.01);
    expect(samples[trigger + 4]).toBeGreaterThan(0);
  });

  it('picks the same crossing however the trama was cut', () => {
    const period = SAMPLE_RATE / 261.626;
    const shift = 97;
    const whole = tone(261.626, [1], 0, LENGTH + shift);

    const early = fundamentalTrigger(whole.subarray(0, LENGTH), period)!;
    const late = fundamentalTrigger(whole.subarray(shift, shift + LENGTH), period)!;

    // The two tramas start `shift` samples apart, so their triggers point at the
    // same absolute sample — give or take one period and one sample of rounding.
    const drift = Math.abs(((early - (late + shift)) % period) + period) % period;
    expect(Math.min(drift, period - drift)).toBeLessThan(2);
  });

  it('ignores the extra crossings a bright harmonic adds', () => {
    // Third harmonic louder than the fundamental: three rising crossings of zero
    // per period. Whichever one the trace starts at, it has to be the same one on
    // every trama, so the two cuts must overlay sample by sample.
    const period = SAMPLE_RATE / 220;
    const shift = 61;
    const whole = tone(220, [0.4, 0, 1], 0, LENGTH + shift);
    const early = whole.subarray(0, LENGTH);
    const late = whole.subarray(shift, shift + LENGTH);

    const earlyTrigger = fundamentalTrigger(early, period)!;
    const lateTrigger = fundamentalTrigger(late, period)!;

    for (let offset = 0; offset < Math.round(2 * period); offset += 7) {
      expect(Math.abs(early[earlyTrigger + offset]! - late[lateTrigger + offset]!)).toBeLessThan(
        0.03,
      );
    }
  });
});

describe('periodicity', () => {
  it('is one for a sine at its own period', () => {
    expect(periodicity(tone(261.626), SAMPLE_RATE / 261.626)).toBeGreaterThan(0.99);
  });

  it('is high at the period of a bright FM timbre, where the guess is not', () => {
    // The verification is asked about the note, and the note is there whatever
    // the autocorrelation would have picked on its own.
    expect(periodicity(tone(349.23, [0.3, 0, 1, 0, 0.8]), SAMPLE_RATE / 349.23)).toBeGreaterThan(
      0.9,
    );
  });

  it('is low for noise at any period at all', () => {
    expect(periodicity(noise(), SAMPLE_RATE / 261.626)).toBeLessThan(0.6);
  });
});

describe('scopeLock · el enganche', () => {
  it('locks to the note being held and reports the note, never a sub-multiple', () => {
    // 349,23 Hz on a bright FM timbre is the reading that turned into 43,8 when
    // the autocorrelation was allowed to name the frequency.
    const lock = scopeLock(tone(349.23, [0.3, 0, 1, 0, 0.8]), holding(349.23));

    expect(lock.kind).toBe('locked');
    if (lock.kind !== 'locked') {
      return;
    }
    expect(lock.frequencyHz).toBe(349.23);
    expect(lock.periodicity).toBeGreaterThan(0.6);
    expect(lock.length).toBe(Math.round((SCOPE_CYCLES * SAMPLE_RATE) / 349.23));
    expect(lock.windowMs).toBeCloseTo(11.5, 1);
  });

  it('draws exactly four cycles, and the caption reads that count from here', () => {
    const lock = scopeLock(tone(261.626), holding(261.626));

    expect(SCOPE_CYCLES).toBe(4);
    if (lock.kind !== 'locked') {
      throw new Error(lock.kind);
    }
    expect(lock.length / lock.periodSamples).toBeCloseTo(SCOPE_CYCLES, 2);
  });

  it('stands still: two tramas of the same note start on the same shape', () => {
    const note = 261.626;
    const shift = 97;
    const whole = tone(note, [0.4, 0, 1], 0, LENGTH + shift);
    const early = whole.subarray(0, LENGTH);
    const late = whole.subarray(shift, shift + LENGTH);

    const first = scopeLock(early, holding(note));
    const second = scopeLock(late, holding(note));
    if (first.kind !== 'locked' || second.kind !== 'locked') {
      throw new Error('no lock');
    }

    expect(first.length).toBe(second.length);
    // The two cuts point at the same absolute sample of the tone, give or take
    // the period they may differ by and the sample the rounding costs.
    const period = first.periodSamples;
    const drift = Math.abs(((first.trigger - (second.trigger + shift)) % period) + period) % period;
    expect(Math.min(drift, period - drift)).toBeLessThan(2);
    for (let offset = 0; offset < first.length; offset += 11) {
      expect(
        Math.abs(early[first.trigger + offset]! - late[second.trigger + offset]!),
      ).toBeLessThan(0.06);
    }
  });

  it('draws the newest audio of the buffer and not the oldest', () => {
    const lock = scopeLock(tone(261.626), holding(261.626));
    if (lock.kind !== 'locked') {
      throw new Error(lock.kind);
    }

    // Within one period of the end: a scope a fifth of a second behind the
    // keyboard would be showing what was played, not what is being played.
    expect(LENGTH - (lock.trigger + lock.length)).toBeLessThan(lock.periodSamples);
  });

  it('takes fc from the last capture ahead of the played note', () => {
    // The branch is written and unreachable in this build: nothing fits an fc
    // yet. When one exists it wins, because it was measured off the sound.
    const source: LockSource = { ...holding(261.626), capturedFcHz: 220 };

    const lock = scopeLock(tone(220), source);

    expect(lock.kind === 'locked' && lock.frequencyHz).toBe(220);
  });

  it('refuses with no held note, and hands back the raw window', () => {
    const lock = scopeLock(tone(261.626), holding(null));

    expect(lock.kind).toBe('noLock');
    expect(lock.kind === 'noLock' && lock.reason).toBe('noHeldNote');
    expect(lock.windowMs).toBeCloseTo(20, 0);
  });

  it('refuses with more than one pitch held: two notes have no fundamental', () => {
    const two = { ...holding(261.626), heldPitches: 2 };

    const lock = scopeLock(tone(261.626, [1, 0, 0, 0.9]), two);

    expect(lock.kind === 'noLock' && lock.reason).toBe('moreThanOneNote');
  });

  it('refuses when the held note is not in the audio', () => {
    // A key down over something aperiodic: the lock would stand a shape still
    // that is not there.
    const lock = scopeLock(noise(), holding(261.626));

    expect(lock.kind === 'noLock' && lock.reason).toBe('pitchUnstable');
  });

  it('says the signal is under the floor rather than drawing the floor', () => {
    const floor = -66;
    // Peak to peak four decibels over the floor: under the six the trace needs.
    const quiet = tone(261.626, [1], 0, LENGTH);
    const scale = Math.pow(10, (floor + 4) / 20) / 0.5;
    for (let index = 0; index < quiet.length; index += 1) {
      quiet[index] = quiet[index]! * scale;
    }

    const lock = scopeLock(quiet, holding(261.626, floor));

    expect(lock.kind).toBe('belowFloor');
    expect(lock.kind === 'belowFloor' && lock.band).toBeGreaterThan(0);
  });

  it('says the same of digital silence, where there is no floor to stand over', () => {
    const lock = scopeLock(new Float32Array(LENGTH), {
      capturedFcHz: null,
      heldHz: null,
      heldPitches: 0,
      floorDb: -Infinity,
    });

    expect(lock.kind).toBe('belowFloor');
  });
});

describe('scopeLock · los vectores de oro', () => {
  const NAMES: readonly GoldenName[] = [
    'fmx-1op-sine',
    'fmx-ratio2-modlow',
    'fmx-ratio2-modhigh',
    'fmx-ratio1414',
  ];

  /** The three whose lines are harmonics of the note: they repeat at its period. */
  const HARMONIC: readonly GoldenName[] = NAMES.filter((name) => name !== 'fmx-ratio1414');

  for (const name of HARMONIC) {
    it(`locks ${name} to the note the MODX8 was playing`, () => {
      const samples = readGolden(name);
      // The floor the panel would be reading beside it: same window, same word.
      const floorDb = liveTrama(samples, GOLDEN_F0).floorDb;

      const lock = scopeLock(samples, holding(GOLDEN_F0, floorDb));

      expect(lock.kind).toBe('locked');
      if (lock.kind !== 'locked') {
        return;
      }
      expect(lock.frequencyHz).toBe(GOLDEN_F0);
      expect(lock.periodicity).toBeGreaterThan(0.6);
      // Four cycles of a C4: 15.3 ms, whatever the timbre on top of it.
      expect(lock.windowMs).toBeCloseTo(15.3, 1);
    });
  }

  it('refuses the inharmonic vector, whose waveform does not repeat at the note', () => {
    // `Coarse 1` / `Fine 41`, measured ratio 1.4103: eleven lines that are not
    // harmonics, so the audio correlates with itself at the note's period at
    // −0.199. There is no shape to stand still, and the scope says so instead of
    // standing one still that is not there.
    const samples = readGolden('fmx-ratio1414');

    const lock = scopeLock(samples, holding(GOLDEN_F0, liveTrama(samples, GOLDEN_F0).floorDb));

    expect(lock.kind === 'noLock' && lock.reason).toBe('pitchUnstable');
  });

  it('locks the vector whose ninth harmonic is louder than its note', () => {
    // `modhigh` is the one that breaks a scope that trusts the strongest line or
    // the autocorrelation: the peak of its spectrum is the 9th harmonic.
    const samples = readGolden('fmx-ratio2-modhigh');
    const lock = scopeLock(samples, holding(GOLDEN_F0, liveTrama(samples, GOLDEN_F0).floorDb));

    expect(lock.kind === 'locked' && lock.frequencyHz).toBe(GOLDEN_F0);
  });
});

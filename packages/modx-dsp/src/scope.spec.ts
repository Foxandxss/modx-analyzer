import { describe, expect, it } from 'vitest';
import { SAMPLE_RATE } from './constants';
import { estimatePeriod, findRisingTrigger, fundamentalTrigger, scopeTrace } from './scope';

/** Three bloques' worth of samples, which is what the scope keeps. */
const LENGTH = 1323 * 3;

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
    const noise = new Float32Array(LENGTH);
    let seed = 1;
    for (let index = 0; index < LENGTH; index += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      noise[index] = (seed / 0x3fffffff - 1) * 0.5;
    }

    expect(estimatePeriod(noise)).toBeNull();
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

describe('findRisingTrigger', () => {
  it('is the fallback with no period, and still crosses zero going up', () => {
    const samples = tone(261.626);

    const trigger = findRisingTrigger(samples, 0.1)!;

    expect(samples[trigger]).toBeLessThanOrEqual(0);
    expect(samples[trigger + 1]).toBeGreaterThan(0);
  });

  it('says nothing when the signal never goes low enough to arm', () => {
    const flat = new Float32Array(LENGTH).fill(0.2);

    expect(findRisingTrigger(flat, 0.1)).toBeNull();
  });
});

describe('scopeTrace', () => {
  it('draws exactly two cycles', () => {
    const trace = scopeTrace(tone(261.626))!;

    expect(trace.frequencyHz).toBeCloseTo(261.626, 0);
    expect(trace.length).toBeCloseTo((2 * SAMPLE_RATE) / 261.626, 0);
  });

  it('stands still: the same note at another phase starts at the same shape', () => {
    const note = 261.626;
    const cold = scopeTrace(tone(note, [1], 0))!;
    const later = scopeTrace(tone(note, [1], 1.7))!;

    // Both traces start on a rising crossing of zero, so their first samples agree
    // whatever the bloque happened to be cut at — which is the whole point.
    expect(cold.length).toBe(later.length);
    for (const offset of [0, 10, 40]) {
      const a = tone(note, [1], 0)[cold.trigger + offset]!;
      const b = tone(note, [1], 1.7)[later.trigger + offset]!;
      expect(Math.abs(a - b)).toBeLessThan(0.02);
    }
  });

  it('draws nothing at all on digital silence', () => {
    expect(scopeTrace(new Float32Array(LENGTH))).toBeNull();
  });

  it('still gives a window when the sound has no period', () => {
    const noise = new Float32Array(LENGTH);
    let seed = 7;
    for (let index = 0; index < LENGTH; index += 1) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      noise[index] = (seed / 0x3fffffff - 1) * 0.5;
    }

    const trace = scopeTrace(noise)!;

    expect(trace.periodSamples).toBeNull();
    expect(trace.frequencyHz).toBeNull();
    expect(trace.length).toBe(Math.round(0.02 * SAMPLE_RATE));
  });
});

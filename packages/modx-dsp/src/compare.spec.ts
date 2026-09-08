import { describe, expect, it } from 'vitest';
import { compareWindows } from './compare';
import { MEASURE_WINDOW, SAMPLE_RATE } from './constants';

function sine(hz: number, amplitude = 0.5, length = MEASURE_WINDOW): Float32Array {
  const samples = new Float32Array(length);
  for (let n = 0; n < length; n += 1) {
    samples[n] = amplitude * Math.sin((2 * Math.PI * hz * n) / SAMPLE_RATE);
  }
  return samples;
}

/** The same sine plus a second, quiet one — a spur where there was none. */
function withSpur(hz: number, spurHz: number, spurDb: number): Float32Array {
  const base = sine(hz);
  const spur = sine(spurHz, 0.5 * 10 ** (spurDb / 20));
  const mixed = new Float32Array(base.length);
  for (let n = 0; n < base.length; n += 1) {
    mixed[n] = base[n]! + spur[n]!;
  }
  return mixed;
}

/**
 * The method #14's decision rests on, tested before it is pointed at the keyboard.
 *
 * If this comparison could not see a spur it would answer «polling is invisible»
 * whatever the MODX8 did, which is the same trap the fake fell into in #16 and in
 * #21: an instrument that agrees with the assumption by construction.
 */
describe('compareWindows', () => {
  it('is zero everywhere when the two windows are the same samples', () => {
    const held = sine(440);

    const found = compareWindows(held, Float32Array.from(held));

    expect(found.maxDb).toBe(0);
    expect(found.p50Db).toBe(0);
    expect(found.over.every((band) => band.bins === 0)).toBe(true);
    expect(found.bins).toBe(MEASURE_WINDOW / 2 + 1);
  });

  /**
   * The case the ticket is actually about: something got added to one of the two
   * windows and it has to show up. −72 dB is fase 0's own oscillator spur level,
   * so this is the size of thing #14 would need to be able to see.
   */
  it('finds a −72 dB spur that is in one window and not the other', () => {
    const clean = sine(440);
    const spurred = withSpur(440, 2756.25, -72);

    const found = compareWindows(clean, spurred);

    expect(found.maxDb).toBeGreaterThan(6);
    // And it says where, within a bin of 2 756,25 Hz.
    expect(Math.abs(found.maxBinHz - 2756.25)).toBeLessThan(found.binHz);
  });

  /**
   * The distribution is what separates «one bin moved» from «the whole spectrum
   * moved», and a maximum on its own cannot. A single spur must leave the median
   * bin untouched.
   */
  it('keeps the median at the floor when only one line moved', () => {
    const found = compareWindows(sine(440), withSpur(440, 2756.25, -72));

    expect(found.p50Db).toBeLessThan(1);
    expect(found.over[2]!.bins).toBeLessThan(found.bins / 100);
  });

  it('compares the tail, so a longer recording is still the window that ended it', () => {
    const long = sine(440, 0.5, MEASURE_WINDOW * 2);
    const tail = long.slice(long.length - MEASURE_WINDOW);

    const found = compareWindows(long, tail);

    expect(found.maxDb).toBe(0);
  });
});

/**
 * The floor is random and the note is not, so a comparison that counts every bin
 * counts mostly noise. These pin the part of the answer #14 actually rests on.
 */
describe('compareWindows · sólo el contenido', () => {
  /** A window whose bins below the content line are pure noise, and different noise. */
  function withNoise(hz: number, seed: number): Float32Array {
    const base = sine(hz);
    let state = seed;
    const noisy = new Float32Array(base.length);
    for (let n = 0; n < base.length; n += 1) {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      noisy[n] = base[n]! + ((state / 0x7fffffff) * 2 - 1) * 1e-6;
    }
    return noisy;
  }

  it('ignores a floor that moved and keeps the note that did not', () => {
    const found = compareWindows(withNoise(440, 1), withNoise(440, 7));

    // Two different noise floors under the same note: the all-bins figures see a
    // great deal and the content figures see almost nothing. That gap is the
    // whole reason the content half exists.
    expect(found.maxDb).toBeGreaterThan(found.contentMaxDb);
    expect(found.contentP50Db).toBeLessThan(1);
    expect(found.contentBins).toBeLessThan(found.bins);
    expect(found.contentBins).toBeGreaterThan(0);
  });

  it('still sees a spur that stands above the content line', () => {
    const found = compareWindows(sine(440), withSpur(440, 2756.25, -72));

    expect(found.contentMaxDb).toBeGreaterThan(6);
    expect(Math.abs(found.contentMaxBinHz - 2756.25)).toBeLessThan(found.binHz);
  });
});

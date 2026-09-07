import { describe, expect, it } from 'vitest';
import { LIVE_BIN_HZ, LIVE_WINDOW, SAMPLE_RATE } from './constants';
import { fft } from './fft';
import { spectrum } from './spectrum';

/** A tone that fills the window, at whatever amplitude is asked for. */
function tone(frequency: number, amplitude = 1, length = LIVE_WINDOW): Float32Array {
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    samples[index] = amplitude * Math.sin((2 * Math.PI * frequency * index) / SAMPLE_RATE);
  }
  return samples;
}

describe('fft', () => {
  it('agrees with the direct transform it replaces', () => {
    const size = 64;
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let index = 0; index < size; index += 1) {
      re[index] = Math.sin((2 * Math.PI * 5 * index) / size) + 0.25 * Math.cos(index);
    }
    const direct = naiveDft(re);

    fft(re, im);

    for (let bin = 0; bin < size; bin += 1) {
      expect(re[bin]!).toBeCloseTo(direct.re[bin]!, 8);
      expect(im[bin]!).toBeCloseTo(direct.im[bin]!, 8);
    }
  });

  it('refuses a size that is not a power of two', () => {
    expect(() => fft(new Float64Array(6), new Float64Array(6))).toThrow();
  });
});

describe('spectrum', () => {
  it('puts a full-scale sine at 0 dBFS and half of one 6 dB under it', () => {
    // A tone on a bin centre, so the number under test is the scaling and not
    // the scalloping loss of a tone between two bins.
    // The reference is full scale and not the peak of the frame: a floor that is
    // quoted in dBFS must not move when somebody plays louder.
    expect(spectrum(tone(LIVE_BIN_HZ * 93)).peakDb).toBeCloseTo(0, 1);
    expect(spectrum(tone(LIVE_BIN_HZ * 93, 0.5)).peakDb).toBeCloseTo(-6, 1);
  });

  it('has the bin width the constants promise', () => {
    expect(spectrum(tone(1000)).binHz).toBeCloseTo(LIVE_BIN_HZ, 6);
  });

  it('reads the last window of a longer buffer, which is the newest audio', () => {
    const older = tone(1000, 0.5, LIVE_WINDOW);
    const newer = tone(1000, 0.05, LIVE_WINDOW);
    const both = new Float32Array(LIVE_WINDOW * 2);
    both.set(older, 0);
    both.set(newer, LIVE_WINDOW);

    expect(spectrum(both).peakDb).toBeCloseTo(-26, 0);
  });

  it('will not make a spectrum out of fewer samples than the window', () => {
    expect(() => spectrum(new Float32Array(1024))).toThrow();
  });
});

function naiveDft(values: Float64Array): { re: Float64Array; im: Float64Array } {
  const size = values.length;
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let bin = 0; bin < size; bin += 1) {
    for (let index = 0; index < size; index += 1) {
      const angle = (-2 * Math.PI * bin * index) / size;
      re[bin]! += values[index]! * Math.cos(angle);
      im[bin]! += values[index]! * Math.sin(angle);
    }
  }
  return { re, im };
}

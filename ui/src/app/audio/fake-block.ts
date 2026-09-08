import { ARTEFACT_HZ, BLOCK_FRAMES, CHANNELS, SAMPLE_RATE } from 'modx-dsp';
import { HEADER_BYTES } from './bridge';

/**
 * A bloque built the way `crates/modx-audio/src/block.rs` writes one.
 *
 * It is the only place the layout is spelled out twice, and that is deliberate: a
 * test that built its fixture with the same code that reads it would pass through
 * any change to the format, including a wrong one.
 */
export interface FakeBlock {
  sequence?: number;
  /** Monotonic microseconds, as the audio thread stamps them. */
  sentAtMicros?: number;
  callbackFrames?: number;
  silent?: boolean;
  /** Channel 0. Channel 1 is written identical, which is what was measured. */
  mono?: Float32Array;
}

export function fakeBlock({
  sequence = 0,
  sentAtMicros = 0,
  callbackFrames = 441,
  silent = false,
  mono = new Float32Array(BLOCK_FRAMES),
}: FakeBlock = {}): ArrayBuffer {
  const frames = mono.length;
  const buffer = new ArrayBuffer(HEADER_BYTES + frames * CHANNELS * 4);
  const header = new DataView(buffer);
  header.setUint32(0, sequence, true);
  header.setUint32(4, frames, true);
  header.setBigUint64(8, BigInt(Math.round(sentAtMicros)), true);
  header.setUint32(16, callbackFrames, true);
  header.setUint32(20, silent ? 1 : 0, true);

  const samples = new Float32Array(buffer, HEADER_BYTES, frames * CHANNELS);
  for (let frame = 0; frame < frames; frame += 1) {
    samples[frame * CHANNELS] = mono[frame];
    samples[frame * CHANNELS + 1] = mono[frame];
  }
  return buffer;
}

/** One bloque of a held note, so the scope has something to trigger on. */
export function heldNote(frequency: number, startFrame = 0, frames = BLOCK_FRAMES): Float32Array {
  const mono = new Float32Array(frames);
  for (let index = 0; index < frames; index += 1) {
    mono[index] = 0.5 * Math.sin((2 * Math.PI * frequency * (startFrame + index)) / SAMPLE_RATE);
  }
  return mono;
}

/**
 * The generator's comb added on top of a note: one line at a multiple of
 * 2 756.25 Hz, 72 dB under the note, which is where fase 0 §7 found it in all
 * four vectores de oro.
 *
 * It exists so a test can ask the screen what it does about an artefact without
 * reading a WAV: the vectores are the DSP's regression tests and live in
 * `modx-dsp`, and a UI test that needed one of them would be measuring the
 * analysis all over again instead of the panel.
 *
 * `multiple` is which line of the comb to lay down. It is there because the comb
 * is not one line: on the MODX8 a C4 shows the 1× and a C5 the 2×, and the chip
 * flickering between them was #19. Call it twice to put down both.
 */
export function withComb(
  mono: Float32Array,
  startFrame = 0,
  amplitude = 1.25e-4,
  multiple = 1,
): Float32Array {
  const both = Float32Array.from(mono);
  const hz = ARTEFACT_HZ * multiple;
  for (let index = 0; index < both.length; index += 1) {
    both[index] += amplitude * Math.sin((2 * Math.PI * hz * (startFrame + index)) / SAMPLE_RATE);
  }
  return both;
}

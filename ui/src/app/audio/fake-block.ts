import { BLOCK_FRAMES, CHANNELS, SAMPLE_RATE } from 'modx-dsp';
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

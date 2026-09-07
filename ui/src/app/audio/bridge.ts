import { BLOCK_FRAMES, CHANNELS, SAMPLE_RATE, scopeTrace } from 'modx-dsp';

/**
 * The front's half of the audio bridge: everything the Web Worker does, as plain
 * functions and one class, so that `audio.worker.ts` is a message wrapper with
 * nothing in it worth testing.
 *
 * The bloque arrives as one `ArrayBuffer`, transferred from the main thread, laid
 * out exactly as `crates/modx-audio/src/block.rs` writes it:
 *
 * ```text
 * offset  bytes  field
 *      0      4  u32  sequence
 *      4      4  u32  frames
 *      8      8  u64  sent_at_micros    monotonic, from the start of the capture
 *     16      4  u32  callback_frames
 *     20      4  u32  flags             bit 0: no entra audio
 *     24    4·s  f32  samples           interleaved L R L R …
 * ```
 *
 * That layout is the contract between Rust and this file and it is written down in
 * both. Changing one side without the other gives a silent shift, not a crash,
 * which is why {@link decodeBlock} checks the length it was promised.
 */

/** Bytes of header in front of the samples. Mirrors `HEADER_BYTES` in Rust. */
export const HEADER_BYTES = 24;

/** Bit 0 of `flags`. */
const FLAG_SILENT = 1;

/** How many bloques of channel 0 the scope keeps: 90 ms, two cycles down to 22 Hz. */
const SCOPE_BLOCKS = 3;

/**
 * How many delivery latencies are kept for the percentiles: 33 minutes at 33.3 Hz,
 * so a ten-minute run is measured whole and nothing grows without bound.
 */
const LATENCY_HISTORY = 65536;

export interface AudioBlock {
  readonly sequence: number;
  readonly frames: number;
  /** Monotonic microseconds counted from before the first device callback. */
  readonly sentAtMicros: number;
  /** Frames the device handed over in the callback that completed this bloque. */
  readonly callbackFrames: number;
  /** Exact digital zeros for a second. Not a level threshold; see `silence.rs`. */
  readonly silent: boolean;
  /** Interleaved stereo, laid over the same buffer without copying it. */
  readonly samples: Float32Array;
}

/** Take the bloque apart without copying its samples. */
export function decodeBlock(buffer: ArrayBuffer): AudioBlock {
  const header = new DataView(buffer, 0, HEADER_BYTES);
  const frames = header.getUint32(4, true);
  const expected = HEADER_BYTES + frames * CHANNELS * 4;
  if (buffer.byteLength !== expected) {
    throw new Error(`bloque de ${buffer.byteLength} B, se esperaban ${expected} B`);
  }

  return {
    sequence: header.getUint32(0, true),
    frames,
    sentAtMicros: Number(header.getBigUint64(8, true)),
    callbackFrames: header.getUint32(16, true),
    silent: (header.getUint32(20, true) & FLAG_SILENT) !== 0,
    samples: new Float32Array(buffer, HEADER_BYTES, frames * CHANNELS),
  };
}

/** Channel 0 of an interleaved bloque, which is what every analysis reads. */
export function channelZero(block: AudioBlock): Float32Array {
  const mono = new Float32Array(block.frames);
  for (let frame = 0; frame < block.frames; frame += 1) {
    mono[frame] = block.samples[frame * CHANNELS];
  }
  return mono;
}

export interface BridgeStats {
  /** Bloques that arrived. */
  readonly blocks: number;
  /** Sequence numbers that never arrived. The go/no-go wants this at zero. */
  readonly gaps: number;
  /** Bloques that arrived after a later one. Tauri orders channels, so: zero. */
  readonly outOfOrder: number;
  /** Frames of the last device callback. 441 on a healthy WASAPI stream. */
  readonly callbackFrames: number;
  /** Smallest and largest device callback seen since the app started. */
  readonly minCallbackFrames: number;
  readonly maxCallbackFrames: number;
  readonly p50Ms: number | null;
  readonly p99Ms: number | null;
  readonly maxMs: number | null;
  /** No entra audio: exact digital zeros for a second. */
  readonly silent: boolean;
}

const NO_STATS: BridgeStats = {
  blocks: 0,
  gaps: 0,
  outOfOrder: 0,
  callbackFrames: 0,
  minCallbackFrames: 0,
  maxCallbackFrames: 0,
  p50Ms: null,
  p99Ms: null,
  maxMs: null,
  silent: false,
};

/**
 * Counts what the bridge lost and how late it was.
 *
 * **How the two clocks are aligned.** Rust stamps each bloque with microseconds
 * since the capture started; the worker stamps arrival with `performance.now()`,
 * which counts from the page. The two epochs are unrelated, so the difference
 * between them is a real latency plus an unknown constant, and no amount of
 * arithmetic here can separate the two. What is reported is therefore the
 * difference **minus the smallest difference of the whole run**: the fastest
 * bloque is called zero and every other one is measured against it. The numbers
 * are a lower bound on the true delivery latency and an exact measurement of its
 * spread — which is what «p99 under 33 ms» is asking about, because a constant
 * offset shared by every bloque cannot drop a frame.
 */
export class BlockMeter {
  private blocks = 0;
  private outOfOrder = 0;
  private firstSequence: number | null = null;
  private highestSequence = 0;
  private callbackFrames = 0;
  private minCallbackFrames = 0;
  private maxCallbackFrames = 0;
  private silent = false;

  /** Raw `arrival − sent` differences, in ms, oldest overwritten. */
  private readonly deltas = new Float64Array(LATENCY_HISTORY);
  private written = 0;

  /** `arrivedAt` is `performance.now()` when the buffer reached the worker. */
  observe(block: AudioBlock, arrivedAt: number): void {
    // Lost is counted as a hole in the span, not as a jump: a bloque that came
    // late is out of order, and counting it as lost the moment its successor
    // arrived would make the go/no-go fail on a reordering that lost nothing.
    if (this.firstSequence === null) {
      this.firstSequence = block.sequence;
      this.highestSequence = block.sequence;
    } else if (block.sequence < this.highestSequence) {
      this.outOfOrder += 1;
    } else {
      this.highestSequence = block.sequence;
    }
    this.blocks += 1;

    this.callbackFrames = block.callbackFrames;
    this.maxCallbackFrames = Math.max(this.maxCallbackFrames, block.callbackFrames);
    this.minCallbackFrames =
      this.blocks === 1
        ? block.callbackFrames
        : Math.min(this.minCallbackFrames, block.callbackFrames);
    this.silent = block.silent;

    this.deltas[this.written % LATENCY_HISTORY] = arrivedAt - block.sentAtMicros / 1000;
    this.written += 1;
  }

  stats(): BridgeStats {
    if (this.blocks === 0) {
      return NO_STATS;
    }

    const kept = this.deltas.slice(0, Math.min(this.written, LATENCY_HISTORY));
    const floor = kept.reduce((lowest, delta) => Math.min(lowest, delta), Infinity);
    const latencies = Array.from(kept, (delta) => delta - floor).sort((a, b) => a - b);

    return {
      blocks: this.blocks,
      gaps: this.highestSequence - (this.firstSequence ?? 0) + 1 - this.blocks,
      outOfOrder: this.outOfOrder,
      callbackFrames: this.callbackFrames,
      minCallbackFrames: this.minCallbackFrames,
      maxCallbackFrames: this.maxCallbackFrames,
      p50Ms: percentile(latencies, 0.5),
      p99Ms: percentile(latencies, 0.99),
      maxMs: latencies[latencies.length - 1] ?? null,
      silent: this.silent,
    };
  }
}

function percentile(sorted: readonly number[], fraction: number): number | null {
  if (sorted.length === 0) {
    return null;
  }
  const index = Math.min(sorted.length - 1, Math.floor(fraction * sorted.length));
  return sorted[index] ?? null;
}

/** What one bloque leaves behind for the screen. */
export interface BridgeFrame {
  /**
   * Channel 0, already triggered and two cycles long, ready to draw — or `null`
   * when there is nothing to draw. Never a flat line at zero: that would be a
   * measurement, and this is the absence of one.
   */
  readonly trace: Float32Array | null;
  /** The frequency the trace was triggered at, for the readout. */
  readonly frequencyHz: number | null;
}

/**
 * The worker's whole job: take a bloque, keep the score, and hand back the piece
 * of waveform the scope draws.
 *
 * It holds the last three bloques of channel 0 so that two cycles fit down to
 * 22 Hz — one bloque is 30 ms, which is not two cycles of anything below 66 Hz.
 *
 * {@link stats} is deliberately not part of {@link receive}: the percentiles sort
 * the whole history and the readout is only read once a second, so paying for them
 * 33 times a second would be the bridge measuring itself into a failure.
 */
export class AudioBridge {
  private readonly meter = new BlockMeter();
  private readonly history = new Float32Array(BLOCK_FRAMES * SCOPE_BLOCKS);

  receive(buffer: ArrayBuffer, arrivedAt: number): BridgeFrame {
    const block = decodeBlock(buffer);
    this.meter.observe(block, arrivedAt);

    const mono = channelZero(block);
    this.history.copyWithin(0, mono.length);
    this.history.set(mono, this.history.length - mono.length);

    const found = scopeTrace(this.history, SAMPLE_RATE);
    const trace =
      found === null ? null : this.history.slice(found.trigger, found.trigger + found.length);

    return { trace, frequencyHz: found?.frequencyHz ?? null };
  }

  stats(): BridgeStats {
    return this.meter.stats();
  }
}

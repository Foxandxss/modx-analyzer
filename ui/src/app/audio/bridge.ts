import {
  BLOCK_FRAMES,
  CHANNELS,
  LiveTrama,
  MEASURE_WINDOW,
  Medida,
  SAMPLE_RATE,
  liveTrama,
  medida,
  scopeTrace,
} from 'modx-dsp';

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
 * How many bloques of channel 0 are kept in all: four, 5 292 samples, because the
 * vista viva's window is 4 096 and three bloques are 3 969. The scope still reads
 * the last three of them — a longer buffer would change where it triggers — so
 * this number is the espectro's, not the scope's.
 */
const HISTORY_BLOCKS = 4;

/**
 * How many trama costs are kept for the percentiles. The same 65 536 as the
 * latencies, for the same reason: a ten-minute run is measured whole.
 */
const TRAMA_HISTORY = 65536;

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

/**
 * The medida's window, as `measure_window` hands it over: bare little-endian f32
 * of channel 0, no header, oldest sample first.
 *
 * It is checked against the window that is about to be analysed rather than
 * trusted, exactly as the bloque is: a buffer one sample short would otherwise
 * be a spectrum quietly measured over the wrong length of time.
 */
export function decodeMeasureWindow(buffer: ArrayBuffer, window = MEASURE_WINDOW): Float32Array {
  const expected = window * 4;
  if (buffer.byteLength !== expected) {
    throw new Error(`ventana de ${buffer.byteLength} B, se esperaban ${expected} B`);
  }
  return new Float32Array(buffer);
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
  /**
   * What one trama costs end to end in the worker, from the bloque arriving to
   * the espectro, the armónicos and the ridgeline being ready to draw. The budget
   * is 33 ms — one bloque — and these are the numbers that say whether it is met.
   */
  readonly tramaP50Ms: number | null;
  readonly tramaP99Ms: number | null;
  readonly tramaMaxMs: number | null;
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
  tramaP50Ms: null,
  tramaP99Ms: null,
  tramaMaxMs: null,
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

  /** What each trama cost the worker, in ms, oldest overwritten. */
  private readonly tramas = new Float64Array(TRAMA_HISTORY);
  private tramasWritten = 0;

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

  /** What the analysis of one trama cost, in ms. Measured, never estimated. */
  observeTrama(costMs: number): void {
    this.tramas[this.tramasWritten % TRAMA_HISTORY] = costMs;
    this.tramasWritten += 1;
  }

  stats(): BridgeStats {
    if (this.blocks === 0) {
      return NO_STATS;
    }

    const kept = this.deltas.slice(0, Math.min(this.written, LATENCY_HISTORY));
    const floor = kept.reduce((lowest, delta) => Math.min(lowest, delta), Infinity);
    const latencies = Array.from(kept, (delta) => delta - floor).sort((a, b) => a - b);

    // The trama costs need no floor subtracted: one clock measured them.
    const tramas = Array.from(
      this.tramas.slice(0, Math.min(this.tramasWritten, TRAMA_HISTORY)),
    ).sort((a, b) => a - b);

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
      tramaP50Ms: percentile(tramas, 0.5),
      tramaP99Ms: percentile(tramas, 0.99),
      tramaMaxMs: tramas[tramas.length - 1] ?? null,
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
  /** The espectro, the armónicos and the ridgeline of this trama. */
  readonly trama: LiveTrama;
  /** What this trama cost, in ms, measured with `performance` marks. */
  readonly tramaMs: number;
}

/** What one press of MEDIR left behind. */
export interface MedidaFrame {
  /** The partial table, or `null` when the shutter opened on a silence. */
  readonly medida: Medida | null;
  /** What the 65 536 cost here, in ms. Measured, and it is not the 33 ms budget. */
  readonly costMs: number;
}

/** The marks the trama budget is measured with. Named so a profile reads. */
const MARK_START = 'trama:inicio';
const MARK_END = 'trama:fin';
const MEASURE = 'trama';

/** And the medida's own, which nobody is timing against a budget. */
const MEDIDA_START = 'medida:inicio';
const MEDIDA_END = 'medida:fin';
const MEDIDA_MEASURE = 'medida';

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
  private readonly history = new Float32Array(BLOCK_FRAMES * HISTORY_BLOCKS);

  /** The note the keyboard is holding, when it says so. See {@link setNote}. */
  private noteHz: number | null = null;

  /**
   * The note the last trama was actually drawn against, fallback included.
   *
   * It is what a medida taken with the MIDI port gone reads its harmonics
   * against: the espectro is still drawing an axis off the scope's period, and a
   * table that refused to number the same lines the axis is numbering would be
   * the two halves of the screen disagreeing about which note is sounding.
   */
  private drawnHz: number | null = null;

  /**
   * The note the espectro's axis is drawn against.
   *
   * It is the **played** note, from the note tracker, and not the period the
   * scope measured: with a high modulation index the loudest line is the ninth
   * harmonic and an axis that took the strongest peak for 1× would redraw itself
   * every time somebody turned a knob. The scope's period is the fallback, so
   * that audio entering with the MIDI port gone is still drawn — it is the same
   * note, read off the sound instead of off the keyboard.
   */
  setNote(hz: number | null): void {
    this.noteHz = hz;
  }

  receive(buffer: ArrayBuffer, arrivedAt: number): BridgeFrame {
    performance.mark(MARK_START);

    const block = decodeBlock(buffer);
    this.meter.observe(block, arrivedAt);

    const mono = channelZero(block);
    this.history.copyWithin(0, mono.length);
    this.history.set(mono, this.history.length - mono.length);

    // The scope keeps reading the last three bloques it always read: the trigger
    // it finds is a property of the window it was given.
    const scopeWindow = this.history.subarray(this.history.length - BLOCK_FRAMES * SCOPE_BLOCKS);
    const found = scopeTrace(scopeWindow, SAMPLE_RATE);
    const trace =
      found === null ? null : scopeWindow.slice(found.trigger, found.trigger + found.length);

    this.drawnHz = this.noteHz ?? found?.frequencyHz ?? null;
    const trama = liveTrama(this.history, this.drawnHz);

    performance.mark(MARK_END);
    const measured = performance.measure(MEASURE, MARK_START, MARK_END);
    this.meter.observeTrama(measured.duration);
    performance.clearMarks(MARK_START);
    performance.clearMarks(MARK_END);
    performance.clearMeasures(MEASURE);

    return { trace, frequencyHz: found?.frequencyHz ?? null, trama, tramaMs: measured.duration };
  }

  /**
   * One press of MEDIR: 65 536 samples out of the ring, one Hann window, one
   * transform, and a partial table that will not move again until the next press.
   *
   * It runs **here**, on the worker's thread, for the same reason the trama does
   * (ADR-0001): a 65 536-point transform is tens of milliseconds and the thread
   * that draws cannot spend them. The note it is read against is the same one
   * the espectro's axis uses, so the medida and the vista viva can never
   * disagree about which note was playing.
   */
  measure(buffer: ArrayBuffer, window = MEASURE_WINDOW): MedidaFrame {
    performance.mark(MEDIDA_START);

    const samples = decodeMeasureWindow(buffer, window);
    const taken = medida(samples, this.noteHz ?? this.drawnHz, SAMPLE_RATE, window);

    performance.mark(MEDIDA_END);
    const measured = performance.measure(MEDIDA_MEASURE, MEDIDA_START, MEDIDA_END);
    performance.clearMarks(MEDIDA_START);
    performance.clearMarks(MEDIDA_END);
    performance.clearMeasures(MEDIDA_MEASURE);

    return { medida: taken, costMs: measured.duration };
  }

  stats(): BridgeStats {
    return this.meter.stats();
  }
}

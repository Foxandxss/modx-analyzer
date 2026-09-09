import {
  BLOCK_FRAMES,
  CHANNELS,
  LiveTrama,
  MEASURE_WINDOW,
  Medida,
  SAMPLE_RATE,
  ScopeLock,
  estimatePeriod,
  liveTrama,
  medida,
  scopeLock,
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
 *     24      8  u64  queued_at_micros  same clock, on the way to the IPC
 *     32    4·s  f32  samples           interleaved L R L R …
 * ```
 *
 * That layout is the contract between Rust and this file and it is written down in
 * both. Changing one side without the other gives a silent shift, not a crash,
 * which is why {@link decodeBlock} checks the length it was promised.
 */

/** Bytes of header in front of the samples. Mirrors `HEADER_BYTES` in Rust. */
export const HEADER_BYTES = 32;

/** Bit 0 of `flags`. */
const FLAG_SILENT = 1;

/**
 * The page's clock, read the same way on the main thread and inside the worker.
 *
 * **`performance.now()` is not one clock across threads.** A dedicated worker
 * gets its own `timeOrigin` — the moment it was created — so its `now()` counts
 * from later than the page's. Measured on the MODX8 on 2026-09-09, the first
 * attempt at #23's split reported a worker leg of **−447,5 ms**: not a latency at
 * all, but the 447 ms between the page starting and `new Worker` returning.
 *
 * Adding `timeOrigin` back puts both threads on the same absolute scale, so a
 * difference across them is a duration again. What it costs is that
 * `timeOrigin` can be coarsened by the browser, which leaves a constant bias
 * under a millisecond on that one leg — three orders of magnitude below the
 * burst it is there to find.
 */
export function stamp(): number {
  return performance.timeOrigin + performance.now();
}

/**
 * How many bloques of channel 0 the scope keeps: seven, 210 ms.
 *
 * The scope draws four whole periods of the note and the first crossing it can
 * start on may be almost a period into the buffer, so what it needs is **five**
 * periods of the lowest key of an 88-key MODX8 — A0, 27.5 Hz, 181.8 ms. Seven
 * bloques cover that with margin, and the trace is cut from the **newest** end
 * of them (`cutCycles` in `scope.ts`), so a long history costs latency nowhere.
 */
const SCOPE_BLOCKS = 7;

/**
 * How many bloques the espectro's axis falls back on when the MIDI port is gone:
 * three, 90 ms, which is what it has always read.
 *
 * It is deliberately **not** the scope's window. `estimatePeriod` measures from
 * the start of what it is given, so handing it the scope's longer buffer would
 * have it correlating the silence in front of the first seven bloques of a
 * session — and the axis would have no note for the first fifth of a second of
 * every launch.
 */
const AXIS_BLOCKS = 3;

/**
 * How many bloques of channel 0 are kept in all. The scope's buffer is the
 * longest thing anybody reads — the vista viva's window is 4 096 and lives
 * inside it — so this is the scope's number and the espectro takes its window
 * off the end of it.
 */
const HISTORY_BLOCKS = SCOPE_BLOCKS;

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

/**
 * How many bloques at the start of a capture are kept out of the percentiles:
 * five seconds of them.
 *
 * **This is #23.** Some launches deliver a bloque hundreds of milliseconds late
 * and lose none of them (`GAPS 0`, `OUT OF ORDER 0` every time). A percentile taken
 * over a window that still contains one of those is reporting the launch and not
 * the bridge: at 132 bloques `p99` read 167,9 ms, and at 4 917 it still read
 * 150,2 ms, because a burst only falls under the 1 % once the run is a hundred
 * times longer than it.
 *
 * So the burst is not averaged in and it is not hidden either: these bloques are
 * counted, their worst is reported on its own as {@link BridgeStats.worstWarmup},
 * and the percentiles say how many bloques they cover.
 *
 * **Five seconds, and why that number is not the point.** Measured over five
 * launches on 2026-09-09, the worst bloque of a burst landed at 1,3 s twice and
 * the other three launches never burst at all; five seconds covers that with
 * margin. But the same measurement found a 204,9 ms bloque at **48,5 s**, which
 * no window can exclude — so this is a way of reporting the launch honestly and
 * never a way of making the figures pass. What keeps them honest is that the
 * worst of the run says {@link LatencyLegs.atSeconds}, and that
 * {@link BridgeStats.worstGapMs} says whether the front was late or absent.
 */
export const WARMUP_BLOCKS = 167;

export interface AudioBlock {
  readonly sequence: number;
  readonly frames: number;
  /** Monotonic microseconds counted from before the first device callback. */
  readonly sentAtMicros: number;
  /**
   * The same clock, stamped as the bloque left the queue between the audio
   * thread and the IPC. The one cut in the path that needs no epoch crossed.
   */
  readonly queuedAtMicros: number;
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
    queuedAtMicros: Number(header.getBigUint64(24, true)),
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

/**
 * One bloque's journey, cut into the three pieces it is made of.
 *
 * The path from the device callback to the worker crosses two threads and one
 * process boundary, and until #23 it was reported as a single number: a launch
 * burst of 379 ms was visible and unattributable. These are the three pieces,
 * and they add up to {@link LatencyLegs.totalMs} exactly.
 *
 * **Two of them are measurements and one is a lower bound.** {@link queueMs} is
 * stamped twice by Rust on one monotonic clock, {@link workerMs} twice by the
 * page on `performance.now()`; both are exact. Only {@link ipcMs} spans the two
 * epochs, so only it carries the unknown constant — and it is the leg the floor
 * is taken out of, which is why the three still sum to the total.
 */
export interface LatencyLegs {
  /** Waiting between the audio thread and the thread that feeds the IPC. */
  readonly queueMs: number;
  /** The crossing itself: the encode, Tauri's IPC, the webview's event loop. */
  readonly ipcMs: number;
  /** Waiting in the worker's own message queue, behind the tramas ahead of it. */
  readonly workerMs: number;
  /** The three of them. This is the figure the 33 ms budget is about. */
  readonly totalMs: number;
  /**
   * How far into the capture this bloque was, in seconds, off the stamp the
   * device callback took.
   *
   * A `max` without it cannot be acted on. #23 is the question «is this figure
   * the launch or the bridge?», and a worst bloque three seconds in and one four
   * minutes in are two completely different answers wearing the same number.
   */
  readonly atSeconds: number;
}

export interface BridgeStats {
  /** Bloques that arrived, the launch included. */
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
  /**
   * How many bloques the three percentiles below cover: everything past the
   * launch. It is reported next to them and not left to be worked out, because
   * «p99 under 33 ms» is a claim about a window, and #23 is what happens when
   * nothing on screen says which window it was.
   */
  readonly measuredBlocks: number;
  /** Bloques of the launch, kept out of them. See {@link WARMUP_BLOCKS}. */
  readonly warmupBlocks: number;
  /** The worst bloque of the launch, split. `null` before the first one. */
  readonly worstWarmup: LatencyLegs | null;
  /** The worst bloque past the launch, split. `null` until the launch is over. */
  readonly worstMeasured: LatencyLegs | null;
  /**
   * The longest the front went without a bloque arriving at all, in ms, and how
   * far into the capture that was.
   *
   * Bloques are cut every 30 ms, so this reads about 30 on a healthy run. It is
   * here because a `max` on its own cannot tell one slow bloque from a **stall**:
   * if the front stops receiving for 230 ms and then takes seven at once, the
   * worst of those looks like a delivery that was 200 ms late, and it is not —
   * it is the front having been away. The two have different causes, and this is
   * the number that separates them.
   */
  readonly worstGapMs: number | null;
  readonly worstGapAtSeconds: number;
  /**
   * The page-clock stamp at which the capture's own clock reads zero.
   *
   * It is what lets a figure measured on the page — the main thread's lateness
   * to its own timer — be placed in the same seconds as a figure measured on the
   * device's. Taken from the most recent bloque, so it carries that bloque's
   * delivery latency as its error: about a millisecond, against events being
   * placed to a tenth of a second.
   */
  readonly captureStartedAtMs: number;
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
  measuredBlocks: 0,
  warmupBlocks: 0,
  worstWarmup: null,
  worstMeasured: null,
  worstGapMs: null,
  worstGapAtSeconds: 0,
  captureStartedAtMs: 0,
  p50Ms: null,
  p99Ms: null,
  maxMs: null,
  tramaP50Ms: null,
  tramaP99Ms: null,
  tramaMaxMs: null,
  silent: false,
};

/** The three legs before the epoch is taken out of the middle one. */
interface RawLegs {
  readonly queueMs: number;
  readonly ipcRawMs: number;
  readonly workerMs: number;
  /** Microseconds since the capture started, straight off the header. */
  readonly sentAtMicros: number;
}

/**
 * Counts what the bridge lost, how late it was, and **where** the lateness was.
 *
 * **How the two clocks are aligned.** Rust stamps each bloque twice in
 * microseconds since the capture started; the page stamps it twice more with
 * `performance.now()`, which counts from the page. The two epochs are unrelated,
 * so a difference taken across them is a real latency plus an unknown constant,
 * and no amount of arithmetic here can separate the two.
 *
 * Exactly **one** of the three legs crosses the epochs, and that is the whole
 * trick: {@link LatencyLegs.queueMs} is Rust's two stamps and
 * {@link LatencyLegs.workerMs} is the page's two, so both are exact durations,
 * and only the crossing carries the constant. What is reported for the crossing
 * is the difference **minus the smallest such difference of the run**: the
 * fastest bloque's crossing is called zero and every other one is measured
 * against it. So the total is a lower bound on the true delivery latency and an
 * exact measurement of its spread — which is what «p99 under 33 ms» is asking
 * about, because a constant offset shared by every bloque cannot drop a frame.
 *
 * **The launch is counted apart.** The first {@link WARMUP_BLOCKS} never enter
 * the percentiles; they are counted, and the worst of them is reported whole and
 * split, so #23's burst appears on screen as itself instead of inside a figure
 * that claims to be about the bridge.
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

  /** The three legs of each bloque past the launch, in ms, oldest overwritten. */
  private readonly queueMs = new Float64Array(LATENCY_HISTORY);
  private readonly ipcRawMs = new Float64Array(LATENCY_HISTORY);
  private readonly workerMs = new Float64Array(LATENCY_HISTORY);
  /** When each of them was cut by the device, so a `max` can be placed in time. */
  private readonly sentAtMicros = new Float64Array(LATENCY_HISTORY);
  private written = 0;

  /**
   * The fastest crossing of the whole capture, the launch included: the stand-in
   * for the constant between the two epochs.
   *
   * It is a running minimum over **everything** and not over the measured window
   * alone, on purpose. A floor that is too low makes every reported latency too
   * large, which is the direction a go/no-go should err in; one taken from the
   * window it reports on could rise as that window scrolled and would make the
   * bridge look as though it were getting better.
   */
  private floorRaw = Infinity;

  /** The launch: how many bloques, and the worst of them, before the floor. */
  private warmupBlocks = 0;
  private worstWarmup: RawLegs | null = null;

  /** Where the capture's zero falls on the page's clock. See the field. */
  private captureStartedAtMs = 0;

  /** The longest the front went without a bloque, and how far in it happened. */
  private lastPostedAt: number | null = null;
  private worstGapMs: number | null = null;
  private worstGapAtSeconds = 0;

  /** What each trama cost the worker, in ms, oldest overwritten. */
  private readonly tramas = new Float64Array(TRAMA_HISTORY);
  private tramasWritten = 0;

  /**
   * `postedAt` is `performance.now()` when the main thread took the bloque off
   * the Tauri channel; `arrivedAt` is `performance.now()` when the worker got to
   * it. They are the same clock, so what lies between them is the worker's own
   * message queue and nothing else.
   */
  observe(block: AudioBlock, arrivedAt: number, postedAt: number = arrivedAt): void {
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

    const legs: RawLegs = {
      queueMs: (block.queuedAtMicros - block.sentAtMicros) / 1000,
      ipcRawMs: postedAt - block.queuedAtMicros / 1000,
      workerMs: arrivedAt - postedAt,
      sentAtMicros: block.sentAtMicros,
    };
    this.floorRaw = Math.min(this.floorRaw, legs.ipcRawMs);

    // The gap is measured on arrivals at the main thread and not on the stamps
    // the device took: what is being asked is how long **the front** was without
    // one, and the device never stops cutting them.
    if (this.lastPostedAt !== null) {
      const gap = postedAt - this.lastPostedAt;
      if (this.worstGapMs === null || gap > this.worstGapMs) {
        this.worstGapMs = gap;
        this.worstGapAtSeconds = block.sentAtMicros / 1_000_000;
      }
    }
    this.lastPostedAt = postedAt;
    this.captureStartedAtMs = postedAt - block.sentAtMicros / 1000;

    if (this.blocks <= WARMUP_BLOCKS) {
      this.warmupBlocks += 1;
      // Ordering by the raw total is ordering by the corrected one: the floor is
      // the same constant under every bloque of the run.
      if (this.worstWarmup === null || rawTotal(legs) > rawTotal(this.worstWarmup)) {
        this.worstWarmup = legs;
      }
      return;
    }

    const slot = this.written % LATENCY_HISTORY;
    this.queueMs[slot] = legs.queueMs;
    this.ipcRawMs[slot] = legs.ipcRawMs;
    this.workerMs[slot] = legs.workerMs;
    this.sentAtMicros[slot] = legs.sentAtMicros;
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

    const kept = Math.min(this.written, LATENCY_HISTORY);
    const totals = new Array<number>(kept);
    let worstAt = -1;
    let worstTotal = -Infinity;
    for (let index = 0; index < kept; index += 1) {
      const total = this.corrected(index).totalMs;
      totals[index] = total;
      if (total > worstTotal) {
        worstTotal = total;
        worstAt = index;
      }
    }
    totals.sort((a, b) => a - b);

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
      measuredBlocks: kept,
      warmupBlocks: this.warmupBlocks,
      worstWarmup: this.worstWarmup === null ? null : this.correct(this.worstWarmup),
      worstMeasured: worstAt < 0 ? null : this.corrected(worstAt),
      worstGapMs: this.worstGapMs,
      worstGapAtSeconds: this.worstGapAtSeconds,
      captureStartedAtMs: this.captureStartedAtMs,
      p50Ms: percentile(totals, 0.5),
      p99Ms: percentile(totals, 0.99),
      maxMs: totals[totals.length - 1] ?? null,
      tramaP50Ms: percentile(tramas, 0.5),
      tramaP99Ms: percentile(tramas, 0.99),
      tramaMaxMs: tramas[tramas.length - 1] ?? null,
      silent: this.silent,
    };
  }

  /** The legs of one measured bloque, with the epoch taken out of the crossing. */
  private corrected(index: number): LatencyLegs {
    return this.correct({
      queueMs: this.queueMs[index],
      ipcRawMs: this.ipcRawMs[index],
      workerMs: this.workerMs[index],
      sentAtMicros: this.sentAtMicros[index],
    });
  }

  private correct(legs: RawLegs): LatencyLegs {
    const ipcMs = legs.ipcRawMs - this.floorRaw;
    return {
      queueMs: legs.queueMs,
      ipcMs,
      workerMs: legs.workerMs,
      totalMs: legs.queueMs + ipcMs + legs.workerMs,
      atSeconds: legs.sentAtMicros / 1_000_000,
    };
  }
}

/** The three raw legs added up, for comparing two bloques of the same run. */
function rawTotal(legs: RawLegs): number {
  return legs.queueMs + legs.ipcRawMs + legs.workerMs;
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
   * Channel 0, cut to what {@link scope} says is drawable: four locked cycles,
   * or the raw window when there is no lock. `null` only when the buffer was too
   * short to cut anything at all.
   */
  readonly trace: Float32Array | null;
  /**
   * What the scope is entitled to claim about that trace: the lock and its
   * frequency, or why there is none. The caption is written from this and from
   * nothing else, which is what makes the caption a specification.
   */
  readonly scope: ScopeLock;
  /**
   * The note the espectro's axis was drawn against — the played one, or the
   * period the autocorrelation found when the MIDI port is gone.
   *
   * **It is not the scope's frequency** and nothing reads it as one: it is what
   * numbers the harmonics and finds the comb's sidebands.
   */
  readonly drawnHz: number | null;
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
 * It holds the last {@link SCOPE_BLOCKS} bloques of channel 0 so that the four
 * cycles the scope draws fit down to the lowest key of the keyboard.
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
   * How many distinct pitches the keyboard is holding. Two notes have no
   * fundamental between them, so the scope refuses rather than locking to one.
   */
  private heldPitches = 0;

  /**
   * The fc of the last Medida, which the scope locks to ahead of the played
   * note.
   *
   * **Nothing calls the setter in the running build**: the medida produces a
   * partial table and fits nothing, so there is no fc to hand over. The branch
   * exists because the priority is part of the scope's contract, and it is
   * exercised in the spec so that the fit ticket lands on a path that works.
   */
  private capturedFcHz: number | null = null;

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
  setNote(hz: number | null, heldPitches = hz === null ? 0 : 1): void {
    this.noteHz = hz;
    this.heldPitches = heldPitches;
  }

  /**
   * The fc the last capture fitted, for the scope to lock to.
   *
   * Unused in this build and deliberately kept: see {@link capturedFcHz}.
   */
  setCapturedFc(hz: number | null): void {
    this.capturedFcHz = hz;
  }

  /**
   * `postedAt` is when the main thread handed the bloque over, on this
   * page's clock. It defaults to `arrivedAt` — «it was not waiting here» — so a
   * caller
   * that has nothing to say about the worker's queue says nothing rather than
   * inventing a zero somewhere else.
   */
  receive(buffer: ArrayBuffer, arrivedAt: number, postedAt: number = arrivedAt): BridgeFrame {
    performance.mark(MARK_START);

    const block = decodeBlock(buffer);
    this.meter.observe(block, arrivedAt, postedAt);

    const mono = channelZero(block);
    this.history.copyWithin(0, mono.length);
    this.history.set(mono, this.history.length - mono.length);

    const scopeWindow = this.history.subarray(this.history.length - BLOCK_FRAMES * SCOPE_BLOCKS);

    // The axis's fallback, and the only thing the autocorrelation is allowed to
    // name: the espectro is drawn in multiples of a note and needs one even with
    // the MIDI port gone. The scope does not read it — on a bright timbre it
    // picks a sub-multiple, which is what 43,8 Hz was.
    const axisWindow = this.history.subarray(this.history.length - BLOCK_FRAMES * AXIS_BLOCKS);
    const period = this.noteHz === null ? estimatePeriod(axisWindow, SAMPLE_RATE) : null;
    this.drawnHz = this.noteHz ?? (period === null ? null : SAMPLE_RATE / period);
    const trama = liveTrama(this.history, this.drawnHz);

    // The floor the lock is weighed against is the same figure the readout says
    // beside it (#30): one word, one meaning, one window.
    const scope = scopeLock(
      scopeWindow,
      {
        capturedFcHz: this.capturedFcHz,
        heldHz: this.noteHz,
        heldPitches: this.heldPitches,
        floorDb: trama.floorDb,
      },
      SAMPLE_RATE,
    );
    // Under the floor nothing is handed over at all: what would be drawn is the
    // floor, the panel draws it as a band from the lock's own figure, and a
    // trace of noise sent across for nobody to draw is a flat line waiting to be
    // painted by the next reader of this field.
    const trace =
      scope.kind === 'belowFloor' || scope.length < 2
        ? null
        : scopeWindow.slice(scope.trigger, scope.trigger + scope.length);

    performance.mark(MARK_END);
    const measured = performance.measure(MEASURE, MARK_START, MARK_END);
    this.meter.observeTrama(measured.duration);
    performance.clearMarks(MARK_START);
    performance.clearMarks(MARK_END);
    performance.clearMeasures(MEASURE);

    return { trace, scope, drawnHz: this.drawnHz, trama, tramaMs: measured.duration };
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

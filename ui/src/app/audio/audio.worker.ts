/// <reference lib="webworker" />
import { LiveTrama, Medida, ScopeLock } from 'modx-dsp';
import { AudioBridge, BridgeStats, stamp } from './bridge';

/**
 * The worker the bloques are handed to. A message wrapper and nothing else: every
 * line worth a test lives in {@link AudioBridge}, which is why there is no
 * `audio.worker.spec.ts`.
 *
 * It exists so that the analysis never runs on the thread that draws. The buffer
 * arrives transferred, so the main thread has already given it away by the time
 * this runs, and the trama goes back the same way — the curve, the sixteen bars
 * and the trace are transferred, not copied.
 */

/** One reply a second for the readout: the percentiles cost too much for 33 Hz. */
const STATS_EVERY = 33;

export interface BlockMessage {
  readonly kind: 'block';
  readonly buffer: ArrayBuffer;
  /**
   * `performance.now()` on the main thread, the instant the bloque came off the
   * Tauri channel.
   *
   * It rides along because of #23: without it, the wait in **this** queue — the
   * worker chewing through the tramas ahead of this bloque — is indistinguishable
   * from the IPC being slow, and those two have nothing to do with each other.
   * It is taken with {@link stamp} and not `performance.now()`, because those
   * are two different clocks on two threads — which is what the first attempt at
   * this got wrong, and it showed up as a worker leg of −447 ms.
   */
  readonly postedAt: number;
}

/**
 * The note the keyboard is holding, when it is holding one. It arrives on its own
 * message and not with every bloque: it changes when somebody plays, which is
 * hundreds of times slower than the audio.
 */
export interface NoteMessage {
  readonly kind: 'note';
  readonly hz: number | null;
  /**
   * How many distinct pitches are down. It rides with the note because the scope
   * needs both: a chord has a lowest note and no fundamental, and locking to the
   * first of three would stand a shape still that belongs to none of them.
   */
  readonly held: number;
}

/**
 * One press of MEDIR, carrying the window Rust took out of the ring. It is the
 * only message that arrives because somebody did something.
 */
export interface MeasureMessage {
  readonly kind: 'measure';
  readonly buffer: ArrayBuffer;
}

export type WorkerMessage = BlockMessage | NoteMessage | MeasureMessage;

export interface FrameMessage {
  readonly kind: 'frame';
  readonly trace: Float32Array | null;
  /** The lock, or why there is none: what the scope's caption is written from. */
  readonly scope: ScopeLock;
  /** The note the espectro's axis was drawn against. Not the scope's figure. */
  readonly drawnHz: number | null;
  /** The espectro, the armónicos and the ridgeline, ready to draw. */
  readonly trama: LiveTrama;
  /** What this trama cost end to end here, in ms. Budget: 33. */
  readonly tramaMs: number;
  /** Present once a second, absent on the other 32 tramas. */
  readonly stats?: BridgeStats;
}

/** What comes back from a press of MEDIR: a partial table, or a silence. */
export interface MedidaMessage {
  readonly kind: 'medida';
  /** `null` when the shutter opened on a window with nothing in it. */
  readonly medida: Medida | null;
  /** What the 65 536 cost on this thread, in ms. */
  readonly costMs: number;
}

const bridge = new AudioBridge();
let received = 0;

addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  if (event.data.kind === 'note') {
    bridge.setNote(event.data.hz, event.data.held);
    return;
  }
  if (event.data.kind === 'measure') {
    const frame = bridge.measure(event.data.buffer);
    const answer: MedidaMessage = {
      kind: 'medida',
      medida: frame.medida,
      costMs: frame.costMs,
    };
    postMessage(answer);
    return;
  }
  if (event.data.kind !== 'block') {
    return;
  }

  const frame = bridge.receive(event.data.buffer, stamp(), event.data.postedAt);
  received += 1;

  const message: FrameMessage = {
    kind: 'frame',
    trace: frame.trace,
    scope: frame.scope,
    drawnHz: frame.drawnHz,
    trama: frame.trama,
    tramaMs: frame.tramaMs,
    ...(received % STATS_EVERY === 0 ? { stats: bridge.stats() } : {}),
  };

  postMessage(message, transferable(frame.trace, frame.trama));
});

/** Every array in the trama is this worker's own, so all of them go by transfer. */
function transferable(trace: Float32Array | null, trama: LiveTrama): Transferable[] {
  const buffers = [trace?.buffer, trama.curve?.buffer, trama.harmonics?.buffer];
  return buffers.filter((buffer): buffer is ArrayBuffer => buffer !== undefined);
}

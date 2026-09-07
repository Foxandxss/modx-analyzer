/// <reference lib="webworker" />
import { LiveTrama } from 'modx-dsp';
import { AudioBridge, BridgeStats } from './bridge';

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
}

/**
 * The note the keyboard is holding, when it is holding one. It arrives on its own
 * message and not with every bloque: it changes when somebody plays, which is
 * hundreds of times slower than the audio.
 */
export interface NoteMessage {
  readonly kind: 'note';
  readonly hz: number | null;
}

export type WorkerMessage = BlockMessage | NoteMessage;

export interface FrameMessage {
  readonly kind: 'frame';
  readonly trace: Float32Array | null;
  readonly frequencyHz: number | null;
  /** The espectro, the armónicos and the ridgeline, ready to draw. */
  readonly trama: LiveTrama;
  /** What this trama cost end to end here, in ms. Budget: 33. */
  readonly tramaMs: number;
  /** Present once a second, absent on the other 32 tramas. */
  readonly stats?: BridgeStats;
}

const bridge = new AudioBridge();
let received = 0;

addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  if (event.data.kind === 'note') {
    bridge.setNote(event.data.hz);
    return;
  }
  if (event.data.kind !== 'block') {
    return;
  }

  const frame = bridge.receive(event.data.buffer, performance.now());
  received += 1;

  const message: FrameMessage = {
    kind: 'frame',
    trace: frame.trace,
    frequencyHz: frame.frequencyHz,
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

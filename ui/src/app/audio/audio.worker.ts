/// <reference lib="webworker" />
import { AudioBridge, BridgeStats } from './bridge';

/**
 * The worker the bloques are handed to. A message wrapper and nothing else: every
 * line worth a test lives in {@link AudioBridge}, which is why there is no
 * `audio.worker.spec.ts`.
 *
 * It exists so that the analysis never runs on the thread that draws. The buffer
 * arrives transferred, so the main thread has already given it away by the time
 * this runs, and the trace goes back the same way.
 */

/** One reply a second for the readout: the percentiles cost too much for 33 Hz. */
const STATS_EVERY = 33;

export interface BlockMessage {
  readonly kind: 'block';
  readonly buffer: ArrayBuffer;
}

export interface FrameMessage {
  readonly kind: 'frame';
  readonly trace: Float32Array | null;
  readonly frequencyHz: number | null;
  /** Present once a second, absent on the other 32 tramas. */
  readonly stats?: BridgeStats;
}

const bridge = new AudioBridge();
let received = 0;

addEventListener('message', (event: MessageEvent<BlockMessage>) => {
  if (event.data.kind !== 'block') {
    return;
  }

  const frame = bridge.receive(event.data.buffer, performance.now());
  received += 1;

  const message: FrameMessage = {
    kind: 'frame',
    trace: frame.trace,
    frequencyHz: frame.frequencyHz,
    ...(received % STATS_EVERY === 0 ? { stats: bridge.stats() } : {}),
  };

  postMessage(message, frame.trace ? [frame.trace.buffer] : []);
});

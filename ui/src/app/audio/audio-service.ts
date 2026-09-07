import { DestroyRef, Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { BACKEND_GATEWAY } from '../backend/backend-gateway';
import { BridgeStats } from './bridge';
import { BlockMessage, FrameMessage } from './audio.worker';

/**
 * The front's owner of the audio bridge.
 *
 * It subscribes to the bloques, hands each one to the worker **by transfer** and
 * turns what comes back into signals. It never looks inside a buffer: the samples
 * are given away the moment they arrive, which is the point — the thread that
 * draws must not be the thread that analyses (ADR-0001).
 */

/** What the service needs of a worker. Narrow on purpose, so a test can stand in. */
export interface AudioWorkerLike {
  postMessage(message: BlockMessage, transfer: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<FrameMessage>) => void): void;
  terminate(): void;
}

/**
 * How the worker is made. The default builds the real one; a test provides a
 * factory that runs the same `AudioBridge` in place, so the whole path from a
 * bloque to the screen is exercised without a `Worker`.
 */
export const AUDIO_WORKER = new InjectionToken<() => AudioWorkerLike>('AudioWorker', {
  providedIn: 'root',
  factory: () => () => new Worker(new URL('./audio.worker', import.meta.url), { type: 'module' }),
});

/** The dead state: nothing has arrived, so nothing is claimed. */
export const NO_STATS: BridgeStats = {
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

@Injectable({ providedIn: 'root' })
export class AudioService {
  private readonly backend = inject(BACKEND_GATEWAY);
  private readonly makeWorker = inject(AUDIO_WORKER);
  private readonly destroyRef = inject(DestroyRef);

  /** Channel 0, triggered and two cycles long. `null` when there is nothing. */
  readonly trace = signal<Float32Array | null>(null);

  /** The frequency the trace was triggered at, or `null` with no note. */
  readonly frequencyHz = signal<number | null>(null);

  /** What the bridge has lost and how late it has been. Refreshed once a second. */
  readonly stats = signal<BridgeStats>(NO_STATS);

  /**
   * No entra audio: exact digital zeros for a second, decided in Rust. The card
   * that says so out loud is #15; this is the fact it will hang off.
   */
  readonly noAudio = computed(() => this.stats().silent);

  private worker: AudioWorkerLike | null = null;

  /**
   * Open the worker and start taking bloques. Called once, from the component that
   * draws them, so that nothing spins up in a test that did not ask for it.
   */
  start(): void {
    if (this.worker !== null) {
      return;
    }

    const worker = this.makeWorker();
    this.worker = worker;
    worker.addEventListener('message', ({ data }) => {
      this.trace.set(data.trace);
      this.frequencyHz.set(data.frequencyHz);
      if (data.stats !== undefined) {
        this.stats.set(data.stats);
      }
    });

    const unsubscribe = this.backend.subscribeBlocks((buffer) => {
      worker.postMessage({ kind: 'block', buffer }, [buffer]);
    });

    this.destroyRef.onDestroy(() => {
      void unsubscribe.then((stop) => stop());
      worker.terminate();
      this.worker = null;
    });
  }
}

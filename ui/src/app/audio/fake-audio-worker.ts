import { AudioBridge } from './bridge';
import { BlockMessage, FrameMessage } from './audio.worker';
import { AudioWorkerLike } from './audio-service';

/**
 * The worker's fifteen lines, run in place.
 *
 * A test drives the real {@link AudioBridge} — the same class the worker wraps —
 * synchronously, so a bloque pushed through `FakeBackendGateway` reaches the
 * screen inside the test instead of on some later tick. Nothing about the analysis
 * is faked here; only the thread is.
 */
export class FakeAudioWorker implements AudioWorkerLike {
  private readonly bridge = new AudioBridge();
  private readonly listeners = new Set<(event: MessageEvent<FrameMessage>) => void>();

  /** How many bloques have gone through. `terminate` does not reset it. */
  received = 0;

  postMessage(message: BlockMessage): void {
    const frame = this.bridge.receive(message.buffer, performance.now());
    this.received += 1;

    // Every trama carries the stats here, where nobody is counting frames: a test
    // asserts on what the readout shows, not on how often it is refreshed.
    const reply: FrameMessage = {
      kind: 'frame',
      trace: frame.trace,
      frequencyHz: frame.frequencyHz,
      stats: this.bridge.stats(),
    };
    for (const listener of this.listeners) {
      listener({ data: reply } as MessageEvent<FrameMessage>);
    }
  }

  addEventListener(_type: 'message', listener: (event: MessageEvent<FrameMessage>) => void): void {
    this.listeners.add(listener);
  }

  terminate(): void {
    this.listeners.clear();
  }
}

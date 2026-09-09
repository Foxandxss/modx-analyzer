import { AudioBridge, stamp } from './bridge';
import { FrameMessage, MedidaMessage, NoteMessage, WorkerMessage } from './audio.worker';
import { AudioWorkerLike, WorkerReply } from './audio-service';

/**
 * The worker's twenty lines, run in place.
 *
 * A test drives the real {@link AudioBridge} — the same class the worker wraps —
 * synchronously, so a bloque pushed through `FakeBackendGateway` reaches the
 * screen inside the test instead of on some later tick. Nothing about the analysis
 * is faked here; only the thread is.
 */
export class FakeAudioWorker implements AudioWorkerLike {
  private readonly bridge = new AudioBridge();
  private readonly listeners = new Set<(event: MessageEvent<WorkerReply>) => void>();

  /** How many bloques have gone through. `terminate` does not reset it. */
  received = 0;

  /** The notes the service has sent, in order. The axis hangs off the last one. */
  readonly notes: (number | null)[] = [];

  /** How many medidas have been asked for. A press that measured nothing counts. */
  measured = 0;

  postMessage(message: WorkerMessage): void {
    if (message.kind === 'measure') {
      const frame = this.bridge.measure(message.buffer);
      this.measured += 1;
      this.send({ kind: 'medida', medida: frame.medida, costMs: frame.costMs });
      return;
    }
    if (message.kind === 'note') {
      this.notes.push((message as NoteMessage).hz);
      this.bridge.setNote(message.hz, message.held);
      return;
    }

    // The bloque is handed over the instant it is posted, because there is no
    // thread between the two here. That is the honest `postedAt` for this
    // worker: nothing waited in a queue that does not exist.
    const frame = this.bridge.receive(message.buffer, stamp(), message.postedAt);
    this.received += 1;

    // Every trama carries the stats here, where nobody is counting frames: a test
    // asserts on what the readout shows, not on how often it is refreshed.
    const reply: FrameMessage = {
      kind: 'frame',
      trace: frame.trace,
      scope: frame.scope,
      drawnHz: frame.drawnHz,
      trama: frame.trama,
      tramaMs: frame.tramaMs,
      atMs: frame.atMs,
      stats: this.bridge.stats(),
    };
    this.send(reply);
  }

  private send(reply: FrameMessage | MedidaMessage): void {
    for (const listener of this.listeners) {
      listener({ data: reply } as MessageEvent<WorkerReply>);
    }
  }

  addEventListener(_type: 'message', listener: (event: MessageEvent<WorkerReply>) => void): void {
    this.listeners.add(listener);
  }

  terminate(): void {
    this.listeners.clear();
  }
}

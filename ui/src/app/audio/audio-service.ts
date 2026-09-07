import {
  DestroyRef,
  Injectable,
  InjectionToken,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { LiveTrama, MEASURE_WINDOW, Medida, NO_TRAMA, WATERFALL_FRAMES } from 'modx-dsp';
import { BACKEND_GATEWAY } from '../backend/backend-gateway';
import { equalTemperamentHz } from '../provenance/theory';
import { BridgeStats } from './bridge';
import { FrameMessage, MedidaMessage, WorkerMessage } from './audio.worker';

/**
 * The front's owner of the audio bridge.
 *
 * It subscribes to the bloques, hands each one to the worker **by transfer** and
 * turns what comes back into two very different things:
 *
 * - **{@link live}, a plain mutable holder** the canvases read inside their own
 *   `requestAnimationFrame` loop. It is not a signal on purpose: a signal set
 *   33 times a second is 33 change detections a second in a zoneless app, and
 *   the trama budget is 33 ms whole. Nothing in Angular is told a bloque
 *   arrived.
 * - **signals for the readouts**, which are set only when the number a human
 *   reads has actually changed — the frequency to a tenth, the floor to a whole
 *   decibel. A figure that flickers between two values is a figure nobody can
 *   read.
 *
 * It never looks inside a buffer: the samples are given away the moment they
 * arrive, which is the point — the thread that draws must not be the thread that
 * analyses (ADR-0001).
 */

/** What the service needs of a worker. Narrow on purpose, so a test can stand in. */
export interface AudioWorkerLike {
  postMessage(message: WorkerMessage, transfer: Transferable[]): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<WorkerReply>) => void): void;
  terminate(): void;
}

/** What the worker sends back: a trama 33 times a second, a medida on request. */
export type WorkerReply = FrameMessage | MedidaMessage;

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
  tramaP50Ms: null,
  tramaP99Ms: null,
  tramaMaxMs: null,
  silent: false,
};

/**
 * The newest trama, held for whoever is painting.
 *
 * `version` goes up once per trama so a canvas can tell «nothing new» from «the
 * same shape twice» without comparing arrays.
 */
export interface LiveView {
  /** Channel 0, triggered and two cycles long, or `null` with nothing to draw. */
  trace: Float32Array | null;
  trama: LiveTrama;
  /** The last 14 curves, oldest first: 462 ms of the attack fading. */
  waterfall: Float32Array[];
  version: number;
}

/**
 * A medida, and when it was taken.
 *
 * The stamp is `performance.now()` on this side, which is the clock the age
 * counter reads — no epochs are crossed here, because the analysis ran in this
 * page's own worker. What is *not* here is any way for the numbers inside to
 * change: a medida is replaced whole by the next press of MEDIR and never
 * updated in place.
 */
export interface MedidaView {
  readonly medida: Medida;
  readonly takenAt: number;
}

/** How often the readout signals are allowed to move: four times a second. */
const READOUT_EVERY = 8;

@Injectable({ providedIn: 'root' })
export class AudioService {
  private readonly backend = inject(BACKEND_GATEWAY);
  private readonly makeWorker = inject(AUDIO_WORKER);
  private readonly destroyRef = inject(DestroyRef);

  /** The newest trama. Mutated 33 times a second and never watched by Angular. */
  readonly live: LiveView = { trace: null, trama: NO_TRAMA, waterfall: [], version: 0 };

  /** The frequency the trace was triggered at, or `null` with no note. Tenths. */
  readonly frequencyHz = signal<number | null>(null);

  /** The noise floor of the vista viva relative to its peak, whole decibels. */
  readonly floorDb = signal<number | null>(null);

  /** The comb line the chip names, or `null` when the comb is not in this sound. */
  readonly artefactHz = signal<number | null>(null);

  /** Tramas a second, measured. What `MIRAR · N fps` says, and never a constant. */
  readonly fps = signal<number | null>(null);

  /** Whether the vista viva has anything to draw: a note, and a curve for it. */
  readonly drawing = signal(false);

  /** What the bridge has lost and how late it has been. Refreshed once a second. */
  readonly stats = signal<BridgeStats>(NO_STATS);

  /**
   * No entra audio: exact digital zeros for a second, decided in Rust. The card
   * that says so out loud is #15; this is the fact it will hang off.
   */
  readonly noAudio = computed(() => this.stats().silent);

  /**
   * The last medida, or `null` when there is none. **Nothing sets this but a
   * press of MEDIR**, which is the whole difference between measuring and
   * looking: the vista viva's signals move four times a second and this one moves
   * when somebody decides it does.
   */
  readonly medida = signal<MedidaView | null>(null);

  /** True between the press and the table. The shutter is not instantaneous. */
  readonly measuring = signal(false);

  /**
   * What the last medida cost in the worker, in ms. It has no budget — nobody is
   * drawing while it runs — but it is what #14 will weigh the anillo's polling
   * against, so it is measured rather than guessed.
   */
  readonly measureMs = signal<number | null>(null);

  /**
   * Why there is no medida, in Spanish, or `null` when there is one. It is the
   * difference between «nunca se ha medido» and «se midió sobre un silencio»,
   * and the column says which.
   */
  readonly measureNote = signal<string | null>(null);

  private worker: AudioWorkerLike | null = null;

  /** The press waiting for its table, so a second press cannot queue behind it. */
  private pending: ((view: MedidaView | null) => void) | null = null;

  /** Tramas since the last time the readouts were allowed to move. */
  private sinceReadout = 0;
  private readoutAt: number | null = null;

  constructor() {
    // The note the espectro's axis is drawn against. It crosses to the worker
    // when it changes and not with every bloque: somebody playing is hundreds of
    // times slower than the audio.
    effect(() => {
      const pitch = this.backend.lowestLivePitch();
      this.postNote(pitch === null ? null : equalTemperamentHz(pitch));
    });
  }

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
    worker.addEventListener('message', ({ data }) =>
      data.kind === 'medida' ? this.onMedida(data) : this.onFrame(data),
    );

    const pitch = this.backend.lowestLivePitch();
    this.postNote(pitch === null ? null : equalTemperamentHz(pitch));

    const unsubscribe = this.backend.subscribeBlocks((buffer) => {
      worker.postMessage({ kind: 'block', buffer }, [buffer]);
    });

    this.destroyRef.onDestroy(() => {
      void unsubscribe.then((stop) => stop());
      worker.terminate();
      this.worker = null;
    });
  }

  /**
   * MEDIR: take 65 536 samples out of the ring and analyse them once.
   *
   * The order matters and is the design's: the samples are **already recorded**
   * when the button is pressed, so nothing is waited for and nobody is asked to
   * hold the note any longer than they were holding it. What can be missing is
   * the sound itself — the ring not filled at launch, or a shutter that opened
   * between two notes — and those are two different sentences on screen, not one
   * failure.
   *
   * The previous medida is left alone until the new one lands: a table that
   * blanked on every press and came back a moment later would be the flicker the
   * design forbids. It is replaced whole, or it stays.
   */
  async measure(): Promise<MedidaView | null> {
    if (this.worker === null || this.measuring()) {
      return null;
    }
    this.measuring.set(true);

    const buffer = await this.backend.measureWindow(MEASURE_WINDOW);
    if (buffer === null) {
      this.measuring.set(false);
      // The ring could not serve the window: at launch it holds less than 1.5 s
      // of sound, and with the device shut it holds none.
      this.measureNote.set('no hay 1,5 s de audio todavía');
      return null;
    }

    const table = new Promise<MedidaView | null>((resolve) => {
      this.pending = resolve;
    });
    this.worker.postMessage({ kind: 'measure', buffer }, [buffer]);
    return table;
  }

  private onMedida(message: MedidaMessage): void {
    this.measuring.set(false);
    this.measureMs.set(message.costMs);

    const view =
      message.medida === null ? null : { medida: message.medida, takenAt: performance.now() };
    if (view !== null) {
      this.medida.set(view);
      this.measureNote.set(null);
    } else {
      // Measured, and there was nothing there. Said out loud, because it is not
      // the same as never having pressed the button.
      this.measureNote.set('el obturador se abrió sobre un silencio');
    }

    const waiting = this.pending;
    this.pending = null;
    waiting?.(view);
  }

  private onFrame(frame: FrameMessage): void {
    // The rate is counted from the first bloque, so the first readout already
    // has an interval to divide by instead of a dash for a second.
    this.readoutAt ??= performance.now();

    this.live.trace = frame.trace;
    this.live.trama = frame.trama;
    this.live.version += 1;

    // A trama with no curve adds no ridgeline: the note is over, and what is
    // already drawn is the tail of it fading. Nothing is pushed to keep the
    // waterfall from filling with the floor.
    if (frame.trama.curve !== null) {
      this.live.waterfall.push(frame.trama.curve);
      if (this.live.waterfall.length > WATERFALL_FRAMES) {
        this.live.waterfall.shift();
      }
    }

    if (frame.stats !== undefined) {
      this.stats.set(frame.stats);
    }

    // The readouts move at 4 Hz, except when the vista viva starts or stops
    // drawing: that is not a number moving, it is a panel changing state, and
    // making somebody wait a quarter of a second for it would be a stutter.
    this.sinceReadout += 1;
    const drawing = frame.trama.curve !== null;
    if (this.sinceReadout >= READOUT_EVERY || drawing !== this.drawing()) {
      this.refreshReadouts(frame);
    }
  }

  /** The four numbers a human reads, moved at 4 Hz and rounded so they hold still. */
  private refreshReadouts(frame: FrameMessage): void {
    const now = performance.now();
    if (this.readoutAt !== null) {
      const seconds = (now - this.readoutAt) / 1000;
      this.fps.set(seconds > 0 ? Math.round((this.sinceReadout / seconds) * 10) / 10 : null);
    }
    this.readoutAt = now;
    this.sinceReadout = 0;

    const hertz = frame.frequencyHz;
    this.frequencyHz.set(hertz === null ? null : Math.round(hertz * 10) / 10);
    this.floorDb.set(frame.trama.curve === null ? null : Math.round(frame.trama.floorDb));
    this.artefactHz.set(frame.trama.artefactHz);
    this.drawing.set(frame.trama.curve !== null);
  }

  private postNote(hz: number | null): void {
    this.worker?.postMessage({ kind: 'note', hz }, []);
  }
}

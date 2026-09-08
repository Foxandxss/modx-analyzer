import {
  DestroyRef,
  Injectable,
  InjectionToken,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { LiveTrama, MEASURE_WINDOW, Medida, NO_TRAMA, WATERFALL_FRAMES } from 'modx-dsp';
import { BACKEND_GATEWAY } from '../backend/backend-gateway';
import { Clock } from '../provenance/clock';
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
  /**
   * Ridgelines pushed since launch. `waterfall[i]` is row `rows - length + i`,
   * which is what lets a cut keep its place while the window scrolls past it.
   */
  rows: number;
  /**
   * Where the sound changed underneath, as row numbers. The waterfall draws a
   * dashed line above each of them: the vista viva never dies, but it does stop
   * being the same sound, and that is a fact about the picture.
   */
  cuts: number[];
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

/**
 * No bloque for this long and the device is gone, not slow.
 *
 * Bloques arrive every 30 ms, so this is thirty-three of them missed. The margin
 * is deliberate: the launch burst of #23 has delivered a bloque **379 ms** late
 * with nothing lost, and a threshold that called that a disconnection would put a
 * card over a working device once per launch.
 */
const DEVICE_GONE_MS = 1_000;

/**
 * How long the chip keeps naming a comb line that this window did not see.
 *
 * One second: long enough to cover the windows where a line drops under the
 * detector, short enough that changing note moves the chip while you are still
 * looking at it.
 */
const ARTEFACT_HOLD_MS = 1_000;

/**
 * How far the note has to move before the comb is treated as a new one.
 *
 * Three per cent is about half a semitone: wider than the wobble of a held note
 * as the scope re-triggers, narrower than any key you could press next.
 */
const NOTE_MOVED = 0.03;

/** Whether the note under the comb is a different note, not the same one wobbling. */
function noteMoved(before: number | null, now: number | null): boolean {
  if (before === null || now === null) {
    return before !== now;
  }
  return Math.abs(now - before) / before > NOTE_MOVED;
}

/**
 * What the audio is doing. Four states, because «no entra audio» turned out to be
 * three different facts wearing one name (#21, #22).
 *
 * - `alive` — bloques arriving with something in them.
 * - `idle` — bloques arriving and every sample is an exact zero, with nobody
 *   playing. **This is the MODX8 not sounding**, measured on 2026-09-08: the
 *   keyboard delivers exact digital zeros when its engine is idle, so zeros on
 *   their own say nothing about the cable. No card: it would fire every time the
 *   owner stopped playing, which while learning is constantly.
 * - `noRoute` — exact zeros **while the keyboard is holding a note**. That
 *   combination is unambiguous: something should be sounding and nothing is
 *   arriving, so the route is wrong (`Part Output = USB1&2`).
 * - `gone` — no bloque at all for {@link DEVICE_GONE_MS}. The device has been
 *   taken away, which on this hardware happens every time the USB cable is
 *   pulled, because `MODX-1` and `Line (MODX)` come down the same cable.
 */
export type AudioState = 'alive' | 'idle' | 'noRoute' | 'gone';

@Injectable({ providedIn: 'root' })
export class AudioService {
  private readonly backend = inject(BACKEND_GATEWAY);
  private readonly clock = inject(Clock);
  private readonly makeWorker = inject(AUDIO_WORKER);
  private readonly destroyRef = inject(DestroyRef);

  /** The newest trama. Mutated 33 times a second and never watched by Angular. */
  readonly live: LiveView = {
    trace: null,
    trama: NO_TRAMA,
    waterfall: [],
    rows: 0,
    cuts: [],
    version: 0,
  };

  /** The frequency the trace was triggered at, or `null` with no note. Tenths. */
  readonly frequencyHz = signal<number | null>(null);

  /** The noise floor of the vista viva relative to its peak, whole decibels. */
  readonly floorDb = signal<number | null>(null);

  /** The comb line the chip names, or `null` when the comb is not in this sound. */
  readonly artefactHz = signal<number | null>(null);

  /** What the readout tick measured. {@link fps} is this, once it is believable. */
  private readonly measuredFps = signal<number | null>(null);

  /**
   * Tramas a second, measured — and `null` the moment the device goes.
   *
   * It has to be `null` and not the last number, because a frozen cadence is the
   * app's worst lie: `MIRAR · 33.4 fps` over a stream that ended is a figure that
   * looks measured and is a memory. Everything downstream reads correctly off
   * this one change — `MIRAR` goes to the dash, `MEDIR` refuses (there is nothing
   * to measure), and the live panels drop their `VIVO`.
   */
  readonly fps = computed(() => (this.audioState() === 'gone' ? null : this.measuredFps()));

  /** When the last bloque arrived, on this side's clock. `null` before the first. */
  private readonly lastBlockAt = signal<number | null>(null);

  /** The comb line on the chip, when it was last actually seen, and under which note. */
  private artefactHeldHz: number | null = null;
  private artefactHeldAt = 0;
  private artefactNoteHz: number | null = null;

  /** Since when the keyboard has been holding something, or `null` if it is not. */
  private readonly notesLiveSince = signal<number | null>(null);

  /**
   * What the audio is doing: see {@link AudioState}.
   *
   * It is computed **here and once**, from the three facts that live in three
   * different places — the silence flag decided in Rust, the arrival of bloques
   * known only to this side, and the notes the keyboard reports. Before #21 and
   * #22 the first of those was asked to answer for all three, and it fired when
   * the MODX was merely idle while staying silent when the device was gone.
   *
   * The age of the last bloque is computed here for the same reason
   * `ÚLTIMO SONDEO` is: with the device gone **nothing is emitted**, so an age
   * sent from the other side would freeze at the instant it left.
   */
  readonly audioState = computed<AudioState>(() => {
    const arrived = this.lastBlockAt();
    // **Nothing has arrived yet is not «gone».** `gone` means it was delivering
    // and stopped, which is the fact #22 is about; before the first bloque the
    // app has not looked, and the same rule that keeps card 1 off the screen
    // during the frames before the first `modx://connection` keeps this quiet.
    // A device that never opened at all is the header's `Line (MODX)` showing
    // the dash, and that is already said elsewhere.
    if (arrived === null) {
      return 'idle';
    }
    if (this.clock.now() - arrived > DEVICE_GONE_MS) {
      return 'gone';
    }
    if (!this.stats().silent) {
      return 'alive';
    }
    // Zeros, and the keyboard is holding something — but only once it has been
    // holding it for longer than the silence run itself. Without that dwell,
    // striking a key would flash the card for the few milliseconds between the
    // Note On and the first sample of the sound arriving.
    const since = this.notesLiveSince();
    const playing = since !== null && this.clock.now() - since >= DEVICE_GONE_MS;
    return playing ? 'noRoute' : 'idle';
  });

  /** Whether the vista viva has anything to draw: a note, and a curve for it. */
  readonly drawing = signal(false);

  /** What the bridge has lost and how late it has been. Refreshed once a second. */
  readonly stats = signal<BridgeStats>(NO_STATS);

  /**
   * Exact digital zeros for a second, decided in Rust. It is a fact about the
   * samples and nothing more.
   *
   * **It is not «no entra audio»** and it stopped being drawn as such in #21: the
   * MODX8 sends exact zeros whenever its engine is idle, so on its own this is
   * true every time nobody is playing. What it means is {@link audioState}.
   */
  readonly exactZeros = computed(() => this.stats().silent);

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

  /** Ancla changes already acted on, so the effect below fires once per change. */
  private anchorChanges = 0;

  constructor() {
    // The note the espectro's axis is drawn against. It crosses to the worker
    // when it changes and not with every bloque: somebody playing is hundreds of
    // times slower than the audio.
    effect(() => {
      const pitch = this.backend.lowestLivePitch();
      this.postNote(pitch === null ? null : equalTemperamentHz(pitch));
    });

    // Since when the keyboard has been holding something. It is a **since** and
    // not a boolean because the card that reads it needs the note to have been
    // down for longer than the silence run: otherwise striking a key flashes it
    // for the milliseconds between the Note On and the first sample arriving.
    effect(() => {
      const live = this.backend.liveNotes() > 0;
      untracked(() => {
        if (!live) {
          this.notesLiveSince.set(null);
        } else if (this.notesLiveSince() === null) {
          this.notesLiveSince.set(this.clock.now());
        }
      });
    });

    // The medida dies with the patch it was taken on, and it is **not**
    // recovered: nobody is going to press MEDIR on the owner's behalf, and a
    // table that came back on its own would be a measurement that happened
    // rather than one somebody did. The vista viva goes on untouched — it is
    // audio entering now and it belongs to no patch at all.
    effect(() => {
      const changes = this.backend.patch().changes;
      const changed = changes > this.anchorChanges;
      this.anchorChanges = changes;
      // Zero is the launch — the ancla read a name for the first time — and
      // there is nothing of a previous sound to throw away.
      if (changed && changes > 0) {
        this.onPatchChanged();
      }
    });
  }

  /**
   * The sound was changed underneath: the medida dies and the waterfall keeps
   * the cut.
   *
   * The medida is **not** recovered, here or later. Nobody is going to press
   * MEDIR on the owner's behalf, and a table that came back on its own would be
   * a measurement that happened rather than one somebody did. What stays is the
   * cut: above the line and below it are two different sounds, and the
   * ridgelines below are still worth looking at.
   */
  private onPatchChanged(): void {
    this.medida.set(null);
    this.measureMs.set(null);
    this.measureNote.set('la medida era de otro sonido');
    this.live.cuts.push(this.live.rows);
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
    // Every bloque, not every readout: what says the device is still there is
    // that something arrived, and the readout only moves four times a second.
    this.lastBlockAt.set(this.clock.now());

    this.live.trace = frame.trace;
    this.live.trama = frame.trama;
    this.live.version += 1;

    // A trama with no curve adds no ridgeline: the note is over, and what is
    // already drawn is the tail of it fading. Nothing is pushed to keep the
    // waterfall from filling with the floor.
    if (frame.trama.curve !== null) {
      this.live.waterfall.push(frame.trama.curve);
      this.live.rows += 1;
      if (this.live.waterfall.length > WATERFALL_FRAMES) {
        this.live.waterfall.shift();
      }
      // A cut that has scrolled off the top of the window is gone with the
      // ridgelines it separated: keeping it would draw a line between two
      // sounds that are both no longer on screen.
      const oldest = this.live.rows - this.live.waterfall.length;
      while (this.live.cuts.length > 0 && this.live.cuts[0] < oldest) {
        this.live.cuts.shift();
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
      this.measuredFps.set(
        seconds > 0 ? Math.round((this.sinceReadout / seconds) * 10) / 10 : null,
      );
    }
    this.readoutAt = now;
    this.sinceReadout = 0;

    const hertz = frame.frequencyHz;
    this.frequencyHz.set(hertz === null ? null : Math.round(hertz * 10) / 10);
    this.floorDb.set(frame.trama.curve === null ? null : Math.round(frame.trama.floorDb));
    this.holdArtefact(frame.trama.artefactHz, frame.frequencyHz, now);
    this.drawing.set(frame.trama.curve !== null);
  }

  /**
   * The comb line the chip names, held so it stops flickering.
   *
   * `artefactChipHz` already answers with the **lowest** comb line of its
   * window, snapped to `ARTEFACT_HZ`. What moves is which lines clear the
   * detector inside one 4 096-sample window: measured on the MODX8 on
   * 2026-09-08, a C4 sits on 2 756 Hz and a C5 on 5 513 Hz and neither moves,
   * but a **G4 alternates between the two** because the 2 756 line drops under
   * the threshold on some windows. The chip then repainted twice a second and
   * a number that does that reads as broken, however right each frame was (#19).
   *
   * So the rule is over time and not over one window: the lowest line seen in
   * the last {@link ARTEFACT_HOLD_MS}. A lower line is taken at once — it is
   * the comb's own fundamental and the more telling of the two — and a higher
   * one only once the held line has been gone for the whole hold, which is what
   * lets the chip follow a real change of note instead of sticking on 2 756 Hz
   * for the rest of the session.
   */
  private holdArtefact(hz: number | null, noteHz: number | null, now: number): void {
    // Una nota nueva es un comb nuevo. El sostenimiento existe para que la línea
    // no baile dentro de UNA nota, no para arrastrarla hasta la siguiente: sin
    // esto, pasar de un C4 a un C5 tardaba el sostenimiento entero en mover el
    // chip, que es el segundo largo que se nota con el teclado delante.
    if (noteMoved(this.artefactNoteHz, noteHz)) {
      this.artefactHeldHz = null;
      this.artefactHeldAt = 0;
    }
    this.artefactNoteHz = noteHz;

    if (hz === null) {
      if (now - this.artefactHeldAt > ARTEFACT_HOLD_MS) {
        this.artefactHeldHz = null;
        this.artefactHz.set(null);
      }
      return;
    }
    const held = this.artefactHeldHz;
    if (held === null || hz < held || now - this.artefactHeldAt > ARTEFACT_HOLD_MS) {
      this.artefactHeldHz = hz;
      this.artefactHeldAt = now;
    } else if (hz === held) {
      this.artefactHeldAt = now;
    }
    this.artefactHz.set(this.artefactHeldHz);
  }

  private postNote(hz: number | null): void {
    this.worker?.postMessage({ kind: 'note', hz }, []);
  }
}

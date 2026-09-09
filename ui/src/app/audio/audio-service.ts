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
import {
  LiveTrama,
  MEASURE_WINDOW,
  MEASURE_WINDOW_MS,
  Medida,
  NO_TRAMA,
  ScopeLock,
  WATERFALL_FRAMES,
} from 'modx-dsp';
import { AnchorBeat, BACKEND_GATEWAY } from '../backend/backend-gateway';
import { CaptureWindow, aval } from '../provenance/aval';
import { Clock } from '../provenance/clock';
import { equalTemperamentHz } from '../provenance/theory';
import { BridgeStats, stamp } from './bridge';
import { LoopLag } from './loop-lag';
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
 *   reads has actually changed — the floor to a whole decibel, the enganche when
 *   it becomes another enganche. A figure that flickers between two values is a
 *   figure nobody can read.
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

/**
 * The newest trama, held for whoever is painting.
 *
 * `version` goes up once per trama so a canvas can tell «nothing new» from «the
 * same shape twice» without comparing arrays.
 */
export interface LiveView {
  /** Channel 0, cut to what {@link scope} allows, or `null` with nothing to cut. */
  trace: Float32Array | null;
  /**
   * What the scope may claim about that trace. The canvas reads it to choose its
   * register: a locked trace is drawn in the signal's colour with its period
   * boundaries, an unlocked one in the predicted register, and a signal under the
   * floor is a band and no trace at all.
   */
  scope: ScopeLock;
  trama: LiveTrama;
  /** The last 14 curves, oldest first, newest last. */
  waterfall: Float32Array[];
  /**
   * When each of those curves was sounding, in ms on the capture's clock, in
   * step with {@link waterfall}.
   *
   * There is one per row and not one hop times a count, because rows are pushed
   * only when there is a curve: a phrase with a breath in it keeps fourteen rows
   * that span far more than fourteen hops, and a caption computed from the count
   * would say 420 ms over a picture that covers two seconds.
   */
  stamps: number[];
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

/**
 * What the waterfall's caption states: the rows drawn and the time they cover.
 *
 * Both are read off the picture and neither is a constant. `frames` is how many
 * ridgelines are on screen, which is fewer than fourteen early in a session and
 * after every silence; `spanMs` is the last row's stamp minus the first's, which
 * is what makes a breath in the phrase visible in the caption instead of being
 * quietly counted as 30 ms of sound.
 */
export interface WaterfallView {
  readonly frames: number;
  readonly spanMs: number;
}

/** Nothing has been drawn, so there is no span to state. */
export const NO_WATERFALL: WaterfallView = { frames: 0, spanMs: 0 };

/**
 * The caption's two figures, from the stamps of the rows that are on screen.
 *
 * One row spans nothing: it is a single instant, and `0 → 0 ms` is the true
 * reading of it. The span is never `frames × hop` — that is the arithmetic this
 * whole field exists to replace.
 */
export function waterfallView(stamps: readonly number[]): WaterfallView {
  if (stamps.length === 0) {
    return NO_WATERFALL;
  }
  return { frames: stamps.length, spanMs: stamps[stamps.length - 1] - stamps[0] };
}

/**
 * The scope before the first bloque: nothing is held, so there is no lock.
 *
 * It is a refusal and not a `belowFloor`, because no window has been looked at
 * yet — saying the signal is under the floor would be a claim about audio that
 * has not arrived.
 */
export const NO_LOCK: ScopeLock = {
  kind: 'noLock',
  reason: 'noHeldNote',
  trigger: 0,
  length: 0,
  windowMs: 0,
};

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
 * The enganche as one word, so two readings can be told apart without comparing
 * a frequency that moves a hundredth of a hertz between tramas.
 */
function lockState(lock: ScopeLock): string {
  return lock.kind === 'noLock' ? lock.reason : lock.kind;
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
    scope: NO_LOCK,
    trama: NO_TRAMA,
    waterfall: [],
    stamps: [],
    rows: 0,
    cuts: [],
    version: 0,
  };

  /**
   * The scope's enganche: the note it is locked to, or why it is not locked.
   *
   * It is the caption's only source, and the caption is the scope's
   * specification — `LOCKED 349.23 Hz · 4 CYCLES · 11.5 ms` says what the trace
   * is, and `NO LOCK · pitch unstable` says there is no claim to read off it.
   */
  readonly scope = signal<ScopeLock>(NO_LOCK);

  /**
   * What the waterfall is showing: how many ridgelines are drawn and how much
   * time they cover.
   *
   * It is the caption's only source. Both figures come from the rows themselves
   * — the length of {@link LiveView.waterfall} and the difference between its
   * first and last stamp — so the caption can never describe a picture that is
   * not on screen. That is the whole of this signal's job, and it is why the
   * template holds no frame count and no millisecond figure of its own.
   */
  readonly waterfall = signal<WaterfallView>(NO_WATERFALL);

  /** The noise floor of the vista viva in absolute dBFS, whole decibels. */
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
   *
   * A press is necessary and not sufficient: a table only lands here once the
   * ancla has vouched for the window it was taken from, so what is drawn as
   * `MEASURED` is never a figure of a sound that was not playing.
   */
  readonly medida = signal<MedidaView | null>(null);

  /**
   * True between the press and the **aval**, not between the press and the table.
   *
   * The shutter is not instantaneous and it does not close when the worker
   * answers: a table nobody can name is not a capture yet, so the busy state
   * covers the ancla's beat too. Typically 40 to 250 ms of it, never more than
   * one beat.
   */
  readonly measuring = signal(false);

  /**
   * Whether the shutter is armed, and **the only copy of that decision**.
   *
   * It is live the moment there is sound to measure. Before the first bloque the
   * ring holds nothing at all, so the button stays dead rather than promising a
   * medida the app cannot take. Both places the shutter is drawn read this, so
   * neither can be a lie about the other.
   *
   * With the polling switch thrown it is dead too, and that is the aval and not
   * the audio: #14's instrument exists so that the app stops noticing a
   * Performance change, so with it on **no capture could ever be vouched for**.
   * A shutter that opened there would produce a table nothing could ever draw.
   */
  readonly canMeasure = computed(
    () => this.fps() !== null && !this.measuring() && !this.backend.polling().paused,
  );

  /**
   * What the last medida cost in the worker, in ms. It has no budget — nobody is
   * drawing while it runs — but it is what #14 will weigh the anillo's polling
   * against, so it is measured rather than guessed.
   */
  readonly measureMs = signal<number | null>(null);

  /**
   * Why the shutter came back empty, in the column's own words, or `null`.
   *
   * Two causes and no more: `not 1.5 s of audio yet` and `the shutter opened on
   * silence`. The third — the sound was changed underneath — is **not** a note,
   * because the column's resting state already says it by being at rest and the
   * header says it in words (`NOT MEASURED IN THIS SOUND`). A sentence under a
   * cell that is already drawn empty is the wordiness #33 removed.
   */
  readonly measureNote = signal<string | null>(null);

  private worker: AudioWorkerLike | null = null;

  /**
   * The main thread watching itself, so #23's one remaining ambiguity can be
   * settled: whether the crossing is slow or the thread it crosses onto is busy.
   */
  private readonly lag = new LoopLag();

  /**
   * The worst the main thread has been late to its own timer, in ms. It is not
   * about the audio at all, which is exactly why it can answer for it.
   */
  readonly mainThreadLagMs = signal(0);

  /**
   * How far into the capture the main thread's worst stall was, in seconds, on
   * the same clock as every other `A LOS`. Zero until a bloque has placed the
   * capture's zero on the page's clock.
   */
  readonly mainThreadLagAtSeconds = signal(0);

  /** The press waiting for its table, so a second press cannot queue behind it. */
  private pending: ((view: MedidaView | null) => void) | null = null;

  /**
   * The span the shutter took, stamped at the press and carried to the aval.
   *
   * Two of them, because a capture crosses two waits: the ring's answer, and then
   * the ancla's. {@link takingWindow} is the press that has not got its table yet;
   * {@link waiting} is the table that has not been vouched for.
   */
  private takingWindow: CaptureWindow | null = null;
  private waiting: { readonly view: MedidaView; readonly window: CaptureWindow } | null = null;

  /** Tramas since the last time the readouts were allowed to move. */
  private sinceReadout = 0;
  private readoutAt: number | null = null;

  /** Ancla changes already acted on, so the effect below fires once per change. */
  private anchorChanges = 0;

  constructor() {
    // The note the espectro's axis is drawn against and the scope locks to, with
    // how many pitches are down beside it. It crosses to the worker when it
    // changes and not with every bloque: somebody playing is hundreds of times
    // slower than the audio.
    effect(() => {
      this.postNote(this.backend.lowestLivePitch(), this.backend.liveNotes());
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

    // The ancla speaking: every beat is a chance for the capture that is waiting
    // to be drawn or thrown away. The polling switch is read here too, because
    // throwing it means no beat is ever coming and a capture that waited for one
    // would leave the shutter busy for the rest of the session.
    effect(() => {
      const beats = this.backend.anchorBeats();
      const looking = !this.backend.polling().paused;
      untracked(() => this.settleCapture(beats, looking));
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
    // No note: the column going back to labels, units and dashes *is* the
    // statement, and the ancla is already saying `NOT MEASURED IN THIS SOUND`
    // in the header. Writing it a third time under a cell that is drawn empty
    // is labelling the blank.
    this.measureNote.set(null);
    // A capture still waiting for its aval is of the sound that has just gone,
    // so it never reaches the screen. The beat that carried this change would
    // discard it a moment later anyway; doing it here means the two facts —
    // «the name moved» and «this table is of the old name» — are one decision.
    this.discardCapture();
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
    this.lag.start();
    worker.addEventListener('message', ({ data }) =>
      data.kind === 'medida' ? this.onMedida(data) : this.onFrame(data),
    );

    this.postNote(this.backend.lowestLivePitch(), this.backend.liveNotes());

    const unsubscribe = this.backend.subscribeBlocks((buffer) => {
      // Stamped here and not in the worker: this is the last moment on the main
      // thread, so everything after it is the worker's queue and everything
      // before it is the crossing. #23 could not tell those apart.
      worker.postMessage({ kind: 'block', buffer, postedAt: stamp() }, [buffer]);
    });

    this.destroyRef.onDestroy(() => {
      void unsubscribe.then((stop) => stop());
      worker.terminate();
      this.lag.stop();
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
   *
   * And it lands **only once the ancla has vouched for it**. The promise resolves
   * with what was drawn, which is `null` for a capture the aval threw away — the
   * shutter stays busy until then and nothing on screen moves.
   */
  async measure(): Promise<MedidaView | null> {
    if (this.worker === null || this.measuring()) {
      return null;
    }
    this.measuring.set(true);

    // Stamped **before** anything is awaited. The ring hands back what is already
    // recorded, so the span the window covers ends at the press; a stamp taken
    // after the round trip would claim samples that entered during it.
    const to = performance.now();
    this.takingWindow = { from: to - MEASURE_WINDOW_MS, to };
    // Ask the ancla to look sooner than its second. It is the same out-of-turn
    // request the anillo ancho makes and it is what keeps the hold at 40 to 250 ms
    // instead of a whole beat; the ancla owns its cadence and may say no.
    void this.backend.requestAnchorBeat();

    const buffer = await this.backend.measureWindow(MEASURE_WINDOW);
    if (this.takingWindow === null) {
      // The sound was changed underneath while the ring was answering. The
      // window is of a patch that is gone, so it is not even handed over: there
      // is no outcome it could have that anything would draw.
      return null;
    }
    if (buffer === null) {
      this.measuring.set(false);
      this.takingWindow = null;
      // The ring could not serve the window: at launch it holds less than 1.5 s
      // of sound, and with the device shut it holds none.
      this.measureNote.set('not 1.5 s of audio yet');
      return null;
    }

    const table = new Promise<MedidaView | null>((resolve) => {
      this.pending = resolve;
    });
    this.worker.postMessage({ kind: 'measure', buffer }, [buffer]);
    return table;
  }

  private onMedida(message: MedidaMessage): void {
    // Recorded even for a table nobody will draw: what the worker cost is a fact
    // about this machine and #14 weighs the anillo's polling against it.
    this.measureMs.set(message.costMs);
    const window = this.takingWindow;
    this.takingWindow = null;
    if (window === null) {
      // The sound was changed underneath while the worker was still counting.
      // The press has already been answered and this table is of a patch that is
      // gone, so it never becomes anything.
      return;
    }

    if (message.medida === null) {
      this.measuring.set(false);
      // Measured, and there was nothing there. Said out loud, because it is not
      // the same as never having pressed the button.
      this.measureNote.set('the shutter opened on silence');
      this.resolveCapture(null);
      return;
    }

    // The table exists and **nothing on screen says so yet**. Its window reaches
    // 1.486 s into the past and the ancla takes up to a second to see a change,
    // so until a beat has spoken for both ends of it this is a measurement of a
    // sound the app cannot name. The shutter stays in its measuring state and the
    // previous capture, if there is one, stays exactly as it was.
    this.waiting = { view: { medida: message.medida, takenAt: performance.now() }, window };
    this.settleCapture(this.backend.anchorBeats(), !this.backend.polling().paused);
  }

  /**
   * Draw the waiting capture, throw it away, or leave it waiting.
   *
   * Called from both sides of the race, because either can arrive first: the beat
   * that vouches may already be in the history when the worker answers, and the
   * worker may answer long before the beat.
   */
  private settleCapture(beats: readonly AnchorBeat[], looking: boolean): void {
    const waiting = this.waiting;
    if (waiting === null) {
      return;
    }
    // With the ancla stopped there is no beat to wait for, ever. Holding the
    // capture would be the shutter waiting on something that is switched off.
    const verdict = looking ? aval(beats, waiting.window) : 'discarded';
    if (verdict === 'pending') {
      return;
    }
    this.waiting = null;
    this.measuring.set(false);
    if (verdict === 'vouched') {
      this.medida.set(waiting.view);
      this.measureNote.set(null);
      this.resolveCapture(waiting.view);
      return;
    }
    // Discarded **unseen**: the window was of a sound the ancla cannot name, so
    // it was never a table on screen and there is nothing to take away. Nothing
    // is written under the cells either — the column at rest is the statement and
    // the header says it in words (#33).
    this.resolveCapture(null);
  }

  /**
   * The sound moved under a capture that had not been drawn yet: it goes.
   *
   * Both stages of the press, because a Performance change lands in either of
   * them — while the worker is still counting, and while the ancla has not
   * spoken. Neither has anything on screen to take away.
   */
  private discardCapture(): void {
    if (this.takingWindow === null && this.waiting === null) {
      return;
    }
    this.takingWindow = null;
    this.waiting = null;
    this.measuring.set(false);
    this.resolveCapture(null);
  }

  /** Answer the press, whatever it turned out to be. */
  private resolveCapture(view: MedidaView | null): void {
    const pending = this.pending;
    this.pending = null;
    pending?.(view);
  }

  private onFrame(frame: FrameMessage): void {
    // The rate is counted from the first bloque, so the first readout already
    // has an interval to divide by instead of a dash for a second.
    this.readoutAt ??= performance.now();
    // Every bloque, not every readout: what says the device is still there is
    // that something arrived, and the readout only moves four times a second.
    this.lastBlockAt.set(this.clock.now());

    this.live.trace = frame.trace;
    this.live.scope = frame.scope;
    this.live.trama = frame.trama;
    this.live.version += 1;

    // A trama with no curve adds no ridgeline: the note is over, and what is
    // already drawn is the tail of it fading. Nothing is pushed to keep the
    // waterfall from filling with the floor.
    if (frame.trama.curve !== null) {
      this.live.waterfall.push(frame.trama.curve);
      this.live.stamps.push(frame.atMs);
      this.live.rows += 1;
      if (this.live.waterfall.length > WATERFALL_FRAMES) {
        this.live.waterfall.shift();
        this.live.stamps.shift();
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
    // drawing, or when the scope's enganche changes: those are not numbers
    // moving, they are panels changing state, and making somebody wait a quarter
    // of a second for one would be a stutter. A caption that still says `LOCKED`
    // over a trace that has already gone amber is worse than a stutter.
    this.sinceReadout += 1;
    const drawing = frame.trama.curve !== null;
    const locked = lockState(frame.scope) !== lockState(this.scope());
    if (this.sinceReadout >= READOUT_EVERY || drawing !== this.drawing() || locked) {
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
    this.mainThreadLagMs.set(this.lag.worst);
    const started = this.stats().captureStartedAtMs;
    this.mainThreadLagAtSeconds.set(started === 0 ? 0 : (this.lag.worstAt - started) / 1000);

    this.scope.set(frame.scope);
    this.waterfall.set(waterfallView(this.live.stamps));
    this.floorDb.set(frame.trama.curve === null ? null : Math.round(frame.trama.floorDb));
    this.holdArtefact(frame.trama.artefactHz, frame.drawnHz, now);
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

  /**
   * The pitch the worker draws and locks against, and how many keys are down.
   *
   * The two travel together because the scope needs both: the lowest live pitch
   * has an answer under a chord and there is no fundamental under a chord, so
   * the count is what stops the trace being stood still on a note nobody is
   * hearing on its own.
   */
  private postNote(pitch: number | null, held: number): void {
    const hz = pitch === null ? null : equalTemperamentHz(pitch);
    this.worker?.postMessage({ kind: 'note', hz, held }, []);
  }
}

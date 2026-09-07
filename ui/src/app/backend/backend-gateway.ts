import { InjectionToken, Signal } from '@angular/core';

/**
 * The one seam between the Angular front and the native side.
 *
 * Everything the front learns about the keyboard and the audio device crosses
 * here, over the three Tauri transports and nothing else:
 *
 * - **events** — the port owner pushes what it has read: connection, patch
 *   header, relectura progress, live notes. They surface as signals.
 * - **invoke** — one-shot questions with an answer: {@link BackendGateway.appInfo}.
 * - **channels** — the raw audio bloques: {@link BackendGateway.subscribeBlocks}.
 *
 * Tauri's IPC is never faked; this interface is. Every UI test runs against
 * `FakeBackendGateway`, so no test needs a window or a keyboard.
 */
export interface BackendGateway {
  /** Whether `MODX-1` is open, and what the audio device reports. */
  readonly connection: Signal<ConnectionView>;

  /**
   * The facts of the loaded patch that the header draws. Every field is a
   * {@link PolledValue}: it carries its own provenance, so a value from a patch
   * that is gone keeps its shape and loses its number.
   */
  readonly patch: Signal<PatchHeaderView>;

  /**
   * The relectura of the whole patch, or `null` before the first one has begun.
   * The count is visible on purpose — the app is not hiding what it costs.
   */
  readonly reread: Signal<RereadProgress | null>;

  /**
   * The eight operators as the anillo ancho last read them, and how long its last
   * complete pass took. Everything the diagram draws comes from here.
   */
  readonly operators: Signal<OperatorsView>;

  /**
   * The drawing the read algorithm selects, or `null` when there is none.
   *
   * The 88 topologies live in Rust (ADR-0003) and the keyboard only ever answers
   * a *number*, so what arrives here is the one entry that number picked. `null`
   * has two meanings and the front tells them apart by looking at
   * {@link PatchHeaderView.algorithm}: no number yet is a diagram that has not
   * been read, and a number with no entry is `ALGORITMO SIN TABLA`.
   *
   * It only changes when the algorithm does, though the event that carries it
   * arrives a dozen times a second: see {@link sameTopology}.
   */
  readonly topology: Signal<Topology | null>;

  /** Live notes counted by distinct pitch (Note On with velocity 0 is Note Off). */
  readonly liveNotes: Signal<number>;

  /**
   * The lowest pitch the keyboard is holding, or `null` when nothing sounds.
   *
   * It is what every node's `TEORÍA` frequency is computed from: an operator's
   * frequency is a multiple of the note's, so with no note there is no number —
   * a dash, not a zero.
   */
  readonly lowestLivePitch: Signal<number | null>;

  /**
   * The volcado de seguridad of this launch, or `null` while it is still being
   * taken. One per launch, never deleted, and it carries the folder path in
   * every state — including the failures, where the path *is* the message.
   */
  readonly dump: Signal<DumpView | null>;

  /** Version and the folder where the volcados de seguridad are written. */
  appInfo(): Promise<AppInfo>;

  /**
   * Silence the keyboard: All Sound Off, All Notes Off and 2 048 explicit Note
   * Offs on the sixteen channels, and not one parameter.
   *
   * It is the last thing that stops working, so it is allowed to fail loudly: if
   * the port was lost the native side reopens it and sends anyway.
   */
  panic(): Promise<PanicOutcome>;

  /**
   * `REINTENTAR`: throw `MODX-1` away, enumerate again and open what is there.
   *
   * It rejects when there was nothing to open, which is what keeps the card from
   * flashing «done» at a keyboard that is still switched off. What it does **not**
   * report is whether the keyboard answers: that is the ancla's next whole pass,
   * and until it comes the app has nothing to say about it.
   */
  retry(): Promise<void>;

  /**
   * Raw f32 bloques straight off the device, one per three device callbacks.
   * Returns the unsubscribe.
   *
   * The buffer crosses untouched, exactly as `crates/modx-audio/src/block.rs`
   * wrote it: this interface carries it and does not read it. Taking it apart is
   * the worker's job and the format is the contract between the worker and Rust
   * (ADR-0001), which is why it is documented in `audio/bridge.ts` and not here.
   */
  subscribeBlocks(onBlock: (block: ArrayBuffer) => void): Promise<() => void>;

  /**
   * The window MEDIR analyses: the most recent `samples` of channel 0, as raw
   * little-endian f32, or `null` when the ring cannot serve that many yet.
   *
   * **The shutter looks backwards.** The sound somebody pressed MEDIR at is
   * already in the past, so the samples come out of the ring buffer Rust keeps
   * rather than being collected afterwards — otherwise a medida would begin by
   * asking for another second and a half of the same note.
   *
   * `null` is «there is not that much audio», which is the honest answer at
   * launch and with the device shut, and never a shorter window: a medida over a
   * padded window measures a silence that never entered.
   */
  measureWindow(samples: number): Promise<ArrayBuffer | null>;
}

export const BACKEND_GATEWAY = new InjectionToken<BackendGateway>('BackendGateway');

/** The five stamps of `CONTEXT.md`. Exactly one of them rides on every figure. */
export type Provenance = 'measured' | 'theory' | 'polled' | 'stale' | 'invalidated';

/**
 * A figure plus how it was obtained. `value` is `null` whenever the stamp is not
 * one that carries a number, which is how the dash reaches the screen instead of
 * a zero.
 */
export interface PolledValue<T> {
  readonly value: T | null;
  readonly provenance: Provenance;
  /** `performance.now()` when the value was read, or `null` when there is none. */
  readonly readAt: number | null;
}

export function invalidated<T>(): PolledValue<T> {
  return { value: null, provenance: 'invalidated', readAt: null };
}

export type PortState = 'connected' | 'disconnected';

/**
 * The two roads to `DESCONECTADO`, which are not the same fact.
 *
 * `enumeration` is `MODX-1` gone from the list — unplugged, switched off, or held
 * exclusively by another app — and there is something for `REINTENTAR` to reopen.
 * `timeouts` is three ancla passes in a row with a hole in them: the port is
 * there and the keyboard is not answering. One timeout is anomalous (fase 0c lost
 * 0 replies in 27 000 requests) and is deliberately **not** this: a single
 * timeout is what a busy keyboard looks like, and the card must not appear over a
 * chord.
 */
export type PortLoss = 'enumeration' | 'timeouts';

export interface ConnectionView {
  readonly port: PortState;
  /** Why the port counts as gone, or `null` when it does not. */
  readonly loss: PortLoss | null;
  /**
   * `MODX-1`, or `null` while the port has not been enumerated. It is **kept**
   * through a disconnection: a port that stopped answering is not a port that was
   * never there.
   */
  readonly portName: string | null;
  /** `Line (MODX)`, or `null` while the audio device is not open. */
  readonly audioDevice: string | null;
  /** 44 100, or `null` while the audio device is not open. */
  readonly sampleRate: number | null;
}

export interface PatchHeaderView {
  /** The ancla: the Part 1 name, polled at 1 Hz. */
  readonly performanceName: PolledValue<string>;
  /** The name the ancla had before it changed, drawn struck through beside it. */
  readonly previousPerformanceName: string | null;
  /**
   * How many times the Performance has changed underneath since launch.
   *
   * The first name of the session does not count: a launch invalidates nothing.
   * This is the number to watch — not {@link previousPerformanceName}, which
   * stays set for the rest of the session, and not the name itself, which two
   * different Performances can share. It is a counter and not a flag because two
   * changes in a row have to be two of them.
   */
  readonly changes: number;
  readonly algorithm: PolledValue<number>;
  readonly feedback: PolledValue<number>;
  /** The operator the feedback loop sits on, e.g. 5 for `FB 3 · OP5`. */
  readonly feedbackOperator: PolledValue<number>;
}

/** The header before the keyboard has answered: shape kept, figures lost. */
export function noPatch(): PatchHeaderView {
  return {
    performanceName: invalidated<string>(),
    previousPerformanceName: null,
    changes: 0,
    algorithm: invalidated<number>(),
    feedback: invalidated<number>(),
    feedbackOperator: invalidated<number>(),
  };
}

/** One line of the drawing: `from` modulates `into`. */
export interface Route {
  readonly from: number;
  readonly into: number;
}

/**
 * One of the 88 algorithms, as transcribed from the Data List's Algorithm Chart.
 *
 * Nothing here was polled: the keyboard says a number and never says who
 * modulates whom, so every route is paper until somebody compares the drawing
 * with the MODX's own screen. Which is what {@link Topology.provenance} says out
 * loud, per entry.
 */
export interface Topology {
  /** 1-88, as the keyboard's own screen numbers it. */
  readonly number: number;
  readonly routes: readonly Route[];
  /** The operators hanging off the output bus, ascending. */
  readonly carriers: readonly number[];
  /** The loop the chart draws as a rectangle. `from === into` for all but two. */
  readonly feedback: Route;
  /** Chain depth by operator, indexed `operator - 1`. A portadora is 0. */
  readonly depth: readonly number[];
  /** `documentado` until the drawing has been checked against the keyboard. */
  readonly provenance: TableProvenance;
}

/**
 * ADR-0003's two grades, which are not the five stamps of a figure: a route is
 * not a cifra and cannot go `CADUCO`. Promotion is per entry.
 */
export type TableProvenance = 'measured' | 'documented';

/**
 * Whether two topologies are the same drawing.
 *
 * The event that carries the topology is the anillo ancho's, so it arrives a
 * dozen times a second saying the same thing. Comparing by number is enough
 * because the 88 are a static table: the same number is the same drawing, and
 * without this the whole diagram would be rebuilt on every pass.
 */
export function sameTopology(a: Topology | null, b: Topology | null): boolean {
  return a === b || (a !== null && b !== null && a.number === b.number);
}

/**
 * The relectura, running or finished.
 *
 * `total` comes from the native side rather than being a constant here, and it
 * is **not** the design sheet's 416: that figure is the fase 0c sweep, which
 * asked every `al` of `ah` 48 and 49 one byte at a time. The app reads one
 * address per parameter, which is 384 of them, and the strip says what was
 * actually asked for. See `crates/modx-midi/src/table.rs`.
 */
export interface RereadProgress {
  readonly done: number;
  readonly total: number;
  /** How many of `done` came back with a value. 415 of 416 in the fase 0c sweep. */
  readonly answered: number;
  /** `null` while it is running, and the whole pass once it is over. */
  readonly tookMs: number | null;
}

/**
 * What an operator is doing in this patch. Carrier and modulator come from the
 * algorithm's topology; `inert` is Level 0 and overrides both, wherever the
 * algorithm put the operator.
 */
export type OperatorRole = 'carrier' | 'modulator' | 'inert';

/** Whether Coarse and Fine mean a ratio of the note, or a frequency of their own. */
export type FrequencyMode = 'ratio' | 'fixed';

/** One node of the diagram. Every figure carries its own stamp and its own age. */
export interface OperatorView {
  /** 1-8. */
  readonly operator: number;
  readonly role: PolledValue<OperatorRole>;
  /** 0-99. It is drawn as the height of the fill; the number only confirms it. */
  readonly level: PolledValue<number>;
  /** The nominal ratio. Absent in `fixed` mode, where the pair is not a ratio. */
  readonly ratio: PolledValue<number>;
  readonly frequencyMode: PolledValue<FrequencyMode>;
  readonly spectralForm: PolledValue<string>;
}

export interface OperatorsView {
  /** Always eight, in operator order, whether or not anything has been read. */
  readonly operators: readonly OperatorView[];
  /**
   * How long the anillo ancho's last completed pass took, or `null` before the
   * first one closed. `CADUCO` and the zone's cadence both come from it, and it
   * is never a constant: the same 42 addresses take ~84 ms in silence and ~430 ms
   * while somebody plays.
   */
  readonly passMs: number | null;
  readonly passes: number;
}

/** The eight nodes before the keyboard has answered: shape kept, figures lost. */
export function noOperators(): OperatorsView {
  return {
    operators: [1, 2, 3, 4, 5, 6, 7, 8].map((operator) => ({
      operator,
      role: invalidated<OperatorRole>(),
      level: invalidated<number>(),
      ratio: invalidated<number>(),
      frequencyMode: invalidated<FrequencyMode>(),
      spectralForm: invalidated<string>(),
    })),
    passMs: null,
    passes: 0,
  };
}

/** What one press of the pánico did. */
export interface PanicOutcome {
  /** Notas vivas held when the messages went out, counted before the silencing. */
  readonly silenced: number;
  /** Whether the port had to be reopened first. */
  readonly reopened: boolean;
}

export interface AppInfo {
  readonly version: string;
  /** Full path of the `dumps` folder. A safety file you cannot find is not safety. */
  readonly dumpsFolder: string;
}

/**
 * How the volcado went. `short` is its own state on purpose: the bytes were kept
 * and written, and calling that `saved` would hide the one failure mode a bulk
 * dump has that nothing in the app can see or fix (`Bulk Interval`).
 */
export type DumpState = 'saved' | 'short' | 'failed';

export interface DumpView {
  readonly state: DumpState;
  /** Full path of the file, or `null` when there is no file. */
  readonly path: string | null;
  /** Full path of the folder, in every state. A warning with no path is no warning. */
  readonly folder: string;
  readonly bytes: number;
  readonly messages: number;
  /** How long the dump took, or `null` when it never ran: the dash, not a zero. */
  readonly tookMs: number | null;
  /** One line in Spanish saying what went wrong, or `null` when nothing did. */
  readonly reason: string | null;
  /** The 123 messages and 7 669 bytes of fase 0c, so nothing here hardcodes them. */
  readonly expectedMessages: number;
  readonly expectedBytes: number;
}

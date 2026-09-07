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
   * The relectura of the 416 addresses, or `null` when no relectura is running.
   * The count is visible on purpose — the app is not hiding what it costs.
   */
  readonly reread: Signal<RereadProgress | null>;

  /**
   * The eight operators as the anillo ancho last read them, and how long its last
   * complete pass took. Everything the diagram draws comes from here.
   */
  readonly operators: Signal<OperatorsView>;

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

export interface ConnectionView {
  readonly port: PortState;
  /** `MODX-1`, or `null` while the port has not been enumerated. */
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
  readonly algorithm: PolledValue<number>;
  readonly feedback: PolledValue<number>;
  /** The operator the feedback loop sits on, e.g. 5 for `FB 3 · OP5`. */
  readonly feedbackOperator: PolledValue<number>;
}

export interface RereadProgress {
  readonly done: number;
  readonly total: number;
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

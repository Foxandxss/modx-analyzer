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

  /** Live notes counted by distinct pitch (Note On with velocity 0 is Note Off). */
  readonly liveNotes: Signal<number>;

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
   * Returns the unsubscribe. The blocks carry no analysis: that is TypeScript's
   * job in the worker (ADR-0001).
   */
  subscribeBlocks(onBlock: (block: AudioBlock) => void): Promise<() => void>;
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
 * The contract between Rust and the worker. One bloque is three device callbacks
 * of interleaved stereo f32 (1 323 frames), with the sender's monotonic timestamp
 * so delivery latency can be measured rather than guessed.
 */
export interface AudioBlock {
  readonly sequence: number;
  readonly sentAtMicros: number;
  readonly frames: number;
  readonly samples: Float32Array;
}

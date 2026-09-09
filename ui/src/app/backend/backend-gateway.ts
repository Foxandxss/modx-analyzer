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

  /**
   * The ancla's own passes, oldest first, at most {@link ANCHOR_BEAT_HISTORY} of
   * them, and empty until the first one has gone by.
   *
   * The name and {@link PatchHeaderView.changes} say *what* is loaded; these say
   * **when the app last checked**, which is a different question and the only one
   * a medida can be vouched for by (ADR-0005, extended to the capture): a window
   * of audio reaches 1.5 s into the past, and only a beat that started after its
   * last sample can speak for it.
   *
   * It is a list and not the last beat because the rule needs **both** ends of the
   * window — the beat that closed before its first sample and the beat that opened
   * after its last — and a signal that only ever holds the newest would have the
   * older of the two already overwritten by the time the shutter asks.
   */
  readonly anchorBeats: Signal<readonly AnchorBeat[]>;

  /**
   * Ask the ancla for a beat sooner than its second.
   *
   * It is a hint and it is the same one the anillo ancho makes: the ancla owns its
   * cadence (ADR-0004) and the gap rule decides when, which under notes is «at the
   * usual second». Resolving means the request was filed, never that a beat has
   * happened — that arrives on {@link anchorBeats} like every other.
   */
  requestAnchorBeat(): Promise<void>;

  /** Live notes counted by distinct pitch (Note On with velocity 0 is Note Off). */
  readonly liveNotes: Signal<number>;

  /**
   * The note generator of the bridge measurement: what it has asked for, what
   * the port took, and what the keyboard has said back.
   *
   * It is an instrument and not a feature — it exists so that ADR-0001's
   * go/no-go can be taken under the one condition where audio, MIDI polling and
   * the repaint all compete, which only happens while the keyboard is sounding.
   */
  readonly generator: Signal<GeneratorView>;

  /**
   * The read-only sweep of one operator block, running or finished, or `null`
   * before the first one has been asked for.
   *
   * It is #16's instrument: the app addresses every operator parameter with
   * `am = (op << 4) | part`, a rule measured on the Part 1 and on the Part 1
   * only. Sweeping the same operator on a Part 2 is what turns the assumption
   * under the whole table into a reading.
   */
  readonly sweep: Signal<SweepView | null>;

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
   * Start the note generator: dense notes from the PC, down the same port.
   *
   * Two preconditions, and they are not decoration: the pánico is wired and has
   * been pressed for real once, and the generator lets go of every key it
   * pressed when the loop ends however it ends. The hung notes of fase 0c came
   * from the second one being missing.
   */
  startGenerator(): Promise<void>;

  /** Stop it. It resolves once the Note Offs have gone out, not before. */
  stopGenerator(): Promise<void>;

  /**
   * Whether the ancla and the anillo ancho are asking for anything.
   *
   * #14's instrument, and the only control in the app that makes it stop
   * knowing things on purpose: with this on, nothing notices a Performance
   * change. It exists so the same held note can be measured twice, once with
   * the polling running and once without.
   */
  readonly polling: Signal<PollingView>;

  /** Stop or resume the two polling loops. */
  setPolling(paused: boolean): Promise<void>;

  /**
   * Write one window of the audio ring to disk and answer where it went.
   *
   * The **label is chosen by the native side** from the polling flag, not by
   * this caller: filing a polled window as an unpolled one is the one mistake
   * that would quietly ruin #14's comparison.
   */
  exportWindow(samples: number): Promise<string>;

  /**
   * Ask every offset of one operator of one Part, one at a time, and write
   * nothing.
   *
   * It resolves when the sweep has **started**, not when it is done: what
   * happens arrives on the sweep signal, the same one-writer rule the
   * connection and the relectura follow. It rejects when there is already one
   * going or when the Part or the operator is not a number the keyboard has.
   */
  sweepOperator(part: number, operator: number): Promise<void>;

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
  /**
   * 2, or `null` while the audio device is not open.
   *
   * The three audio fields are one fact: they are set together by the Rust side
   * when the stream opens and dropped together when it closes, so the `LIVE`
   * pill's second line is either all three or the dash. Never a count without a
   * device to have counted.
   */
  readonly channels: number | null;
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

/**
 * What one ancla pass found. Rust's `Beat`, in its own four words.
 *
 * `first` is the first whole name of the session and is **not** a change: nothing
 * preceded it, so it invalidates nothing — but it cannot vouch for anything either,
 * because it has no previous name to have found unchanged. `incomplete` is a pass
 * with a hole in it, which is compared with nothing at all and therefore neither
 * confirms nor denies that the sound moved.
 */
export type BeatAnswer = 'same' | 'first' | 'changed' | 'incomplete';

/**
 * One pass of the ancla, on this side's clock.
 *
 * **Two instants and not one.** A pass costs ~40 ms idle and ~200 ms under notes,
 * and what it can vouch for is everything that happened before it *started*: the
 * end is only when the answer became known. Collapsing them would give the aval a
 * fifth of a second of slack in the one condition — somebody playing — where a
 * Performance is most likely to be changed underneath.
 */
export interface AnchorBeat {
  /** 1-based, in the order the ancla took them. A gap here is a beat that was lost. */
  readonly beat: number;
  /** When the pass asked for its first address, on `performance.now()`'s clock. */
  readonly startedAt: number;
  /** When its last address answered. */
  readonly endedAt: number;
  readonly answer: BeatAnswer;
  /**
   * The name **this pass** read, or `null` for `incomplete`, which read none.
   *
   * A hole in the name is not a name, so an incomplete pass reports nothing rather
   * than the last one it knew: that would be the app claiming a reading it did not
   * take.
   */
  readonly name: string | null;
}

/**
 * How many beats the gateway keeps.
 *
 * The medida's window reaches 1.486 s into the past and needs the beat that closed
 * before it began, so about three seconds of history is the requirement. Beats are
 * a second apart at rest and 250 ms apart at the aval floor, so sixteen of them is
 * four seconds in the worst case and the requirement in the best. It is bounded at
 * all because this signal is written a dozen times a minute for the whole life of
 * the process and nothing draws the old ones.
 */
export const ANCHOR_BEAT_HISTORY = 16;

/**
 * The history with `beat` on the end, oldest first, and the oldest dropped once it
 * is longer than {@link ANCHOR_BEAT_HISTORY}.
 *
 * It is shared by both gateways because forgetting the oldest beat is the same fact
 * either side of the seam, and two copies of a bound are two bounds.
 */
export function keepBeat(history: readonly AnchorBeat[], beat: AnchorBeat): readonly AnchorBeat[] {
  const kept = [...history, beat];
  return kept.length > ANCHOR_BEAT_HISTORY ? kept.slice(kept.length - ANCHOR_BEAT_HISTORY) : kept;
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
  /**
   * Which connected structure each operator belongs to, indexed `operator - 1`,
   * named by the lowest operator number in it. A branch of one is an operator
   * with no route at all.
   *
   * The depth says which row a node stands on; this says which drawing it
   * belongs to, which is what stands whole branches side by side. Computed in
   * Rust beside the depth, because the rule that lays out any of the 88 belongs
   * to the table and two copies of a rule are one copy too many.
   */
  readonly branch: readonly number[];
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
 * `total` comes from the native side rather than being a constant here. The
 * design sheet said 416 until session 2 moved `--reread-total` to 384 to match:
 * the 416 was the fase 0c sweep, which
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
 * The relectura in progress, or `null`. **One copy of «the strip is up».**
 *
 * A pass that carries how long it took is a pass that arrived, and the count
 * stops climbing because it finished rather than because it stalled. Two places
 * read this and they must not drift: the strip that draws the count, and the
 * regrowth of the algorithm surface, which waits for the strip to go rather than
 * racing it (#41).
 */
export function rereadRunning(pass: RereadProgress | null): RereadProgress | null {
  return pass === null || pass.tookMs !== null ? null : pass;
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

/**
 * One run of the note generator, as the dev readout draws it.
 *
 * `asked` and `sent` are two numbers on purpose. The generator is served last of
 * everything (ADR-0004), so a run in which the port never got round to it is a
 * **result** about the port under load and not a broken instrument — and the two
 * numbers drifting apart is the only way that shows.
 */
export interface GeneratorView {
  readonly running: boolean;
  /** Messages the pattern produced. */
  readonly asked: number;
  /** Messages the port took. */
  readonly sent: number;
  /** Steps the port refused outright, normally because there is no port. */
  readonly refused: number;
  /** Pitches the generator is holding. Zero whenever it is not running. */
  readonly held: number;
  /**
   * Channel messages the **keyboard** has sent since the port opened.
   *
   * This is #8's self-verification. Under real hands it climbs with the playing.
   * Under generated notes it only climbs if the MODX echoes what it is told back
   * to its own output, which nobody has checked — so it is counted and written
   * down rather than assumed either way.
   */
  readonly traffic: number;
  /** Milliseconds per step of the pattern. */
  readonly stepMs: number;
}

/**
 * One offset of the operator block, as the sweep read it.
 *
 * `value` is `null` for an offset that did not answer, and that is the half of
 * the sweep worth looking at: the Data List gives 39 of the 47 as parameters and
 * the fase 0c blind sweep counted 43 answering, so how many dashes there are is
 * the reading that closes the contradiction.
 */
export interface SweepOffset {
  /** The `al` byte, which is how the Data List's own table is indexed. */
  readonly al: number;
  /** `49 21 1A`: the whole terna, ready to be copied onto paper. */
  readonly address: string;
  /** The decoded value, or `null` when the offset did not answer. */
  readonly value: number | null;
  /** What the table calls whatever owns this offset, or `null` where nothing does. */
  readonly name: string | null;
  /** ADR-0003's grade of that entry, in the table's own two words. */
  readonly provenance: 'medido' | 'documentado' | null;
  /** Whether the table has it down as reserved. A reserved offset reads like any other. */
  readonly reserved: boolean;
  /** Whether the bytes moved since the previous sweep of this same operator. */
  readonly changed: boolean;
}

/**
 * One sweep of one operator of one Part, running or finished.
 *
 * Nothing here is a figure of the patch and none of it wears one of the five
 * stamps: a sweep is not a reading the app draws from, it is the app checking
 * where its own readings come from.
 */
export interface SweepView {
  readonly part: number;
  readonly operator: number;
  readonly done: number;
  /** The operator block's documented size, from the table and not from here. */
  readonly total: number;
  readonly answered: number;
  readonly running: boolean;
  /** `null` while it is running, and the whole pass once it is over. */
  readonly tookMs: number | null;
  /** Empty while it runs: a half table would read as a Part that answers nowhere. */
  readonly offsets: readonly SweepOffset[];
  /**
   * Whether there was a previous sweep of this same operator to compare with.
   *
   * «Nothing moved» and «there is nothing to have moved from» are two different
   * facts, and a first sweep drawn as SIN CAMBIOS would be the app claiming a
   * comparison it never made.
   */
  readonly compared: boolean;
  /**
   * Every `al` that moved since the previous sweep of this same operator.
   *
   * A list and not a flag: one panel change landing in **two** places is the
   * interesting failure, and a flag could not say it.
   */
  readonly changed: readonly number[];
}

/** No run yet: dashes, not zeros with a story behind them. */
export function noGenerator(): GeneratorView {
  return {
    running: false,
    asked: 0,
    sent: 0,
    refused: 0,
    held: 0,
    traffic: 0,
    stepMs: 0,
  };
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

/** Whether the two polling loops are asking the keyboard anything (#14). */
export interface PollingView {
  readonly paused: boolean;
}

export function noPolling(): PollingView {
  return { paused: false };
}

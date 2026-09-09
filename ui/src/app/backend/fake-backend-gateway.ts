import { Injectable, signal } from '@angular/core';
import { CHANNELS } from 'modx-dsp';
import { HEADER_BYTES } from '../audio/bridge';
import {
  AnchorBeat,
  AppInfo,
  BackendGateway,
  BeatAnswer,
  ConnectionView,
  DumpView,
  GeneratorView,
  OperatorsView,
  PanicOutcome,
  PatchHeaderView,
  PortLoss,
  RereadProgress,
  SweepOffset,
  SweepView,
  Topology,
  invalidated,
  keepBeat,
  noGenerator,
  noPolling,
  PollingView,
  noOperators,
  noPatch,
  sameTopology,
} from './backend-gateway';

/**
 * The gateway a test drives by hand: it pushes connection states, patch headers,
 * relectura progress and bloques, and nothing crosses Tauri.
 *
 * Its starting point is the app's starting point — everything invalidated, so a
 * test that pushes nothing sees exactly the screen the laptop shows on launch.
 */
@Injectable()
export class FakeBackendGateway implements BackendGateway {
  readonly connection = signal<ConnectionView>({
    port: 'disconnected',
    loss: null,
    portName: null,
    audioDevice: null,
    sampleRate: null,
  });

  readonly patch = signal<PatchHeaderView>(noPatch());

  readonly reread = signal<RereadProgress | null>(null);

  readonly operators = signal<OperatorsView>(noOperators());

  /** No algorithm read, so no drawing: the same silence the real one opens in. */
  readonly topology = signal<Topology | null>(null, { equal: sameTopology });

  /** The ancla has not beaten yet, which is where the app opens. */
  readonly anchorBeats = signal<readonly AnchorBeat[]>([]);

  /** How many times a beat has been asked for out of turn. */
  beatRequests = 0;

  readonly liveNotes = signal(0);

  readonly lowestLivePitch = signal<number | null>(null);

  /** No volcado yet: the launch the app opens in, before the keyboard answered. */
  readonly dump = signal<DumpView | null>(null);

  /** Nothing has been generated: no run has been asked for. */
  readonly generator = signal<GeneratorView>(noGenerator());

  /** No barrido asked for: the block on screen is not there at all. */
  readonly sweep = signal<SweepView | null>(null);

  /** Every `(parte, operador)` a sweep has been asked for, in order. */
  readonly sweepCalls: { part: number; operator: number }[] = [];

  /** How many times the generator has been started and stopped. */
  generatorStarts = 0;
  generatorStops = 0;

  appInfoResult: AppInfo = { version: '0.0.0-fake', dumpsFolder: '' };

  /** What the next pánico answers, or a rejection when the port is gone for good. */
  panicResult: () => Promise<PanicOutcome> = () =>
    Promise.resolve({ silenced: this.liveNotes(), reopened: false });

  /** How many times the pánico has been pressed. A second press is a bug, not a habit. */
  panicPresses = 0;

  /**
   * What the next `REINTENTAR` does. The default is the keyboard being there
   * again: the port opens and the link clears, which is what the native side
   * reports the moment `MODX-1` is back in the enumeration.
   *
   * A test that wants the other case — the owner presses it with the keyboard
   * still switched off — replaces this with a rejection, and the card stays.
   */
  retryResult: () => Promise<void> = () => {
    this.portFound();
    return Promise.resolve();
  };

  /** How many times `REINTENTAR` has been pressed. */
  retryPresses = 0;

  private readonly blockListeners = new Set<(block: ArrayBuffer) => void>();

  /**
   * Channel 0 of everything emitted, the way Rust's `MonoRing` keeps it.
   *
   * A test that pressed MEDIR would otherwise be handed a window somebody wrote
   * by hand, and the one thing the medida has to get right is that it analyses
   * **the sound that was playing** and not the one arriving next.
   */
  private ring = new Float32Array(0);

  appInfo(): Promise<AppInfo> {
    return Promise.resolve(this.appInfoResult);
  }

  panic(): Promise<PanicOutcome> {
    this.panicPresses += 1;
    const outcome = this.panicResult();
    this.liveNotes.set(0);
    // The native side stops the generator before it sends: a generator still
    // generating would put a Note On behind the 2 080 messages that were
    // supposed to be the end of it.
    this.generator.update((view) => ({ ...view, running: false, held: 0 }));
    return outcome;
  }

  retry(): Promise<void> {
    this.retryPresses += 1;
    return this.retryResult();
  }

  /**
   * The request is counted and **no beat happens**.
   *
   * That is not a shortcut: the ancla owns its cadence and answers the request when
   * the gap rule lets it, so a fake that beat here would let a test pass on a beat
   * the keyboard is not obliged to give — and, worse, on times nobody chose. A test
   * that wants the beat scripts it with {@link anchorBeat}.
   */
  requestAnchorBeat(): Promise<void> {
    this.beatRequests += 1;
    return Promise.resolve();
  }

  startGenerator(): Promise<void> {
    this.generatorStarts += 1;
    // The native side answers by emitting, so the state moves here too: a run
    // that started is a run the readout has to be able to see.
    this.generator.update((view) => ({ ...view, running: true, stepMs: 40 }));
    return Promise.resolve();
  }

  /**
   * Test driver: the native side takes the sweep and says what it found.
   *
   * The default is the fake MODX's own answer for a Part that is there — the 39
   * offsets the Data List accounts for, and dashes at the eight it does not.
   * Whether the **real** keyboard answers at 43 of them is the whole of #16 and
   * cannot be decided here, so nothing in this file pretends it can.
   */
  sweepResult: (part: number, operator: number) => SweepView = (part, operator) =>
    fakeSweep(part, operator);

  sweepOperator(part: number, operator: number): Promise<void> {
    this.sweepCalls.push({ part, operator });
    this.sweep.set(this.sweepResult(part, operator));
    return Promise.resolve();
  }

  stopGenerator(): Promise<void> {
    this.generatorStops += 1;
    // Stopping resolves once the keys are up, which is why `held` goes to zero
    // in the same breath and never a step later.
    this.generator.update((view) => ({ ...view, running: false, held: 0 }));
    return Promise.resolve();
  }

  readonly polling = signal<PollingView>(noPolling());

  /** Windows exported since this fake was made, newest last. */
  exported: string[] = [];

  setPolling(paused: boolean): Promise<void> {
    this.polling.set({ paused });
    return Promise.resolve();
  }

  exportWindow(samples: number): Promise<string> {
    // The label comes from the flag and not from the caller, the same way the
    // native side does it — a test that could file a polled window as an
    // unpolled one would be testing a mistake the real command cannot make.
    const label = this.polling().paused ? 'sin-sondeo' : 'sondeo';
    const path = `medidas/${this.exported.length}-${label}-${samples}.f32`;
    this.exported.push(path);
    return Promise.resolve(path);
  }

  /**
   * Test driver: the run has been going and these are its counts.
   *
   * `sent` defaults to `asked` — the port took everything — because the case
   * worth writing a test about is the one where it did not.
   */
  generatorRuns(counts: Partial<GeneratorView> & { asked: number }): void {
    this.generator.update((view) => ({
      ...view,
      running: true,
      stepMs: 40,
      sent: counts.asked,
      ...counts,
    }));
  }

  /**
   * Test driver: the link went. `enumeration` is the cable pulled or another app
   * holding the port; `timeouts` is three ancla passes in a row with a hole.
   *
   * The name stays, exactly as the native side keeps it: `MODX-1` is still what
   * the app is looking for behind the keyboard.
   */
  portLost(loss: PortLoss): void {
    this.connection.update((view) => ({
      ...view,
      port: 'disconnected',
      loss,
      portName: view.portName ?? 'MODX-1',
    }));
  }

  /** Test driver: the port is open and answering again. */
  portFound(): void {
    this.connection.update((view) => ({
      ...view,
      port: 'connected',
      loss: null,
      portName: 'MODX-1',
    }));
  }

  subscribeBlocks(onBlock: (block: ArrayBuffer) => void): Promise<() => void> {
    this.blockListeners.add(onBlock);
    return Promise.resolve(() => this.blockListeners.delete(onBlock));
  }

  measureWindow(samples: number): Promise<ArrayBuffer | null> {
    if (this.ring.length < samples) {
      // What the real command answers when the ring has not filled: nothing at
      // all, never a shorter window.
      return Promise.resolve(null);
    }
    return Promise.resolve(this.ring.slice(this.ring.length - samples).buffer as ArrayBuffer);
  }

  /**
   * Test driver: the ancla answers with a name for the first time.
   *
   * A launch is **not** a change — nothing of a previous patch is on screen —
   * so nothing is invalidated and `changes` stays at zero, exactly as the native
   * side does it.
   */
  anchorReads(name: string): void {
    this.patch.update((patch) => ({
      ...patch,
      performanceName: { value: name, provenance: 'polled', readAt: performance.now() },
    }));
  }

  /**
   * Test driver: a pass started at `startedAt`, ended at `endedAt` and answered
   * this. The two times are the point and are never invented here — what a beat can
   * vouch for is decided by where it sits against a window of audio, so a driver
   * that chose the times would be choosing the answer.
   *
   * Neither {@link anchorReads} nor {@link loadPerformance} beats: those say what
   * the header reads, which crosses on another event and carries no times at all. A
   * test that needs both says both, in the order the native side would.
   *
   * The name defaults to whatever the fake has loaded, because that is what the
   * pass would have read; `incomplete` overrides it to `null`, because a pass with a
   * hole in it read no name.
   */
  anchorBeat(beat: {
    startedAt: number;
    endedAt: number;
    answer: BeatAnswer;
    name?: string | null;
  }): AnchorBeat {
    const read =
      beat.answer === 'incomplete' ? null : (beat.name ?? this.patch().performanceName.value);
    const found: AnchorBeat = {
      beat: this.beats + 1,
      startedAt: beat.startedAt,
      endedAt: beat.endedAt,
      answer: beat.answer,
      name: read,
    };
    this.beats += 1;
    this.anchorBeats.update((history) => keepBeat(history, found));
    return found;
  }

  /** How many beats have been scripted, so their numbers climb as the ancla's do. */
  private beats = 0;

  /**
   * Test driver: somebody loads another Performance on the panel.
   *
   * It does here exactly what the native side does, in the same one step, which
   * is the point of driving it through the gateway: the new name arrives with
   * the old one beside it, `changes` goes up, and **everything polled loses its
   * number in the same breath**. No figure of the old patch is ever replaced by
   * a figure of the new one without passing through the dash, because the
   * dashes go out first and the anillo ancho refills afterwards.
   */
  loadPerformance(name: string): void {
    const previous = this.patch().performanceName.value;
    this.patch.update((patch) => ({
      ...patch,
      performanceName: { value: name, provenance: 'polled', readAt: performance.now() },
      previousPerformanceName: previous,
      changes: patch.changes + 1,
      algorithm: invalidated<number>(),
      feedback: invalidated<number>(),
      feedbackOperator: invalidated<number>(),
    }));
    this.topology.set(null);
    this.operators.update((view) => ({
      ...noOperators(),
      passMs: view.passMs,
      passes: view.passes,
    }));
  }

  /** Test driver: hand every subscriber a bloque as if it came off the device. */
  emitBlock(block: ArrayBuffer): void {
    this.keepChannelZero(block);
    for (const listener of this.blockListeners) {
      listener(block);
    }
  }

  /** The ring the native side keeps, filled from the bloques as they go out. */
  private keepChannelZero(block: ArrayBuffer): void {
    const frames = new DataView(block).getUint32(4, true);
    const interleaved = new Float32Array(block, HEADER_BYTES, frames * CHANNELS);
    const kept = new Float32Array(this.ring.length + frames);
    kept.set(this.ring);
    for (let frame = 0; frame < frames; frame += 1) {
      kept[this.ring.length + frame] = interleaved[frame * CHANNELS];
    }
    this.ring = kept;
  }
}

/** The offsets the table accounts for as parameters: `00`-`25`, and `2A` reserved. */
const NAMED_OFFSETS = 0x26;
const RESERVED_AT = 0x2a;
const BLOCK_SIZE = 47;

/**
 * A sweep as the fake MODX answers it: every offset the table names comes back,
 * and the rest are dashes.
 *
 * It is the app asking where the app thinks the parameters are, which is all a
 * fake can ever show. The reading that matters — whether the MODX answers at
 * `(op << 4) | part` for a Part 2, and at how many of the 47 — needs the
 * keyboard, and is written down in `docs/results` rather than modelled here.
 */
export function fakeSweep(part: number, operator: number, changed: number[] = []): SweepView {
  const offsets: SweepOffset[] = Array.from({ length: BLOCK_SIZE }, (_, al) => {
    const answers = al < NAMED_OFFSETS || al === RESERVED_AT;
    return {
      al,
      address: terna(part, operator, al),
      value: answers ? 0 : null,
      name: al < NAMED_OFFSETS ? `Parameter ${hex(al)}` : null,
      provenance: al >= RESERVED_AT ? 'documentado' : 'medido',
      reserved: al >= RESERVED_AT,
      changed: changed.includes(al),
    };
  });

  return {
    part,
    operator,
    done: BLOCK_SIZE,
    total: BLOCK_SIZE,
    answered: offsets.filter((offset) => offset.value !== null).length,
    running: false,
    tookMs: 310,
    offsets,
    compared: changed.length > 0,
    changed,
  };
}

/** `49 21 1A`, the way the native side writes it: `(op << 4) | part`, base zero. */
function terna(part: number, operator: number, al: number): string {
  return `49 ${hex(((operator - 1) << 4) | (part - 1))} ${hex(al)}`;
}

function hex(byte: number): string {
  return byte.toString(16).toUpperCase().padStart(2, '0');
}

import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Channel, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  AppInfo,
  BackendGateway,
  ConnectionView,
  DumpView,
  FrequencyMode,
  OperatorRole,
  OperatorView,
  OperatorsView,
  PanicOutcome,
  PatchHeaderView,
  PolledValue,
  RereadProgress,
  Topology,
  invalidated,
  noOperators,
  noPatch,
  sameTopology,
} from './backend-gateway';

/**
 * A figure as the native side sends it: the number, and how long before the event
 * left that the keyboard said it.
 *
 * **It is an age and not a timestamp on purpose.** The reading is stamped with a
 * monotonic clock in Rust whose epoch has nothing to do with `performance.now()`,
 * and two unrelated clocks cannot be subtracted. An elapsed time can be carried
 * across, so the age is turned back into a stamp on this side's clock the instant
 * the event arrives — the same alignment the audio bloque does, for the same
 * reason. What that costs is the IPC hop, which is a few milliseconds against a
 * `CADUCO` threshold of hundreds.
 */
interface Aged<T> {
  readonly value: T;
  readonly ageMs: number;
}

/** `modx://patch`, before the ages become stamps. */
interface PatchWire {
  readonly performanceName: Aged<string> | null;
  readonly previousPerformanceName: string | null;
  readonly changes: number;
  readonly algorithm: Aged<number> | null;
  readonly feedback: Aged<number> | null;
  readonly feedbackOperator: Aged<number> | null;
  readonly topology: TopologyWire | null;
}

/**
 * The topology as Rust sends it. It carries no age: the 88 are a table, not a
 * reading, and a table entry does not go stale. What ages is the number that
 * chose it, and that is `algorithm`.
 */
interface TopologyWire extends Omit<Topology, 'provenance'> {
  /** ADR-0003's own two words, in Spanish, as the table spells them. */
  readonly provenance: 'medido' | 'documentado';
}

/** `modx://operators`, before the ages become stamps. */
interface OperatorWire {
  readonly operator: number;
  readonly role: Aged<OperatorRole> | null;
  readonly level: Aged<number> | null;
  readonly ratio: Aged<number> | null;
  readonly frequencyMode: Aged<FrequencyMode> | null;
  readonly spectralForm: Aged<string> | null;
}

interface OperatorsWire {
  readonly operators: readonly OperatorWire[];
  readonly passMs: number | null;
  readonly passes: number;
}

/** `modx://live-notes`: the pánico's glow and the note the TEORÍA lines follow. */
interface LiveNotesWire {
  readonly count: number;
  readonly lowestPitch: number | null;
}

/**
 * One figure, stamped `SONDEADO` on this side's clock. An address that has never
 * answered keeps its shape and shows the dash.
 *
 * Nothing here ever writes `CADUCO`: whether a reading is too old is a question
 * about the time *now*, and it is asked again on every frame that draws it.
 */
function polled<T>(aged: Aged<T> | null, arrivedAt: number): PolledValue<T> {
  if (aged === null) {
    return invalidated<T>();
  }
  return { value: aged.value, provenance: 'polled', readAt: arrivedAt - aged.ageMs };
}

/** The table's two words into the front's two, and nothing else touched. */
function toTopology(wire: TopologyWire | null): Topology | null {
  if (wire === null) {
    return null;
  }
  return { ...wire, provenance: wire.provenance === 'medido' ? 'measured' : 'documented' };
}

/**
 * The real gateway. It knows the event names, the command names and the channel
 * payload, and nothing else: no keyboard vocabulary, no drawing.
 *
 * With no `MODX-1` to open, nothing emits any of these and every slot stays
 * invalidated, which is the state this screen is specified to open in.
 */
@Injectable()
export class TauriBackendGateway implements BackendGateway {
  private readonly destroyRef = inject(DestroyRef);

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

  // The ring says the algorithm a dozen times a second and it is the same
  // algorithm every time; the drawing is only rebuilt when the number changes.
  readonly topology = signal<Topology | null>(null, { equal: sameTopology });

  readonly liveNotes = signal(0);

  readonly lowestLivePitch = signal<number | null>(null);

  readonly dump = signal<DumpView | null>(null);

  constructor() {
    this.listenInto('modx://connection', this.connection);
    this.listenInto('modx://reread', this.reread);
    this.listenInto('modx://dump', this.dump);

    // The three the anillo ancho feeds. Each arrives with ages rather than
    // timestamps and is aligned to this side's clock on arrival.
    this.listen<PatchWire>('modx://patch', (wire) => {
      this.patch.set(this.toPatch(wire));
      this.topology.set(toTopology(wire.topology));
    });
    this.listen<OperatorsWire>('modx://operators', (wire) =>
      this.operators.set(this.toOperators(wire)),
    );
    this.listen<LiveNotesWire>('modx://live-notes', (wire) => {
      this.liveNotes.set(wire.count);
      this.lowestLivePitch.set(wire.lowestPitch);
    });

    // The volcado is taken once, on a thread, and is very likely finished before
    // this window has run a line of JavaScript. The event would then have nobody
    // listening, so the state is asked for as well as listened to.
    void invoke<DumpView | null>('last_dump').then((taken) => {
      if (taken !== null && this.dump() === null) {
        this.dump.set(taken);
      }
    });
  }

  appInfo(): Promise<AppInfo> {
    return invoke<AppInfo>('app_info');
  }

  panic(): Promise<PanicOutcome> {
    return invoke<PanicOutcome>('panic_keyboard');
  }

  retry(): Promise<void> {
    // The connection state is not set here and is not awaited into anything: the
    // native side emits `modx://connection` either way, and the card is drawn off
    // that event and nothing else. One writer, the way `connection.rs` says.
    return invoke<void>('retry_connection');
  }

  async subscribeBlocks(onBlock: (block: ArrayBuffer) => void): Promise<() => void> {
    // `InvokeResponseBody::Raw` on the Rust side reaches JavaScript as an
    // `ArrayBuffer`. It is handed on without being read, so that the only copy
    // between the audio thread and the analysis is the one the IPC makes.
    const channel = new Channel<ArrayBuffer>();
    let subscribed = true;
    channel.onmessage = (block) => {
      if (subscribed) {
        onBlock(block);
      }
    };
    await invoke('subscribe_audio_blocks', { channel });
    return () => {
      subscribed = false;
    };
  }

  async measureWindow(samples: number): Promise<ArrayBuffer | null> {
    try {
      // Raw again, and for the same reason as the bloques: 256 KB of samples
      // through JSON would be a megabyte of digits parsed on the thread that
      // draws. The buffer is handed to the worker by transfer without being read.
      return await invoke<ArrayBuffer>('measure_window', { samples });
    } catch (reason) {
      // The command says why in Spanish — the device is shut, or the ring has
      // not filled — and the log is where a developer reads it. On screen it is
      // one fact: there was nothing to measure.
      console.warn('modx: no hay ventana para medir', reason);
      return null;
    }
  }

  private toPatch(wire: PatchWire): PatchHeaderView {
    const arrivedAt = performance.now();
    return {
      performanceName: polled(wire.performanceName, arrivedAt),
      previousPerformanceName: wire.previousPerformanceName,
      changes: wire.changes,
      algorithm: polled(wire.algorithm, arrivedAt),
      feedback: polled(wire.feedback, arrivedAt),
      feedbackOperator: polled(wire.feedbackOperator, arrivedAt),
    };
  }

  private toOperators(wire: OperatorsWire): OperatorsView {
    const arrivedAt = performance.now();
    const operators: OperatorView[] = wire.operators.map((node) => ({
      operator: node.operator,
      role: polled(node.role, arrivedAt),
      level: polled(node.level, arrivedAt),
      ratio: polled(node.ratio, arrivedAt),
      frequencyMode: polled(node.frequencyMode, arrivedAt),
      spectralForm: polled(node.spectralForm, arrivedAt),
    }));
    return { operators, passMs: wire.passMs, passes: wire.passes };
  }

  private listenInto<T>(event: string, target: { set(value: T): void }): void {
    this.listen<T>(event, (payload) => target.set(payload));
  }

  private listen<T>(event: string, onPayload: (payload: T) => void): void {
    const unlisten = listen<T>(event, ({ payload }) => onPayload(payload));
    this.destroyRef.onDestroy(() => void unlisten.then((stop) => stop()));
  }
}

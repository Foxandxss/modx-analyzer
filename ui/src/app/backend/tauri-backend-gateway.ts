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
  invalidated,
  noOperators,
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
  readonly algorithm: Aged<number> | null;
  readonly feedback: Aged<number> | null;
  readonly feedbackOperator: Aged<number> | null;
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

/**
 * The real gateway. It knows the event names, the command names and the channel
 * payload, and nothing else: no keyboard vocabulary, no drawing.
 *
 * Nothing emits these events yet — the port owner and the audio bridge are their
 * own tickets — so on the laptop every slot stays invalidated, which is the state
 * this screen is specified to open in.
 */
@Injectable()
export class TauriBackendGateway implements BackendGateway {
  private readonly destroyRef = inject(DestroyRef);

  readonly connection = signal<ConnectionView>({
    port: 'disconnected',
    portName: null,
    audioDevice: null,
    sampleRate: null,
  });

  readonly patch = signal<PatchHeaderView>({
    performanceName: invalidated<string>(),
    previousPerformanceName: null,
    algorithm: invalidated<number>(),
    feedback: invalidated<number>(),
    feedbackOperator: invalidated<number>(),
  });

  readonly reread = signal<RereadProgress | null>(null);

  readonly operators = signal<OperatorsView>(noOperators());

  readonly liveNotes = signal(0);

  readonly lowestLivePitch = signal<number | null>(null);

  readonly dump = signal<DumpView | null>(null);

  constructor() {
    this.listenInto('modx://connection', this.connection);
    this.listenInto('modx://reread', this.reread);
    this.listenInto('modx://dump', this.dump);

    // The three the anillo ancho feeds. Each arrives with ages rather than
    // timestamps and is aligned to this side's clock on arrival.
    this.listen<PatchWire>('modx://patch', (wire) => this.patch.set(this.toPatch(wire)));
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

  private toPatch(wire: PatchWire): PatchHeaderView {
    const arrivedAt = performance.now();
    return {
      performanceName: polled(wire.performanceName, arrivedAt),
      previousPerformanceName: wire.previousPerformanceName,
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

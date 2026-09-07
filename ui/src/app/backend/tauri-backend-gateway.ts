import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Channel, invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  AppInfo,
  BackendGateway,
  ConnectionView,
  DumpView,
  PanicOutcome,
  PatchHeaderView,
  RereadProgress,
  invalidated,
} from './backend-gateway';

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

  readonly liveNotes = signal(0);

  readonly dump = signal<DumpView | null>(null);

  constructor() {
    this.listenInto('modx://connection', this.connection);
    this.listenInto('modx://patch', this.patch);
    this.listenInto('modx://reread', this.reread);
    this.listenInto('modx://live-notes', this.liveNotes);
    this.listenInto('modx://dump', this.dump);

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

  private listenInto<T>(event: string, target: { set(value: T): void }): void {
    const unlisten = listen<T>(event, ({ payload }) => target.set(payload));
    this.destroyRef.onDestroy(() => void unlisten.then((stop) => stop()));
  }
}

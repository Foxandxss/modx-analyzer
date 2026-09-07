import { Injectable, signal } from '@angular/core';
import {
  AppInfo,
  BackendGateway,
  ConnectionView,
  PanicOutcome,
  PatchHeaderView,
  RereadProgress,
  invalidated,
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

  appInfoResult: AppInfo = { version: '0.0.0-fake', dumpsFolder: '' };

  /** What the next pánico answers, or a rejection when the port is gone for good. */
  panicResult: () => Promise<PanicOutcome> = () =>
    Promise.resolve({ silenced: this.liveNotes(), reopened: false });

  /** How many times the pánico has been pressed. A second press is a bug, not a habit. */
  panicPresses = 0;

  private readonly blockListeners = new Set<(block: ArrayBuffer) => void>();

  appInfo(): Promise<AppInfo> {
    return Promise.resolve(this.appInfoResult);
  }

  panic(): Promise<PanicOutcome> {
    this.panicPresses += 1;
    const outcome = this.panicResult();
    this.liveNotes.set(0);
    return outcome;
  }

  subscribeBlocks(onBlock: (block: ArrayBuffer) => void): Promise<() => void> {
    this.blockListeners.add(onBlock);
    return Promise.resolve(() => this.blockListeners.delete(onBlock));
  }

  /** Test driver: hand every subscriber a bloque as if it came off the device. */
  emitBlock(block: ArrayBuffer): void {
    for (const listener of this.blockListeners) {
      listener(block);
    }
  }
}

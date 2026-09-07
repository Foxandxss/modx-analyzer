import { Injectable, signal } from '@angular/core';
import { CHANNELS } from 'modx-dsp';
import { HEADER_BYTES } from '../audio/bridge';
import {
  AppInfo,
  BackendGateway,
  ConnectionView,
  DumpView,
  OperatorsView,
  PanicOutcome,
  PatchHeaderView,
  RereadProgress,
  Topology,
  invalidated,
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
    portName: null,
    audioDevice: null,
    sampleRate: null,
  });

  readonly patch = signal<PatchHeaderView>(noPatch());

  readonly reread = signal<RereadProgress | null>(null);

  readonly operators = signal<OperatorsView>(noOperators());

  /** No algorithm read, so no drawing: the same silence the real one opens in. */
  readonly topology = signal<Topology | null>(null, { equal: sameTopology });

  readonly liveNotes = signal(0);

  readonly lowestLivePitch = signal<number | null>(null);

  /** No volcado yet: the launch the app opens in, before the keyboard answered. */
  readonly dump = signal<DumpView | null>(null);

  appInfoResult: AppInfo = { version: '0.0.0-fake', dumpsFolder: '' };

  /** What the next pánico answers, or a rejection when the port is gone for good. */
  panicResult: () => Promise<PanicOutcome> = () =>
    Promise.resolve({ silenced: this.liveNotes(), reopened: false });

  /** How many times the pánico has been pressed. A second press is a bug, not a habit. */
  panicPresses = 0;

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
    return outcome;
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

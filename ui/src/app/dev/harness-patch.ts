import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import {
  FrequencyMode,
  OperatorRole,
  OperatorView,
  PolledValue,
  Topology,
  invalidated,
} from '../backend/backend-gateway';
import { FakeBackendGateway } from '../backend/fake-backend-gateway';
import { harnessTopology } from './algorithm-table';

/** The eight, always. */
const OPERATORS = 8;

/**
 * How long the harness says its pass took, and how often it takes one.
 *
 * **This is the load-bearing number in the file.** `CADUCO` is four passes with a
 * floor of 400 ms (`freshness.ts`), so a bench that set the eight nodes once and
 * stopped would draw the app's *stale* ink half a second later — every figure in
 * alert, which is not the drawing anybody wants to look at. The real ring emits a
 * dozen times a second and every figure carries the moment it was read; so does
 * this, at the 98 ms the running build measures (`ALL EIGHT · 10.2 Hz`).
 */
export const HARNESS_PASS_MS = 98;

/**
 * The patch the bench opens on: the running build's own eight Levels, the ones
 * quoted in `operator-diagram.ts` — `90 · 90 · 71 · 90 · 90 · 85 · 90 · 99`.
 *
 * A real reading and not a spread, because the datum's whole argument is that
 * real patches cluster near the top: a bench that opened on eight Levels 12
 * points apart would make the drawing look easier to read than it is.
 */
export const HARNESS_LEVELS: readonly number[] = [90, 90, 71, 90, 90, 85, 90, 99];

/** `Init Normal (FM-X)`: algorithm 2, and what the fake keyboard loads. */
export const HARNESS_ALGORITHM = 2;

/**
 * The ratio and the form each node draws, per operator and fixed.
 *
 * They are not settable and they are not a patch anybody measured: what needs a
 * hand on it is the Level, because that is what this round's decisions are about.
 * These exist so the node holds its **five facts** rather than three — a node
 * drawing two dashes is not the card any of the looks are about — and they are
 * eight different values so that a node which stopped drawing its own is
 * visible.
 */
const RATIOS: readonly number[] = [1, 2, 0.5, 3, 1.41, 4, 7, 0.25];
const FORMS: readonly string[] = [
  'Sine',
  'All 1',
  'Odd 1',
  'Res 1',
  'Sine',
  'All 2',
  'Odd 2',
  'Res 2',
];

/**
 * How often the ancla beats, in passes of the ring, and what a pass of it costs.
 *
 * The ancla owns its own cadence (ADR-0004) and it is «at the usual second», so
 * the bench beats once a second rather than once per pass: ten of these at 98 ms.
 * 40 ms is fase 0c's idle pass. Nothing on this screen needs a beat with no audio
 * to vouch for — it is here so the ancla is not the one thing on the bench that
 * is visibly dead.
 */
const BEAT_EVERY_PASSES = 10;
const IDLE_BEAT_MS = 40;

/** C4, so every node has a `PREDICTED` Hz: no note, no number, and a dash. */
export const HARNESS_PITCH = 60;

/**
 * The patch the bench is holding, and the loop that keeps saying so.
 *
 * It drives {@link FakeBackendGateway} exactly the way the native side drives the
 * real one — same events, same cadence, same ages — so what ends up on screen is
 * the app's own ink and not a special rendering path. Everything the round has to
 * look at (#88) is reachable from here with no MODX and no Rust side: the
 * algorithm, the eight Levels, the held note, the ancla, and the fold switch.
 *
 * What it deliberately does **not** drive: audio. There are no bloques, so the
 * Vistas vivas stay in their empty look and there is no Medida — a measurement is
 * a reading of a real instrument and the bench has none. The looks this bench
 * exists for are all about the drawing.
 */
@Injectable()
export class HarnessPatch {
  private readonly gateway = inject(FakeBackendGateway);

  /** 1-88, or anything else, which is how `ALGORITHM n · NO TABLE` gets on screen. */
  readonly algorithm = signal(HARNESS_ALGORITHM);

  /** The eight Levels, 0-99, in operator order. A 0 parks its operator. */
  readonly levels = signal<readonly number[]>(HARNESS_LEVELS);

  /** The name the ancla reads. The bench beats every pass and always finds it. */
  readonly performanceName = signal('Init Normal (FM-X)');

  /** The lowest note being held, or `null` for nothing sounding. */
  readonly pitch = signal<number | null>(HARNESS_PITCH);

  /**
   * Whether the drawing may fold (`folding.ts`). Off is what #81's floor is
   * measured against, which is the reason this switch exists at all.
   */
  readonly folding = signal(true);

  private passes = 0;

  constructor() {
    // The port and the device are open: with them shut the app draws its unhappy
    // cards, and two cards over the top of the drawing is not the screen the
    // looks are about.
    this.gateway.portFound();
    this.gateway.audioOpen();
    this.pass();
    const ring = setInterval(() => this.pass(), HARNESS_PASS_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(ring));
  }

  /**
   * One pass of the anillo ancho, as the bench tells it: every figure re-read
   * now, the topology the number picks, and the ancla having found the same name.
   */
  pass(): void {
    const now = performance.now();
    const topology = harnessTopology(this.algorithm());
    this.passes += 1;

    this.gateway.patch.set({
      performanceName: polled(this.performanceName(), now),
      previousPerformanceName: null,
      // A launch is not a change, and the bench never loads a second
      // Performance: the invalidation flash is not one of the round's looks.
      changes: 0,
      algorithm: polled(this.algorithm(), now),
      // `FB 3`, and fixed: the loop's own ink is not one of this round's looks,
      // and 0 would draw the inert dashed arc of #57 rather than a live one.
      feedback: polled(3, now),
      feedbackOperator: polled(topology?.feedback.into ?? 1, now),
    });
    this.gateway.topology.set(topology);
    this.gateway.operators.set({
      operators: this.levels().map((level, index) => this.node(index + 1, level, topology, now)),
      passMs: HARNESS_PASS_MS,
      passes: this.passes,
    });

    const pitch = this.pitch();
    this.gateway.lowestLivePitch.set(pitch);
    this.gateway.liveNotes.set(pitch === null ? 0 : 1);

    if (this.passes % BEAT_EVERY_PASSES === 1) {
      // `first` for the opening one and `same` after it: the first whole name of
      // a session is not a change and cannot vouch for anything either, and the
      // bench never loads a second Performance, so every beat after it finds the
      // same name.
      this.gateway.anchorBeat({
        startedAt: now - IDLE_BEAT_MS,
        endedAt: now,
        answer: this.passes === 1 ? 'first' : 'same',
        name: this.performanceName(),
      });
    }
  }

  /** Set one operator's Level, leaving the other seven where they are. */
  setLevel(operator: number, level: number): void {
    this.levels.update((levels) =>
      levels.map((held, index) => (index === operator - 1 ? clampLevel(level) : held)),
    );
    this.pass();
  }

  /** Every operator at the same Level: how a patch at the ceiling is set in one go. */
  setEveryLevel(level: number): void {
    this.levels.set(Array.from({ length: OPERATORS }, () => clampLevel(level)));
    this.pass();
  }

  private node(
    operator: number,
    level: number,
    topology: Topology | null,
    now: number,
  ): OperatorView {
    const drawn = role(operator, level, topology);
    return {
      operator,
      // No algorithm is no role, and a polled `null` would be the bench
      // claiming it read one: the dash comes from the same invalidated shape
      // the real gateway uses.
      role: drawn === null ? invalidated<OperatorRole>() : polled(drawn, now),
      level: polled(level, now),
      ratio: polled(RATIOS[operator - 1], now),
      frequencyMode: polled<FrequencyMode>('ratio', now),
      spectralForm: polled(FORMS[operator - 1], now),
    };
  }
}

/** A figure the bench has just said, stamped `SONDEADO` on this side's clock. */
function polled<T>(value: T, now: number): PolledValue<T> {
  return { value, provenance: 'polled', readAt: now };
}

function clampLevel(level: number): number {
  return Math.max(0, Math.min(99, Math.round(level)));
}

/**
 * What an operator is doing, the way `algorithms.rs`'s `role()` decides it: the
 * topology says carrier or modulator, and Level 0 overrides both wherever the
 * algorithm put it (`CONTEXT.md`).
 *
 * **The one rule this file restates**, because the role crosses the wire already
 * decided and no keyboard is answering. It is three lines and it reads the
 * generated table rather than a second transcription of the chart, so what it can
 * get wrong is the override and not the drawing.
 */
function role(operator: number, level: number, topology: Topology | null): OperatorRole | null {
  if (topology === null) {
    // No algorithm, no role, and never a guess: the app's own rule.
    return null;
  }
  if (level === 0) {
    return 'inert';
  }
  return topology.carriers.includes(operator) ? 'carrier' : 'modulator';
}

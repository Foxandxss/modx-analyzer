import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { BACKEND_GATEWAY } from '../backend/backend-gateway';
import { Clock } from './clock';

/**
 * How long the header flashes after the Performance changed underneath.
 * `--anchor-flash` in `design-tokens.css`, and the same 2 200 ms the tutor's
 * write uses; it is here in TypeScript because CSS cannot decide a state and the
 * two must not drift.
 */
export const ANCHOR_FLASH_MS = 2200;

/**
 * The one place that knows the sound was changed underneath, and when.
 *
 * It watches a **counter** and not a name: two different Performances can share
 * the name of their Part 1 — the ancla's one hole, documented rather than hidden
 * — and the previous name stays on screen for the rest of the session, so
 * neither of them can say that a change just happened. The counter can.
 *
 * Nothing here invalidates anything. `INVALIDADO` is decided where the figures
 * live: the anillo ancho empties itself in Rust and the figures arrive already
 * without their numbers. What this decides is the two things that are about
 * *time since* the change — the 2 200 ms flash, and whether this sound has been
 * measured yet — and for those it reads the same {@link Clock} `CADUCO` does,
 * because a state that ends because nothing arrived needs something to tick.
 */
@Injectable({ providedIn: 'root' })
export class Anchor {
  private readonly backend = inject(BACKEND_GATEWAY);
  private readonly clock = inject(Clock);

  /** When the Performance last changed underneath, on this side's clock. */
  private readonly at = signal<number | null>(null);

  private seen = 0;

  constructor() {
    effect(() => {
      const changes = this.backend.patch().changes;
      if (changes !== this.seen) {
        this.seen = changes;
        // Zero is the launch: the ancla read a name for the first time, which
        // invalidates nothing because nothing came before it.
        this.at.set(changes === 0 ? null : performance.now());
      }
    });
  }

  /** How many times the Performance has changed since launch. */
  readonly changes = computed(() => this.backend.patch().changes);

  /** Whether it has ever changed. The header does not go back to rest after one. */
  readonly everChanged = computed(() => this.changes() > 0);

  /** When it last changed, or `null` when it never has. */
  readonly changedAt = this.at.asReadonly();

  /**
   * The 2 200 ms after a change: what the header flashes for and what puts the
   * chip on the vista viva. It ends on its own, off the clock, because nothing
   * is going to arrive to end it.
   */
  readonly justChanged = computed(() => {
    const at = this.at();
    return at !== null && this.clock.now() - at < ANCHOR_FLASH_MS;
  });

  /** The name that was loaded before, drawn struck through beside the new one. */
  readonly previousName = computed(() => this.backend.patch().previousPerformanceName);
}

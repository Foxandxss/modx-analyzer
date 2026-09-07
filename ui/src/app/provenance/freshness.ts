import { Injectable, Signal, computed, inject } from '@angular/core';
import { BACKEND_GATEWAY, PolledValue } from '../backend/backend-gateway';
import { Clock } from './clock';

/**
 * `CADUCO` is four periods of **its own** ring. `--stale-factor` in
 * `design-tokens.css`; it is here in TypeScript because CSS cannot decide a
 * stamp, and the two must not drift.
 */
export const STALE_FACTOR = 4;

/**
 * And the floor it never goes below: `--stale-wide-s` (0.33 s), which is four
 * periods of the anillo ancho at the 12.2 Hz it was documented at.
 *
 * The floor exists so that the threshold cannot collapse on a freakishly fast
 * pass and light the whole diagram in alert; the multiplier exists so that
 * playing — which takes a pass from ~84 ms to ~430 ms — does not light it either.
 * Between them, `CADUCO` means what it says: nobody has read this in a while.
 */
export const STALE_WIDE_FLOOR_MS = 330;

/** The threshold that follows the ring, given how long its last pass took. */
export function staleAfterMs(passMs: number | null): number {
  return Math.max(STALE_FACTOR * (passMs ?? 0), STALE_WIDE_FLOOR_MS);
}

/**
 * The one place that decides whether a polled figure has gone `CADUCO`.
 *
 * It follows the anillo ancho's own cadence, which is the whole point: the same
 * 42 addresses take ~84 ms in silence and ~430 ms while somebody plays, so a
 * fixed threshold in seconds would stamp the diagram stale exactly when the owner
 * is playing it. Nothing here invalidates anything — `INVALIDADO` belongs to the
 * ancla and is a statement about which patch a number came from, not about age.
 */
@Injectable({ providedIn: 'root' })
export class RingFreshness {
  private readonly backend = inject(BACKEND_GATEWAY);
  private readonly clock = inject(Clock);

  /** How long the ring's last completed pass took, or `null` before the first. */
  readonly passMs: Signal<number | null> = computed(() => this.backend.operators().passMs);

  /** The live cadence the zone header says out loud, or `null` before the first pass. */
  readonly cadenceHz = computed(() => {
    const pass = this.passMs();
    return pass === null || pass <= 0 ? null : Math.round((1000 / pass) * 10) / 10;
  });

  readonly staleAfterMs = computed(() => staleAfterMs(this.passMs()));

  /**
   * The same figure, with `CADUCO` on it when it is older than the threshold.
   * Anything that is not `SONDEADO` comes back untouched: a measured or an
   * invalidated figure does not age into this one.
   */
  stamp<T>(value: PolledValue<T>): PolledValue<T> {
    if (value.provenance !== 'polled' || value.readAt === null) {
      return value;
    }
    const age = this.clock.now() - value.readAt;
    return age > this.staleAfterMs() ? { ...value, provenance: 'stale' } : value;
  }
}

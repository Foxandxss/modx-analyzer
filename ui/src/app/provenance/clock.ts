import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * How often the clock moves. `CADUCO` is hundreds of milliseconds away, so ten
 * ticks a second is far finer than the thing it decides and far cheaper than the
 * 30 fps the signal views run at.
 */
export const CLOCK_TICK_MS = 100;

/**
 * The passing of time, as a signal.
 *
 * A figure going `CADUCO` is the one change on this screen that happens because
 * *nothing* arrived: if the keyboard stops answering, no event will ever come to
 * redraw the diagram, and a diagram that keeps drawing yesterday's numbers with
 * today's stamp is the exact failure this app exists to avoid. So something has
 * to tick.
 *
 * A test sets `now` by hand; the interval it also has running cannot get in the
 * way, because a test asserts long before the next tick.
 */
@Injectable({ providedIn: 'root' })
export class Clock {
  readonly now = signal(performance.now());

  constructor() {
    const tick = setInterval(() => this.now.set(performance.now()), CLOCK_TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }
}

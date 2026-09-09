import { stamp } from './bridge';

/**
 * How late the main thread's own timer is, which is the same question as how
 * long the main thread was busy doing something else.
 *
 * **Why this exists.** #23's split says the whole of the bridge's lateness sits
 * in one leg — the crossing from Rust to the main thread — while the queue
 * before it and the worker after it stay at zero. But that leg is two things at
 * once: Tauri's transport, and the main thread getting round to the callback.
 * A bloque held up in transport and a bloque waiting on a busy thread are the
 * same 200 ms, and they have completely different fixes.
 *
 * So this measures the main thread on its own, with nothing to do with the
 * audio: a timer that asks to be woken every {@link PERIOD} ms and records how
 * much later than that it actually ran. If the worst here matches the worst
 * delivery, the thread was blocked and the bridge is a bystander. If it does
 * not, the time is going into the IPC itself.
 *
 * It measures the thread it runs on by occupying it, which is the only way this
 * can be done from inside — the cost is one wake-up every 25 ms doing two
 * subtractions, against a budget of 33 ms per trama.
 */

/**
 * How often it asks to be woken: finer than a bloque, so a stall of one bloque
 * cannot slip between two wake-ups, and coarse enough to cost nothing.
 */
const PERIOD = 25;

export class LoopLag {
  private worstMs = 0;
  private worstAtMs = 0;
  private expected = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  /**
   * The worst lateness seen, in ms.
   *
   * It never resets. A stall that happened once is the fact being hunted, and a
   * figure that decayed back to zero would erase it a second later — the same
   * mistake #23 is about, where the burst fell out of the percentile window and
   * the screen then claimed a pass.
   */
  get worst(): number {
    return this.worstMs;
  }

  /**
   * When the worst was seen, on the clock `start` was given.
   *
   * Without it the figure cannot be put beside anything: a 200 ms stall at the
   * same second as a 200 ms delivery is one event with two witnesses, and the
   * same two numbers a minute apart are two unrelated facts.
   */
  get worstAt(): number {
    return this.worstAtMs;
  }

  /**
   * `now` is injectable so a test can drive the clock; it defaults to the one
   * clock this is about.
   */
  start(now: () => number = stamp): void {
    if (this.timer !== null) {
      return;
    }
    this.expected = now() + PERIOD;
    const tick = () => {
      const at = now();
      // Timers are allowed to be a few ms late for reasons that are not a stall
      // — the clamping every browser does — so the baseline here is small and
      // never zero. What is being looked for is three orders of magnitude up.
      const late = at - this.expected;
      if (late > this.worstMs) {
        this.worstMs = late;
        this.worstAtMs = at;
      }
      this.expected = at + PERIOD;
      this.timer = setTimeout(tick, PERIOD);
    };
    this.timer = setTimeout(tick, PERIOD);
  }

  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

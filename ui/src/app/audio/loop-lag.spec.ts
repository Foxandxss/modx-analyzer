import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoopLag } from './loop-lag';

/**
 * The clock and the timers are both driven by hand here, because the thing being
 * measured is the difference between them: a test that used the real ones would
 * be asserting on how busy the machine running it happened to be.
 */
describe('LoopLag', () => {
  let clock = 0;
  const now = () => clock;

  beforeEach(() => {
    clock = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Let `ms` pass with the clock and the timers moving **together**, one
   * millisecond at a time. Advancing the clock in one jump and then running the
   * timers would report the jump itself as lateness, which is the stall this is
   * supposed to be able to tell apart from an idle thread.
   */
  function idle(ms: number): void {
    for (let step = 0; step < ms; step += 1) {
      clock += 1;
      vi.advanceTimersByTime(1);
    }
  }

  it('claims nothing before it has been woken', () => {
    const lag = new LoopLag();
    lag.start(now);

    expect(lag.worst).toBe(0);
    lag.stop();
  });

  it('stays near zero while the thread is answering its timer', () => {
    const lag = new LoopLag();
    lag.start(now);

    idle(500);

    expect(lag.worst).toBeLessThan(2);
    lag.stop();
  });

  /**
   * The measurement #23 needs: the thread went away for 230 ms, so the wake-up
   * that should have come 25 ms in came 230 ms in instead. That is the shape of a
   * stall, and it is what tells a blocked thread from a slow IPC.
   */
  it('reports how long the thread was away from its own timer', () => {
    const lag = new LoopLag();
    lag.start(now);

    // The thread is busy for 230 ms: the clock moves, and the timer that was due
    // at 25 ms only gets to run at the end of it.
    clock += 230;
    vi.advanceTimersByTime(230);

    expect(lag.worst).toBeCloseTo(205, 0);
    lag.stop();
  });

  /**
   * It never resets, which is the whole point: a stall that happened once is the
   * fact being hunted, and a figure that decayed would erase it a second later —
   * the same way #23's burst fell out of the percentile window and let the screen
   * claim a pass.
   */
  it('keeps the worst it ever saw', () => {
    const lag = new LoopLag();
    lag.start(now);

    clock += 230;
    vi.advanceTimersByTime(230);
    idle(1000);

    expect(lag.worst).toBeCloseTo(205, 0);
    lag.stop();
  });

  it('stops asking to be woken once it is stopped', () => {
    const lag = new LoopLag();
    lag.start(now);
    lag.stop();

    clock += 500;
    vi.advanceTimersByTime(500);

    expect(lag.worst).toBe(0);
  });
});

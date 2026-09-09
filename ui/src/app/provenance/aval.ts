import { AnchorBeat } from '../backend/backend-gateway';

/**
 * The span of wall clock one capture's window covers, on `performance.now()`'s
 * clock — the same clock {@link AnchorBeat} is stamped on.
 *
 * It is a span and not an instant because the shutter looks backwards: the
 * samples are already in the ring when the button is pressed, so `to` is the
 * press and `from` is `MEASURE_WINDOW_MS` earlier.
 */
export interface CaptureWindow {
  /** When the window's first sample entered. */
  readonly from: number;
  /** When its last sample entered, which is the press itself. */
  readonly to: number;
}

/**
 * What the ancla has to say about a window of audio.
 *
 * `pending` is not a third outcome, it is the absence of one: no beat has spoken
 * for the window yet, so there is nothing to draw and nothing to throw away.
 */
export type Aval = 'vouched' | 'discarded' | 'pending';

/**
 * ADR-0005's rule, applied to a window of audio instead of to one polled figure.
 *
 * A polled figure is read at an instant and one beat started after it can speak
 * for it. A medida's window is 1.486 s **wide** and the ancla takes up to a
 * second to see a change, so a single beat cannot: a Performance changed in the
 * second before the press yields a window of the old sound that every beat after
 * it would happily call current. Both ends have to be spoken for.
 *
 * - The beat that **started after the window's last sample** must answer `same`.
 *   `changed` throws the window away; `first` cannot vouch for anything, because
 *   it has no previous name to have found unchanged.
 * - The **last beat that closed before the window's first sample** must have read
 *   that same name. Without it the app was not looking when the window began and
 *   has nothing to say about what was sounding then, which is a refusal and not a
 *   pass.
 *
 * An `incomplete` pass is skipped at both ends: a hole in the name is compared
 * with nothing at all, so it neither confirms nor denies, and the answer waits
 * for the next whole one.
 *
 * @param beats The ancla's history, oldest first, as the gateway keeps it.
 */
export function aval(beats: readonly AnchorBeat[], window: CaptureWindow): Aval {
  const after = beats.find((beat) => beat.startedAt > window.to && beat.answer !== 'incomplete');
  if (after === undefined) {
    return 'pending';
  }
  if (after.answer !== 'same') {
    return 'discarded';
  }
  const before = beats.filter((beat) => beat.endedAt < window.from && beat.name !== null).at(-1);
  if (before === undefined) {
    return 'discarded';
  }
  return before.name === after.name ? 'vouched' : 'discarded';
}

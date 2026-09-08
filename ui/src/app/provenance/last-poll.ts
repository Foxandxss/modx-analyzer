import { OperatorsView, PatchHeaderView, PolledValue } from '../backend/backend-gateway';

/**
 * When the keyboard last answered **anything**, on this side's clock.
 *
 * It is what the «teclado no conectado» card counts up from: `ÚLTIMO SONDEO N s`
 * is not a figure the native side sends, because while the port is gone nothing
 * is sent at all — an age emitted once would freeze on screen at the moment it
 * left. Every polled figure already carries the instant it was read, so the
 * newest of them is the answer, and it goes on ageing off the {@link Clock}
 * exactly the way `CADUCO` does.
 *
 * `null` has one meaning and it is not zero: nothing has ever been read. That is
 * the launch with no keyboard, and it is also every figure right after an ancla
 * change, when they are `INVALIDADO` and carry no stamp at all.
 */
export function lastPollAt(patch: PatchHeaderView, operators: OperatorsView): number | null {
  const figures: PolledValue<unknown>[] = [
    patch.performanceName,
    patch.algorithm,
    patch.feedback,
    patch.feedbackOperator,
    ...operators.operators.flatMap((node) => [
      node.role,
      node.level,
      node.ratio,
      node.frequencyMode,
      node.spectralForm,
    ]),
  ];

  let newest: number | null = null;
  for (const figure of figures) {
    if (figure.readAt !== null && (newest === null || figure.readAt > newest)) {
      newest = figure.readAt;
    }
  }
  return newest;
}

/**
 * How long ago that was, in seconds, never negative.
 *
 * `readAt` is an age from the wire aligned onto this side's clock, so it can land
 * a few milliseconds **ahead** of `now` — which put `ÚLTIMO SONDEO -0.1 s` on
 * screen during the 2026-09-08 keyboard session (#18). A negative age is not a
 * smaller truth than zero, it is a keyboard that answered in the future, so the
 * clamp lives here rather than in each of the two places that print it.
 */
export function pollAgeSeconds(at: number, now: number): number {
  return Math.max(0, (now - at) / 1000);
}

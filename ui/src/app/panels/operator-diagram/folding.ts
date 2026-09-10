import { InjectionToken, Signal, signal } from '@angular/core';

/**
 * Whether the drawing may fold its facts.
 *
 * **It exists because a measurement needs it, not because a user wants it.** The
 * body's floor is measured on the *unfolded* drawing at the deepest algorithm
 * (#81), and taking that reading against a drawing that has already folded is
 * how the floor and the fold threshold chase each other down with no stopping
 * point. So the fold has to be switchable off from outside the drawing, and the
 * only thing that ever switches it is the dev bench (#79).
 *
 * A token and not an input: nothing on screen offers this, no state of the app
 * reaches it, and the app the laptop runs never sees it off — the default here is
 * on, and `app.config.ts` overrides nothing. `harness.config.ts` is the one
 * place that binds it to something a hand can move.
 *
 * **What honours it today.** Folding does not exist yet — it lands in #82 — so
 * the only thing the drawing can honour is saying which way the switch is set:
 * `data-folding="off"` on the diagram, absent when folding is on. #82 reads this
 * same signal for the geometry rather than adding a second one, which is the
 * whole reason the switch lands before the fold does.
 */
export const FOLDING = new InjectionToken<Signal<boolean>>('Folding', {
  providedIn: 'root',
  factory: () => signal(true).asReadonly(),
});

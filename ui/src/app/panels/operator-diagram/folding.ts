import { InjectionToken, Signal, signal } from '@angular/core';
import { ColumnShape } from '../glass-column/column-geometry';
import { FoldRule } from './layout';
import { canvasWidth, fittedCardWidth, floorCanvasHeight } from './node-geometry';
import { WIDE_CANVAS_H, WIDE_CANVAS_W } from './wide-layout';

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
 * **What honours it.** `OperatorDiagram` reads it and hands the wide layout
 * either {@link foldRule} or {@link NEVER_FOLDS}; the drawing says which way the
 * switch is set on its host, `data-folding="off"`, absent when folding is on.
 * One signal for the geometry and the marking, which is why the switch landed a
 * commit before the fold did.
 */
export const FOLDING = new InjectionToken<Signal<boolean>>('Folding', {
  providedIn: 'root',
  factory: () => signal(true).asReadonly(),
});

/**
 * The `<marker>`'s extent along a route, in the `viewBox` units it is drawn in.
 *
 * `operator-diagram.html` declares `markerWidth/markerHeight = 9` in
 * `userSpaceOnUse`, so an arrowhead on a vertical route occupies nine of this
 * canvas's own units however the panel stretches it. Not a measurement and not a
 * judgement: it is that declaration, read.
 */
export const ARROWHEAD = 9;

/**
 * How much of a route has to be *line* rather than arrowhead, in CSS pixels.
 *
 * **Chosen, not derived and not judged** — it is the round's own figure for what
 * makes a gap a line rather than a stub under a point, and it is look 4 of the
 * verification list (#88). It is the one input to the depth threshold that
 * nobody has earned, and it is written here alone so that the look, when it is
 * taken, moves one number.
 */
export const VISIBLE_SEGMENT = 6;

/*
 * One fold, two triggers — and the conditions themselves are one line, in
 * `wideLayout()`.
 *
 * ## What folding is
 *
 * A drawing that cannot hold its facts **folds its facts and never its
 * positions**. Depth is height: the deepest operators keep their row, their
 * order and their place above what they modulate, and give up the ratio, the
 * glyph, the Hz and the per-figure detail to one band carrying identity and
 * Level. Nothing moves; three figures stop being drawn.
 *
 * ## The two triggers, and why they are one mechanism
 *
 * - **Too deep for its rows.** A gap has to hold its arrowhead plus a visible
 *   segment ({@link rowGapFloor}). Below that the row pitch cannot be floored
 *   without eating the card, so the card gives the gap the height it stops
 *   needing.
 * - **Too narrow for its five facts.** The card is narrower than the width at
 *   which those same five facts are known to fit ({@link fittedCardWidth}).
 *
 * They are one mechanism because they are one sentence — *this drawing cannot
 * hold what it is being asked to draw* — and because what they do about it is
 * identical. Two mechanisms would be two things to learn, two things to switch
 * off, and two bands that could drift apart in what they keep.
 *
 * ## What folding does **not** resolve, and this is the half that gets forgotten
 *
 * The composición's width has two floors under it and only one of them is a fold
 * condition. The fitted-width arm is about whether the five facts *fit*, and
 * folding resolves it by construction: fold, and there are three fewer facts to
 * fit. The readability arm — one Level point never drawn smaller than a pixel on
 * the axis that carries it — is **not resolved by folding at all**, because
 * folding the facts does not widen the card by one pixel. It is a hard floor on
 * the window, enforced by a minimum and the body scrolling under it — `laneFloor()`
 * in `node-geometry.ts`, bound onto the body's grid by `app.ts` (#86) — and not
 * this module's. A reader who folds the facts and assumes the floor went away
 * has traded a measurement for a picture of one.
 */

/**
 * The gap the drawing has to keep, in `viewBox` units.
 *
 * The criterion is in pixels and the drawing is in units the panel stretches, so
 * the conversion is the canvas's own y-scale — and it is taken **at the body's
 * floor**, which is what stops the threshold spiralling. The floor is the
 * smallest canvas the app ever draws (`column-geometry.ts`: under it the body
 * scrolls), so a gap that clears the criterion there clears it at every window
 * the app can be given. Evaluated at the *actual* height instead, a taller
 * window would unfold algorithm 37 and a drag would fold it again — the drawing
 * changing its facts with the height, which is a second thing to learn and one
 * nobody asked for. The width trigger does move with the window, and the
 * asymmetry is deliberate: there, the card really is narrower.
 *
 * ```text
 * gap ≥ ARROWHEAD + VISIBLE_SEGMENT / yScale
 * ```
 *
 * **17.51 units**, against a `ROW_GAP_MAX` of 26 — so the floor never fights the
 * cap, and the drawing that folds is the drawing whose natural gap has fallen
 * under it. Its inputs, exhaustively, because two of them turned up unnamed in
 * one session: {@link ARROWHEAD}, {@link VISIBLE_SEGMENT}, `WIDE_CANVAS_H`, and
 * every term of `floorCanvasHeight()` — `BODY_FLOOR` (which is itself
 * `VIEWS_FLOOR`, `NODES_FLOOR` and **`LEGEND_H`**), the zone's padding, the head
 * band, the canvas's margins and `LEGEND_H` again, subtracted.
 */
export function rowGapFloor(): number {
  return ARROWHEAD + VISIBLE_SEGMENT / (floorCanvasHeight() / WIDE_CANVAS_H);
}

/**
 * The narrowest card that holds five facts, in the wide canvas's own units, at
 * the lane a given column shape claims.
 *
 * The fitted width is a **rendered fact about a drawing that ships**, not a
 * threshold picked to make an algorithm fold: it is the card the narrow 3 × 3
 * grid draws these same five facts in, with the same template and the same type
 * (`node-geometry.ts`). A wide card narrower than that one is a card asking to
 * hold what a card that size is already known to hold, which is the whole of the
 * criterion.
 *
 * It is per shape because the lane is: the rail's 1 016 px and the pinned 1 070
 * put the same card at different pixels, so **156.1 units pinned and 164.7 in
 * the rail**. Algorithm 1 — eight operators on the bus row, so eight columns and
 * a card of 142 units — is under both, which is why the fold arrives at the
 * shipped window rather than being a two-of-88 curiosity, and why more of the
 * table folds as the lane narrows.
 */
export function fittedCard(shape: ColumnShape): number {
  return (fittedCardWidth() / canvasWidth(shape)) * WIDE_CANVAS_W;
}

/** What the drawing has to keep in this shape, or it folds its facts. */
export function foldRule(shape: ColumnShape): FoldRule {
  return { rowGapMin: rowGapFloor(), cardMin: fittedCard(shape) };
}

/**
 * The bench's switch, off: a drawing that is asked to keep nothing never folds.
 *
 * Stated as a rule rather than as a second branch in the layout, so there is one
 * path through `wideLayout()` and the switch cannot grow a drawing of its own —
 * which is exactly what the floor measured in #81 would have been taken against.
 */
export const NEVER_FOLDS: FoldRule = { rowGapMin: 0, cardMin: 0 };

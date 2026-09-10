import { BODY_FLOOR } from '../glass-column/column-geometry';
import { CANVAS_H, NODE_H } from './layout';
import { LEGEND_H } from './legend';
import { WIDE_CANVAS_H, WIDE_ROWS, wideRowPitch } from './wide-layout';

/**
 * The node's interior, in CSS pixels: where the fill's scale ends, and how much
 * room the ceiling datum has to be seen in.
 *
 * ## This module is px and `layout.ts` is not
 *
 * `layout.ts` says in its own header that its numbers are `viewBox` units and
 * that the panel stretches them with `preserveAspectRatio="none"`. Every number
 * here is a CSS pixel and has to stay one. That is the whole point of the
 * daylight being a constant rather than a share: headroom that scaled with card
 * height would give the datum different clearance in every column shape and
 * collapse back toward the border at the composition where the card is smallest
 * — the same defect reappearing at one shape only, which is the hardest kind to
 * find twice. Putting px arithmetic behind an export surface whose stated
 * contract is stretchable units is how a correct-looking edit goes wrong two
 * months from now, so the two live apart.
 *
 * The boundary between them is one line: a card's height on screen is its share
 * of the canvas's own rendered height. `layout.ts` and `wide-layout.ts` own the
 * share; this module owns the pixels.
 *
 * ## Why the fill has a track at all
 *
 * The Level is the height of the fill and the figure under it only confirms what
 * the height already said (`DESIGN.md` §20.2). That claim is untouched here.
 * What changed is an accident underneath it: the fill *was* the card, so a Level
 * of 99 out of 99 left one percent of the card above it, and the patch the app
 * boots into — `Init Normal (FM-X)`, `99 · 14 · 16 · 99 · 99 · 99 · 9 · 53` —
 * put the ceiling datum inside the card's own 2 px border, where there was
 * nothing to see (#67).
 *
 * So the fill keeps its scale and is given a **track**: the card's interior less
 * {@link TRACK_INSET} at the top, and nowhere else. Level is still the height of
 * the fill, still linear, still zero-anchored, still comparable across the eight.
 * What it is no longer is a measurement whose top edge is a border.
 *
 * ## Where the inset comes from
 *
 * The datum is drawn with `border-top` on a zero-height box positioned by
 * `bottom`, so its **bottom edge is the datum** and its ink rises into the space
 * above it: at Level `L` the stroke occupies `[L, L + DATUM_STROKE]`. That is
 * deliberate and not a rounding. At the loudest node the datum and the fill's top
 * are the same height, and drawing the stroke on the empty side is what keeps it
 * from covering the fill it is a statement about — the one node where the reading
 * matters most is the one node a centred stroke would be half-drawn on.
 *
 * The consequence is that at the top of the range the stroke's top overshoots the
 * track, and the inset is what buys room for it:
 *
 * ```text
 * I = d + DATUM_STROKE − 0.01 · T
 * ```
 *
 * `d` is {@link DAYLIGHT_FLOOR}, the dark surface left between the stroke and the
 * card's border. `DATUM_STROKE` is the ink the datum spends above the line it
 * names. `0.01 · T` is what the last percent of the track gives back, `T` being
 * the track's own height.
 *
 * **The track must not clip.** `overflow: visible` on `.node__track` is part of
 * this derivation and not an implementation detail: the stroke is *meant* to rise
 * into the headroom, and a clipping track would cut it off at the track's top
 * exactly as the card's border cut it off before — recreating #67 one box in,
 * with the arithmetic here still reading six pixels. `.node` keeps its own
 * `overflow: hidden`, which is what rounds the fill into the role's radius, and
 * the inset is **top-only**, so the fill's other three edges stay where they were
 * and nothing about its corners changes.
 */

/** `--rule-min`, which is `.node`'s border on all four sides. */
const NODE_BORDER = 2;

/** `.node__datum`'s `border-top`, also `--rule-min`. */
export const DATUM_STROKE = 2;

/**
 * The top of the Level range (`backend-gateway.ts`, `OperatorView.level`).
 *
 * The worst case for the datum, and the reason #67 exists: the higher the
 * ceiling, the more of the stroke has to live above the track.
 */
export const LEVEL_MAX = 99;

/**
 * How much dark surface has to remain between the datum's ink and the card's
 * border, in CSS pixels.
 *
 * ### The verdict
 *
 * **6 px, judged and kept.** Someone looked at it, which is the whole difference
 * between this number and one that is merely true.
 *
 * - **What was on screen.** The wide composition, both ranuras empty so the
 *   156 px strip is up, window restored and dragged down, on a 2× display.
 * - **Which patch, as Levels.** Algorithm 66 with `99 · 0 · 99 · 99 · 0 · 0 · 99
 *   · 99` — a ceiling of 99 with a **lit carrier at the ceiling**, which is the
 *   case worth judging: the datum then lies against `--carrier` at full strength,
 *   the louder of the two lines. A reading with no carrier at the ceiling never
 *   puts it there and cannot answer the question. (Spelled out rather than named:
 *   the instrument still said `Init Normal (FM-X)` because the patch was edited
 *   without renaming, and those Levels are **not** what `theBootPatch` encodes.)
 * - **What was measured**, off the PNG at 1:1 on OP8's card: 4 device px of
 *   border ink, 13 device px of clean `--surface-raised`, 4 device px of datum.
 *   About 6.5 CSS px, which is the derivation.
 * - **How it read.** A rule at a common height, clearly clear of the border, and
 *   not as a rim on the fill — `--carrier-fill` fading to `.04` at its top is
 *   visible in the pixels, the fill entering as a gradient a row below the line.
 *
 * ### Why the judgement is not about the card it was judged on
 *
 * The card measured was about 31 px, taller than {@link worstCardHeight}'s squat
 * card. That does not weaken it. The daylight runs border-to-datum and **both
 * ends are fixed by the inset**: the only card-dependent term in the derivation
 * is `0.01 · T`, worth 0.44 px across the entire range from the squat card to the
 * narrow grid's. Hence the same 13 device px on a carrier card and a modulator
 * card of the same height, and hence the transfer: card height decides how much
 * track the fill gets, not what was looked at. The judgement holds at the squat
 * card without having been taken there.
 *
 * ### Why not 5
 *
 * 5 would probably read, and it would give a pixel of fill back on the squat card
 * where fill height is scarcest, so the trade is real. Rejected on margin: the
 * pixel is invisible in the fill, and the daylight is the only thing between this
 * and the defect the issue is named after, on the composition the app boots into.
 *
 * ### The instrument, since it was thrown away
 *
 * `FakeBackendGateway` subclassed and seeded at the gateway only — connection,
 * ancla, algorithm 66's topology and the eight Levels — provided for
 * `BACKEND_GATEWAY` in `app.config.ts` in place of `TauriBackendGateway`, then
 * `npx ng serve`. Five minutes to rebuild, which is the honest reason it was safe
 * to delete. #72 is the ticket for not rebuilding it a third time.
 */
export const DAYLIGHT_FLOOR = 6;

/**
 * `.node__track`'s top inset, mirrored by `operator-diagram.scss`.
 *
 * The smallest integer that clears {@link DAYLIGHT_FLOOR} at
 * {@link worstCardHeight}, by the derivation in this module's header. It is
 * authored here and asserted by the spec against a card recomputed from the
 * constants, rather than written into the sheet with a comment explaining where
 * it came from: a constant a test merely describes is a constant the test cannot
 * fail on.
 */
export const TRACK_INSET = 8;

/**
 * `.zone`'s own chrome above and below the canvas, in CSS pixels.
 *
 * Mirrored from `operator-diagram.scss` — `padding: 12px 18px 0`, `.zone__head`'s
 * line box at `--text-label` plus its `--space-1` margin, and `.canvas`'s
 * `margin: var(--space-1) 0` on both edges. `legend.ts`'s trade, for its reason:
 * jsdom computes no boxes, so a box that has to be a claim a test can fail on is
 * modelled as arithmetic here and mirrored by the sheet.
 *
 * The head is the one term that cannot be exact — `line-height` is `normal` at
 * `--text-label`, so its box is a font metric. That does not matter, and the
 * amount by which it does not matter is the useful part: daylight moves about
 * 0.0008 px per pixel of canvas height, so being ten pixels wrong here shifts the
 * assertion by under a hundredth of a pixel. What this arithmetic is sensitive to
 * is {@link TRACK_INSET} and the row count, which is where the interesting
 * failures are.
 */
const ZONE_PAD_TOP = 12;
const ZONE_HEAD_BAND = 18;
const CANVAS_MARGIN_Y = 8;

/**
 * The canvas's rendered height when the body is at its floor.
 *
 * The diagram's zone is a whole grid column of the body, so its height *is* the
 * body's, and the body never goes under `BODY_FLOOR`: below that the eight nodes
 * lose the figures inside them and the vistas lose their curve (#19), and what
 * gives way is the scroll rather than the drawing. Out of that the zone spends
 * its chrome and the legend's band, and `.canvas` is `flex: 1` on what is left.
 *
 * Taken from `BODY_FLOOR` and not from its `NODES_FLOOR` term on purpose. The
 * floor is a `Math.max` of two measurements that grew apart when the legend took
 * a second row (#65); if the vistas' half ever wins, the canvas grows with it and
 * this follows, instead of going quietly stale against a term that stopped being
 * the one that decided.
 */
export function floorCanvasHeight(): number {
  return BODY_FLOOR - ZONE_PAD_TOP - ZONE_HEAD_BAND - CANVAS_MARGIN_Y - LEGEND_H;
}

/**
 * The smallest card either composition can put on screen, in CSS pixels.
 *
 * Two candidates, and the wide one wins by a factor of three. The narrow grid's
 * node is a constant share of its canvas (`NODE_H / CANVAS_H`, 23.8 %). The wide
 * composition sizes its node by how deep the algorithm is, and at `WIDE_ROWS` —
 * algorithm 66, the single chain of eight, the deepest of the 88 — the share is
 * 8.25 %. At the floor that is a card of roughly 24 px, and it is the card the
 * inset has to be earned against.
 *
 * Nothing here is hard-coded to 24. If #69 lands and the deepest algorithms fold,
 * or if `BODY_FLOOR` moves again as it did for the legend's second row, this
 * re-derives and the spec's assertion either stays green honestly or goes red. A
 * hard-coded worst case would have quietly become a number about a card the
 * layout no longer draws.
 */
export function worstCardHeight(): number {
  const canvas = floorCanvasHeight();
  const wide = (wideRowPitch(WIDE_ROWS).nodeH / WIDE_CANVAS_H) * canvas;
  const grid = (NODE_H / CANVAS_H) * canvas;
  return Math.min(wide, grid);
}

/** The fill's scale, in CSS pixels: the card's interior, less the headroom. */
export function trackHeight(cardHeight: number): number {
  return cardHeight - 2 * NODE_BORDER - TRACK_INSET;
}

/**
 * The dark surface between the datum's ink and the card's border, at a ceiling
 * that puts the line as high as the range allows.
 *
 * This is the number #67 is about. Before the track it was negative — the stroke
 * sat inside the border and `overflow: hidden` had already taken most of it — and
 * the only check that existed asserted the element was in the DOM, which it was,
 * on a line nobody could see.
 */
export function datumDaylight(cardHeight: number, level: number = LEVEL_MAX): number {
  const track = trackHeight(cardHeight);
  const overshoot = DATUM_STROKE - track * (1 - level / 100);
  return TRACK_INSET - overshoot;
}

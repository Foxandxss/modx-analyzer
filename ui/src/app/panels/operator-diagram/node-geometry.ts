import {
  BODY_FLOOR,
  ColumnShape,
  DESIGN_BODY_W,
  DIAGRAM_W,
  diagramLane,
} from '../glass-column/column-geometry';
import { CANVAS_H, CANVAS_W, LevelAxis, NODE_H, NODE_W } from './layout';
import { LEGEND_H, ZONE_PAD_X } from './legend';
import { COL_GAP, MARGIN_X, WIDE_CANVAS_W, WIDE_COLUMNS } from './wide-layout';

/**
 * The node's interior, in CSS pixels: where the fill's scale ends, and how much
 * room the ceiling datum has to be seen in.
 *
 * ## This module is px and `layout.ts` is not
 *
 * `layout.ts` says in its own header that its numbers are `viewBox` units and
 * that the panel stretches them with `preserveAspectRatio="none"`. Every number
 * here is a CSS pixel and has to stay one. That is the whole point of the
 * daylight being a constant rather than a share: headroom that scaled with the
 * card would give the datum different clearance in every column shape and
 * collapse back toward the border at the composición where the card is smallest
 * — the same defect reappearing at one shape only, which is the hardest kind to
 * find twice. Putting px arithmetic behind an export surface whose stated
 * contract is stretchable units is how a correct-looking edit goes wrong two
 * months from now, so the two live apart.
 *
 * The boundary between them is one line: a card's size on screen is its share of
 * the canvas's own rendered box. `layout.ts` and `wide-layout.ts` own the share;
 * this module owns the pixels.
 *
 * ## Why the fill has a track at all
 *
 * The Level is the length of the fill and the figure under it only confirms what
 * the length already said (`DESIGN.md` §20.2). That claim is untouched here.
 * What changed is an accident underneath it: the fill *was* the card, so a Level
 * of 99 out of 99 left one percent of the card past it, and the patch the app
 * boots into — `Init Normal (FM-X)`, `99 · 14 · 16 · 99 · 99 · 99 · 9 · 53` —
 * put the ceiling datum inside the card's own 2 px border, where there was
 * nothing to see (#67).
 *
 * So the fill keeps its scale and is given a **track**: the card's interior less
 * {@link levelTrackInset} at the far end of the carrying axis, and nowhere else.
 * Level is still the length of the fill, still linear, still zero-anchored,
 * still the same scale on all eight. What it is no longer is a measurement whose
 * far edge is a border.
 *
 * ## Which axis, and why this module never asks the box
 *
 * Round 10 turned Level onto the width in the wide composición and left the
 * narrow grid on the height ({@link LevelAxis}). Every function here therefore
 * takes **the card along the axis that carries Level** and does not care which
 * of the two that is: the arithmetic is identical in both directions, and the
 * one thing that would make it wrong is a caller measuring the other side. That
 * is why the two insets are named per composición at {@link levelTrackInset}
 * rather than computed from whichever number a caller happens to hold.
 *
 * ## Where the inset comes from
 *
 * The datum is drawn with a border on a zero-thickness box positioned along the
 * axis, so its **near edge is the datum** and its ink extends past it into the
 * empty side: at Level `L` the stroke occupies `[L, L + DATUM_STROKE]`. That is
 * deliberate and not a rounding. At the loudest node the datum and the fill's
 * far end are the same place, and drawing the stroke on the empty side is what
 * keeps it from covering the fill it is a statement about — the one node where
 * the reading matters most is the one node a centred stroke would be half-drawn
 * on.
 *
 * The consequence is that at the top of the range the stroke overshoots the
 * track, and the inset is what buys room for it:
 *
 * ```text
 * I = d + DATUM_STROKE − T / LEVEL_SCALE
 * ```
 *
 * `d` is {@link DAYLIGHT_CRITERION}, the dark surface left between the stroke
 * and the card's border. `DATUM_STROKE` is the ink the datum spends past the
 * line it names. `T / LEVEL_SCALE` is what the last Level point of the track
 * gives back, `T` being the track's own length. {@link trackInset} is that
 * expression solved for a card rather than for a track, since the inset is part
 * of what it is buying room for.
 *
 * **The track must not clip.** `overflow: visible` on `.node__track` is part of
 * this derivation and not an implementation detail: the stroke is *meant* to
 * reach into the headroom, and a clipping track would cut it off at the track's
 * own edge exactly as the card's border cut it off before — recreating #67 one
 * box in, with the arithmetic here still reading six pixels. `.node` keeps its
 * own `overflow: hidden`, which is what rounds the fill into the role's radius,
 * and the inset is at **one end only**, so the fill's other three edges stay
 * where they were and nothing about its corners changes.
 */

/** `--rule-min`, which is `.node`'s border on all four sides. */
const NODE_BORDER = 2;

/** `.node__datum`'s border, also `--rule-min`. */
export const DATUM_STROKE = 2;

/**
 * The top of the Level range (`backend-gateway.ts`, `OperatorView.level`).
 *
 * The worst case for the datum, and the reason #67 exists: the higher the
 * ceiling, the more of the stroke has to live past the track.
 */
export const LEVEL_MAX = 99;

/**
 * What the fill divides by, which is **not** {@link LEVEL_MAX}.
 *
 * The fill is written as a percentage of the track and the Level is that
 * percentage, so one Level point is `T / 100` and a patch at the top of its
 * range still leaves a point of track unfilled. That last point is the
 * `T / LEVEL_SCALE` term of the inset — the room the range gives back — and it
 * is also the figure the whole rotation is about: on the narrowest card the wide
 * composición draws it is about **1.02 px**, and on the vertical axis it was
 * **0.12 px**, which is why two operators three points apart used to be drawn a
 * third of a pixel apart.
 */
const LEVEL_SCALE = 100;

/**
 * How much dark surface has to remain between the datum's ink and the card's
 * border, in CSS pixels.
 *
 * **6 px, and the criterion is all that survives the rotation.** The number was
 * judged once, on the vertical axis, and that verdict is retired rather than
 * deleted — it is carried into ADR-0008 with its value, its card, its patch as
 * Levels and the sentence that the geometry it was judged in no longer exists
 * (#84). Recorded here until that document is in the tree, because a judgement
 * deleted silently is the same defect as one kept past its geometry:
 *
 * - **What was on screen.** The wide composición, both ranuras empty so the
 *   156 px strip is up, window restored and dragged down, on a 2× display.
 * - **Which patch, as Levels.** Algorithm 66 with `99 · 0 · 99 · 99 · 0 · 0 · 99
 *   · 99` — a ceiling of 99 with a **lit carrier at the ceiling**, which is the
 *   case worth judging: the datum then lies against `--carrier` at full strength.
 * - **What was measured**, off the PNG at 1:1 on OP8's card: 4 device px of
 *   border ink, 13 device px of clean `--surface-raised`, 4 device px of datum.
 *   About 6.5 CSS px.
 * - **How it read.** A rule at a common height, clearly clear of the border, and
 *   not as a rim on the fill.
 *
 * ### Why the criterion transfers and the verdict does not
 *
 * The daylight runs border-to-datum and **both ends are fixed by the inset**, so
 * it is explicitly independent of the dimension being measured — which is why it
 * carried from a 31 px card to a 24 px one in the first place, and why it
 * carries across ninety degrees now. What does not carry is what six pixels of
 * *that* surface looked like: it was a judgement about a horizontal rule lying
 * on an amber border with `--carrier-fill` fading underneath it, and in the
 * rotated drawing the datum is a **vertical** rule with different ink beside it.
 *
 * So the two rotated daylights are **derived and nobody has looked at them**:
 * about **6.0 px** on the narrowest card this build can draw and 7.9 px on the
 * batten at three columns. They are the same kind of number `bottom: 99%` was,
 * and they are looks 2 and 3 of the round's verification list (#88), to be taken
 * on the **wide stacked node at the column cap** and not only on the batten —
 * taking it on the roomy box is the same trap as judging the old datum on the
 * grid card.
 *
 * ### Why not 5
 *
 * 5 would probably read, and it would give a pixel of fill back where the track
 * is scarcest, so the trade is real. Rejected on margin: the pixel is invisible
 * in the fill, and the daylight is the only thing between this and the defect
 * #67 is named after.
 */
export const DAYLIGHT_CRITERION = 6;

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
 * is the inset and the row count, which is where the interesting failures are.
 *
 * **All three were read off the screen in #81** and all three hold: in the
 * harness at 1280 × 800 the zone's chrome above and below the canvas comes to
 * `12 + 18 + 8` px, with the head's box at 14 and its `--space-1` margin at 4.
 * The term that did **not** hold is the legend's, which is `legend.ts`'s and is
 * corrected there — it is worth 8 px of canvas and it reaches this function.
 */
const ZONE_PAD_TOP = 12;
const ZONE_HEAD_BAND = 18;
const CANVAS_MARGIN_Y = 8;

/**
 * The canvas's rendered height when the body is at its floor.
 *
 * The diagram's zone is a whole grid column of the body, so its height *is* the
 * body's, and the body never goes under `BODY_FLOOR`: below that the eight nodes
 * lose the figures inside them and the vistas lose their curve, and what
 * gives way is the scroll rather than the drawing. That criterion is not #19's,
 * whatever the constant used to say it was — `column-geometry.ts` has what that
 * ticket does and does not contain. Out of that the zone spends
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
 * The canvas's rendered width in the narrowest lane the wide composición claims,
 * which is the **rail** shape at the shipped window.
 *
 * There is no floor under this the way `BODY_FLOOR` is a floor under the height:
 * `tauri.conf.json` has no `minWidth` and `diagramLane()` is not floored, so any
 * drag makes the drawing narrower than anything here. That is #86's ticket and
 * not this module's, and until it lands the honest thing is to earn the inset
 * against **the narrowest lane the app ships with** rather than against a floor
 * that does not exist yet. The rail is that lane — 1 016 px against the pinned
 * shape's 1 070 — and it is the binding arm by 54 px.
 */
export function floorCanvasWidth(): number {
  return canvasWidth('rail');
}

/**
 * The canvas's rendered width in a given column shape, at the window the app
 * ships in.
 *
 * **`DESIGN_BODY_W` and not a measured window, and that is a statement rather
 * than a shortcut.** Nothing in this app measures its own boxes — jsdom computes
 * none, so every claim here is arithmetic the sheets mirror — and `tauri.conf`
 * gives the body the whole 1 280 px with no `minWidth` under it. So this is the
 * lane the composición *claims*, per shape: **980 px in the rail and 1 034
 * pinned**, the 54 px between them being the filete the pinned shape halves. The
 * day the window has a floor (#86) it is this function that learns it, and the
 * fold trigger reading it moves with it in one place.
 */
export function canvasWidth(shape: ColumnShape): number {
  return diagramLane(shape, DESIGN_BODY_W) - 2 * ZONE_PAD_X;
}

/**
 * The width at which five facts are known to fit, in CSS pixels: **131 px**.
 *
 * The fold's width trigger needs a fitted width, and the temptation is to author
 * one — a number picked until algorithm 1 folds, which is a classification
 * wearing a derivation. This is not that. It is the card the **narrow 3 × 3
 * grid** draws, and that card holds these same five facts today, in the same
 * template at the same type, in the composición that ships: `NODE_W` of
 * `CANVAS_W`, of the lane the narrow composición is written to keep exactly
 * ({@link DIAGRAM_W}) less the zone's padding.
 *
 * So the claim is a comparison and not a threshold — *this card is narrower than
 * one that is known to hold what it is being asked to hold* — and the only way
 * it goes stale is somebody changing what the grid node draws, which changes
 * both sides of it at once.
 *
 * **It says nothing about the batten.** A node laying its five facts in a row
 * needs the width its row needs, which is not this number and is more than any
 * card the layout draws — at 302 px the batten wraps to two lines, which is the
 * card's height and not its width, and it is not what this trigger is about
 * (#81's table, and look 5 of #88).
 */
export function fittedCardWidth(): number {
  return (NODE_W / CANVAS_W) * (DIAGRAM_W - 2 * ZONE_PAD_X);
}

/**
 * The band a folded node needs, in CSS pixels: **16 px**, border to border.
 *
 * This is what the fold has to buy back, and it is the one number in the round
 * that can say the fold *failed*: if a folded card comes out shorter than this,
 * the drawing is folding facts and still not holding what it kept, and the
 * fold's own floor is the thing that fails (#81). At the body's floor, at eight
 * rows — the deepest of the 88 and the worst case there is — the folded card is
 * 18.7 px, so the margin is **2.7 px**, derived and nobody has looked at it: look
 * 5 of the verification list is *does the folded band read as depth, or as a
 * footnote* (#88).
 *
 * Mirrored from `operator-diagram.scss`'s `.node--folded.node--squat` — one line
 * at `--text-micro` with `line-height: 1`, a pixel of padding on each side, and
 * `.node`'s own `--rule-min` border, which is in the box because `.node` is
 * `border-box`. `legend.ts`'s trade, for its reason.
 */
export function foldedBandHeight(): number {
  return 2 * NODE_BORDER + 2 * BAND_PAD_Y + BAND_LINE;
}

/** `.node--folded.node--squat .node__body`'s padding, top and bottom. */
const BAND_PAD_Y = 1;
/** Its one line: `--text-micro`, at `line-height: 1` so the box is the figure. */
const BAND_LINE = 10;

/**
 * The smallest card the narrow 3 × 3 grid puts on screen, along the axis that
 * carries Level there: its **height**, in CSS pixels.
 *
 * The grid node is a constant share of its canvas (`NODE_H / CANVAS_H`, 23.8 %),
 * so at the body's floor it is about 68 px. It used to lose this comparison to
 * the wide composición's card by a factor of three, and it no longer competes
 * with it at all: the wide boxes carry Level along their width now, so their
 * height is not a Level scale and a `Math.min` across the two would be comparing
 * a measurement with a dimension that no longer measures anything.
 */
export function narrowestGridCard(): number {
  return (NODE_H / CANVAS_H) * floorCanvasHeight();
}

/**
 * The smallest card the wide composición puts on screen, along the axis that
 * carries Level there: its **width**, in CSS pixels.
 *
 * Recomputed from the four constants that decide it — `WIDE_CANVAS_W`, the two
 * margins, the gutter and the eight columns — and from no cap. `NODE_W_MAX` and
 * `SQUAT_NODE_W_MAX` are ceilings that at eight columns both sit above this
 * number and never decide it, so a card derived from one of them would be a card
 * about a drawing the layout never makes; and it would make this a property of
 * the node class, which it is not — at the column cap a batten and a stacked
 * node are exactly as wide as each other. `wide-layout.spec.ts` re-derives the
 * same width independently and asserts the layout's own `Math.min` agrees with
 * it, which is what keeps the claim that no cap binds from being an assumption
 * (#75).
 *
 * Eight columns is the whole surface (#40), including the any-parking case:
 * parking adds a stub column but removes an operator from the branches, so the
 * total never passes eight.
 */
export function narrowestWideCard(): number {
  const pitchX = (WIDE_CANVAS_W - 2 * MARGIN_X) / WIDE_COLUMNS;
  return ((pitchX - COL_GAP) / WIDE_CANVAS_W) * floorCanvasWidth();
}

/**
 * The inset a card needs at the far end of its carrying axis, in whole CSS
 * pixels: the smallest integer that clears {@link DAYLIGHT_CRITERION}.
 *
 * The criterion is #67's and unchanged — `I = d + DATUM_STROKE − T / LEVEL_SCALE`
 * — but a caller holds a **card** and not a track, and the track is
 * `card − 2 · NODE_BORDER − I`, so the inset stands on both sides of it. Solved
 * for `I` and rounded up:
 *
 * ```text
 * I = ⌈ (d + DATUM_STROKE − (card − 2 · NODE_BORDER) / LEVEL_SCALE)
 *       ÷ (1 − 1 / LEVEL_SCALE) ⌉
 * ```
 *
 * Two things follow from it being derived, and both are worth saying because the
 * proposal that produced this round got one of them backwards. **The daylight
 * cannot be a second criterion**: it clears `d` by construction at every card,
 * so quoting it as a floor alongside the track's is one criterion wearing two
 * hats. And when `d` moves, what moves is the **inset** — never the track floor,
 * which is #86's and is about readability rather than about a border.
 */
export function trackInset(card: number): number {
  const given = (card - 2 * NODE_BORDER) / LEVEL_SCALE;
  return Math.ceil((DAYLIGHT_CRITERION + DATUM_STROKE - given) / (1 - 1 / LEVEL_SCALE));
}

/**
 * The inset the sheet actually draws, per composición, in CSS pixels.
 *
 * One authored value per composición, earned against **that composición's own
 * narrowest card**, because the inset is a single declaration and the daylight
 * only ever grows as the card does. It comes to **8 px on the narrow grid** —
 * the number that shipped, re-earned rather than kept — and **7 px in the wide
 * composición**, which is the whole of what the rotation moves here.
 *
 * It is handed to the template rather than written into the sheet. `TRACK_INSET`
 * used to be authored here and mirrored by `operator-diagram.scss`, which was
 * two declarations of one number in a module whose stated contract is that they
 * mirror each other; now the sheet declares no inset at all and the drawing is
 * told, on each of the four edges, what that edge costs. There are two numbers
 * and both of them are here.
 */
export function levelTrackInset(axis: LevelAxis): number {
  return trackInset(axis === 'height' ? narrowestGridCard() : narrowestWideCard());
}

/** The fill's scale, in CSS pixels: the card's interior, less the headroom. */
export function trackLength(card: number, axis: LevelAxis): number {
  return card - 2 * NODE_BORDER - levelTrackInset(axis);
}

/**
 * The dark surface between the datum's ink and the card's border, at a ceiling
 * that puts the line as far along the axis as the range allows.
 *
 * This is the number #67 is about. Before the track it was negative — the stroke
 * sat inside the border and `overflow: hidden` had already taken most of it — and
 * the only check that existed asserted the element was in the DOM, which it was,
 * on a line nobody could see.
 */
export function datumDaylight(card: number, axis: LevelAxis, level: number = LEVEL_MAX): number {
  const track = trackLength(card, axis);
  const overshoot = DATUM_STROKE - track * (1 - level / LEVEL_SCALE);
  return levelTrackInset(axis) - overshoot;
}

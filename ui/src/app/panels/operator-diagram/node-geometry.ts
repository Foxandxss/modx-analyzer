import {
  BODY_FLOOR,
  ColumnShape,
  DESIGN_BODY_W,
  DIAGRAM_W,
  bodyWidthFor,
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
 * deleted — it is carried into ADR-0008 §7 with its value, its card, its patch
 * as Levels and the sentence that the geometry it was judged in no longer
 * exists (#84). That document is the record now, and this comment is not a
 * second copy of it: a judgement kept in two places drifts exactly as a number
 * declared in two places does.
 *
 * ### Why the criterion transfers and the verdict does not
 *
 * The daylight runs border-to-datum and **both ends are fixed by the inset**, so
 * it is explicitly independent of the dimension being measured — which is why it
 * carried from a 31 px card to a 24 px one in the first place, and why it
 * carries across ninety degrees now. What does not carry is what six pixels of
 * *that* surface looked like: it was a judgement about a horizontal rule lying
 * on an amber border with the carrier fill (then `--carrier-fill`, since #93
 * the `--carrier-fill-dense` → `-faint` ramp) fading underneath it, and in the
 * rotated drawing the datum is a **vertical** rule with the same ramp turned
 * along the bar, so its faint stop is now the tip the daylight is measured
 * from (ADR-0008 §2.6).
 *
 * So the two rotated daylights are **derived and nobody has looked at them**:
 * about **6.0 px** on the narrowest card this build can draw and 7.9 px on the
 * batten at three columns. They are the same kind of number `bottom: 99%` was,
 * and they are looks 2 and 3 of the round's verification list — which lives in
 * ADR-0008 §8 and is taken in #88 — on the **wide stacked node at the column
 * cap** and not only on the batten —
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
 * One Level point is never drawn smaller than this on the axis that carries it,
 * in CSS pixels.
 *
 * **The criterion under the width floor, and the one thing in it that is
 * chosen.** A pixel is the smallest thing a screen can draw, so a point under it
 * is a point two operators can differ by without the drawing showing it — which
 * is the 0.35 px between 99 and 96 that the whole rotation was about, one axis
 * along. Folding does not touch it: folding the facts does not widen the card by
 * one pixel (`folding.ts`), so this is a floor on the **window** and not a fold
 * condition, and it is enforced the way the height already is — a minimum, and
 * the body scrolling under it (#86).
 */
export const PIXELS_PER_POINT = 1;

/**
 * The shortest track the wide composición ever draws, in CSS pixels: **100**.
 *
 * {@link LEVEL_SCALE} points at {@link PIXELS_PER_POINT} each. It is the
 * *track* and not the card because the criterion is about the scale: the card
 * is what the track costs once the inset and the border are added to it, which
 * is {@link readableCard}.
 */
export function readableTrack(): number {
  return LEVEL_SCALE * PIXELS_PER_POINT;
}

/**
 * The narrowest card the wide composición is allowed to draw, in CSS pixels:
 * **111** — the readable track, the inset that track earns, and the border on
 * both sides.
 *
 * The inset is taken in the **track** form of #67's derivation, `I = d +
 * DATUM_STROKE − T / LEVEL_SCALE`, because here the track is the given and the
 * card is the unknown: 6 + 2 − 1 is 7, exactly. {@link trackInset} is the same
 * derivation solved the other way round — a card given, the inset unknown — and
 * the two agree on this card, 111 → 7 → 111, which is what makes it a fixed
 * point and not a coincidence; `operator-diagram.spec.ts` asserts the agreement
 * rather than either number.
 */
export function readableCard(): number {
  const track = readableTrack();
  const inset = DAYLIGHT_CRITERION + DATUM_STROKE - track / LEVEL_SCALE;
  return track + inset + 2 * NODE_BORDER;
}

/**
 * The narrowest card's share of the wide canvas, at eight columns: **142 of
 * 1 232**.
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
 * since #83 a parked operator takes a place in the band above the deepest row and
 * not a stub column of its own, and it leaves the branches to do it, so the
 * drawing's columns are the wider of the two counts and never their sum.
 */
function narrowestCardShare(): number {
  const pitchX = (WIDE_CANVAS_W - 2 * MARGIN_X) / WIDE_COLUMNS;
  return (pitchX - COL_GAP) / WIDE_CANVAS_W;
}

/**
 * The canvas's rendered width at the floor the window stops at, in CSS pixels:
 * **963.04**, the canvas at which the eight-column card is exactly
 * {@link readableCard}.
 *
 * This is the width the height's floor already has: `BODY_FLOOR` is the body at
 * which the drawing stops giving way and the scroll starts, and this is the
 * canvas at the same point on the other axis. Until #86 it was the lane the rail
 * shape left at the *shipped* window — 980 px, and an honest number, because
 * `tauri.conf.json` has no `minWidth` and any drag made the drawing narrower
 * than anything here. It is derived now and not measured, and derived from the
 * criterion rather than from a window: {@link PIXELS_PER_POINT} is the one
 * chosen figure in it.
 *
 * It is a **fraction of a pixel** and stays one. Rounding it up to 964 would be
 * a second declaration of the same floor, one pixel apart from the first, and
 * the grid the body is laid out by takes a fractional minimum without complaint.
 */
export function floorCanvasWidth(): number {
  return readableCard() / narrowestCardShare();
}

/**
 * The lane the wide composición needs, in CSS pixels: **999.04**, the floor's
 * canvas plus the zone's padding on both sides.
 *
 * **This is the number the sheet reads**, bound onto `.body` from `app.ts` as
 * the minimum of the diagram's track in the two shapes that draw the wide
 * composición — and bound rather than declared there, for the reason the filete
 * is (#76): a literal in the sheet is a second copy of a derived number, and the
 * two agree until somebody edits one. The narrow grid's lane has no minimum from
 * here: its Level runs along the height, whose floor is `BODY_FLOOR`, and the
 * width that composición can be dragged to is #66's question and not a
 * readability one.
 *
 * One number and not one per shape, on purpose: what differs between the rail
 * and the pinned composición is not what the drawing needs but what the *other*
 * two lanes cost beside it, and the grid adds those up itself — which is what
 * makes the body's minimum per shape without anybody typing a second constant.
 * {@link bodyWidthFloor} is the model's account of that sum.
 */
export function laneFloor(): number {
  return floorCanvasWidth() + 2 * ZONE_PAD_X;
}

/**
 * The body width under which the composición scrolls sideways, per shape, in CSS
 * pixels: **1 263.04 in the rail and 1 209.04 pinned**, and `null` for the
 * ranuras, whose lane is `DIAGRAM_W` by construction and has no readability floor
 * to derive one from.
 *
 * This is what the grid computes on its own once {@link laneFloor} is the first
 * track's minimum — the lane, the middle lane's declared width, `FIGURES_W` and
 * the two filetes — and the model says it through `column-geometry.ts`'s inverse
 * of `diagramLane()` so that a test can hold the two to the same arithmetic. The
 * proposal's 1 211 predates `bodyGap()` halving the filete with the pin down
 * (#76); the build wins. Against the 1 280 px window the app ships in the slack
 * is **17 px in the rail**, which is the arm that binds, and 71 with the pin.
 * A single constant would over-constrain the pinned shape by exactly the
 * difference, which is why there is not one.
 */
export function bodyWidthFloor(shape: ColumnShape): number | null {
  return bodyWidthFor(shape, laneFloor());
}

/**
 * Where a card's Level origin sits from the body's left edge, in CSS pixels,
 * for a card at `x` in the wide canvas's own units — and only while the body is
 * scrolled, which is the one time this number is exact.
 *
 * ## The decision under it (ADR-0008 §5)
 *
 * Rotated, the bars measure from a **shared, remote origin**: a column's cards
 * fill from one left edge, and the ceiling datum is a rule referenced to it.
 * Horizontal scroll can put that origin off the screen while the bars stay on
 * it, and bars with no visible zero are the misleading chart everybody has seen.
 * The vertical axis never had the problem — the old fill's zero was its own
 * card's bottom edge, adjacent by construction.
 *
 * Two answers were on the table: pin the origin column and scroll only the
 * track, or **stop claiming the axis once the origin leaves**. The second is what
 * is built. The first has no column to pin — the cards are percentages of one
 * `viewBox` the panel stretches, so the «origin column» is a fraction of an SVG
 * and not a box the body could hold still — and pinning the whole drawing
 * instead would slide the figures column over the loud ends of the bars, which
 * trades one lie for the other. So a card whose zero has left the screen drops
 * its fill and its datum and keeps its figure: the number is still true, and the
 * length it confirmed is no longer on screen to confirm. **Per card and not per
 * drawing**, because the origin is per column: the leftmost column loses its
 * zero first and the ink leaves with it, so what the pianist sees is the bar
 * going where its edge went.
 *
 * ## Why this is arithmetic and not a measurement
 *
 * Nothing in this app measures its own boxes. What makes the offset knowable is
 * that the body only scrolls sideways when it is narrower than its floor — and
 * then the diagram's track is at its minimum, which is {@link laneFloor}
 * exactly, so the canvas is {@link floorCanvasWidth} wide and a card's `x` is a
 * known share of a known width. Above the floor the body does not scroll and
 * the question does not arise. The zone's padding puts the canvas in from the
 * lane's edge, and the card's border puts the track in from the card's.
 *
 * This is look 7 of ADR-0008 §8, and it is still owed: *does a scrolled bar
 * read against an origin it cannot see* has an answer here — it is not asked to
 * — and whether the ink leaving reads as the reason it left is what the look
 * decides.
 */
export function originOffset(x: number): number {
  return ZONE_PAD_X + x * (floorCanvasWidth() / WIDE_CANVAS_W) + NODE_BORDER;
}

/**
 * Whether a card at `x` in the wide canvas has had its origin scrolled off the
 * body's left edge: the body has gone further right than the card's zero.
 */
export function originGone(x: number, scrollLeft: number): boolean {
  return scrollLeft > originOffset(x);
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
 * pinned**, the 54 px between them being the filete the pinned shape halves.
 * Both are above {@link floorCanvasWidth} — by 17 and 71 px of lane — which is
 * what lets the app ship without scrolling at rest; the fold's width trigger
 * reads this and not the floor, because the card it judges is the one on screen
 * and not the narrowest one the window allows.
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
 * carries Level there: its **width**, in CSS pixels — and since #86 it is
 * {@link readableCard}, because the window stops where that card would get
 * narrower.
 *
 * Written as the floor's card and not as the share of the floor's canvas, though
 * the two are one number: `share · (card / share)` is 111 in arithmetic and a
 * hair under it in floating point, and {@link trackInset} rounds up, so the
 * hair would be a whole pixel of inset earned against a card the drawing never
 * draws. `operator-diagram.spec.ts` recomputes it the other way and holds the
 * two together.
 */
export function narrowestWideCard(): number {
  return readableCard();
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
 * which is {@link readableTrack} and is about readability rather than about a
 * border; what a larger `d` moves is the card that track costs, and the window's
 * floor with it.
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

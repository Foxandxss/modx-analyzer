import { SCOPE_CYCLES } from 'modx-dsp';
import { LEGEND_H, legendHeight } from '../operator-diagram/legend';

/**
 * Where the glass column's boxes are, in CSS pixels, for any state of the two
 * ranuras.
 *
 * ## Why this is a module and not a stylesheet
 *
 * Everything here is laid out by `grid` and `flex`, and none of it can be read
 * back in a test: jsdom computes no boxes, and a rule asserted by reading a
 * compiled stylesheet is a test of the sheet and not of the shape. So the shape
 * is **modelled here as arithmetic** and the sheets mirror it — the same trade
 * `layout.ts` makes with `--op-node-w`, and for the same reason: the claim that
 * has to hold is about a box, so the box is what a test is handed.
 *
 * The numbers below are the declarations they name. If one of them changes in
 * `app.ts`, `glass-column.scss` or `bottom-strip.scss`, it changes here in the
 * same commit; each of those sheets carries a comment saying so.
 *
 * ## What the arithmetic is for
 *
 * Three claims, and none of them is expressible any other way:
 *
 * - **A ranura's box does not depend on what the other one holds.** Both are
 *   `flex: 1` unconditionally, so an empty ranura keeps its half as empty glass.
 *   A panel that changes size with its neighbour is a shape you have to learn
 *   twice.
 * - **Four cycles read as a wave.** In the bottom strip the scope was handed a
 *   1244 × 83 box, in which one cycle of a lock is drawn four times wider than
 *   the whole trace is tall — a ripple on a rule. The same lock in a ranura gets
 *   336 × 220, where a cycle is *narrower* than the wave is tall. See
 *   {@link cycleAspect}, which is the figure that says so.
 * - **The collapsed strip's room goes to the body.** Not to a box holding a
 *   panel that moved out, and not to a panel of 0 px still painting 33 times a
 *   second for nobody.
 *
 * No square is imposed on the scope. The ranura's box is already taller than one
 * cycle is wide, and forcing an aspect on the canvas would leave dead glass
 * inside a ranura whose whole rule is that it keeps its half.
 */

/** A box on screen, in CSS pixels. No origin: nothing here needs one. */
export interface Box {
  readonly width: number;
  readonly height: number;
}

/**
 * The three shapes the glass column takes.
 *
 * - `ranuras` — the two halves, with whatever each one holds.
 * - `rail` — both empty and the pin up: the column collapses to its two handles,
 *   in the bench drawer's closed vocabulary, and one press brings a panel back.
 * - `gone` — `KEEP IT BIG` is down. Not a rail: the pin is its own handle and it
 *   is in the header of the panel it is about, so a second one here would be a
 *   control for a state that already has one.
 */
export type ColumnShape = 'ranuras' | 'rail' | 'gone';

/** What the column's shape is decided by. All of it lives in `Composition`. */
export interface ColumnState {
  /** Whether each ranura holds a panel, top first. */
  readonly filled: readonly [boolean, boolean];
  /** Whether `KEEP IT BIG` is down. */
  readonly pinned: boolean;
  /** Whether the bottom strip is the one drawing the waterfall. */
  readonly waterfallBelow: boolean;
}

/** Every box of the composición, once the state and the room are known. */
export interface Geometry {
  readonly shape: ColumnShape;
  /** The middle lane's width: the column, the rail, or nothing at all. */
  readonly column: number;
  /** The body's own box, which is what the three lanes divide. */
  readonly body: Box;
  /** The bottom strip's band, `0` when the waterfall moved up into a ranura. */
  readonly strip: number;
  /**
   * The two ranuras, top first, and **always both**: an empty one is empty glass
   * and keeps its half. In the rail they are the two handles at the rail's
   * width; with the column gone they are nothing.
   */
  readonly ranuras: readonly [Box, Box];
  /** The glass inside each ranura, once the head has taken its row. */
  readonly frames: readonly [Box, Box];
}

/** `--composition-diagram`: the wide drawing's own width, in `app.ts`. */
export const DIAGRAM_W = 700;
/** `--composition-column`: the figures column, which never closes. */
export const FIGURES_W = 208;
/**
 * `--rule-min`, one filete: the gap the body leaves between two of its lanes.
 *
 * How many of it a boundary is worth is {@link bodyGap}'s, and the body reads
 * that rather than declaring a width of its own — see the note there.
 */
export const RULE = 2;

/** The body's three lanes, so two boundaries: one on each side of the column. */
const BODY_BOUNDARIES = 2;
/** `--drawer-grab`: the rail is the closed drawer's handle, stood on its end. */
export const RAIL_W = 52;
/** The bottom strip's band, with the waterfall in it. */
export const STRIP_H = 156;
/** What the bench drawer costs the screen, open or shut. */
export const DRAWER_GRAB = 52;
/**
 * `tauri.conf.json`'s window `width`. The body gets all of it: the three lanes
 * divide the window, so this is what the design widths below are taken at.
 * There is no `minWidth` beside it, and no floor here for the width either —
 * see {@link diagramLane}.
 */
export const DESIGN_BODY_W = 1280;

/**
 * The 360 both halves of the floor stand on, and **the ticket it cites does not
 * contain it.**
 *
 * The comment here said someone drove the window down and watched two different
 * things stop saying what they say, and cited #19. GitHub **#19 is «Text
 * collides at full size»** — the struck-through name under the `ALG` chip and
 * `TEORÍA` over `SONDEADO` — and its three acceptance criteria are legibility
 * ones at the *design* window. It contains no height measurement. 360 appears in
 * no results document and nowhere in the design handoff; its only witness was
 * this comment, pointing at a ticket that does not have it (#81).
 *
 * So the 360 is left standing and its provenance is written down instead of
 * invented: it is an **unwitnessed** number, and #81's measurement is a
 * **first** one that supersedes nothing — see {@link BODY_FLOOR}. The two
 * constants stay two because only one of them grew: the legend went to two rows
 * (#65) and its band comes out of the canvas, so the diagram needs the extra
 * back; the vistas never needed it and nothing here should quietly say they did.
 */
const VIEWS_FLOOR = 360;
/** The diagram's half of the 360, with the one-row legend's band taken back out. */
const NODES_FLOOR = 360 - legendHeight(1);

/**
 * `grid-template-rows: minmax(382px, 1fr)` in `app.ts`: under this the body
 * scrolls.
 *
 * Derived, so it follows the legend the next time its row count changes rather
 * than becoming a number nobody can re-earn. The relation is the claim and the
 * number is the consequence: **whatever the legend takes, the canvas is left
 * with what it was left with when 360 was measured.**
 *
 * ## The legend is an input to this, twice
 *
 * {@link LEGEND_H} is added here and subtracted again at `floorCanvasHeight()`,
 * so the drawing only ever sees the difference — and the floor is wrong by
 * exactly as much as the legend's band is wrong by. #81 found it wrong by 8 px:
 * the swatch's rule is drawn outside its declared box, so the band the screen
 * gives the legend is 62 px and this module was spending 54. The floor is 382
 * for that reason and not because a window was dragged four pixels further.
 *
 * ## What #81 measured, and why this is not that number
 *
 * The measurement is at `docs/results/2026-09-10-el-suelo-del-cuerpo.md`, taken
 * in the harness with the fold switched off, on the deepest algorithm — the
 * anchor the round asked for.
 *
 * - **Criterion.** A gap holds its arrowhead plus a visible segment, and a node
 *   holds its five facts.
 * - **Geometry.** Wide composición, pinned and rail, Chrome at 1280 CSS px wide
 *   and DPR 1, folding off, algorithm **66** — eight rows, the batten class.
 * - **Patch, as Levels.** `90 · 90 · 71 · 90 · 90 · 85 · 90 · 99`, the bench's.
 * - **What came back.** The five facts need a body of **561 px**; the gap needs
 *   about **1 300**. The window the app ships gives the body **534**.
 *
 * Neither is this floor, and the reason is written here rather than left for the
 * next reader to rediscover: **both are criteria the fold resolves** (#82), and
 * clamping the window at either would put the app's own design window under its
 * floor — the body would scroll at rest, on every machine, to protect a drawing
 * that after #82 is never drawn. What the anchor buys is what it was asked to
 * buy: it is above every shallower drawing's need, so the fold can only ever
 * buy margin, and the threshold derived at this floor cannot spiral.
 */
export const BODY_FLOOR = Math.max(NODES_FLOOR + LEGEND_H, VIEWS_FLOOR);

/** `.view`'s padding in `glass-column.scss`. */
const VIEW_PAD_X = 16;
const VIEW_PAD_Y = 12;
/**
 * `.view__head` at one row: `--text-label` in its line box, plus the 7 px under
 * it. The chooser is taller than that and does not say so — it takes its 44 px
 * of hit target back out of its own margin, which is the pin's trick (#19).
 */
const HEAD_BAND = 22;

/** `bottom-strip.scss`: `--hit-tab` plus the 9 and the 8 of the head's padding. */
const STRIP_HEAD_BAND = 61;
const STRIP_PAD_X = 18;
const STRIP_PAD_BOTTOM = 12;

/** `scope.ts` draws the trace at `± amplitude · middle · 0.92`. */
const TRACE_FILL = 0.92;

/**
 * The aspect at which cycles stop reading as a wave.
 *
 * At 2 one cycle is drawn twice as wide as the whole trace is tall, which is
 * where a waveform becomes a ripple travelling along a rule. It is a threshold
 * for a test to name and not a value anything is clamped to.
 */
export const FLAT = 2;

/** Nothing at all, for a ranura that is not on screen to be given a box. */
const NOTHING: Box = { width: 0, height: 0 };

/** Both empty and the pin up is the rail; the pin down takes the column away. */
export function columnShape(filled: readonly [boolean, boolean], pinned: boolean): ColumnShape {
  if (pinned) {
    return 'gone';
  }
  return filled[0] || filled[1] ? 'ranuras' : 'rail';
}

/**
 * Every box of the composición, from the state of the two ranuras and the room
 * under the header.
 *
 * `room` is the whole screen below the header band — what the body, the bottom
 * strip and the drawer's handle divide between them. The body is what is left of
 * it, and it never goes under {@link BODY_FLOOR}: below that the eight nodes lose
 * the figures inside them and the vistas lose their curve, so what gives way is
 * the scroll and not the drawing. That sentence is the floor's criterion and it
 * is not #19's: see {@link BODY_FLOOR} for what that ticket does and does not
 * contain.
 */
export function columnGeometry(state: ColumnState, room: Box): Geometry {
  const shape = columnShape(state.filled, state.pinned);
  const strip = state.waterfallBelow ? STRIP_H : 0;
  const body: Box = {
    width: room.width,
    height: Math.max(room.height - strip - DRAWER_GRAB, BODY_FLOOR),
  };
  const column = laneWidth(shape, body.width);
  // The two halves, split by the filete between them. The same box for both,
  // whatever either one holds: that is the whole rule and it is one line.
  const half: Box = { width: column, height: (body.height - RULE) / 2 };
  const ranura = shape === 'gone' ? NOTHING : half;
  const frame = shape === 'ranuras' ? glass(half) : NOTHING;

  return { shape, column, body, strip, ranuras: [ranura, ranura], frames: [frame, frame] };
}

/** The scope's box in the bottom strip: where it used to live, and why it left. */
export function stripFrame(width: number): Box {
  return {
    width: width - 2 * STRIP_PAD_X,
    height: STRIP_H - STRIP_HEAD_BAND - STRIP_PAD_BOTTOM,
  };
}

/**
 * How wide one cycle is drawn against how tall the trace can be, in the box the
 * scope is handed.
 *
 * Under 1 a cycle is taller than it is wide and the shape is a wave; over
 * {@link FLAT} it is a ripple on a rule. The divisor is the peak-to-peak the
 * canvas allows and not the box itself: `scope.ts` keeps {@link TRACE_FILL} of
 * the half box on each side of the zero line.
 */
export function cycleAspect(frame: Box, cycles: number = SCOPE_CYCLES): number {
  return frame.width / cycles / (frame.height * TRACE_FILL);
}

/**
 * The diagram's own lane, which is the first track and takes what the other two
 * leave. In `ranuras` that comes to exactly {@link DIAGRAM_W}, because the
 * column is the one written as a remainder; in `rail` and `gone` the diagram is
 * the remainder instead and the number moves with the window. At
 * {@link DESIGN_BODY_W} that is **1 016 px in the rail shape and 1 070 pinned**,
 * which is what {@link bodyGap} makes the model say as well as the screen.
 *
 * **It is not floored.** Under about 910 px of body it drops below
 * {@link DIAGRAM_W} in every shape, and down there {@link FIGURES_W} is still
 * hard-coded and the grid's percentage-positioned nodes are long past anything
 * anyone has looked at. The height has a floor with a measurement behind it — it
 * has had one since #81 — and the width has
 * none, and one picked to make an arithmetic test pass would be a constant
 * earned by the test instead of by a measurement. So callers state which widths
 * they are claiming for, and the floor is #66.
 */
export function diagramLane(shape: ColumnShape, bodyWidth: number): number {
  return bodyWidth - laneWidth(shape, bodyWidth) - FIGURES_W - BODY_BOUNDARIES * bodyGap(shape);
}

/**
 * What one boundary between two of the body's lanes measures, in CSS pixels.
 *
 * A whole filete, except where the lane between the two boundaries has closed
 * to nothing: there the two gaps abut with no track between them, and two
 * filetes with 0 px in the middle read as a rule of double thickness. So each of
 * them is half, and the pinned composición's diagram is 1 070 px wide at the
 * design window rather than the 1 068 an unconditional `2 · RULE` returns.
 *
 * **This is the source the sheet reads too**, bound into `.body`'s `column-gap`
 * from `app.ts`, because the width of this one gap is the only filete in the app
 * that depends on which shape the body is in. Declared in the sheet as well it
 * would be two derivations of one truth, identical until somebody edited one —
 * which is exactly how the model came to return a width the screen was not
 * drawing (#76).
 *
 * **Keyed to the adjacency and not to a shape's name.** What halves the gap is
 * that there is no track between the two of them, which is {@link fixedLane}
 * returning zero. A fourth shape that closes the middle lane inherits this by
 * having the adjacency; keyed to `gone` it would go stale the day that shape
 * arrived, and silently.
 */
export function bodyGap(shape: ColumnShape): number {
  return fixedLane(shape) === 0 ? RULE / BODY_BOUNDARIES : RULE;
}

/**
 * The middle lane where it is a declared width, and `null` where it is the
 * remainder — the ranuras composición is the one shape whose column is what the
 * other two lanes leave, which is what keeps the diagram at exactly
 * {@link DIAGRAM_W} at the design width.
 */
function fixedLane(shape: ColumnShape): number | null {
  switch (shape) {
    case 'ranuras':
      return null;
    case 'rail':
      return RAIL_W;
    case 'gone':
      return 0;
  }
}

function laneWidth(shape: ColumnShape, bodyWidth: number): number {
  return (
    // The remainder, so the diagram gets exactly its 700 px and the exchange
    // cannot contradict the resting state.
    fixedLane(shape) ?? bodyWidth - DIAGRAM_W - FIGURES_W - BODY_BOUNDARIES * bodyGap(shape)
  );
}

function glass(ranura: Box): Box {
  return {
    width: ranura.width - 2 * VIEW_PAD_X,
    height: ranura.height - 2 * VIEW_PAD_Y - HEAD_BAND,
  };
}

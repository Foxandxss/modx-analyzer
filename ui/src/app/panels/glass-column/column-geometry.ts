import { SCOPE_CYCLES } from 'modx-dsp';

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
/** `--rule-min`, the filete between two lanes. */
export const RULE = 2;
/** `--drawer-grab`: the rail is the closed drawer's handle, stood on its end. */
export const RAIL_W = 52;
/** The bottom strip's band, with the waterfall in it. */
export const STRIP_H = 156;
/** What the bench drawer costs the screen, open or shut. */
export const DRAWER_GRAB = 52;
/** `grid-template-rows: minmax(360px, 1fr)`: under this the body scrolls. */
export const BODY_FLOOR = 360;

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
 * the figures inside them and the vistas lose their curve (#19), so what gives
 * way is the scroll and not the drawing.
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

function laneWidth(shape: ColumnShape, bodyWidth: number): number {
  switch (shape) {
    case 'ranuras':
      // The remainder, so the diagram gets exactly its 700 px and the exchange
      // cannot contradict the resting state.
      return bodyWidth - DIAGRAM_W - FIGURES_W - 2 * RULE;
    case 'rail':
      return RAIL_W;
    case 'gone':
      return 0;
  }
}

function glass(ranura: Box): Box {
  return {
    width: ranura.width - 2 * VIEW_PAD_X,
    height: ranura.height - 2 * VIEW_PAD_Y - HEAD_BAND,
  };
}

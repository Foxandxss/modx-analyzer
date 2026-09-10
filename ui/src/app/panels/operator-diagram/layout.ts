import { Topology } from '../../backend/backend-gateway';

/**
 * Where the eight nodes go and how the lines between them run, for any of the 88.
 *
 * ## Why there is no hand-made sheet
 *
 * The chart in the Data List draws each algorithm by hand, and copying 88
 * drawings would be 88 more things to get wrong. Instead the layout comes out of
 * the **chain depth** the table computes: a portadora is 0, and everything else
 * is one deeper than the deepest thing it modulates. Sorting the eight by depth
 * — deepest first, and by operator number inside a depth — and filling a 3×3 grid
 * row by row gives three properties for free:
 *
 * - Eight operators in three-wide rows is **always** exactly three rows, so the
 *   canvas never changes size and never has to be scaled to fit.
 * - Every route runs from a node earlier in the reading order to a later one,
 *   because a route always drops the depth by at least one. Modulation therefore
 *   always flows left to right and top to bottom, and the output bus is at the
 *   bottom where the portadoras end up.
 * - The feedback arc is the only line that runs backwards, which is what it is.
 *
 * This is **not** the chart's own row layout, and the difference is worth knowing
 * before comparing the two on a screen: in algorithm 37 the chart puts Op3 beside
 * Op4 although Op3 modulates it.
 *
 * ## Why nothing here is scaled by hand
 *
 * The numbers below are the units of an SVG `viewBox` that the panel stretches to
 * whatever room it has (`preserveAspectRatio="none"`), with the nodes positioned
 * over it in percentages of the same box. So the drawing fills the column at any
 * height without measuring anything, and the strokes stay honest because every
 * line carries `vector-effect: non-scaling-stroke` — which is exactly what the
 * design package says that property is for.
 */

/**
 * The node box and the spacing around it, in `viewBox` units. These are the
 * values of `--op-node-w`, `--op-node-h`, `--op-col-gap`, `--op-row-gap` and
 * `--op-bus-offset` in `design-tokens.css`; they live here as numbers because a
 * route has to land on the edge of a node and an SVG cannot read a CSS variable.
 * The node's own size on screen comes from this layout, so the two cannot drift
 * into a drawing whose lines miss the boxes.
 */
export const NODE_W = 118;
export const NODE_H = 108;
export const COL_GAP = 82;
export const ROW_GAP = 28;
/** How far under the last row the output bus runs. */
export const BUS_OFFSET = 30;

/** Room for the feedback arc on the right, and for the hop gap at the top. */
const MARGIN_X = 40;
const MARGIN_Y = 18;

export const COLUMNS = 3;
export const ROWS = 3;

/**
 * The 3 × 3 grid carries Level in the node's **height**, and round 10 did not
 * change it.
 *
 * The rotation is the wide composición's (`wide-layout.ts`): there the vertical
 * direction was carrying depth across nodes and Level inside them, and this
 * drawing never had that overload — its rows are a reading order and not a
 * depth axis, so nothing here was bidding for the same pixels. Level stays where
 * it was, which is why the two compositions now disagree about the direction and
 * why the value is written down in each of them rather than inferred anywhere.
 */
const LEVEL_AXIS: LevelAxis = 'height';

export const CANVAS_W = 2 * MARGIN_X + COLUMNS * NODE_W + (COLUMNS - 1) * COL_GAP;
const GRID_H = ROWS * NODE_H + (ROWS - 1) * ROW_GAP;
export const BUS_Y = MARGIN_Y + GRID_H + BUS_OFFSET;
/** Below the bus there is only the `OUT L/R` rótulo. */
export const CANVAS_H = BUS_Y + 26;

/** How far above a row the gap runs that a route uses to hop over a neighbour. */
const HOP_LIFT = 9;
/** How far the feedback arc bulges out past the right edge of its node. */
const FEEDBACK_BULGE = 30;

/** One node's box in the canvas, and which slot of the grid it landed in. */
export interface Slot {
  readonly operator: number;
  /**
   * Which row of the drawing the node stands in, counted from the top.
   *
   * In the wide composición it is the depth read upside down, and an operator
   * parked at zero answers `PARKED_BAND_ROW` — a row above the deepest, out of
   * the depth axis entirely, because it has no depth in the chain
   * (`wide-layout.ts`).
   */
  readonly row: number;
  readonly column: number;
  readonly x: number;
  readonly y: number;
  /**
   * The box the node gets, in `viewBox` units. It is a constant here, and it is
   * not in the wide composition: there the depth of the algorithm decides how
   * much height there is to go round (`wide-layout.ts`).
   */
  readonly w: number;
  readonly h: number;
}

/** A modulation line, ready to be drawn. Whether it is dashed is the role's business. */
export interface DrawnRoute {
  readonly from: number;
  readonly into: number;
  readonly path: string;
}

/**
 * The dead end of an operator parked at zero: a short dashed drop out of the
 * node ending in a cross-bar, and nothing after it. Only the wide composition
 * parks anything, so the narrow one never draws one.
 */
export interface DrawnStub {
  readonly operator: number;
  readonly path: string;
}

/** One portadora's drop onto the output bus. */
export interface DrawnBus {
  readonly carrier: number;
  readonly path: string;
}

/**
 * The loop, with somewhere to write `FB n` that is not on top of it — and not on
 * top of the node it belongs to either.
 *
 * `labelX` is the label's **near edge** and not its centre: the words start there
 * and run away from the boxes. It used to be a centre, which put half of `FB 0`
 * back over the node's own right edge and — the nodes being drawn after the
 * labels — under it, so the figure read `B 0` (#68). A centre is the wrong datum
 * for a label whose whole job is to sit beside something.
 */
export interface DrawnFeedback {
  readonly from: number;
  readonly into: number;
  readonly path: string;
  /** The label's near edge, past the arc's bulge. The words run rightwards from it. */
  readonly labelX: number;
  readonly labelY: number;
}

/**
 * Which of the node's two dimensions carries Level.
 *
 * The two values are the box's **named** dimensions and never its long side and
 * its short one. `layout.ts`'s numbers are `viewBox` units stretched with
 * `preserveAspectRatio="none"`, so the ratio a card has on screen belongs to the
 * panel and not to this module: at one moment the wide stacked node is about
 * 1.7 : 1 and the batten about 8 : 1, both carrying Level the same way. A rule
 * phrased as *whichever axis the box actually has* would let a window resize
 * flip the direction of a measurement with nothing failing — which is the shape
 * of the defect this round is named after, one geometry along.
 *
 * So the axis is **stated per composición**, once, by the module that lays that
 * composición out, and read by nobody who could compute it instead.
 */
export type LevelAxis = 'height' | 'width';

/**
 * What a drawing has to keep, or it folds its facts — in the `viewBox` units
 * this module and `wide-layout.ts` are written in.
 *
 * Two numbers and no behaviour, and the reason is the boundary the two halves of
 * this drawing are split along: the criteria behind them are in **CSS pixels**
 * (a gap that holds its arrowhead plus a visible segment; a card that holds five
 * facts), and a layout module that could read a pixel would be a layout module
 * that had to know what the window is doing. So `folding.ts` earns them in
 * pixels and converts them once, here they are stretchable units like everything
 * else, and the conditions that read them are one `||` at the site that draws.
 *
 * The narrow 3 × 3 grid never takes one: three rows are three rows at every
 * window, and its card is the one the fitted width is *measured on*.
 */
export interface FoldRule {
  /** The gap the drawing keeps under a row, at and below which the facts fold. */
  readonly rowGapMin: number;
  /** The narrowest card that still holds five facts, at the lane in hand. */
  readonly cardMin: number;
}

export interface DiagramLayout {
  readonly width: number;
  readonly height: number;
  /**
   * Which way Level runs in this composición's nodes. A literal in each of the
   * two layout modules, never derived from a box (see {@link LevelAxis}).
   */
  readonly levelAxis: LevelAxis;
  /** The eight, in operator order, whatever order they are drawn in. */
  readonly slots: readonly Slot[];
  readonly routes: readonly DrawnRoute[];
  readonly bus: readonly DrawnBus[];
  /** The bus itself, from the leftmost portadora to `OUT L/R`, or null with no topology. */
  readonly busLine: string | null;
  readonly feedback: DrawnFeedback | null;
  /** The dead ends of the operators at zero. Empty unless something was parked. */
  readonly stubs: readonly DrawnStub[];
  /**
   * The height the rows left the node is under what stacking its five facts
   * needs, so the node lays them in a row instead. The layout is what says so,
   * because it is the only thing that knows how many rows shared the height.
   */
  readonly squat: boolean;
  /**
   * The drawing could not hold its facts, so it kept identity and Level and gave
   * up the other three (`folding.ts`). Positions never fold: this says nothing
   * about where any node is, and every slot above is the slot the unfolded
   * drawing would have given it.
   */
  readonly folded: boolean;
}

/**
 * The drawing of one algorithm, or — with no topology read — the eight nodes in
 * operator order and not one line between them. A diagram with no algorithm is
 * not a diagram of algorithm 1.
 */
export function layout(topology: Topology | null): DiagramLayout {
  const slots = place(topology);
  const slotOf = (operator: number) => slots[operator - 1];

  if (topology === null) {
    return {
      width: CANVAS_W,
      height: CANVAS_H,
      levelAxis: LEVEL_AXIS,
      slots,
      routes: [],
      bus: [],
      busLine: null,
      feedback: null,
      stubs: [],
      squat: false,
      folded: false,
    };
  }

  const bus = topology.carriers.map((carrier) => ({
    carrier,
    path: busDrop(slotOf(carrier)),
  }));

  return {
    width: CANVAS_W,
    height: CANVAS_H,
    levelAxis: LEVEL_AXIS,
    slots,
    routes: topology.routes.map((route) => ({
      ...route,
      path: routePath(slotOf(route.from), slotOf(route.into)),
    })),
    bus,
    busLine: busLine(topology.carriers.map(slotOf)),
    feedback: feedbackArc(slotOf(topology.feedback.from), slotOf(topology.feedback.into)),
    stubs: [],
    squat: false,
    folded: false,
  };
}

/**
 * The eight in their slots: deepest first, and by operator number within a depth,
 * filled three to a row. With no topology there is no depth, and the order is the
 * one the operators come in.
 */
function place(topology: Topology | null): Slot[] {
  const operators = [1, 2, 3, 4, 5, 6, 7, 8];
  const depth = (operator: number) => topology?.depth[operator - 1] ?? 0;
  const order = [...operators].sort((a, b) => depth(b) - depth(a) || a - b);

  const slots: Slot[] = [];
  for (const operator of operators) {
    const index = order.indexOf(operator);
    const row = Math.floor(index / COLUMNS);
    const column = index % COLUMNS;
    slots.push({
      operator,
      row,
      column,
      x: MARGIN_X + column * (NODE_W + COL_GAP),
      y: MARGIN_Y + row * (NODE_H + ROW_GAP),
      w: NODE_W,
      h: NODE_H,
    });
  }
  return slots;
}

/** Where a line enters or leaves a node: the middle of its top or bottom edge. */
function topX(slot: Slot): number {
  return slot.x + NODE_W / 2;
}

function bottomY(slot: Slot): number {
  return slot.y + NODE_H;
}

/**
 * The middle of the gap under a row, where a route runs sideways.
 *
 * It was `crossY()` here and `laneY()` in `wide-layout.ts`, which is one object
 * under two names — the doc comment was identical word for word and the two
 * compute the same quantity. Renaming only the wide one would have replaced a
 * collision with a synonym: the next reader greps `gapY` and finds half the
 * drawing. So both carry the name the glossary settles on, and the two modules
 * naming this independently was not a decision anybody took.
 */
function gapY(row: number): number {
  return MARGIN_Y + (row + 1) * NODE_H + row * ROW_GAP + ROW_GAP / 2;
}

/** The gap just above a row, for the routes that hop over a neighbour. */
function hopY(row: number): number {
  return MARGIN_Y + row * (NODE_H + ROW_GAP) - HOP_LIFT;
}

/**
 * The vertical gutter beside a column. It is in the gap between the columns (or
 * in the right margin for the last one), which is what makes a long drop safe: a
 * vertical run in a gutter never crosses a node.
 */
function gutterX(column: number): number {
  return column < COLUMNS - 1
    ? MARGIN_X + column * (NODE_W + COL_GAP) + NODE_W + COL_GAP / 2
    : CANVAS_W - MARGIN_X / 2;
}

/**
 * One modulation line, in orthogonal segments.
 *
 * Three cases, and the depth ordering guarantees the source is never below the
 * target: side by side in the same row, the row straight below, and further down
 * than that.
 */
function routePath(from: Slot, into: Slot): string {
  if (from.row === into.row) {
    // Over the top, because a straight line between two nodes in the same row
    // would cross whatever sits between them.
    return `M ${topX(from)} ${from.y} V ${hopY(from.row)} H ${topX(into)} V ${into.y}`;
  }
  if (into.row === from.row + 1) {
    return `M ${topX(from)} ${bottomY(from)} V ${gapY(from.row)} H ${topX(into)} V ${into.y}`;
  }
  return (
    `M ${topX(from)} ${bottomY(from)} V ${gapY(from.row)} ` +
    `H ${gutterX(from.column)} V ${hopY(into.row)} H ${topX(into)} V ${into.y}`
  );
}

/** A portadora's drop onto the bus: straight down, or down the gutter beside it. */
function busDrop(slot: Slot): string {
  if (slot.row === ROWS - 1) {
    return `M ${topX(slot)} ${bottomY(slot)} V ${BUS_Y}`;
  }
  return `M ${topX(slot)} ${bottomY(slot)} V ${gapY(slot.row)} H ${gutterX(slot.column)} V ${BUS_Y}`;
}

/** The bus, from the leftmost thing that drops onto it to `OUT L/R`. */
function busLine(carriers: readonly Slot[]): string | null {
  if (carriers.length === 0) {
    return null;
  }
  const entries = carriers.map((slot) =>
    slot.row === ROWS - 1 ? topX(slot) : gutterX(slot.column),
  );
  return `M ${Math.min(...entries)} ${BUS_Y} H ${CANVAS_W - MARGIN_X}`;
}

/**
 * The loop, drawn out of the right side of the operator whose output it takes and
 * back into the top of the operator it re-enters. For all but two of the 88 those
 * are the same node and the arc is a small ear on its right; for algorithms 12
 * and 14 it wraps a whole chain and the arc has to reach back up the drawing.
 */
function feedbackArc(from: Slot, into: Slot): DrawnFeedback {
  const out = { x: from.x + NODE_W, y: Math.round(from.y + NODE_H * 0.68) };
  const back = { x: into.x + NODE_W, y: Math.round(into.y + NODE_H * 0.3) };
  const bulge = Math.max(out.x, back.x) + FEEDBACK_BULGE;

  return {
    from: from.operator,
    into: into.operator,
    path: `M ${out.x} ${out.y} C ${bulge} ${out.y}, ${bulge} ${back.y}, ${back.x} ${back.y}`,
    // Past the bulge, and never so far out that the words leave the drawing: in
    // the last column the arc already bulges into the outer half of the margin,
    // so the label is held at the inner edge of that half and writes across it.
    // Nothing else is needed here — `COL_GAP` is 82 units against the arc's 30,
    // so this label never has a neighbouring node to walk into. `wide-layout.ts`,
    // where eight columns leave a gutter of 8, does need more.
    labelX: Math.min(bulge, CANVAS_W - MARGIN_X / 2),
    labelY: Math.min(out.y, back.y) - 8,
  };
}

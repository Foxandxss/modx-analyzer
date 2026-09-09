import { Topology } from '../../backend/backend-gateway';
import { DiagramLayout, DrawnFeedback, DrawnStub, Slot } from './layout';

/**
 * The wide composition's own layout: role read from position, and the position
 * computed from the table rather than drawn by hand.
 *
 * ## Three rules, and the drawing is nothing but them
 *
 * - **A carrier is a node that touches the output bus.** That is the definition
 *   of the word, drawn: the bottom row is chain depth 0, and every operator the
 *   table hangs off the bus drops onto it. Nothing else reaches it.
 * - **Depth is height and every arrow points down.** A route always drops the
 *   chain depth by at least one (`Topology::chain_depth`), so it always runs
 *   from a row to a lower one, and there is no case here — unlike the narrow
 *   grid — of a line that has to hop over a neighbour to reach it.
 * - **An operator at zero is parked to the right on a stub that ends nowhere**,
 *   off the branches, drawn and never deleted. Its routes are not drawn: a line
 *   out of an operator whose Level is 0 carries nothing, and drawing it into the
 *   branches would be a shape making a claim about the sound that the figures
 *   underneath do not make.
 *
 * Whole **branches** stand side by side: each connected structure gets a band of
 * columns to itself (`Topology.branch`, computed in Rust beside the depth), and
 * inside its band each row is centred. So no line ever crosses from one branch
 * to another, because there is no line between them to cross.
 *
 * ## Why the node is not a constant size here
 *
 * The 700 px composition is always three rows of three, so its node can be a
 * constant. This one has as many rows as the algorithm is deep — the 66 has
 * eight of them (#40, `MAX_DEPTH`) — and eight of the narrow node do not fit in
 * the box. So the row pitch is what the depth leaves, the node takes it, and
 * below what stacking five facts needs the node is told to lay them in a row
 * instead ({@link DiagramLayout.squat}) and given the width to do it. Under
 * three rows the node stops growing: the extra room is air, not a bigger node,
 * or the drawing would change size every time the Performance did.
 *
 * The units are the `viewBox`'s, as in `layout.ts`: the panel stretches the box
 * to whatever room it has and the nodes ride it in percentages of the same box.
 */

/** The box the drawing is authored in: `DESIGN.md` §10's 1232 × 400. */
export const WIDE_CANVAS_W = 1232;
export const WIDE_CANVAS_H = 400;

/**
 * The worst case the box has to hold, measured over the 88 rather than assumed
 * (#40): the **1** stands eight operators on one row (`MAX_ROW`) and the **66**
 * is eight rows deep (`MAX_DEPTH` + 1). Both are the same eight boxes, so eight
 * columns and eight rows is the whole surface — never nine of either.
 */
export const WIDE_COLUMNS = 8;
export const WIDE_ROWS = 8;

/** Room for the feedback ear on the right and for the stub's cross-bar. */
const MARGIN_X = 16;
const MARGIN_Y = 6;
/** The narrowest gutter between two nodes, which is what eight columns leave. */
const COL_GAP = 8;
const ROW_GAP_MAX = 26;
/** How far under the last row the bus runs, and the room `OUT L/R` needs below it. */
const BUS_OFFSET = 20;
const OUT_ROOM = 22;

/**
 * Under this many rows the node stops growing. Three is the narrow composition's
 * own row count, so a shallow algorithm draws a node about the size it has
 * there and the rest of the box is air.
 */
const MIN_ROWS = 3;

/** What the five facts need to stack, head to `PREDICTED`, in `viewBox` units. */
const STACK_H = 90;

const NODE_W_MAX = 190;
/** A node that had to lay its facts in a row gets the width to do it. */
const SQUAT_NODE_W_MAX = 380;

const FEEDBACK_BULGE = 20;

/** How wide the bar is that closes a parked operator's stub. */
const STUB_BAR = 34;

interface Placement {
  readonly row: number;
  /** Which column slot the node is centred over. Fractional inside a band. */
  readonly column: number;
}

/** What the whole drawing was sized to, handed to the functions that draw it. */
interface Shape {
  readonly nodeW: number;
  readonly nodeH: number;
  readonly pitchX: number;
  readonly rowGap: number;
  readonly busY: number;
}

/**
 * The wide drawing of one algorithm, with the operators in `cut` — the ones the
 * ring read a Level of 0 for — parked off the branches.
 *
 * With no topology read there is nothing to park and nothing to join: the eight
 * stand in operator order on the bus row and not one line is drawn between them,
 * which is the same refusal the narrow composition makes.
 */
export function wideLayout(topology: Topology | null, cut: readonly number[]): DiagramLayout {
  const operators = [1, 2, 3, 4, 5, 6, 7, 8];
  const parked = topology === null ? [] : operators.filter((operator) => cut.includes(operator));
  const placed = operators.filter((operator) => !parked.includes(operator));

  const depthOf = (operator: number) => topology?.depth[operator - 1] ?? 0;
  const rows = placed.length === 0 ? 1 : Math.max(...placed.map(depthOf)) + 1;
  const slotRows = Math.max(rows, MIN_ROWS);

  const pitchY = (WIDE_CANVAS_H - MARGIN_Y - BUS_OFFSET - OUT_ROOM) / slotRows;
  const rowGap = Math.min(ROW_GAP_MAX, pitchY / 4);
  const nodeH = pitchY - rowGap;
  const squat = nodeH < STACK_H;

  const grid = place(topology, placed, rows, depthOf);
  // The stub never takes the bus row: a dead end reaching down to the bus would
  // be touching the one line that means «you hear this».
  const stubRows = Math.max(1, slotRows - 1);
  const stubColumns = Math.ceil(parked.length / stubRows);
  const columns = Math.max(1, grid.columns + stubColumns);

  const pitchX = (WIDE_CANVAS_W - 2 * MARGIN_X) / columns;
  const nodeW = Math.min(pitchX - COL_GAP, squat ? SQUAT_NODE_W_MAX : NODE_W_MAX);

  // The grid hangs off the bus: with fewer rows than slots the air is at the
  // top, because depth is height and a shallow patch is a short drawing.
  const rowY = (row: number) => MARGIN_Y + (slotRows - rows + row) * pitchY;
  const boxX = (column: number) => MARGIN_X + column * pitchX + (pitchX - nodeW) / 2;

  const slots: Slot[] = operators.map((operator) => {
    const at = grid.at.get(operator);
    if (at !== undefined) {
      return {
        operator,
        row: at.row,
        column: Math.round(at.column),
        x: boxX(at.column),
        y: rowY(at.row),
        w: nodeW,
        h: nodeH,
      };
    }
    const index = parked.indexOf(operator);
    const column = grid.columns + Math.floor(index / stubRows);
    const row = index % stubRows;
    return {
      operator,
      row,
      column,
      x: boxX(column),
      y: MARGIN_Y + row * pitchY,
      w: nodeW,
      h: nodeH,
    };
  });

  const slotOf = (operator: number) => slots[operator - 1];
  const shape: Shape = {
    nodeW,
    nodeH,
    pitchX,
    rowGap,
    busY: rowY(rows - 1) + nodeH + BUS_OFFSET,
  };

  if (topology === null) {
    return {
      width: WIDE_CANVAS_W,
      height: WIDE_CANVAS_H,
      slots,
      routes: [],
      bus: [],
      busLine: null,
      feedback: null,
      stubs: [],
      squat,
    };
  }

  const drawn = (operator: number) => placed.includes(operator);
  const carriers = topology.carriers.filter(drawn);
  const feedback = topology.feedback;

  return {
    width: WIDE_CANVAS_W,
    height: WIDE_CANVAS_H,
    slots,
    routes: topology.routes
      .filter((route) => drawn(route.from) && drawn(route.into))
      .map((route) => ({
        ...route,
        path: routePath(slotOf(route.from), slotOf(route.into), shape),
      })),
    bus: carriers.map((carrier) => ({
      carrier,
      path: busDrop(slotOf(carrier), rows, shape),
    })),
    busLine:
      carriers.length === 0
        ? null
        : `M ${Math.min(...carriers.map((carrier) => centreX(slotOf(carrier), nodeW)))} ` +
          `${shape.busY} H ${WIDE_CANVAS_W - MARGIN_X}`,
    feedback:
      drawn(feedback.from) && drawn(feedback.into)
        ? feedbackArc(slotOf(feedback.from), slotOf(feedback.into), shape)
        : null,
    stubs: parked.map((operator) => stub(slotOf(operator), shape)),
    squat,
  };
}

/**
 * Where each placed operator stands: its row is its chain depth read upside down
 * — depth 0 on the bus — and its column is its branch's band.
 *
 * A band is as wide as the widest row that branch has, and the bands are laid
 * out left to right in the order of the operator that names them, so the drawing
 * is stable: the same algorithm is always the same picture, whatever the ring
 * happened to read first.
 */
function place(
  topology: Topology | null,
  placed: readonly number[],
  rows: number,
  depthOf: (operator: number) => number,
): { columns: number; at: Map<number, Placement> } {
  const at = new Map<number, Placement>();
  const rowOf = (operator: number) => rows - 1 - depthOf(operator);
  const branchOf = (operator: number) => topology?.branch[operator - 1] ?? operator;

  const labels = [...new Set(placed.map(branchOf))].sort((a, b) => a - b);
  let column = 0;
  for (const label of labels) {
    const members = placed.filter((operator) => branchOf(operator) === label);
    const perRow = new Map<number, number[]>();
    for (const operator of members) {
      const row = rowOf(operator);
      perRow.set(row, [...(perRow.get(row) ?? []), operator]);
    }
    const width = Math.max(...[...perRow.values()].map((row) => row.length));

    for (const [row, operatorsOfRow] of perRow) {
      const start = column + (width - operatorsOfRow.length) / 2;
      operatorsOfRow.forEach((operator, index) => {
        at.set(operator, { row, column: start + index });
      });
    }
    column += width;
  }

  return { columns: column, at };
}

function centreX(slot: Slot, nodeW: number): number {
  return slot.x + nodeW / 2;
}

/** The lane in the gap under a row, where a route runs sideways. */
function laneY(slot: Slot, shape: Shape): number {
  return slot.y + shape.nodeH + shape.rowGap / 2;
}

/** The lane in the gap just above a row, for a route that skipped past one. */
function hopY(slot: Slot, shape: Shape): number {
  return slot.y - shape.rowGap / 2;
}

/**
 * The vertical gutter beside a node: half a gap to its right, which is the one
 * place a long drop is safe, because nothing is ever drawn between two columns.
 */
function gutterX(slot: Slot, shape: Shape): number {
  return Math.min(
    slot.x + shape.nodeW + (shape.pitchX - shape.nodeW) / 2,
    WIDE_CANVAS_W - MARGIN_X / 2,
  );
}

/**
 * One modulation line, in orthogonal segments and always downward. Into the row
 * straight below it goes down, across the gap and down again; further than that
 * it takes the gutter, so a long drop never falls through a node.
 */
function routePath(from: Slot, into: Slot, shape: Shape): string {
  const start = `M ${centreX(from, shape.nodeW)} ${from.y + shape.nodeH} V ${laneY(from, shape)}`;
  if (into.row === from.row + 1) {
    return `${start} H ${centreX(into, shape.nodeW)} V ${into.y}`;
  }
  return (
    `${start} H ${gutterX(from, shape)} V ${hopY(into, shape)} ` +
    `H ${centreX(into, shape.nodeW)} V ${into.y}`
  );
}

/** A portadora's drop onto the bus: straight down out of the bottom row. */
function busDrop(slot: Slot, rows: number, shape: Shape): string {
  const out = `M ${centreX(slot, shape.nodeW)} ${slot.y + shape.nodeH}`;
  if (slot.row === rows - 1) {
    return `${out} V ${shape.busY}`;
  }
  return `${out} V ${laneY(slot, shape)} H ${gutterX(slot, shape)} V ${shape.busY}`;
}

/**
 * The dead end of a parked operator: a short dashed drop that stops in a bar
 * across it. It is drawn so that an operator at zero is not merely a node
 * standing on its own — it is a node whose output goes nowhere, said in a line.
 */
function stub(slot: Slot, shape: Shape): DrawnStub {
  const x = centreX(slot, shape.nodeW);
  const from = slot.y + shape.nodeH;
  const end = from + Math.max(8, shape.rowGap * 0.7);
  const bar = Math.min(STUB_BAR, shape.nodeW / 3);
  return {
    operator: slot.operator,
    path: `M ${x} ${from} V ${end} M ${x - bar / 2} ${end} H ${x + bar / 2}`,
  };
}

/**
 * The loop, drawn as the ear on the right of its node that the narrow
 * composition already draws. One vocabulary for one thing: the feedback is the
 * only line in either drawing that runs backwards, and it looks the same in
 * both.
 */
function feedbackArc(from: Slot, into: Slot, shape: Shape): DrawnFeedback {
  const out = { x: from.x + shape.nodeW, y: from.y + shape.nodeH * 0.68 };
  const back = { x: into.x + shape.nodeW, y: into.y + shape.nodeH * 0.3 };
  const ear = Math.min(FEEDBACK_BULGE, (shape.pitchX - shape.nodeW) / 2 + MARGIN_X);
  const bulge = Math.max(out.x, back.x) + ear;

  return {
    from: from.operator,
    into: into.operator,
    path: `M ${out.x} ${out.y} C ${bulge} ${out.y}, ${bulge} ${back.y}, ${back.x} ${back.y}`,
    labelX: Math.max(out.x, back.x) + ear / 2,
    labelY: Math.min(out.y, back.y) - 8,
  };
}

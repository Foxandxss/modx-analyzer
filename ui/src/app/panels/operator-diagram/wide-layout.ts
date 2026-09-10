import { Topology } from '../../backend/backend-gateway';
import { DiagramLayout, DrawnFeedback, DrawnStub, FoldRule, LevelAxis, Slot } from './layout';

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
 *   grid — of a line that has to hop over a neighbour to reach it. The one
 *   exception is a route into the parking band, which has left the depth axis;
 *   it is the paragraph below and it is drawn inert.
 * - **An operator at zero leaves the depth stack**, into a band above the
 *   deepest row, drawn and never deleted and keeping the dashed stub that ends
 *   nowhere. It does **not** move along the axis that carries Level. A line
 *   **out of** it is not drawn; a line **into** it is, inert, onto the bar that
 *   closes its stub. Those are two decisions and the paragraph below is both of
 *   them.
 *
 * Whole **branches** stand side by side: each connected structure gets a band of
 * columns to itself (`Topology.branch`, computed in Rust beside the depth), and
 * inside its band each row is centred. So no line ever crosses from one branch
 * to another, because there is no line between them to cross.
 *
 * ## Parking, and the two directions of a route
 *
 * Parking used to be *to the right*, off the branches, and round 10 is what
 * retires that direction (#83; ADR-0007 §4's principle is untouched). Right is
 * now the **loud** end of the measurement: a silent operator parked there would
 * put its position in direct contradiction with its own figure, on the one
 * composición whose stated principle is that position says it without a caption.
 *
 * So a parked operator leaves the **stack**. It has no depth in the chain, so it
 * is not in the depth axis at all, and it goes into a band above the deepest row
 * at the origin end of the Level axis, laid out from {@link PARKED_BAND_ROW}.
 *
 * **What that costs is a row, and the currency is the point.** Parking used to
 * cost a *column* — a stub column narrowed every card in the drawing — and since
 * the rotation a column is the Level scale, so parking was paying for itself out
 * of the measurement. A row is depth, which is position, and positions are what
 * this drawing is allowed to spend. The band is never wider than the columns
 * parking frees either: an operator leaves the branches before it takes a place
 * in the band, so {@link wideLayout} takes a `Math.max` of the two rather than a
 * sum and an ordinary parking leaves the cards **wider** than they were.
 *
 * **The band is the room parking freed, and that is load-bearing.** The stack
 * closes up behind a parked operator — {@link place} lays out the depths that are
 * actually *occupied*, so a depth nobody is standing at is not a row — and a band
 * needs one row for any number of parked operators, there being eight columns and
 * at most eight of them. So the drawing is never deeper than the eight rows the
 * deepest of the 88 draws unparked, which is the worst case the body's floor was
 * measured at (#81) and the case the fold's own band was checked against. Asserted
 * rather than assumed, in `wide-layout.spec.ts`: no parking of any algorithm gets
 * a card shorter than the 66's.
 *
 * **A route out of a parked operator is not drawn; a route into one is.** Two
 * facts, so two predicates — `drawn(from) && drawn(into)` answered both, which is
 * why a live modulator at Level 99 whose destination was parked drew nothing at
 * all while the silent operator it fed got a dashed drop to a cross-bar, and why
 * no test could tell the two decisions apart (#70).
 *
 * The asymmetry's reason is **geometric and not audibility**: both directions end
 * in no audio, so audibility cannot be what decides that one gets ink. Parking
 * has already displaced the operator onto its stub bar, so its inbound edges land
 * where it now lives and are drawable; its outbound edges would have to run back
 * into the chain it was removed from, re-tangling the run parking exists to clear.
 * The asymmetry is therefore a consequence of a decision already taken.
 *
 * **What it costs is said out loud:** an outbound route is a documented route the
 * drawing does not show. What makes that acceptable is a decision the app has
 * already taken and this rule inherits rather than re-takes — the drawing is of
 * the algorithm **as configured** and not of the algorithm abstractly, and
 * parking is itself patch-dependent geometry.
 *
 * The ink is not new: a feedback amount of zero already ships dashed and inert on
 * exactly this reasoning (#57, {@link feedbackArc}), because the arc comes from
 * the documented topology and not from the amount. A route into a parked operator
 * is the same sentence about a different line — *this is in the algorithm and it
 * carries nothing* — and it is said the same way, in `--inert` on
 * `--dash-inactive`, decided where the Levels are (`OperatorDiagram.routes`).
 *
 * It is also the one line in this drawing that runs **upward**, which is the
 * price of the band being above the deepest row; a drawing that drew it downward
 * would be a drawing that had parked the operator back into the depth axis. It
 * lands on the bar rather than on a card, and {@link deadEndPath} is where the
 * gap under the band is split so that the bar and the line landing on it are not
 * fighting for the same pixels.
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
 * Below what a *gap* needs there is no room left to take, and that is where the
 * drawing stops shrinking its facts and **folds** them instead ({@link FoldRule},
 * `folding.ts`): the deepest operators keep their row, their order and their
 * place above what they modulate, and give up three of their five facts so the
 * gap can have the height they stop needing. Positions never fold, because depth
 * is height and a folded position would be a folded topology.
 *
 * The units are the `viewBox`'s, as in `layout.ts`: the panel stretches the box
 * to whatever room it has and the nodes ride it in percentages of the same box.
 */

/** The box the drawing is authored in: `DESIGN.md` §10's 1232 × 400. */
export const WIDE_CANVAS_W = 1232;
export const WIDE_CANVAS_H = 400;

/**
 * The worst case the box has to hold across its width, measured over the 88
 * rather than assumed (#40): the **1** stands eight operators on one row
 * (`MAX_ROW`), and eight boxes cannot be nine columns.
 *
 * **There is no `WIDE_ROWS` beside it any more.** It said 8, for the **66** at
 * `MAX_DEPTH` + 1, and it was the same eight boxes read down instead of across —
 * but the two are no longer the same kind of fact. The columns are what the
 * drawing has; the rows are what it is asked for, and past a certain number of
 * them the drawing folds its facts rather than drawing rows it cannot hold
 * ({@link FoldRule}). A constant declaring the deepest row count therefore
 * declares a case the fold now decides, and a reader who found it would take it
 * for a bound. Eight is still the deepest of the 88, and it is a fact about the
 * table, so it is asserted where the table is: `wide-layout.spec.ts` sweeps the
 * row counts and `algorithms.rs` owns `MAX_DEPTH`.
 */
export const WIDE_COLUMNS = 8;

/**
 * This composición carries Level in the node's **width**, in both of its boxes.
 *
 * ## The bidding, which is the whole argument
 *
 * The vertical direction was carrying two quantities at once. Across nodes it
 * means depth in the chain; inside a node it meant Level. Those were never
 * comparable numbers, and they were bidding for the same pixels: at the body's
 * floor the deepest algorithm leaves a card of about 24 px, of which the fill's
 * track is 11.6, so two operators at 99 and 96 were drawn **0.35 px apart** —
 * two individually correct rules, the winner starving the loser to a third of a
 * pixel. Turning Level onto the other axis is what pays the loser: at the
 * narrowest card this layout draws, one Level point is about **1.02 px**.
 *
 * ## Both boxes, and never per box
 *
 * The batten and the wide stacked node carry it the same way. One axis per
 * composición: the alternative — vertical in the stacked node, horizontal in the
 * batten — would flip the direction of a measurement *inside one drawing*, at a
 * boundary ({@link STACK_H}) the pianist has no reason to know about. And it
 * must not be read off the box either; see {@link LevelAxis}, which is where
 * that temptation is refused.
 *
 * ## What it costs, and what it does not
 *
 * The far end of this axis is now the **loud** end, so an operator parked at
 * zero can no longer be parked there: that would put its position in direct
 * contradiction with its own figure, on the one composición whose stated
 * principle is that position says it without a caption. Parking leaves the
 * *stack* instead — the third rule above, and it arrived in #83 one commit after
 * the axis did. Depth is still height, and the only line that does not point down
 * is the one that goes into the band parking moved to.
 */
const LEVEL_AXIS: LevelAxis = 'width';

/**
 * Room for the feedback ear on the right and for the stub's cross-bar.
 *
 * ## Why this is part of the module's surface now
 *
 * The narrowest card this layout can draw is about to become the basis of a
 * floor the whole composición is earned against (#75, and #86 behind it), and
 * that card is decided by exactly four numbers: {@link WIDE_CANVAS_W}, this one,
 * {@link COL_GAP} and {@link WIDE_COLUMNS}. Two of them were module-private, so
 * «the check recomputes it from four constants» was a claim about an interface
 * that did not exist and the check would have had to re-declare them.
 *
 * A re-declaration is a copy, and a check whose subject is a copy goes green
 * while the screen says something else — the defect `legend.ts` was written to
 * remove. So the inputs to the floor are what this module promises, not how it
 * happens to be written, and an edit to any of them moves the floor in one
 * place: `node-geometry.ts` recomputes the narrowest card off these four, and
 * `wide-layout.spec.ts` recomputes it a third time on purpose, to check that the
 * layout's own `Math.min` agrees and that neither width cap binds.
 */
export const MARGIN_X = 16;
const MARGIN_Y = 6;
/**
 * The narrowest gutter between two nodes, which is what eight columns leave.
 *
 * Exported, and part of the surface, for the reason written at {@link MARGIN_X}.
 */
export const COL_GAP = 8;
/**
 * The most a gap ever takes of a row's pitch, and — since #82 — **the least**.
 *
 * The cap is the old half: a shallow drawing does not spend its room on air. The
 * floor is the fold's: a gap has to hold its arrowhead plus a visible segment or
 * the line in it is a stub under a point, and below that the drawing folds its
 * facts and the card gives the gap the height it stops needing. The floor is not
 * a constant here because it is earned in pixels at the body's floor — it is
 * {@link FoldRule.rowGapMin}, and `folding.ts` is where it comes from. Never
 * both at once in a real drawing: the floor is 17.5 units against this 26.
 */
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

/**
 * The row a parked operator is drawn in: the band above the deepest, which is
 * one above the top of the stack and therefore not a row of the depth axis.
 *
 * It is a number and not a `null` because a slot's row is read by things that
 * compare rows — {@link feedbackArc}'s crowding, {@link busDrop}'s bus row — and
 * a parked operator has to answer those questions wrongly-but-safely rather than
 * not answer them. Minus one is the answer that makes every one of them false:
 * it is in no row any placed operator is in, and it is above all of them in the
 * same sense the band is.
 */
export const PARKED_BAND_ROW = -1;

/**
 * How the gap under the parking band is split, as shares of that gap.
 *
 * The bar that closes a stub hangs in it and a route into that stub has to reach
 * the bar without running along it, so the two cannot both have the middle. The
 * bar takes the near share and the route crosses **under** every bar in the far
 * one, which leaves the route's last segment — the one the arrowhead sits on —
 * the {@link STUB_LANE} − {@link STUB_BAR_AT} between them. That is about a third
 * of the gap, against the half a route gets to turn down into a card, and it is
 * the same gap either way: a drawing whose gap cannot hold an arrowhead plus a
 * visible segment folds (`folding.ts`), and that floor is what both of these
 * shares are spent out of.
 *
 * The far share stops short of the row below, so a line crossing under the bars
 * never touches the cards of the deepest row.
 */
const STUB_BAR_AT = 0.4;
const STUB_LANE = 0.75;

/**
 * How tall a row is at a given row count, and how much of that the node gets.
 *
 * It was exported so that `node-geometry.ts` could ask this same question to
 * find the smallest card the layout draws; that caller left with the axis, and
 * the export went module-private with it. **#81 is the caller it was said to be
 * waiting for**, and what it wants is not a Level scale but the property the
 * body's floor is anchored on: the deepest algorithm is the worst case, so a
 * floor measured there is a floor at every depth. That is a claim about *this*
 * function — `nodeH` is decided by the row count and by nothing else, and it
 * never grows with one — and a spec cannot make it without being handed the
 * function. {@link wideLayout} calls it rather than repeating it, so the two
 * cannot answer differently and the assertion is about what the drawing does.
 *
 * `viewBox` units, like everything else in this module. What the card measures
 * on screen is that share of the canvas's own rendered height, which is
 * `node-geometry.ts`'s half of the arithmetic and not this one's.
 */
export function wideRowPitch(
  slotRows: number,
  rowGapMin = 0,
): {
  readonly pitchY: number;
  readonly rowGap: number;
  readonly nodeH: number;
} {
  const pitchY = (WIDE_CANVAS_H - MARGIN_Y - BUS_OFFSET - OUT_ROOM) / slotRows;
  // The gap between the two, and the card takes what is left of the pitch. With
  // no floor asked for this is the drawing that shipped before the fold — which
  // is what `NEVER_FOLDS` gets, and what the anchor was measured on.
  const rowGap = Math.min(ROW_GAP_MAX, Math.max(pitchY / 4, rowGapMin));
  return { pitchY, rowGap, nodeH: pitchY - rowGap };
}

/**
 * Whether this drawing folds its facts: **one mechanism, and both of its
 * triggers are this line.**
 *
 * - *Too deep for its rows*: the gap the pitch leaves has fallen under what a
 *   gap has to hold — its arrowhead plus a visible segment.
 * - *Too narrow for its five facts*: the card is under the width those five
 *   facts are known to fit in.
 *
 * Either one folds, and what they fold is identical, which is the whole reason
 * they are one mechanism and not two behaviours a pianist has to learn apart.
 * Read `folding.ts` for where the two numbers come from and — the half that gets
 * forgotten — for the floor that folding does **not** resolve: one Level point
 * never smaller than a pixel is a hard floor on the window, because folding the
 * facts does not widen the card by one pixel.
 *
 * Both are judged on the **unfolded** drawing, which is the drawing this one
 * would otherwise have been. That keeps the decision from standing on its own
 * consequence, and it is what makes the fold monotone: the card the fold hands
 * back is never taller than the one it replaced, so a floor measured unfolded at
 * the deepest algorithm is a floor at every depth (#81).
 */
function foldsFacts(unfolded: { rowGap: number }, card: number, rule: FoldRule): boolean {
  return unfolded.rowGap < rule.rowGapMin || card < rule.cardMin;
}

/** The card the columns leave, capped by what the node class is allowed. */
function cardWidth(pitchX: number, squat: boolean): number {
  return Math.min(pitchX - COL_GAP, squat ? SQUAT_NODE_W_MAX : NODE_W_MAX);
}

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
export function wideLayout(
  topology: Topology | null,
  cut: readonly number[],
  fold: FoldRule,
): DiagramLayout {
  const operators = [1, 2, 3, 4, 5, 6, 7, 8];
  const parked = topology === null ? [] : operators.filter((operator) => cut.includes(operator));
  const placed = operators.filter((operator) => !parked.includes(operator));

  const depthOf = (operator: number) => topology?.depth[operator - 1] ?? 0;

  const grid = place(topology, placed, depthOf);
  // With nothing left in the branches there is still a bus row, so that the one
  // line meaning «you hear this» is where it always is in a drawing that has one.
  const rows = Math.max(grid.rows, 1);
  // One row for the band, whatever is in it, and it is the row the stack gave up:
  // `place()` lays out the occupied depths, so a parked operator takes its own
  // row out of the chain before the band takes one. Eight stays the deepest
  // drawing there is, which is what the body's floor is anchored on (#81).
  const slotRows = Math.max(rows + (parked.length === 0 ? 0 : 1), MIN_ROWS);
  // A `max` and not a sum, for the same reason: an operator is either in the
  // branches or in the band, so the band is never wider than the columns parking
  // freed, and the drawing never passes `WIDE_COLUMNS`.
  const columns = Math.max(1, grid.columns, parked.length);
  // The columns are the fold's business and the fold is not theirs: parking
  // moves a box out of the branches and into the band and neither one folds
  // anything, so this width is the same in both drawings.
  const pitchX = (WIDE_CANVAS_W - 2 * MARGIN_X) / columns;

  const unfolded = wideRowPitch(slotRows);
  const folded = foldsFacts(unfolded, cardWidth(pitchX, unfolded.nodeH < STACK_H), fold);
  const { pitchY, rowGap, nodeH } = folded ? wideRowPitch(slotRows, fold.rowGapMin) : unfolded;
  // Still the card's own question and not the fold's: how many lines the facts
  // it kept are laid in is decided by the height it ended with, which is why a
  // node folded for its width keeps stacking and a folded batten does not.
  const squat = nodeH < STACK_H;
  const nodeW = cardWidth(pitchX, squat);

  // The grid hangs off the bus: with fewer rows than slots the air is at the
  // top, because depth is height and a shallow patch is a short drawing. Row
  // `PARKED_BAND_ROW` is inside the box for the same reason the band is a row —
  // with anything parked there is at least one slot row above the chain.
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
    // Out of the stack and into the band above the deepest row, laid out from the
    // origin end of the Level axis in operator order. Never along that axis: the
    // far end of it is the loud end, and a silent operator drawn there would be a
    // position contradicting its own figure.
    const column = parked.indexOf(operator);
    return {
      operator,
      row: PARKED_BAND_ROW,
      column,
      x: boxX(column),
      y: rowY(PARKED_BAND_ROW),
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
      levelAxis: LEVEL_AXIS,
      slots,
      routes: [],
      bus: [],
      busLine: null,
      feedback: null,
      stubs: [],
      squat,
      folded,
    };
  }

  /**
   * Whether a route **out of** this operator is drawn at all. It is not, when the
   * operator is parked: that line would have to run back into the chain the
   * operator was removed from, re-tangling the run parking exists to clear. The
   * cost — a documented route the drawing does not show — is named in the header.
   */
  const sends = (operator: number) => !parked.includes(operator);
  /**
   * Whether a route **into** this operator ends on a dead end rather than on a
   * card. It does, when the operator is parked — and it is still *drawn*, because
   * parking has already put the operator somewhere its inbound edges can land.
   *
   * Two predicates and not one conjunction: these answer different questions, and
   * one predicate answering both is what drew nothing at all out of a modulator at
   * Level 99 whose destination was parked (#70).
   */
  const deadEnds = (operator: number) => parked.includes(operator);

  const carriers = topology.carriers.filter(sends);
  const feedback = topology.feedback;

  return {
    width: WIDE_CANVAS_W,
    height: WIDE_CANVAS_H,
    levelAxis: LEVEL_AXIS,
    slots,
    routes: topology.routes
      .filter((route) => sends(route.from))
      .map((route) => ({
        ...route,
        path: deadEnds(route.into)
          ? deadEndPath(slotOf(route.from), slotOf(route.into), shape)
          : routePath(slotOf(route.from), slotOf(route.into), shape),
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
    // The loop is read through the same two predicates, and it answers no to
    // both: for 86 of the 88 its two ends are one operator, so the outbound rule
    // decides it alone. What the other two — algorithms 12 and 14, where the arc
    // wraps a chain — do **not** get is the inbound rule above. The arc is an ear
    // on a card's right edge and a card in the parking band has no ear to take it
    // without the arc being redrawn, which is a geometry nobody has decided; it is
    // written here rather than resolved in silence.
    feedback:
      sends(feedback.from) && !deadEnds(feedback.into)
        ? feedbackArc(slotOf(feedback.from), slotOf(feedback.into), shape, slots)
        : null,
    stubs: parked.map((operator) => stub(slotOf(operator), shape)),
    squat,
    folded,
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
 *
 * ## The rows are the depths that are *occupied*
 *
 * With the eight in the branches every depth from the bus up is occupied, by
 * construction: an operator at depth `d` has a route into something at `d − 1`
 * (`Topology::chain_depth`), so a depth with nobody in it cannot exist and this
 * reads exactly as «row is depth» for all of the 88 drawn whole.
 *
 * It is parking that makes the difference, and it is the point: the stack **closes
 * up** behind an operator that leaves it, rather than keeping an empty row where
 * it stood. Every route still runs downward, because dropping the depth by at
 * least one still drops the rank by at least one. And the row the stack gave up is
 * the row the parking band takes, which is what keeps a drawing with anything
 * parked from being deeper than the deepest of the 88 ({@link wideLayout}).
 */
function place(
  topology: Topology | null,
  placed: readonly number[],
  depthOf: (operator: number) => number,
): { rows: number; columns: number; at: Map<number, Placement> } {
  const at = new Map<number, Placement>();
  const ranks = [...new Set(placed.map(depthOf))].sort((a, b) => b - a);
  const rowOf = (operator: number) => ranks.indexOf(depthOf(operator));
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

  return { rows: ranks.length, columns: column, at };
}

function centreX(slot: Slot, nodeW: number): number {
  return slot.x + nodeW / 2;
}

/**
 * The middle of the gap under a row, where a route runs sideways. `layout.ts`
 * has the same function under the same name, and that is deliberate: it is one
 * object, and the two modules naming it apart was never a decision.
 */
function gapY(slot: Slot, shape: Shape): number {
  return slot.y + shape.nodeH + shape.rowGap / 2;
}

/** The gap just above a row, for a route that skipped past one. */
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
 *
 * A route whose destination is parked is {@link deadEndPath} and not this one:
 * the destination has left the depth axis, so there is no row below to drop into.
 */
function routePath(from: Slot, into: Slot, shape: Shape): string {
  const start = `M ${centreX(from, shape.nodeW)} ${from.y + shape.nodeH} V ${gapY(from, shape)}`;
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
  return `${out} V ${gapY(slot, shape)} H ${gutterX(slot, shape)} V ${shape.busY}`;
}

/**
 * The dead end of a parked operator: a short dashed drop that stops in a bar
 * across it. It is drawn so that an operator at zero is not merely a node
 * standing on its own — it is a node whose output goes nowhere, said in a line.
 *
 * The drop is a **share of the gap** and no longer a maximum with a floor of
 * eight units in it. Since parking moved into a band (#83) the bar hangs in a gap
 * that also has to let a route reach it, so the two split that gap between them
 * ({@link STUB_BAR_AT}) instead of the stub taking most of it; and the gap below
 * which this drawing folds rather than shrink anything further is the fold's
 * floor, which is what makes a share safe where it used not to be.
 */
function stub(slot: Slot, shape: Shape): DrawnStub {
  const x = centreX(slot, shape.nodeW);
  const from = slot.y + shape.nodeH;
  const end = stubBarY(slot, shape);
  const bar = Math.min(STUB_BAR, shape.nodeW / 3);
  return {
    operator: slot.operator,
    path: `M ${x} ${from} V ${end} M ${x - bar / 2} ${end} H ${x + bar / 2}`,
  };
}

/** Where the bar that closes a parked operator's stub hangs, in the gap under it. */
function stubBarY(slot: Slot, shape: Shape): number {
  return slot.y + shape.nodeH + shape.rowGap * STUB_BAR_AT;
}

/**
 * A route into a parked operator: the same orthogonal segments as any other, run
 * the other way and ending on the bar that closes the operator's stub.
 *
 * It leaves the source's **top** edge, because the band it is going to is above
 * the deepest row, and it is the only line in this drawing that climbs. The two
 * cases are {@link routePath}'s two, mirrored: out of the row directly under the
 * band it goes straight up into the lane; from deeper than that it lifts into the
 * gap above its own row and climbs the gutter, where a long run crosses no card.
 *
 * The last two segments are what the ticket asks for and what the gap was split
 * for: across in the lane **under** every bar, so a parked operator's dead end is
 * never run along or crossed, then up onto its own bar, which is the segment the
 * arrowhead sits on.
 */
function deadEndPath(from: Slot, into: Slot, shape: Shape): string {
  const lane = into.y + shape.nodeH + shape.rowGap * STUB_LANE;
  const start = `M ${centreX(from, shape.nodeW)} ${from.y}`;
  const climb = from.row === 0 ? '' : ` V ${hopY(from, shape)} H ${gutterX(from, shape)}`;
  return `${start}${climb} V ${lane} H ${centreX(into, shape.nodeW)} V ${stubBarY(into, shape)}`;
}

/**
 * The loop, drawn as the ear on the right of its node that the narrow
 * composition already draws. One vocabulary for one thing: the feedback is the
 * only line in either drawing that runs backwards, and it looks the same in
 * both.
 *
 * ## Why `FB 0` is dashed and inert rather than deleted
 *
 * The arc comes from the documented topology and not from the amount, so it is
 * drawn at every amount there is — including none. A solid route beside a `FB 0`
 * is the drawing making a claim about the sound that the figure under it does
 * not make, which is precisely the sentence the third rule above refuses for an
 * operator at Level 0. So it is answered the same way: the arc keeps its place
 * and loses its ink, in `--inert` on `--dash-inactive`, the pair the stub just
 * above already uses. Deleting it would say the loop is not in this algorithm,
 * which is a different and false statement — and it would take the `FB` label
 * with it, hiding a figure the anillo went and read.
 *
 * The decision is made where the amount is: `OperatorDiagram.feedback`, over the
 * polled figure. Both compositions read it, so both drawings say the same thing.
 *
 * ## Where `FB n` goes, and why it is not simply beside the arc
 *
 * The rule #68 opened, and what round 10 proposes for `DESIGN.md` §20 (#87 puts
 * it there): a label is never painted over by a node, and it is aligned **away**
 * from the boxes rather than centred over an edge. The anchor is therefore the
 * label's near edge, one bulge past the node, and the words run outward from it.
 *
 * That is the whole rule in the narrow grid, where two columns are `COL_GAP = 82`
 * units apart. Here they are **eight**, so at the widest algorithms the gutter is
 * narrower than the word `FB`, and a label written into it lands on the next
 * card. So when another box stands to the right in the same row, the label is
 * **lifted out of the row** into the gap above it — the same clear band a route
 * hops through ({@link hopY}), which is why the lift is that function and not a
 * number: a gap wide enough for a line to run sideways in is the gap the drawing
 * has, and if the row pitch ever changes the label follows it.
 *
 * It is lifted only where the lift lands inside the drawing. On the top row of an
 * algorithm deep enough to fill the box there is neither a gutter nor a gap, and
 * the label stays on the arc's line and crosses its neighbour. That is not a
 * choice made here — it is the round's other proposed rule, that a gap must hold
 * what is drawn in it, failing at the same depth for the same reason. #82 is
 * where the drawing folds instead of running out of room; until it lands, the
 * paint order is what keeps those labels readable, and #91 carries the six
 * algorithms it still bites.
 */
function feedbackArc(from: Slot, into: Slot, shape: Shape, slots: readonly Slot[]): DrawnFeedback {
  const out = { x: from.x + shape.nodeW, y: from.y + shape.nodeH * 0.68 };
  const back = { x: into.x + shape.nodeW, y: into.y + shape.nodeH * 0.3 };
  const ear = Math.min(FEEDBACK_BULGE, (shape.pitchX - shape.nodeW) / 2 + MARGIN_X);
  const bulge = Math.max(out.x, back.x) + ear;

  // The label belongs to the higher of the two boxes: for all but two of the 88
  // they are the same box, and where the loop wraps a chain the words go at the
  // end the arc comes back to.
  const anchor = from.y <= into.y ? from : into;
  const crowded = slots.some((slot) => slot.row === anchor.row && slot.x > anchor.x);
  const lift = hopY(anchor, shape);

  return {
    from: from.operator,
    into: into.operator,
    path: `M ${out.x} ${out.y} C ${bulge} ${out.y}, ${bulge} ${back.y}, ${back.x} ${back.y}`,
    labelX: Math.min(bulge, WIDE_CANVAS_W - MARGIN_X),
    labelY: crowded && lift >= MARGIN_Y ? lift : Math.min(out.y, back.y) - 8,
  };
}

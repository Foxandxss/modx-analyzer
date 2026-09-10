import { describe, expect, it } from 'vitest';
import { Topology } from '../../backend/backend-gateway';
import { Slot } from './layout';
import {
  COL_GAP,
  MARGIN_X,
  WIDE_CANVAS_H,
  WIDE_CANVAS_W,
  WIDE_COLUMNS,
  WIDE_ROWS,
  wideLayout,
} from './wide-layout';

/** A topology as the table sends it, with the depth and the branch computed alike. */
function topology(
  number: number,
  routes: readonly [number, number][],
  carriers: readonly number[],
  feedback: [number, number] = [1, 1],
): Topology {
  return {
    number,
    routes: routes.map(([from, into]) => ({ from, into })),
    carriers,
    feedback: { from: feedback[0], into: feedback[1] },
    depth: chainDepth(routes),
    branch: branches(routes),
    provenance: 'documented',
  };
}

/** Rust's `Topology::chain_depth`, so a test topology is shaped like a real one. */
function chainDepth(routes: readonly [number, number][]): number[] {
  const depth = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let pass = 0; pass < 8; pass += 1) {
    for (const [from, into] of routes) {
      depth[from - 1] = Math.max(depth[from - 1], depth[into - 1] + 1);
    }
  }
  return depth;
}

/** Rust's `Topology::branches`: everything a route joins, whichever way it points. */
function branches(routes: readonly [number, number][]): number[] {
  const branch = [1, 2, 3, 4, 5, 6, 7, 8];
  for (let pass = 0; pass < 8; pass += 1) {
    for (const [from, into] of routes) {
      const lowest = Math.min(branch[from - 1], branch[into - 1]);
      branch[from - 1] = lowest;
      branch[into - 1] = lowest;
    }
  }
  return branch;
}

/** `Init Normal (FM-X)`: the 1-2-3-4 chain, five portadoras, the loop on Op1. */
const ALGORITHM_2 = topology(
  2,
  [
    [1, 2],
    [2, 3],
    [3, 4],
  ],
  [4, 5, 6, 7, 8],
);

/** The **1**: eight portadoras on the bus, `MAX_ROW` and `MAX_PARALLEL_BRANCHES`. */
const ALGORITHM_1 = topology(1, [], [1, 2, 3, 4, 5, 6, 7, 8]);

/** The **66**: the single chain of eight, `MAX_DEPTH`. Eight rows. */
const ALGORITHM_66 = topology(
  66,
  [
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 8],
  ],
  [8],
);

/** The **68**: seven moduladores into Op8, `MAX_BRANCH_ROW`. */
const ALGORITHM_68 = topology(
  68,
  [
    [1, 8],
    [2, 8],
    [3, 8],
    [4, 8],
    [5, 8],
    [6, 8],
    [7, 8],
  ],
  [8],
);

/** Algorithm 12: the loop wraps a chain, Op5's output back into Op3. */
const ALGORITHM_12 = topology(
  12,
  [
    [3, 4],
    [4, 5],
    [6, 7],
    [7, 8],
  ],
  [1, 2, 5, 8],
  [5, 3],
);

/** The four the maxima of #40 were measured on, which is what the box is sized to. */
const THE_WORST_CASES = [ALGORITHM_1, ALGORITHM_66, ALGORITHM_68, ALGORITHM_12];

function slot(slots: readonly Slot[], operator: number): Slot {
  return slots[operator - 1];
}

/**
 * The narrowest card the wide layout can draw, recomputed rather than written
 * down, from the four constants that decide it and from nothing else.
 *
 * Eight columns is the whole surface (#40, {@link WIDE_COLUMNS}), so the
 * narrowest card is what one column of eight leaves once the two margins and the
 * gutter are spent. That number is about to be the basis of a floor the whole
 * composición is earned against (#86), so it is recomputed here from the
 * module's own constants: a literal would be a fifth declaration of it, silently
 * correct until the day somebody moves one of the four.
 *
 * **Neither node-width cap is in this derivation, and that is deliberate.**
 * `NODE_W_MAX` and `SQUAT_NODE_W_MAX` are ceilings, and at eight columns both
 * sit above this number and never decide it — a floor derived from a cap would
 * be a floor about a card the layout never draws, and it would make the floor a
 * property of the node class, which it is not: at the column cap a squat card
 * and a stacked one are the same width. Which is also what stops the assertion
 * below being a tautology: `wideLayout` takes a `Math.min` of this geometry and
 * a cap, so it agreeing with the geometry is exactly the claim that the cap did
 * not bind.
 *
 * ## What this check catches, and what it cannot
 *
 * Made to fail on purpose, one constant at a time. It goes red on
 * {@link WIDE_COLUMNS} moving either way — the layout counts its own columns off
 * the table and never reads that constant, so the two disagree immediately — and
 * on either cap dropping under the geometry.
 *
 * It stays green on {@link MARGIN_X}, {@link COL_GAP} and {@link WIDE_CANVAS_W},
 * and no arrangement of it could do otherwise: the layout and this function read
 * the same three numbers, so they move together by construction. #75 asked for
 * both «recompute it, never write the value down» and «go red when any of the
 * four moves», and those two are exclusive — the only witness that could fail on
 * a margin edit is the literal the first half forbids. The first half is the one
 * worth having, because the failure it prevents is the silent one: a floor
 * carrying a number nobody re-earned. An edit to a margin is not silent — it
 * moves the floor here, in one place, and #86's floor is computed from it.
 */
function narrowestCardWidth(): number {
  const pitchX = (WIDE_CANVAS_W - 2 * MARGIN_X) / WIDE_COLUMNS;
  return pitchX - COL_GAP;
}

/** The `M x y V y2 H x2 …` of a path, as numbers, so a test can read a line. */
function points(path: string): number[] {
  return path
    .split(/[ ,]+/)
    .filter((token) => token !== '' && !Number.isNaN(Number(token)))
    .map(Number);
}

function overlap(a: Slot, b: Slot): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Whether a point of the drawing falls within a node's box. */
function inside(at: { x: number; y: number }, box: Slot): boolean {
  return at.x >= box.x && at.x <= box.x + box.w && at.y >= box.y && at.y <= box.y + box.h;
}

/**
 * How far right the feedback arc actually reaches, off the path the layout drew.
 *
 * The two control points of the cubic both sit at the bulge, so the curve gets
 * three quarters of the way there and no further: `x(½) = ⅛(P₀ + 3P₁ + 3P₂ + P₃)`.
 * Read from the path rather than recomputed, so the assertion is about the ink
 * and not about a second copy of the arithmetic that drew it.
 */
function arcTipX(path: string): number {
  const [x0, , c1x, , c2x, , x3] = points(path);
  return (x0 + 3 * c1x + 3 * c2x + x3) / 8;
}

describe('the wide diagram layout', () => {
  it('states that Level runs along the node, in both of its boxes', () => {
    // The four worst cases cover both node classes — the 66 is eight rows of
    // batten and the 1 is one row of stacked node — and the answer is the same
    // for both, including the drawing with no topology read. One axis per
    // composición: a rule that read the box would answer differently on an 8 : 1
    // batten and a 1.7 : 1 card, which is the same drawing.
    for (const drawn of [...THE_WORST_CASES, null]) {
      const wide = wideLayout(drawn, []);
      expect(wide.levelAxis).toBe('width');
    }
    expect(wideLayout(ALGORITHM_66, []).squat).toBe(true);
    expect(wideLayout(ALGORITHM_1, []).squat).toBe(false);
  });

  it('stands the portadoras on the bus row and everything else above them', () => {
    const { slots } = wideLayout(ALGORITHM_2, []);

    // Depth is height, read from the bus up: Op4 is a portadora and Op1 is three
    // deep, so Op1 is three rows above it.
    expect(slot(slots, 4).row).toBe(3);
    expect(slot(slots, 3).row).toBe(2);
    expect(slot(slots, 1).row).toBe(0);
    for (const carrier of [4, 5, 6, 7, 8]) {
      expect(slot(slots, carrier).y).toBe(slot(slots, 4).y);
    }
    // And the moduladores are drawn strictly higher than the row they feed.
    expect(slot(slots, 1).y).toBeLessThan(slot(slots, 2).y);
  });

  it('touches the bus with every portadora and with nothing else', () => {
    for (const drawn of THE_WORST_CASES) {
      const { slots, bus, busLine } = wideLayout(drawn, []);

      expect(bus.map((drop) => drop.carrier)).toEqual([...drawn.carriers]);
      const busY = points(busLine ?? '')[1];
      for (const drop of bus) {
        const line = points(drop.path);
        // It leaves the middle of the node's bottom edge and ends on the bus.
        expect(line[0]).toBeCloseTo(slot(slots, drop.carrier).x + slot(slots, drop.carrier).w / 2);
        expect(line.at(-1)).toBe(busY);
      }
      // Nothing that is not a portadora reaches the bus: every other node's foot
      // stops above it, and it has no line of its own going down.
      for (const each of slots) {
        if (!drawn.carriers.includes(each.operator)) {
          expect(each.y + each.h).toBeLessThan(busY);
        }
      }
    }
  });

  it('runs every route downward, and never sideways', () => {
    for (const drawn of THE_WORST_CASES) {
      const { slots, routes } = wideLayout(drawn, []);

      for (const route of routes) {
        const from = slot(slots, route.from);
        const into = slot(slots, route.into);
        // A route always drops the chain depth by at least one, so the source is
        // always on a higher row and the arrow always points down into the
        // target's top edge. The feedback arc is the only line that runs back.
        expect(from.row).toBeLessThan(into.row);
        expect(points(route.path).at(-1)).toBe(into.y);
      }
    }
  });

  it('parks an operator at zero on a stub off the branches and draws no line of its', () => {
    const { slots, routes, bus, stubs } = wideLayout(ALGORITHM_2, [1, 5]);

    // Op1 modulates Op2 and Op5 is a portadora; both are cut, so both stand to
    // the right of every operator still in the drawing.
    const branchesRight = Math.max(
      ...[2, 3, 4, 6, 7, 8].map((operator) => slot(slots, operator).x),
    );
    expect(slot(slots, 1).x).toBeGreaterThan(branchesRight);
    expect(slot(slots, 5).x).toBeGreaterThan(branchesRight);

    // Its route and its drop are not drawn at all: a line out of an operator at
    // zero carries nothing, and drawing it would claim it did.
    expect(routes.map((route) => route.from)).not.toContain(1);
    expect(bus.map((drop) => drop.carrier)).toEqual([4, 6, 7, 8]);

    // What it gets instead is a dead end: a drop out of the node, a bar across
    // it, and nothing after it.
    expect(stubs.map((dead) => dead.operator)).toEqual([1, 5]);
    const dead = points(stubs[0].path);
    expect(dead[1]).toBe(slot(slots, 1).y + slot(slots, 1).h);
    expect(dead[3]).toBeGreaterThan(dead[1]);
    expect(dead.at(-1)).toBeGreaterThan(dead[4]);
  });

  it('never lets a stub reach the bus, whatever is left in the drawing', () => {
    // Six of the eight at zero is an ordinary two-operator patch, not an edge
    // case: it is what the running build reads off the keyboard.
    const { busLine, stubs } = wideLayout(ALGORITHM_2, [1, 2, 5, 6, 7, 8]);

    const busY = points(busLine ?? '')[1];
    expect(stubs).toHaveLength(6);
    for (const dead of stubs) {
      // `M x y V end M x end H x`: the drop's own end is the lowest the stub
      // ever gets, and it stops above the one line that means «you hear this».
      expect(points(dead.path)[2]).toBeLessThan(busY);
    }
  });

  it('holds the measured worst cases inside 1232 × 400, with nothing overlapping', () => {
    for (const drawn of THE_WORST_CASES) {
      const { slots, routes, bus, busLine, feedback, width, height } = wideLayout(drawn, []);

      expect(width).toBe(WIDE_CANVAS_W);
      expect(height).toBe(WIDE_CANVAS_H);
      expect(new Set(slots.map((each) => each.row)).size).toBeLessThanOrEqual(WIDE_ROWS);
      expect(new Set(slots.map((each) => each.column)).size).toBeLessThanOrEqual(WIDE_COLUMNS);

      for (const each of slots) {
        expect(each.x).toBeGreaterThanOrEqual(0);
        expect(each.y).toBeGreaterThanOrEqual(0);
        expect(each.x + each.w).toBeLessThanOrEqual(WIDE_CANVAS_W);
        expect(each.y + each.h).toBeLessThanOrEqual(WIDE_CANVAS_H);
      }
      // Eight boxes, and not one of them on top of another: the 66 is eight rows
      // and the 1 is eight columns, which is the whole surface (#40).
      for (const a of slots) {
        for (const b of slots) {
          expect(a === b || !overlap(a, b)).toBe(true);
        }
      }

      const paths = [
        ...routes.map((route) => route.path),
        ...bus.map((drop) => drop.path),
        busLine ?? '',
      ];
      for (const path of paths) {
        for (const value of points(path)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(Math.max(WIDE_CANVAS_W, WIDE_CANVAS_H));
        }
      }
      expect(feedback).not.toBeNull();
    }
  });

  it('stops the node growing under three rows and lays it down over five', () => {
    // Three rows is the narrow composition's own count: under it the room the
    // depth did not use is air, not a bigger node, or the drawing would change
    // size every time the Performance did.
    const shallow = wideLayout(ALGORITHM_1, []);
    const two = wideLayout(topology(6, [[1, 2]], [2, 3, 4, 5, 6, 7, 8]), []);
    expect(slot(two.slots, 1).h).toBe(slot(shallow.slots, 1).h);
    expect(shallow.squat).toBe(false);

    // The 66 is eight rows in the same box: the node cannot stack five facts in
    // an eighth of it, so it is told to lay them in a row and given the width.
    const deep = wideLayout(ALGORITHM_66, []);
    expect(deep.squat).toBe(true);
    expect(slot(deep.slots, 1).h).toBeLessThan(slot(shallow.slots, 1).h);
    expect(slot(deep.slots, 1).w).toBeGreaterThan(slot(shallow.slots, 1).w);
  });

  /**
   * The floor's inputs, asserted as a fact about the drawing rather than as a
   * number in a file.
   *
   * Two things are being claimed, and the second is what makes the first worth
   * having. The **1** is the eight-column case, and the card it draws is the
   * geometry — margins and gutter — with no cap in it. And nothing the layout
   * draws is narrower, parking included: a parked operator takes its column out
   * of the branches before it takes one on the stub, so the total never passes
   * eight and the floor cannot be undercut from behind.
   *
   * What this does **not** assert is a lane width, a body width or a per-class
   * share. Those are presentations of this same number, and asserting one of
   * them would put the floor's derivation somewhere it can drift from the card.
   */
  it('draws its narrowest card at eight columns, and no cap decides it', () => {
    // The eight-column case, drawn: the 1 stands eight portadoras on the bus row.
    const wide = wideLayout(ALGORITHM_1, []);
    expect(new Set(wide.slots.map((each) => each.column)).size).toBe(WIDE_COLUMNS);
    expect(slot(wide.slots, 1).w).toBe(narrowestCardWidth());

    // And nothing narrower exists, over the measured worst cases and over the
    // parkings that move operators from the branches onto the stubs.
    const everyCard = [ALGORITHM_2, ...THE_WORST_CASES].flatMap((drawn) =>
      [[], [1], [1, 5], [1, 2, 5, 6, 7, 8]].flatMap((cut) =>
        wideLayout(drawn, cut).slots.map((each) => each.w),
      ),
    );
    expect(Math.min(...everyCard, wideLayout(null, []).slots[0].w)).toBe(narrowestCardWidth());
  });

  it('stands whole branches side by side and never crosses one with another', () => {
    const { slots } = wideLayout(ALGORITHM_12, []);

    // 1 · 2 · [3 4 5] · [6 7 8]: four branches, and each one keeps a band of
    // columns to itself, so no line ever has to cross from one to another.
    const band = (operators: number[]) => ({
      left: Math.min(...operators.map((operator) => slot(slots, operator).x)),
      right: Math.max(
        ...operators.map((operator) => slot(slots, operator).x + slot(slots, operator).w),
      ),
    });
    const chain = band([3, 4, 5]);
    const other = band([6, 7, 8]);
    expect(band([1]).right).toBeLessThanOrEqual(band([2]).left);
    expect(band([2]).right).toBeLessThanOrEqual(chain.left);
    expect(chain.right).toBeLessThanOrEqual(other.left);
  });

  /**
   * The label rule at the seam that decides it. The anchor is the label's near edge and
   * the words run away from the boxes, so a point clear of every node is a label
   * clear of every node — and a point *inside* one is what the screen showed:
   * `FB 0` half under its own card, reading `B 0` (#68).
   *
   * Algorithm 1 is in the sweep because it is the case that breaks the obvious
   * fix. Eight operators on the bus row is eight columns, and eight columns
   * leave a `COL_GAP` of 8 units between two cards — narrower than the word — so
   * a label merely moved off its own node lands squarely on Op2's. The lift out
   * of the row is what that case is for, and nothing else in the 88 makes it
   * fail this loudly.
   */
  it('writes FB n past the arc and clear of every node', () => {
    for (const drawn of [ALGORITHM_2, ...THE_WORST_CASES]) {
      const { slots, feedback } = wideLayout(drawn, []);
      const anchor = { x: feedback?.labelX ?? 0, y: feedback?.labelY ?? 0 };

      for (const box of slots) {
        expect(inside(anchor, box), `algorithm ${drawn.number}, Op${box.operator}`).toBe(false);
      }
      // Past the ink it names, and never off the end of the drawing.
      expect(anchor.x).toBeGreaterThan(arcTipX(feedback?.path ?? ''));
      expect(anchor.x).toBeLessThan(WIDE_CANVAS_W);
      expect(anchor.y).toBeGreaterThan(0);
    }
  });

  it('lifts the label out of its row only when a box stands to its right', () => {
    // The 1: Op1 carries the loop and Op2 through Op8 are beside it on the bus
    // row, so the gutter is 8 units and the words go into the gap above.
    const crowded = wideLayout(ALGORITHM_1, []);
    const op1 = slot(crowded.slots, 1);
    expect(crowded.slots.some((box) => box.row === op1.row && box.x > op1.x)).toBe(true);
    expect(crowded.feedback?.labelY ?? 0).toBeLessThan(op1.y);

    // The 66 is a single chain, so Op1 is alone on the top row and the whole
    // right of the drawing is empty: the label stays on the arc's own line, and
    // a lift there would move a figure away from the thing it names for nothing.
    const roomy = wideLayout(ALGORITHM_66, []);
    const loop = slot(roomy.slots, 1);
    expect(roomy.slots.some((box) => box.row === loop.row && box.x > loop.x)).toBe(false);
    expect(roomy.feedback?.labelY ?? 0).toBeGreaterThan(loop.y);
  });

  it('keeps OUT L/R below every box, so the bus can be labelled at its own end', () => {
    // The rótulo is drawn at `height - 20` and hard against the right edge; what
    // has to be true is that the last row ends above it in every algorithm,
    // including the deepest, where the rows are at their tightest.
    for (const drawn of [ALGORITHM_2, ...THE_WORST_CASES]) {
      const { slots, height } = wideLayout(drawn, []);
      for (const box of slots) {
        expect(box.y + box.h, `algorithm ${drawn.number}, Op${box.operator}`).toBeLessThan(
          height - 20,
        );
      }
    }
  });

  it('draws the eight in operator order when no algorithm has been read', () => {
    const { slots, routes, bus, busLine, feedback, stubs } = wideLayout(null, [1, 2]);

    expect(slots.map((each) => each.operator)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    // They all stand on one row, in order, and nothing is parked: with no table
    // there is no branch to be off, so nothing is put aside for being at zero.
    for (const each of slots) {
      expect(each.y).toBe(slots[0].y);
      expect(each.row).toBe(0);
    }
    expect(slots[0].x).toBeLessThan(slots[7].x);
    expect(stubs).toEqual([]);
    // And not one line: a diagram with no algorithm is not a diagram of the 1.
    expect(routes).toEqual([]);
    expect(bus).toEqual([]);
    expect(busLine).toBeNull();
    expect(feedback).toBeNull();
  });
});

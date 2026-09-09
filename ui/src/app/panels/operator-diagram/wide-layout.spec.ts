import { describe, expect, it } from 'vitest';
import { Topology } from '../../backend/backend-gateway';
import { Slot } from './layout';
import { WIDE_CANVAS_H, WIDE_CANVAS_W, WIDE_COLUMNS, WIDE_ROWS, wideLayout } from './wide-layout';

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

describe('the wide diagram layout', () => {
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

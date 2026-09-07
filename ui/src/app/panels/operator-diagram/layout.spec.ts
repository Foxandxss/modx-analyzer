import { describe, expect, it } from 'vitest';
import { Topology } from '../../backend/backend-gateway';
import { BUS_Y, CANVAS_H, CANVAS_W, COLUMNS, NODE_H, NODE_W, ROWS, Slot, layout } from './layout';

/** A topology as the table sends it, with the chain depth computed the same way. */
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

/** Every operator on the bus and not one line between them. */
const ALGORITHM_1 = topology(1, [], [1, 2, 3, 4, 5, 6, 7, 8]);

/** The longest chain of the 88: eight operators deep, Op8 out. */
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

describe('diagram layout', () => {
  it('lays the eight out by chain depth, deepest first', () => {
    const { slots } = layout(ALGORITHM_2);

    // Op1 modulates Op2 modulates Op3 modulates Op4: four depths, so four slots
    // in a row, and the portadoras behind them.
    expect(slot(slots, 1).row).toBe(0);
    expect(slot(slots, 1).column).toBe(0);
    expect(slot(slots, 2).column).toBe(1);
    expect(slot(slots, 3).column).toBe(2);
    // Op4 is a portadora at depth 0 and falls in with the other four.
    expect(slot(slots, 4).row).toBe(1);
    expect(slot(slots, 8).row).toBe(2);
  });

  it('always fills exactly three rows, whatever the algorithm', () => {
    for (const drawn of [ALGORITHM_1, ALGORITHM_2, ALGORITHM_66, null]) {
      const { slots, width, height } = layout(drawn);

      expect(new Set(slots.map((each) => each.row))).toEqual(new Set([0, 1, 2]));
      expect(slots.every((each) => each.column < COLUMNS)).toBe(true);
      // Eight nodes three to a row is three rows, so the canvas never changes
      // size and never has to be scaled to fit.
      expect(width).toBe(CANVAS_W);
      expect(height).toBe(CANVAS_H);
    }
  });

  it('draws the eight in operator order when no algorithm has been read', () => {
    const { slots, routes, bus, busLine, feedback } = layout(null);

    expect(slots.map((each) => each.operator)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(slot(slots, 1).column).toBe(0);
    expect(slot(slots, 4).row).toBe(1);
    // And not one line: a diagram with no algorithm is not a diagram of the first.
    expect(routes).toEqual([]);
    expect(bus).toEqual([]);
    expect(busLine).toBeNull();
    expect(feedback).toBeNull();
  });

  it('runs every route downwards in the reading order', () => {
    for (const drawn of [ALGORITHM_2, ALGORITHM_66]) {
      const { slots, routes } = layout(drawn);

      for (const route of routes) {
        const from = slot(slots, route.from);
        const into = slot(slots, route.into);
        const order = (each: Slot) => each.row * COLUMNS + each.column;
        // A route always drops the chain depth, so the source is always earlier
        // in the grid than the target. The feedback arc is the only line that
        // runs the other way, which is what a feedback loop is.
        expect(order(from)).toBeLessThan(order(into));
      }
    }
  });

  it('ends every route on the top edge of the node it modulates', () => {
    const { slots, routes } = layout(ALGORITHM_2);
    const into = slot(slots, 2);
    const line = routes.find((route) => route.into === 2);

    const drawn = points(line?.path ?? '');
    expect(drawn.at(-1)).toBe(into.y);
    // And it leaves from the middle of the source's edge, not from a corner.
    expect(drawn[0]).toBe(slot(slots, 1).x + NODE_W / 2);
  });

  it('hops over the top when both ends are in the same row', () => {
    const { slots, routes } = layout(ALGORITHM_2);
    const line = routes.find((route) => route.from === 1 && route.into === 2);
    const from = slot(slots, 1);

    // Op1 and Op2 are side by side, and a straight line between two nodes in a
    // row would cross whatever sits between them: the lane is above the row.
    expect(points(line?.path ?? '')[1]).toBe(from.y);
    expect(points(line?.path ?? '')[2]).toBeLessThan(from.y);
  });

  it('drops every portadora onto the bus and runs it to OUT L/R', () => {
    const { slots, bus, busLine } = layout(ALGORITHM_2);

    expect(bus.map((drop) => drop.carrier)).toEqual([4, 5, 6, 7, 8]);
    for (const drop of bus) {
      // Whatever the route it takes to get there, it ends on the bus.
      expect(points(drop.path).at(-1)).toBe(BUS_Y);
    }
    // A portadora in the bottom row drops straight down; one further up steps
    // into the lane beside it first, because a drop through a node is a lie.
    expect(points(bus[4].path)).toHaveLength(3);
    expect(points(bus[0].path).length).toBeGreaterThan(3);
    expect(slot(slots, 4).row).toBeLessThan(ROWS - 1);
    expect(busLine).toContain(`${BUS_Y}`);
  });

  it('draws the loop on the operator the chart puts it on', () => {
    const { slots, feedback } = layout(ALGORITHM_2);
    const op1 = slot(slots, 1);

    expect(feedback?.from).toBe(1);
    expect(feedback?.into).toBe(1);
    // It leaves the right edge of Op1 and comes back to it: a small ear, drawn
    // outside the node so it never sits on top of a figure.
    expect(points(feedback?.path ?? '')[0]).toBe(op1.x + NODE_W);
    expect(feedback?.labelX ?? 0).toBeGreaterThan(op1.x + NODE_W);
    expect(feedback?.labelY ?? 0).toBeLessThan(op1.y + NODE_H);
  });

  it('reaches back up the drawing when the loop wraps a chain', () => {
    // Algorithm 12: Op5's output back into Op3, three nodes away.
    const twelve = topology(
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
    const { slots, feedback } = layout(twelve);

    expect(feedback?.from).toBe(5);
    expect(feedback?.into).toBe(3);
    const drawn = points(feedback?.path ?? '');
    expect(drawn[0]).toBe(slot(slots, 5).x + NODE_W);
    expect(drawn.at(-2)).toBe(slot(slots, 3).x + NODE_W);
  });

  it('keeps every line inside the canvas', () => {
    for (const drawn of [ALGORITHM_1, ALGORITHM_2, ALGORITHM_66]) {
      const { routes, bus, busLine, feedback } = layout(drawn);
      const paths = [
        ...routes.map((route) => route.path),
        ...bus.map((drop) => drop.path),
        busLine ?? '',
        feedback?.path ?? '',
      ];

      for (const path of paths) {
        for (const value of points(path)) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(Math.max(CANVAS_W, CANVAS_H));
        }
      }
    }
  });
});

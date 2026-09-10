import { describe, expect, it } from 'vitest';
import {
  BODY_FLOOR,
  Box,
  ColumnState,
  DESIGN_BODY_W,
  DIAGRAM_W,
  FIGURES_W,
  FLAT,
  RAIL_W,
  STRIP_H,
  columnGeometry,
  columnShape,
  cycleAspect,
  diagramLane,
  stripFrame,
} from './column-geometry';
import { LEGEND_H, legendHeight } from '../operator-diagram/legend';

/** 1280 × 800, the window the design is drawn at, minus the 58 px header band. */
const ROOM: Box = { width: 1280, height: 742 };

/** The state as the app runs it, with one ranura filled and the strip below. */
function state(partial: Partial<ColumnState> = {}): ColumnState {
  return { filled: [true, false], pinned: false, waterfallBelow: true, ...partial };
}

describe('columnShape', () => {
  it('is the two ranuras when either half holds a panel', () => {
    expect(columnShape([true, false], false)).toBe('ranuras');
    expect(columnShape([false, true], false)).toBe('ranuras');
    expect(columnShape([true, true], false)).toBe('ranuras');
  });

  it('collapses to the rail when both are empty, so a handle is left behind', () => {
    expect(columnShape([false, false], false)).toBe('rail');
  });

  /**
   * The pin takes the column away rather than leaving a rail: `KEEP IT BIG` is
   * itself the one press back, and it is in the header of the panel it is about.
   * A rail beside it would be a second control for the same state.
   */
  it('takes the column away for the pin, whatever the pair holds', () => {
    expect(columnShape([true, true], true)).toBe('gone');
    expect(columnShape([false, false], true)).toBe('gone');
  });
});

describe('columnGeometry', () => {
  /**
   * Fixed geometry, which is the rule this module exists for: a panel that
   * changes size with its neighbour is a shape you have to learn twice.
   */
  it('gives both ranuras the same box whatever the other one holds', () => {
    const alone = columnGeometry(state({ filled: [true, false] }), ROOM);
    const below = columnGeometry(state({ filled: [false, true] }), ROOM);
    const both = columnGeometry(state({ filled: [true, true] }), ROOM);

    for (const drawing of [alone, below, both]) {
      expect(drawing.ranuras[0]).toEqual(drawing.ranuras[1]);
      expect(drawing.frames[0]).toEqual(drawing.frames[1]);
    }
    expect(below.ranuras).toEqual(alone.ranuras);
    expect(both.ranuras).toEqual(alone.ranuras);
    expect(both.frames).toEqual(alone.frames);
  });

  it('leaves an empty ranura its half as glass and not as room the other takes', () => {
    const { ranuras, frames, body, column } = columnGeometry(
      state({ filled: [true, false] }),
      ROOM,
    );

    // Half the body each, less the filete between them, and neither is zero.
    expect(ranuras[1].height).toBeCloseTo((body.height - 2) / 2);
    expect(ranuras[0].height + ranuras[1].height + 2).toBeCloseTo(body.height);
    expect(frames[1].width).toBeGreaterThan(0);
    expect(frames[1].height).toBeGreaterThan(0);
    expect(column).toBe(368);
  });

  it('leaves the diagram exactly its own width while the column is open', () => {
    const { body, column } = columnGeometry(state(), ROOM);

    expect(body.width - column - FIGURES_W - 4).toBe(DIAGRAM_W);
  });

  /** One press has to bring a panel back, so the two handles keep the two halves. */
  it('collapses to the rail with the handles still halving it', () => {
    const { shape, column, ranuras, frames } = columnGeometry(
      state({ filled: [false, false] }),
      ROOM,
    );

    expect(shape).toBe('rail');
    expect(column).toBe(RAIL_W);
    expect(ranuras[0]).toEqual(ranuras[1]);
    expect(ranuras[0].width).toBe(RAIL_W);
    // A handle is not glass: there is no frame inside it and nothing painting.
    expect(frames[0]).toEqual({ width: 0, height: 0 });
  });

  it('gives the pinned composición no lane at all', () => {
    const { shape, column, ranuras, frames } = columnGeometry(state({ pinned: true }), ROOM);

    expect(shape).toBe('gone');
    expect(column).toBe(0);
    expect(ranuras[0]).toEqual({ width: 0, height: 0 });
    expect(frames[0]).toEqual({ width: 0, height: 0 });
  });

  /**
   * The emptied strip hands its room back rather than staying as a box holding a
   * panel that moved out.
   */
  it('gives the room of the collapsed strip to the body, all of it', () => {
    const below = columnGeometry(state({ waterfallBelow: true }), ROOM);
    const above = columnGeometry(state({ filled: [true, true], waterfallBelow: false }), ROOM);

    expect(below.strip).toBe(STRIP_H);
    expect(above.strip).toBe(0);
    expect(above.body.height - below.body.height).toBe(STRIP_H);
    // And the ranuras are the ones that grow: nothing is left drawn small.
    expect(above.ranuras[0].height - below.ranuras[0].height).toBe(STRIP_H / 2);
  });

  it('scrolls rather than taking the body under the floor the drawing needs', () => {
    const { body } = columnGeometry(state(), { width: 1280, height: 300 });

    expect(body.height).toBe(BODY_FLOOR);
  });

  it('leaves the drawing the height #19 measured, whatever the legend costs', () => {
    // The floor is `minmax(378px, 1fr)` in app.ts, and 378 is not #19's number.
    // #19 measured 360 with the legend at one row; the legend is two rows since
    // #65 and its band comes out of the canvas, so the floor carries the extra.
    //
    // The claim is the relation, not the number: whatever the legend takes, the
    // canvas is left with exactly what it was left with when 360 was measured.
    // Written this way the floor follows a future change to the legend's rows
    // instead of becoming a constant nobody can re-earn.
    expect(BODY_FLOOR - LEGEND_H).toBe(360 - legendHeight(1));
    expect(BODY_FLOOR).toBe(378);
  });

  it('gives the diagram exactly DIAGRAM_W with the ranuras open', () => {
    // The 700 is declared once, as the column's remainder in app.ts. Reading it
    // back through the lane arithmetic keeps the legend's width check and the
    // sheet talking about the same box.
    expect(diagramLane('ranuras', DESIGN_BODY_W)).toBe(DIAGRAM_W);
    // And the other two are wider, which is why the ranuras lane is the one that
    // binds the legend. Neither is floored — see diagramLane.
    expect(diagramLane('rail', DESIGN_BODY_W)).toBeGreaterThan(DIAGRAM_W);
    expect(diagramLane('gone', DESIGN_BODY_W)).toBeGreaterThan(DIAGRAM_W);
  });
});

/**
 * «Four cycles read as a wave and not a flat line» is not assertable through the
 * DOM — jsdom lays nothing out and paints nothing. What is assertable is the box
 * the scope is handed, and how much of a cycle fits across it.
 */
describe('the box four cycles are drawn in', () => {
  it('was a flat line in the bottom strip', () => {
    const frame = stripFrame(ROOM.width);

    expect(frame).toEqual({ width: 1244, height: 83 });
    // Each cycle four times wider than the whole trace is tall: a ripple.
    expect(cycleAspect(frame)).toBeGreaterThan(FLAT);
    expect(cycleAspect(frame)).toBeCloseTo(4.07, 2);
  });

  it('is a wave in a ranura, where a cycle is taller than it is wide', () => {
    const { frames } = columnGeometry(state({ filled: [true, false] }), ROOM);

    expect(frames[0]).toEqual({ width: 336, height: 220 });
    expect(cycleAspect(frames[0])).toBeLessThan(1);
    // An order of magnitude of shape, from one move and no new drawing code.
    expect(cycleAspect(stripFrame(ROOM.width)) / cycleAspect(frames[0])).toBeGreaterThan(9);
  });
});

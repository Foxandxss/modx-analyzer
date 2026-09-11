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
  RULE,
  STRIP_H,
  bodyGap,
  bodyWidthFor,
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

  it('leaves the drawing the height the 360 promised, whatever the legend costs', () => {
    // The floor is `minmax(382px, 1fr)` in app.ts, and 382 is not the 360.
    // 360 was taken with the legend at one row; the legend is two rows since #65
    // and its band comes out of the canvas, so the floor carries the extra.
    //
    // The 360 is cited to #19 nowhere any more, because #19 is "Text collides at
    // full size" and has no height in it at all (#81). What is left is an
    // unwitnessed number and a relation that is worth keeping either way.
    //
    // The claim is the relation, not the number: whatever the legend takes, the
    // canvas is left with exactly what it was left with when 360 was taken.
    // Written this way the floor follows a future change to the legend's rows
    // instead of becoming a constant nobody can re-earn.
    expect(BODY_FLOOR - LEGEND_H).toBe(360 - legendHeight(1));
    expect(BODY_FLOOR).toBe(382);
  });

  /**
   * The legend's band is an input to the floor, and it is the one that moved.
   *
   * The floor was 378 for as long as this module believed the legend's band was
   * 54 px. It is 62 on screen — the swatch's rule is drawn outside its declared
   * box, four pixels per swatch — so the canvas at the floor was 278 px where
   * `floorCanvasHeight()` computed 286, and every figure derived through that
   * scale was 3 % optimistic (#81).
   *
   * Asserted as the relation and not as 62: the number is `legend.ts`'s to hold,
   * and a copy of it here is the second declaration that lets the two drift. What
   * this owns is that a pixel the legend takes is a pixel the floor grows by, in
   * both directions, so the term can never go quietly unspent again.
   */
  it('is decided by the drawing’s half, so the legend’s band reaches it', () => {
    // Which of the two halves wins is what makes the legend an input at all: the
    // floor is a `Math.max`, and if the vistas' 360 were the larger the legend
    // could take a whole extra row without the floor moving a pixel — and the
    // canvas would silently lose it. Asserted as the comparison rather than as
    // 62, whose one declaration is `legend.ts`'s.
    expect(360 - legendHeight(1) + LEGEND_H).toBeGreaterThan(360);
    expect(BODY_FLOOR).toBe(360 - legendHeight(1) + LEGEND_H);
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
 * The filete, which is the one number this module and the sheet used to hold two
 * copies of.
 *
 * `diagramLane()` subtracted a whole filete on both boundaries in every shape,
 * while the sheet halved them with the pin down. So the model returned 1 068 px
 * for a lane the screen was drawing at 1 070, inside the one module whose stated
 * contract is that the two mirror each other (#76). The sheet was right: 1 070
 * is what a user actually has, and the half-gap is a judged visual decision with
 * its reason written at its site.
 */
describe('the filete between two lanes', () => {
  it('is whole where a lane stands between the two gaps', () => {
    expect(bodyGap('ranuras')).toBe(RULE);
    expect(bodyGap('rail')).toBe(RULE);
  });

  /**
   * Two gaps with a 0 px track between them read as a rule of double thickness,
   * so each is half. Asserted through the shape whose middle lane is zero rather
   * than through the class name the sheet used to key it to.
   */
  it('is half where the lane between them has closed to nothing', () => {
    const { column } = columnGeometry(state({ pinned: true }), ROOM);

    expect(column).toBe(0);
    expect(bodyGap('gone')).toBe(RULE / 2);
  });

  it('is the lane arithmetic’s only source for the gap, in every shape', () => {
    // Recomputed from the gap this module hands the sheet, never from a literal:
    // an edit to either has to move both or fail here.
    for (const shape of ['ranuras', 'rail', 'gone'] as const) {
      const { column } = columnGeometry(
        state({
          filled: shape === 'ranuras' ? [true, false] : [false, false],
          pinned: shape === 'gone',
        }),
        ROOM,
      );

      expect(diagramLane(shape, DESIGN_BODY_W)).toBe(
        DESIGN_BODY_W - column - FIGURES_W - 2 * bodyGap(shape),
      );
    }
  });

  /**
   * Which arm moved, so the direction does not read as good news. Against the
   * 999 px the Level axis will be earned against, the pinned slack is 71 px and
   * not the 69 the model used to imply — and the **binding** arm is the rail at
   * 17 px, which this change does not touch at all.
   */
  it('leaves the rail arm alone and puts the pinned lane where the screen draws it', () => {
    expect(diagramLane('rail', DESIGN_BODY_W)).toBe(1016);
    expect(diagramLane('gone', DESIGN_BODY_W)).toBe(1070);
  });
});

/**
 * The width floor's arithmetic, the other way round: the body that leaves the
 * diagram a given lane. It is what the grid computes on its own once the lane
 * is the first track's minimum — `minmax(var(--lane-floor), 1fr)` in `app.ts` —
 * and the model has to say the same sum, or a test of the floor would be a test
 * of a number the screen is not drawing (#86). The lane itself is
 * `node-geometry.ts`'s; what is asserted here is the inverse and nothing about
 * where the lane comes from.
 */
describe('the body a lane costs', () => {
  it('is the inverse of the lane, in the two shapes that have one', () => {
    for (const shape of ['rail', 'gone'] as const) {
      for (const lane of [700, 999, 1016, 1070]) {
        const body = bodyWidthFor(shape, lane);
        expect(body).not.toBeNull();
        expect(diagramLane(shape, body!)).toBeCloseTo(lane, 9);
      }
    }
  });

  /**
   * One lane, two floors: the shapes differ by what stands beside the lane, 52 px
   * of rail against none and a whole filete against half of one. That is the
   * whole reason the floor is not a constant — one number would over-constrain
   * the pinned shape by exactly this difference.
   */
  it('differs between the rail and the pin by the rail and the halved filete', () => {
    const lane = 999;
    expect(bodyWidthFor('rail', lane)! - bodyWidthFor('gone', lane)!).toBe(
      RAIL_W + 2 * (bodyGap('rail') - bodyGap('gone')),
    );
    expect(bodyWidthFor('rail', lane)).toBe(lane + RAIL_W + FIGURES_W + 2 * RULE);
    expect(bodyWidthFor('gone', lane)).toBe(lane + FIGURES_W + RULE);
  });

  it('has no answer for the ranuras, whose lane is DIAGRAM_W by construction', () => {
    // `null` and not 0: there the column is the remainder and the lane never
    // moves, so no body width «puts the lane at» anything — and a zero would
    // read as a width.
    expect(bodyWidthFor('ranuras', 999)).toBeNull();
    expect(bodyWidthFor('ranuras', DIAGRAM_W)).toBeNull();
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

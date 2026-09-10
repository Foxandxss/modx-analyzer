import { describe, expect, it } from 'vitest';
import { DESIGN_BODY_W, diagramLane, type ColumnShape } from '../glass-column/column-geometry';
import { LEGEND, legendHeight, legendRoom, legendRowWidth, textWidth } from './legend';

/**
 * The three shapes the column takes, at the one body width the app is designed
 * for. Named here rather than as three literals so the diagram's lane comes from
 * the same arithmetic the composición uses.
 */
const SHAPES: readonly ColumnShape[] = ['ranuras', 'rail', 'gone'];

describe('the diagram legend', () => {
  describe('fits the band it is drawn in', () => {
    // THIS IS A CLAIM ABOUT THREE WIDTHS, NOT ABOUT ANY WIDTH.
    //
    // A green test evaluated at three points reads very easily as "fits
    // whatever the lane is", which is the assumption that put a hard-coded 700
    // in the sheet in the first place. Below roughly 912 px of body the lane
    // drops under DIAGRAM_W in every shape and this says nothing about it — and
    // nothing else in the composición survives down there either, which is why
    // the width floor is #66 and not this one.
    for (const shape of SHAPES) {
      const lane = diagramLane(shape, DESIGN_BODY_W);

      LEGEND.forEach((row, i) => {
        it(`row ${i + 1} fits the ${shape} lane at ${DESIGN_BODY_W} px of body`, () => {
          expect(legendRowWidth(row)).toBeLessThanOrEqual(legendRoom(lane));
        });
      });
    }
  });

  it('pairs the two roles above, and the two things that are not roles below', () => {
    // The pairing is a rule, so it gets a claim of its own. It is stated in
    // swatches and not in words on purpose: the swatch is the stable identity
    // and the words are §6's business, so a sanctioned copy rewording still
    // passes here while moving an entry between rows does not.
    //
    // It cannot be checked by reading LEGEND — the template and the arithmetic
    // both follow LEGEND, so an edit that moved an entry would stay green
    // everywhere. This is the one place the grouping is written down twice, and
    // that is what makes it falsifiable.
    //
    // Row 1: the two roles the algorithm confers (CONTEXT.md — portadora and
    // modulador derive from the topology). Row 2: the two facts that are not
    // roles — inactivo is Level 0 "sea cual sea su posición", and the ceiling
    // datum is of the patch and not of any node's role.
    expect(LEGEND.map((row) => row.map((entry) => entry.swatch))).toEqual([
      ['carrier', 'modulator'],
      ['inert', 'datum'],
    ]);
  });

  it('does not fit in one row, which is why there are two', () => {
    // The failure #65 reported, kept as arithmetic: all four entries on one row
    // are ~906 px in the 664 the narrowest lane leaves. If this ever stops being
    // true the two-row layout is no longer paying for itself and the pairing
    // rule can be revisited — but it is not to be revisited by discovering the
    // legend fits again by accident.
    const everything = LEGEND.flat();
    const room = legendRoom(diagramLane('ranuras', DESIGN_BODY_W));

    expect(legendRowWidth(everything)).toBeGreaterThan(room);
  });

  /**
   * The swatch's rule is drawn **outside** its declared box, and both of this
   * module's numbers used to spend it nowhere.
   *
   * `.legend__swatch` is `22 × 14` with a `--rule-min` border and no
   * `box-sizing: border-box` anywhere near it, so what the screen gives it is
   * `26 × 18`. Measured in the harness at 1280 × 800, off the rendered boxes:
   * swatch 26 × 18, row 18, legend 62 px against the 54 this module computed
   * (#81).
   *
   * The height is the half that reaches the body's floor — `LEGEND_H` is a term
   * of `BODY_FLOOR` — and the width is the half that reaches #65's clipping
   * check, which was passing with four pixels per swatch it had not counted.
   * Both are asserted here, because neither can be read off `legendHeight()`
   * alone: they are the same 2 px seen from two directions.
   */
  describe('spends the rule drawn around the swatch', () => {
    it('gives a row the swatch’s drawn height, not its declared one', () => {
      // One row plus the gap between rows. It was 18 while the border went
      // unspent; the four pixels are the two rules above and below the swatch.
      expect(legendHeight(2) - legendHeight(1)).toBe(22);
      expect(legendHeight(2)).toBe(62);
    });

    it('gives an entry the swatch’s drawn width, not its declared one', () => {
      const [entry] = LEGEND[0];
      // 26 of drawn swatch and 8 of `--space-2`, which is the whole of what an
      // entry costs beyond its words.
      expect(legendRowWidth([entry]) - textWidth(entry.words)).toBe(34);
    });
  });

  describe('measuring words', () => {
    it('counts the tracking after every glyph, as CSS does', () => {
      // 'I' is 278/1000 em at 10 px, plus 0.12em of letter-spacing.
      expect(textWidth('I')).toBeCloseTo(2.78 + 1.2, 5);
      expect(textWidth('II')).toBeCloseTo(2 * (2.78 + 1.2), 5);
    });

    it('throws on a glyph it has no width for, naming it and its string', () => {
      // An average would let this through as a measurement that was never taken.
      // The table covers A-Z, the space and the middle dot, because there is no
      // text-transform anywhere in ui/src and that is the whole of the copy.
      expect(() => textWidth('Carriers')).toThrowError(/"a"[\s\S]*"Carriers"/);
      expect(() => textWidth('OP 1')).toThrowError(/"1"/);
    });
  });
});

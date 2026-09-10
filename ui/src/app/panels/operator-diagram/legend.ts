/**
 * The diagram's legend: what it says, which row each entry sits in, and how wide
 * that comes out.
 *
 * ## Why the words live here and not only in the template
 *
 * The legend is the key to the vocabulary of both drawings, and at `DIAGRAM_W`
 * it did not fit its own band: four entries in one `nowrap` flex row came to
 * 906 px in 664, and the fourth clipped two characters in (#65). The suite
 * stayed green because the only assertion was that the legend's `textContent`
 * contained the words, and `textContent` is there whether the text is inside the
 * box or outside it.
 *
 * So the width has to be a claim a test can fail, and a width is a claim about a
 * box. jsdom computes no boxes, so the box is **modelled here as arithmetic**
 * and the sheet mirrors it — the trade `column-geometry.ts` and `layout.ts`
 * already make, for the same reason.
 *
 * The strings come with it. If they stayed in the template the arithmetic would
 * be summing a second copy of them, and a test whose subject is a copy can go
 * green while the screen says something else — which is the failure it exists to
 * remove, one layer down. `operator-diagram.html` renders {@link LEGEND} and
 * this module measures {@link LEGEND}: one subject.
 *
 * ## Two rows, always, and which entries pair
 *
 * Not `flex-wrap`. Wrapping would put the line count back on the far side of
 * what jsdom can see, leaving `textContent` as the only assertion again. And a
 * legend that is one row at 1016 px and two the moment `KEEP IT BIG` goes down
 * is a shape you have to learn twice — the argument `column-geometry.ts` makes
 * about a ranura, applied to the thing that teaches the vocabulary.
 *
 * The pairing is a rule and not a consequence of source order. Row 1 is the two
 * roles the algorithm confers: `CONTEXT.md` says portadora and modulador derive
 * from the topology. Row 2 is the two facts that are not roles — inactivo is
 * Level 0 "sea cual sea su posición", and the ceiling datum is not of any node's
 * role at all but of the patch (`.node__datum` in `operator-diagram.scss`). That
 * grouping survives a copy edit, which is what makes it a stable subject for the
 * arithmetic.
 *
 * ## What this does not claim
 *
 * That the legend fits at any width. It fits the lane it is handed, and the spec
 * hands it the three design widths. Below roughly 912 px of body the diagram's
 * lane drops under `DIAGRAM_W` in every shape, and down there the figures column
 * is still hard-coded to `FIGURES_W` and the grid's percentage-positioned nodes
 * are long past anything anyone has looked at. The width under which the composición is not
 * claimed to work is #66; when it lands it goes into what calls
 * {@link legendRoom}, not here.
 */

/** Which node contour an entry is the key to. */
export type LegendSwatch = 'carrier' | 'modulator' | 'inert' | 'datum';

/** One entry: a contour, and the words that say what it means. */
export interface LegendEntry {
  readonly swatch: LegendSwatch;
  readonly words: string;
}

/**
 * The legend, in its rows. Both drawings get all four entries: the swatches are
 * node contours, and the node is one component with one template across the two
 * (ADR-0007 §3), so all four things are on screen in either composición. It
 * matters *more* in the narrow grid, where §4 says the role is not read from
 * position but from the word in the node and the shape of the contour — the
 * legend being the translation of that shape.
 *
 * The first three strings are §6 copy (`GLOSSARY.md`); the fourth is from
 * `DESIGN.md` and is not in the rename list. Shortening any of them is a §6
 * question and not a layout fix, which is why none of them is shortened here.
 */
export const LEGEND: readonly (readonly LegendEntry[])[] = [
  [
    { swatch: 'carrier', words: 'CARRIERS · YOU HEAR THESE' },
    { swatch: 'modulator', words: 'MODULATORS · THEY COLOUR IT' },
  ],
  [
    { swatch: 'inert', words: 'AT ZERO · SILENT' },
    { swatch: 'datum', words: 'THE LOUDEST OPERATOR IN THIS PATCH' },
  ],
];

/**
 * Arial's advance widths, units per 1000 em, for the glyphs the legend uses.
 *
 * Two facts, and the second is the one that stops this being rediscovered:
 *
 * 1. This is Arial's AFM table, transcribed. A table from an external document
 *    living in code with its source named is ADR-0003's pattern, and for its
 *    reason: the error a derived approximation makes here is silent.
 * 2. **Arial is not a reference here, it is the face that rasterises.**
 *    `--font-ui` is `'Helvetica Neue', Helvetica, Arial, sans-serif` and the
 *    shipped bundle is `nsis`, i.e. Windows, where neither of the first two is
 *    an installed face. So the table's subject and the render's subject are the
 *    same font.
 *
 * A table from a narrower font than the one actually rendered can only fail in
 * the optimistic direction — green while the text clips. If a target is ever
 * added where `sans-serif` lands on DejaVu Sans (`M` at 0.995 em against Arial's
 * 0.833) the delta is about 5 %, and the slack absorbs it: row 1 comes to 455
 * against 664. That is the margin, not a proof.
 *
 * There is no `text-transform` anywhere in `ui/src`, so the strings above are
 * the strings that rasterise, and A–Z plus the space and the middle dot is the
 * whole coverage.
 */
const ARIAL_ADVANCE: Readonly<Record<string, number>> = {
  ' ': 278,
  '·': 333,
  A: 667,
  B: 667,
  C: 722,
  D: 722,
  E: 667,
  F: 611,
  G: 778,
  H: 722,
  I: 278,
  J: 500,
  K: 667,
  L: 556,
  M: 833,
  N: 722,
  O: 778,
  P: 667,
  Q: 778,
  R: 722,
  S: 667,
  T: 611,
  U: 722,
  V: 667,
  W: 944,
  X: 667,
  Y: 667,
  Z: 611,
};

/** `--text-micro`, the absolute floor: nothing is written below it. */
const FONT_SIZE = 10;
/** `.legend`'s `letter-spacing: 0.12em`. CSS adds it after every glyph. */
const TRACKING = 0.12 * FONT_SIZE;

/**
 * `.legend__swatch`'s declared box, the rule drawn around it, and the
 * `--space-2` between it and its words.
 *
 * **The rule is drawn outside the 22 × 14 and this module used to spend it
 * nowhere.** Nothing sets `box-sizing: border-box` for the swatch, so each of
 * the four `--rule-min` sides is added to the declared box and the screen draws
 * **26 × 18**. Measured in the harness at 1280 × 800, off the rendered boxes:
 * `.legend__swatch` 26 × 18, `.legend__row` 18, `.legend` **62 px against the
 * 54 this module computed** (#81).
 *
 * That is not a cosmetic eight pixels. {@link LEGEND_H} is a term of
 * `BODY_FLOOR`, so a legend that costs more than it says leaves the drawing less
 * than the floor promises it: the canvas at the floor was **278 px** on screen
 * where `floorCanvasHeight()` computed 286. The height is the term that reaches
 * the floor; the width is the term that reaches #65's clipping check, and both
 * were four pixels light per swatch.
 *
 * Kept as three declarations rather than folded into two totals because that is
 * what the sheet declares: `width: 22px`, `height: 14px` and a border. A reader
 * checking this against `operator-diagram.scss` has to find the same three
 * numbers there, and the sum is what CSS does with them.
 */
const SWATCH_W = 22;
const SWATCH_H = 14;
const SWATCH_BORDER = 2;
const SWATCH_GAP = 8;
/** What one swatch actually occupies, rule and all. */
const SWATCH_BOX_W = SWATCH_W + 2 * SWATCH_BORDER;
/** `--space-5`, between two entries of the same row. */
const ITEM_GAP = 20;
/** `--space-1`, between the two rows. They are one legend, not two lists. */
const ROW_GAP = 4;
/**
 * A row is as tall as its swatch: at `--text-micro` the line box is shorter (11
 * px against 18), and `.legend__row` centres them. Its swatch, drawn — see
 * {@link SWATCH_W}.
 */
const ROW_H = SWATCH_H + 2 * SWATCH_BORDER;
/** `.legend`'s own band: the `--rule-min` rule above it, and its padding. */
const RULE = 2;
const PAD_TOP = 9;
const PAD_BOTTOM = 11;
/**
 * `.zone`'s `padding: 12px 18px 0` — what the lane keeps off the legend.
 *
 * Exported because it is the zone's and not the legend's: the canvas above the
 * legend is inset by the same declaration, so `node-geometry.ts` reads this to
 * turn a lane into the width the drawing actually gets. It is declared here
 * because the legend's row width needed it first, and one declaration in an
 * odd house beats two in tidy ones — which is the whole of #76 in one line.
 */
export const ZONE_PAD_X = 18;

/**
 * How wide these words rasterise, in CSS pixels.
 *
 * Throws on a glyph it has no width for, naming the glyph and the string it came
 * from, so the failure is a copy diff and not a stack trace. Defaulting to an
 * average would let a lowercase letter through as a measurement that was never
 * taken, and a silent wrong number here is what the transcribed table exists to
 * prevent.
 */
export function textWidth(words: string): number {
  let width = 0;
  for (const glyph of words) {
    const advance = ARIAL_ADVANCE[glyph];
    if (advance === undefined) {
      throw new Error(
        `legend: no advance width for ${JSON.stringify(glyph)} in ` +
          `${JSON.stringify(words)}. ARIAL_ADVANCE covers A-Z, the space and ` +
          `the middle dot; add the glyph's AFM width before putting it in copy.`,
      );
    }
    width += (advance / 1000) * FONT_SIZE + TRACKING;
  }
  return width;
}

/** How wide one row's content comes out, swatches and gaps included. */
export function legendRowWidth(row: readonly LegendEntry[]): number {
  const items = row.reduce((w, e) => w + SWATCH_BOX_W + SWATCH_GAP + textWidth(e.words), 0);
  return items + ITEM_GAP * (row.length - 1);
}

/** What is left of a diagram lane for the legend, once `.zone` has its padding. */
export function legendRoom(laneWidth: number): number {
  return laneWidth - 2 * ZONE_PAD_X;
}

/** The band `.legend` takes out of the zone at a given number of rows. */
export function legendHeight(rows: number): number {
  return RULE + PAD_TOP + rows * ROW_H + (rows - 1) * ROW_GAP + PAD_BOTTOM;
}

/**
 * The band it takes as it actually is, which is what the canvas does not get.
 *
 * **62 px, and it is an input to the body's floor**, not only to this panel:
 * `column-geometry.ts` spends it twice — once raising `BODY_FLOOR` and once
 * subtracting it back out at `floorCanvasHeight()` — so it is named at both
 * sites rather than left as a term nobody traces. It was 54 here until #81 read
 * the rendered band; see {@link SWATCH_W} for the four pixels per swatch.
 */
export const LEGEND_H = legendHeight(LEGEND.length);

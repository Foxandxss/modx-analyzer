/**
 * The spectral form as a drawing, because at 18 × 14 a word does not survive.
 *
 * The node used to write `Sine` / `All 1` / `Odd 1` beside the ratio and the pair
 * ellipsised to `×0.50 ...`, which is the failure `DESIGN.md` §9 names outright:
 * **a word that ellipsises is worse than no word.** What replaces it is the big
 * seven-way selector's own drawing with its detail decimated — at most five
 * strokes, one glyph per family:
 *
 * | family | the drawing | why it reads |
 * |---|---|---|
 * | `Sine` | one stroke, centred, full height | one partial and nothing else |
 * | `All` | five strokes, evenly spaced, descending | every harmonic, quieter as they go up |
 * | `Odd` | the same descent with the even ones missing | the gaps **are** the family |
 * | `Res` | a low series with one tall stroke offset right | the resonant peak, off the fundamental |
 *
 * The `1` and `2` variants share their family's glyph. Which of the two a form is
 * belongs to the operator editor, with the other 37 facts: nobody learns the
 * families off an 18 px drawing, they **recognise** them here, and that is all
 * this has to do.
 *
 * ## Why the stroke width is a constant and not the Skirt
 *
 * The design gives this glyph a fifth channel — Skirt as stroke width, eight
 * widths for the parameter's eight positions. `Spectral Skirt` (`49 op 0A`) is
 * **not on the wide ring**: the ring reads Level, Coarse, Fine, Frequency Mode
 * and Spectral Form, and nothing else per operator. A width drawn from a value
 * nobody polled would be the one thing this app exists to prevent, so every
 * glyph is drawn at one width until the Skirt is actually read.
 */

/** The four families, in the order the Data List numbers the seven forms. */
export type SpectralFamily = 'Sine' | 'All' | 'Odd' | 'Res';

/**
 * The path of each family, in the glyph's own 18 × 14 box with the strokes
 * standing on y = 13. Five stroke positions, shared by the three families that
 * use more than one, so the four drawings sit on the same comb and only their
 * heights and their gaps differ.
 */
export const SPECTRAL_GLYPH: Readonly<Record<SpectralFamily, string>> = {
  Sine: 'M9 13V2',
  All: 'M2 13V2M6 13V4.5M10 13V6.5M14 13V8.5M17.5 13V10.5',
  Odd: 'M2 13V2M10 13V6.5M17.5 13V10.5',
  Res: 'M2 13V8M6 13V9.5M10 13V10.5M14 13V2M17.5 13V11',
};

/**
 * The glyph for a form the ring read, or `null` for a form it has not read or
 * one outside the seven. `null` draws the dash, exactly as an unread figure
 * does: a form nobody answered is not a Sine.
 */
export function spectralGlyph(form: string | null): string | null {
  if (form === null) {
    return null;
  }
  const family = form.split(' ')[0] as SpectralFamily;
  return SPECTRAL_GLYPH[family] ?? null;
}

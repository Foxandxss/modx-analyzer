import { SPECTRAL_GLYPH, spectralGlyph } from './spectral-glyph';

/** The seven forms of FM-X, in the order `crates/modx-midi/src/ring.rs` numbers them. */
const SEVEN = ['Sine', 'All 1', 'All 2', 'Odd 1', 'Odd 2', 'Res 1', 'Res 2'];

describe('spectralGlyph', () => {
  it('draws every one of the seven forms', () => {
    for (const form of SEVEN) {
      expect(spectralGlyph(form)).not.toBeNull();
    }
  });

  it('maps each form onto its family, and the 1 and 2 variants onto one drawing', () => {
    expect(spectralGlyph('Sine')).toBe(SPECTRAL_GLYPH.Sine);
    expect(spectralGlyph('All 1')).toBe(SPECTRAL_GLYPH.All);
    expect(spectralGlyph('All 2')).toBe(SPECTRAL_GLYPH.All);
    expect(spectralGlyph('Odd 1')).toBe(SPECTRAL_GLYPH.Odd);
    expect(spectralGlyph('Odd 2')).toBe(SPECTRAL_GLYPH.Odd);
    expect(spectralGlyph('Res 1')).toBe(SPECTRAL_GLYPH.Res);
    expect(spectralGlyph('Res 2')).toBe(SPECTRAL_GLYPH.Res);
  });

  it('gives the four families four different drawings', () => {
    const drawings = new Set(Object.values(SPECTRAL_GLYPH));
    expect(drawings.size).toBe(4);
  });

  it('spends at most five strokes, which is what survives at 18 x 14', () => {
    for (const path of Object.values(SPECTRAL_GLYPH)) {
      expect(path.match(/M/g)?.length ?? 0).toBeLessThanOrEqual(5);
    }
  });

  it('stands every stroke on the same baseline and inside the box', () => {
    for (const path of Object.values(SPECTRAL_GLYPH)) {
      for (const [, x, top] of path.matchAll(/M([\d.]+) 13V([\d.]+)/g)) {
        expect(Number(x)).toBeGreaterThanOrEqual(0);
        expect(Number(x)).toBeLessThanOrEqual(18);
        expect(Number(top)).toBeGreaterThanOrEqual(0);
        expect(Number(top)).toBeLessThan(13);
      }
      // Every command in the path is one of those strokes: nothing else is drawn.
      expect(path.replace(/M[\d.]+ 13V[\d.]+/g, '')).toBe('');
    }
  });

  it('reads the gaps of Odd off the comb All stands on', () => {
    // Odd is All with the even partials taken out, so the two share their stroke
    // positions and only the holes tell them apart. If they were drawn on two
    // different combs the family would read as a different loudness, not a gap.
    const positions = (path: string) => [...path.matchAll(/M([\d.]+) 13/g)].map(([, x]) => x);
    expect(positions(SPECTRAL_GLYPH.Odd).every((x) => positions(SPECTRAL_GLYPH.All).includes(x)));
    expect(positions(SPECTRAL_GLYPH.Odd)).toHaveLength(3);
    expect(positions(SPECTRAL_GLYPH.All)).toHaveLength(5);
  });

  it('draws no glyph for a form nobody read, and none for one outside the seven', () => {
    // An unread form is a dash, not a Sine: the node would otherwise state the
    // form every `Init Normal (FM-X)` operator happens to start in.
    expect(spectralGlyph(null)).toBeNull();
    expect(spectralGlyph('Formant 3')).toBeNull();
  });
});

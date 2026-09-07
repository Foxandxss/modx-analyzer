import { STALE_FACTOR, STALE_WIDE_FLOOR_MS, staleAfterMs } from './freshness';

describe('staleAfterMs', () => {
  it('follows the ring it belongs to', () => {
    // The 42 addresses cost ~84 ms in silence and ~430 ms under notes, and the
    // threshold moves with them: a figure read one pass ago is never CADUCO.
    expect(staleAfterMs(84)).toBe(STALE_FACTOR * 84);
    expect(staleAfterMs(430)).toBe(STALE_FACTOR * 430);
  });

  it('never goes below the idle floor of the tokens', () => {
    // --stale-wide-s. A freakishly fast pass must not be able to stamp the whole
    // diagram stale on a threshold of a few milliseconds.
    expect(staleAfterMs(1)).toBe(STALE_WIDE_FLOOR_MS);
    expect(staleAfterMs(null)).toBe(STALE_WIDE_FLOOR_MS);
  });
});

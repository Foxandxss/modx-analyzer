import { STALE_FACTOR, STALE_WIDE_FLOOR_MS, staleAfterMs } from './freshness';

describe('staleAfterMs', () => {
  it('follows the ring it belongs to', () => {
    // The 42 addresses cost ~430 ms under notes, and the threshold moves with
    // them: a figure read one pass ago is never CADUCO. Above 100 ms per pass
    // the multiplier is what governs.
    expect(staleAfterMs(430)).toBe(STALE_FACTOR * 430);
    expect(staleAfterMs(101)).toBe(STALE_FACTOR * 101);
  });

  it('never goes below the idle floor of the tokens', () => {
    // --stale-wide-s, 0.40 s: four periods of the anillo ancho at the 10 Hz the
    // build measures. A freakishly fast pass must not be able to stamp the whole
    // diagram stale on a threshold of a few milliseconds.
    expect(staleAfterMs(1)).toBe(STALE_WIDE_FLOOR_MS);
    expect(staleAfterMs(null)).toBe(STALE_WIDE_FLOOR_MS);
  });

  it('is the floor that governs in silence, now the ring is 10 Hz and not 12.2', () => {
    // An idle pass is ~84 ms, so four of them is 336 ms — under the 400 ms floor.
    // At the documented 12.2 Hz the floor was 330 ms and the multiplier won here;
    // the token moving to what the build measures moved the crossing point too.
    expect(staleAfterMs(84)).toBe(STALE_WIDE_FLOOR_MS);
    expect(STALE_FACTOR * 84).toBeLessThan(STALE_WIDE_FLOOR_MS);
  });
});

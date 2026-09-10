import { describe, expect, it } from 'vitest';
import { HARNESS_ALGORITHMS, harnessTopology } from './algorithm-table';

/**
 * What the bench's copy of the table has to be for a look taken on it to be
 * worth writing down.
 *
 * These are **not** a check of the chart: nothing this side can tell whether Op3
 * modulates Op4 in algorithm 88, and the only net for that is the structural
 * tests in `algorithms.rs` and a look at the keyboard's own screen (#12). What
 * they check is that the dump is the whole table, in order, with the fields the
 * drawing reads — the failures a stale or truncated dump would produce, which the
 * eye cannot catch because a wrong drawing looks like a drawing.
 *
 * The dump matching the table it came from is checked where the table lives:
 * `the_harness_table_is_this_table`, in `src-tauri/src/patch.rs`.
 */
describe('the bench carries the whole table', () => {
  it('has the 88, in the order their own numbers run', () => {
    expect(HARNESS_ALGORITHMS).toHaveLength(88);
    HARNESS_ALGORITHMS.forEach((topology, index) => {
      expect(topology.number).toBe(index + 1);
    });
  });

  it('carries the depth and the branch the layout lays out from', () => {
    for (const topology of HARNESS_ALGORITHMS) {
      expect(topology.depth).toHaveLength(8);
      expect(topology.branch).toHaveLength(8);
      // A portadora is depth 0 and there is always at least one: an algorithm
      // with nothing on the bus does not sound.
      expect(topology.carriers.length).toBeGreaterThan(0);
    }
  });

  it('says the routes are paper, in the front’s own word', () => {
    // ADR-0003: all 88 are `documentado` today, and promotion is per entry. The
    // wire says `documentado` and the front says `documented`; the turn happens
    // on the way in, exactly as the real gateway makes it.
    for (const topology of HARNESS_ALGORITHMS) {
      expect(topology.provenance).toBe('documented');
    }
  });

  /**
   * The three the round takes its looks on, by number and by shape.
   *
   * They are asserted here rather than trusted because every figure #81 and #88
   * record is measured on one of these three drawings: a dump that had drifted
   * would put a number in a results document against a drawing nobody drew.
   */
  it('draws the 1, the 37 and the 66 the round measures on', () => {
    const eightCarriers = harnessTopology(1);
    expect(eightCarriers?.routes).toEqual([]);
    expect(eightCarriers?.carriers).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

    // The 66 is the single chain of eight — `MAX_DEPTH`, and the deepest drawing
    // that exists, which is what the body's floor is measured on.
    const chainOfEight = harnessTopology(66);
    expect(chainOfEight?.carriers).toEqual([8]);
    expect(chainOfEight?.depth).toEqual([7, 6, 5, 4, 3, 2, 1, 0]);

    // The 37 is the other one the depth fold fires on.
    expect(Math.max(...(harnessTopology(37)?.depth ?? []))).toBeGreaterThanOrEqual(4);
  });

  it('has no drawing for a number outside the 88', () => {
    // Which is the `ALGORITHM n · NO TABLE` case: the bench can put it on screen
    // by typing 89, and it must not invent an entry for it.
    expect(harnessTopology(89)).toBeNull();
    expect(harnessTopology(0)).toBeNull();
  });
});

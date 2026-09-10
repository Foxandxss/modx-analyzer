import { Topology } from '../backend/backend-gateway';
import WIRE from './algorithms.json';

/**
 * The 88 topologies, for the bench that runs with no Rust side behind it.
 *
 * ## Why there is a copy at all
 *
 * The table lives in Rust (ADR-0003) and the keyboard only ever answers a
 * *number*, so the drawing of a patch cannot be derived from anything this side
 * has: no topology, no roles and no lines. A harness that made one up would draw
 * a plausible diagram of a patch that does not exist, which is the one mistake
 * `crates/modx-midi/src/algorithms.rs` says out loud it cannot catch.
 *
 * ## Why the copy is allowed to exist
 *
 * Because it is **generated and checked**, not transcribed. `algorithms.json` is
 * written by `src-tauri/src/patch.rs`'s `every_topology()` — the same
 * `TopologyView` the `modx://patch` event carries — and the Rust test
 * `the_harness_table_is_this_table` fails the moment the table and the dump
 * disagree. So a route edited in the chart does not quietly leave the bench
 * drawing last week's algorithm: it goes red in `cargo test`.
 *
 * Regenerate with `MODX_WRITE_HARNESS_TABLE=1 cargo test -p modx-analyzer-app`.
 *
 * Nothing under `dev/` is reachable from `src/main.ts`, so none of this is in the
 * app the laptop runs: see `main.harness.ts`.
 */
interface TopologyWire extends Omit<Topology, 'provenance'> {
  /** ADR-0003's own two words, in Spanish, as the table spells them. */
  readonly provenance: 'medido' | 'documentado';
}

/**
 * The dump, in the shape the front consumes, and in the order the numbers run.
 *
 * The Spanish-to-English turn is the same one `tauri-backend-gateway.ts` makes on
 * the way in, because this file is standing exactly where that one does: what
 * arrives is the wire, and the wire speaks the table's language.
 */
export const HARNESS_ALGORITHMS: readonly Topology[] = (
  WIRE as unknown as readonly TopologyWire[]
).map((wire) => ({
  ...wire,
  provenance: wire.provenance === 'medido' ? 'measured' : 'documented',
}));

/**
 * The entry a number picks, or `null` for a number outside the 88 — which is the
 * `ALGORITHM n · NO TABLE` case the screen already draws, and one the bench can
 * therefore put on screen by typing 89.
 */
export function harnessTopology(number: number): Topology | null {
  return HARNESS_ALGORITHMS[number - 1] ?? null;
}

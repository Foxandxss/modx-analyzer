import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compareWindows, formatComparison } from './compare';
import { MEASURE_WINDOW } from './constants';

/**
 * #14's runner, wearing a test's clothes.
 *
 * The two files come from the `EXPORTAR` button in the dev readout, taken on the
 * **same held note** — one with `SONDEO` running and one with it stopped — and
 * they are raw `f32` little-endian mono, the same `encode_mono` the bloques cross
 * with and the same shape as the golden vectors.
 *
 *     MODX_SONDEO=<...sondeo.f32> MODX_SIN_SONDEO=<...sin-sondeo.f32> \
 *       pnpm --filter modx-dsp exec vitest run compare-windows
 *
 * It is a spec and not a script because **vitest is the only thing in this repo
 * that runs TypeScript**: the package is consumed as source, there is no build to
 * import from, and a plain `.mjs` would have to reimplement the FFT it is
 * supposed to be using. Without the two variables it skips and says so, so the
 * ordinary suite stays green and nobody has to remember it is here.
 *
 * The comparison it prints is tested in `compare.spec.ts`, on synthetic windows
 * where the answer is known. That order matters: an instrument that could not see
 * a −72 dB spur would report «polling is invisible» whatever the keyboard did.
 */
describe('el barrido de #14: dos ventanas de la misma nota', () => {
  const sondeo = process.env.MODX_SONDEO;
  const sinSondeo = process.env.MODX_SIN_SONDEO;

  it.skipIf(!sondeo || !sinSondeo)('compares the two exported windows', () => {
    const read = (path: string): Float32Array => {
      const bytes = readFileSync(path);
      const samples = new Float32Array(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
      );
      expect(
        samples.length,
        `${path}: ${samples.length} muestras, hacen falta ${MEASURE_WINDOW}`,
      ).toBeGreaterThanOrEqual(MEASURE_WINDOW);
      return samples;
    };

    const found = compareWindows(read(sondeo!), read(sinSondeo!));

    console.log(`\ncon sondeo   ${sondeo}`);
    console.log(`sin sondeo   ${sinSondeo}\n`);
    console.log(formatComparison(found));

    // Nothing is asserted about the answer: what the difference means is #14's
    // decision, written down with the numbers beside it. What is asserted is that
    // the two files were comparable at all.
    expect(found.bins).toBe(MEASURE_WINDOW / 2 + 1);
  });
});

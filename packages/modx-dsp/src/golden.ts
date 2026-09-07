import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The four fase 0 vectors, read off disk.
 *
 * **Not exported from `index.ts` on purpose**: this file reads the filesystem and
 * the browser build must never pull it in. It exists so the tests analyse the
 * MODX's own audio instead of a synthetic tone that agrees with the code that
 * generated it — a golden test whose fixture is `Math.sin` proves the test.
 *
 * The vectors live in `golden/` as mono float32 WAVs, cut from the spike's
 * captures by `golden/trim.mjs`; that script is where the trimming and its
 * reasons are written down. What they contain, and every number the tests lean
 * on, is in `design_handoff/sources/fase0_RESULTS.md` §3 and §7.
 */

export type GoldenName =
  /** One operator, ratio 1.0. A pure sine: the floor is the whole point. */
  | 'fmx-1op-sine'
  /** Ratio 2:1, modulator `Level ≈ 40`. Odd harmonics only. */
  | 'fmx-ratio2-modlow'
  /** Ratio 2:1, modulator `Level ≈ 90`. The 9th harmonic is the peak. */
  | 'fmx-ratio2-modhigh'
  /** `Coarse 1`/`Fine 41`, measured ratio 1.4103. Eleven inharmonic lines. */
  | 'fmx-ratio1414';

/** The note all four were captured on: C4 as this MODX8 tunes it, fase 0 §3. */
export const GOLDEN_F0 = 261.763;

export function readGolden(name: GoldenName): Float32Array {
  const file = readFileSync(join(import.meta.dirname, '..', 'golden', `${name}.wav`));
  if (file.toString('ascii', 0, 4) !== 'RIFF' || file.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${name}: no es un WAV`);
  }

  let offset = 12;
  let channels = 0;
  let bits = 0;
  while (offset + 8 <= file.length) {
    const id = file.toString('ascii', offset, offset + 4);
    const size = file.readUInt32LE(offset + 4);
    if (id === 'fmt ') {
      channels = file.readUInt16LE(offset + 10);
      bits = file.readUInt16LE(offset + 22);
    }
    if (id === 'data') {
      if (channels !== 1 || bits !== 32) {
        throw new Error(
          `${name}: se esperaba mono float32, hay ${channels} canales de ${bits} bits`,
        );
      }
      const samples = new Float32Array(size / 4);
      for (let index = 0; index < samples.length; index += 1) {
        samples[index] = file.readFloatLE(offset + 8 + index * 4);
      }
      return samples;
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error(`${name}: sin trozo data`);
}

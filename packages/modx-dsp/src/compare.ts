import { MEASURE_WINDOW, SAMPLE_RATE } from './constants';
import { spectrum } from './spectrum';

/**
 * Two windows of the same held note, compared bin by bin. #14's whole question.
 *
 * The app polls the keyboard while it is measuring — the ancla once a second and
 * the anillo ancho a dozen times — and the design reserved a «blind spot» in case
 * that polling shows up in the audio. #14 says to test the assumption instead of
 * building the pause, and this is the test: take the same sustained note twice,
 * once with the polling running and once with it stopped, and see whether the two
 * spectra differ by more than the floor they are measured against.
 *
 * **The whole distribution, not the maximum.** One bin 3 dB apart out of 32 769 is
 * a different result from a hundred of them, and a maximum cannot tell those two
 * apart — nor can it say whether the difference sits on the peak or down in the
 * noise. What decides the ticket is where the differences live relative to fase
 * 0's floor (−100 to −109 dB) and its oscillator spurs (−72 dB).
 *
 * It is deliberately **not** a verdict. Whether a given difference means «pause
 * the ancla» is a decision that gets written down with the numbers beside it, and
 * a function that returned a boolean would be that decision hidden in code.
 */
export interface WindowComparison {
  readonly window: number;
  readonly binHz: number;
  /** Bins compared: `window / 2 + 1`. */
  readonly bins: number;
  readonly peakDbA: number;
  readonly peakDbB: number;
  /** The noise floor of each, relative to its own peak, as fase 0 reports it. */
  readonly floorDbA: number;
  readonly floorDbB: number;
  /** Absolute dB difference per bin: p50, p99, p99.9 and the largest. */
  readonly p50Db: number;
  readonly p99Db: number;
  readonly p999Db: number;
  readonly maxDb: number;
  /** Where the largest difference fell, so it can be looked at on the spectrum. */
  readonly maxBin: number;
  readonly maxBinHz: number;
  /**
   * How many bins differ by more than each threshold, and what share that is.
   *
   * The three thresholds each mean something: `0.1` is far below anything that
   * could be read off a screen, `1` is what an eye would notice on the spectrum
   * panel, and `6` is the margin the comb detector itself demands before it calls
   * a line present — a difference that large would change what the app reports.
   */
  readonly over: readonly { readonly thresholdDb: number; readonly bins: number }[];
}

const THRESHOLDS_DB = [0.1, 1, 6];

function percentile(sorted: Float64Array, fraction: number): number {
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index]!;
}

/**
 * Compare the tails of two windows. Both must hold at least `window` samples;
 * what is compared is the **last** `window` of each, so a file longer than one
 * window is still the window that ended it.
 */
export function compareWindows(
  a: Float32Array,
  b: Float32Array,
  window: number = MEASURE_WINDOW,
  sampleRate: number = SAMPLE_RATE,
): WindowComparison {
  const left = spectrum(a, window, sampleRate);
  const right = spectrum(b, window, sampleRate);

  const diffs = new Float64Array(left.db.length);
  let maxDb = 0;
  let maxBin = 0;
  for (let bin = 0; bin < left.db.length; bin += 1) {
    const delta = Math.abs(left.db[bin]! - right.db[bin]!);
    diffs[bin] = delta;
    if (delta > maxDb) {
      maxDb = delta;
      maxBin = bin;
    }
  }

  const sorted = Float64Array.from(diffs).sort();
  return {
    window,
    binHz: left.binHz,
    bins: left.db.length,
    peakDbA: left.peakDb,
    peakDbB: right.peakDb,
    floorDbA: left.floorDb,
    floorDbB: right.floorDb,
    p50Db: percentile(sorted, 0.5),
    p99Db: percentile(sorted, 0.99),
    p999Db: percentile(sorted, 0.999),
    maxDb,
    maxBin,
    maxBinHz: maxBin * left.binHz,
    over: THRESHOLDS_DB.map((thresholdDb) => ({
      thresholdDb,
      bins: diffs.reduce((count, delta) => count + (delta > thresholdDb ? 1 : 0), 0),
    })),
  };
}

/** The comparison as the results document wants it: one line per figure. */
export function formatComparison(found: WindowComparison): string {
  const rows: [string, string][] = [
    ['ventana', `${found.window}`],
    ['Hz por bin', found.binHz.toFixed(3)],
    ['bins comparados', `${found.bins}`],
    ['pico A / B (dBFS)', `${found.peakDbA.toFixed(2)} / ${found.peakDbB.toFixed(2)}`],
    ['suelo A / B (dB)', `${found.floorDbA.toFixed(2)} / ${found.floorDbB.toFixed(2)}`],
    ['diferencia p50 (dB)', found.p50Db.toFixed(3)],
    ['diferencia p99 (dB)', found.p99Db.toFixed(3)],
    ['diferencia p99,9 (dB)', found.p999Db.toFixed(3)],
    ['diferencia máxima (dB)', found.maxDb.toFixed(3)],
    ['bin de la máxima', `${found.maxBin} (${found.maxBinHz.toFixed(1)} Hz)`],
  ];
  for (const { thresholdDb, bins } of found.over) {
    const share = ((bins / found.bins) * 100).toFixed(3);
    rows.push([`bins con dif > ${thresholdDb} dB`, `${bins} (${share} %)`]);
  }
  return rows.map(([name, value]) => `${name.padEnd(24)} ${value}`).join('\n');
}

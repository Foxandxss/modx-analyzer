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
 * 0's floor (−100 to −109 dB rel. al pico) and its oscillator spurs (−72 dB).
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
  /**
   * The noise floor of each **relative to its own peak**, as fase 0 reports it —
   * not the app's `FLOOR`, which is absolute dBFS. The qualifier is in the name
   * and in the printed row because these two figures exist to be read beside
   * fase 0's −100 to −109 dB rel. al pico, and two windows of the same note
   * played a decibel apart have to be comparable.
   */
  readonly relFloorDbA: number;
  readonly relFloorDbB: number;
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

  /**
   * The same figures over **content bins only**, and this is the half that
   * answers #14.
   *
   * Comparing all 32 769 bins weights the noise floor exactly as heavily as the
   * note, and the floor is random: two windows of the same sound seconds apart
   * differ by tens of dB down there, because −150 dB against −130 dB is a 20 dB
   * «difference» between two silences. A comparison that counts those is a
   * comparison that answers noise, whatever the polling did.
   *
   * A bin counts as content when **either** window has it above
   * {@link CONTENT_FLOOR_DB} relative to its own peak — −100 dB, the top of fase
   * 0's floor band, so anything the spike called a floor is excluded and anything
   * it called a spur (−72 dB) is kept.
   */
  readonly contentBins: number;
  readonly contentP50Db: number;
  readonly contentP99Db: number;
  readonly contentMaxDb: number;
  readonly contentMaxBinHz: number;
}

const THRESHOLDS_DB = [0.1, 1, 6];

/**
 * Above this, relative to each window's own peak, a bin is content rather than
 * floor.
 *
 * **Not fase 0's number.** The spike's −100 to −109 dB floor is a figure of the
 * **4 096** window, rel. al pico; at 65 536 each bin gathers a sixteenth of the
 * bandwidth and the median goes down with it, which #10 measured over the golden
 * vectors, also rel. al pico: −129,9 dB for the sine, −123,9 for `modlow`,
 * −111,4 for `modhigh` and −100,6 for `ratio1414`. So −100 sits at or above the
 * worst of the four and comfortably
 * above the rest — conservative in the direction that matters, since a bin it
 * keeps is unambiguously content while a bin it drops might merely be quiet.
 *
 * The oscillator spurs fase 0 measured at −72 dB are kept either way.
 */
export const CONTENT_FLOOR_DB = -100;

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

  // Content is judged against each window's own peak, so the two are compared on
  // equal terms even when one was played a decibel louder than the other.
  const contentA = left.peakDb + CONTENT_FLOOR_DB;
  const contentB = right.peakDb + CONTENT_FLOOR_DB;
  const content: number[] = [];
  let contentMaxDb = 0;
  let contentMaxBin = 0;
  for (let bin = 0; bin < left.db.length; bin += 1) {
    if (left.db[bin]! <= contentA && right.db[bin]! <= contentB) {
      continue;
    }
    content.push(diffs[bin]!);
    if (diffs[bin]! > contentMaxDb) {
      contentMaxDb = diffs[bin]!;
      contentMaxBin = bin;
    }
  }
  const contentSorted = Float64Array.from(content).sort();

  const sorted = Float64Array.from(diffs).sort();
  return {
    contentBins: content.length,
    contentP50Db: content.length === 0 ? 0 : percentile(contentSorted, 0.5),
    contentP99Db: content.length === 0 ? 0 : percentile(contentSorted, 0.99),
    contentMaxDb,
    contentMaxBinHz: contentMaxBin * left.binHz,
    window,
    binHz: left.binHz,
    bins: left.db.length,
    peakDbA: left.peakDb,
    peakDbB: right.peakDb,
    relFloorDbA: left.floorDb - left.peakDb,
    relFloorDbB: right.floorDb - right.peakDb,
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
    [
      'suelo A / B (dB rel. al pico)',
      `${found.relFloorDbA.toFixed(2)} / ${found.relFloorDbB.toFixed(2)}`,
    ],
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
  // The half that answers the ticket: everything above is the floor talking.
  rows.push(
    ['', ''],
    [`bins de contenido (>${CONTENT_FLOOR_DB} dB)`, `${found.contentBins}`],
    ['contenido p50 (dB)', found.contentP50Db.toFixed(3)],
    ['contenido p99 (dB)', found.contentP99Db.toFixed(3)],
    ['contenido máxima (dB)', found.contentMaxDb.toFixed(3)],
    ['contenido bin de la máx', `${found.contentMaxBinHz.toFixed(1)} Hz`],
  );
  return rows.map(([name, value]) => `${name.padEnd(28)} ${value}`).join('\n');
}

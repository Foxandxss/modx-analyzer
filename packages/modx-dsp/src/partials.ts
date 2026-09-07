import { ARTEFACT_HZ } from './constants';
import { Spectrum } from './spectrum';

/**
 * The lines of a spectrum, found and told apart.
 *
 * Two things happen here and only two: peaks are picked with parabolic
 * interpolation on the **log** magnitudes (which is what makes the frequency of a
 * Hann peak accurate to a fraction of a bin), and each one is asked whether it is
 * the generator's comb. Nothing here fits anything: no fc/fm, no ratio, no
 * Bessel — those are their own session.
 *
 * **The comb is not hidden and is never counted as a harmonic.** Fase 0 §7 found
 * peaks at multiples of `44100/16` with sidebands at ±f0, at −72 dB, in all four
 * vectors: in the pure sine they are the second and third highest peaks of the
 * whole spectrum, well above the only real harmonic. A naive peak detector calls
 * them content. They are tied to the sample clock, not to the note, which is both
 * why they are recognisable and why the badge always carries the frequency.
 */

/** A peak below this, relative to the strongest, is not looked at: −96 dB. */
const CANDIDATE_FLOOR_DB = -96;

/** How far above the noise floor a peak has to stand to be a line at all. */
const OVER_FLOOR_DB = 8;

/**
 * Hann's main lobe is four bins wide, so two peaks closer than that are one peak
 * and its leakage. The weaker one is dropped rather than published as a partial.
 */
const SEPARATION_BINS = 4;

/** More lines than this on screen is noise; the eleven of the 1.41 vector fit. */
const MAX_PARTIALS = 24;

/**
 * How close a line has to fall to be called the comb, or a harmonic, in bins.
 *
 * One bin — 10.77 Hz at 4 096 — and it is a measured compromise, not a round
 * number. Wider and the 1.41 vector loses a real partial: its line at 2 476.9 Hz
 * sits 17.6 Hz from the comb sideband at 2 494.5 and would be called an
 * artefact. Narrower and the harmonics stop matching, because the note the axis
 * is drawn against is the played one at equal temperament while the MODX's own
 * C4 is 0.91 cents sharp (fase 0 §3), which is 4.4 Hz out by the 32nd harmonic.
 * The comb's sidebands themselves land within 1.3 Hz of where they are
 * predicted, so a bin is all they need.
 */
const MATCH_BINS = 1;

export type PartialKind = 'partial' | 'artefact';

export interface Partial {
  readonly hz: number;
  /** dB relative to the strongest line of the spectrum. */
  readonly db: number;
  readonly kind: PartialKind;
  /** Which harmonic of the note it is, or `null` when it is not one. */
  readonly harmonic: number | null;
}

/**
 * The lines of a spectrum, strongest first.
 *
 * `fundamentalHz` is the note the scope triggered on, or `null` when nothing is
 * periodic. It is used for two things: numbering the harmonics, and finding the
 * comb's sidebands, which sit at `k·2756.25 ± f0` and cannot be recognised
 * without it. With no note the bare comb lines are still recognised.
 */
export function findPartials(spectrum: Spectrum, fundamentalHz: number | null): Partial[] {
  const { db, binHz, peakDb, floorDb } = spectrum;
  const cutoff = Math.max(peakDb + CANDIDATE_FLOOR_DB, peakDb + floorDb + OVER_FLOOR_DB);

  const candidates: { bin: number; hz: number; db: number }[] = [];
  for (let bin = 1; bin + 1 < db.length; bin += 1) {
    const here = db[bin]!;
    if (here < cutoff || here <= db[bin - 1]! || here < db[bin + 1]!) {
      continue;
    }
    const shift = parabolicShift(db[bin - 1]!, here, db[bin + 1]!);
    candidates.push({ bin, hz: (bin + shift) * binHz, db: here - peakDb });
  }
  candidates.sort((left, right) => right.db - left.db);

  const kept: typeof candidates = [];
  for (const candidate of candidates) {
    if (kept.length >= MAX_PARTIALS) {
      break;
    }
    const crowded = kept.some((taken) => Math.abs(taken.bin - candidate.bin) < SEPARATION_BINS);
    if (!crowded) {
      kept.push(candidate);
    }
  }

  const tolerance = MATCH_BINS * binHz;
  const found: Partial[] = kept.map(({ hz, db: level }) => {
    const harmonic = harmonicOf(hz, fundamentalHz, tolerance);
    return {
      hz,
      db: level,
      // A harmonic wins: a line that lands on a multiple of the note is content,
      // whatever else it also lands near.
      kind: harmonic === null && isArtefact(hz, fundamentalHz, tolerance) ? 'artefact' : 'partial',
      harmonic,
    };
  });

  for (const line of probeComb(spectrum, fundamentalHz, tolerance)) {
    const already = found.some(
      (partial) => Math.abs(partial.hz - line.hz) < SEPARATION_BINS * binHz,
    );
    if (!already) {
      found.push(line);
    }
  }

  return found.sort((left, right) => right.db - left.db);
}

/**
 * How far a comb line has to stand over the spectrum around it to be called
 * present: 6 dB. Under a high modulation index the comb is buried in the
 * sidebands of the note itself — in the modhigh vector the first line clears its
 * neighbourhood by 2.9 dB — and a threshold that admitted that would be drawing
 * the noise floor with a badge on it.
 */
const COMB_OVER_LOCAL_DB = 6;

/** Bins either side taken as «the spectrum around here»: ±40 is ±430 Hz. */
const LOCAL_BINS = 40;

/**
 * The comb, looked for **where fase 0 measured it** instead of hoped for among
 * the loudest lines.
 *
 * Peak picking finds it in the quiet vectors, where it is the second and third
 * highest peak of the whole spectrum. It does not find it in a bright timbre,
 * where two dozen real partials are louder — and that is exactly the timbre
 * somebody is playing while they learn. So each multiple of 2 756.25 Hz and its
 * two sidebands are probed one by one, and a line is reported only when it
 * stands over the spectrum around it. Nothing is invented: with no comb there,
 * nothing is returned.
 */
function probeComb(
  spectrum: Spectrum,
  fundamentalHz: number | null,
  toleranceHz: number,
): Partial[] {
  const { db, binHz, peakDb } = spectrum;
  const nyquist = (db.length - 1) * binHz;
  const lines: Partial[] = [];

  for (let comb = ARTEFACT_HZ; comb < nyquist; comb += ARTEFACT_HZ) {
    const places =
      fundamentalHz === null ? [comb] : [comb, comb - fundamentalHz, comb + fundamentalHz];
    for (const hz of places) {
      if (hz <= 0 || hz >= nyquist) {
        continue;
      }
      // A harmonic wins here too: the 21st of C4 lands 15 Hz from a comb line.
      if (harmonicOf(hz, fundamentalHz, toleranceHz) !== null) {
        continue;
      }
      const loudest = loudestAround(db, hz / binHz, Math.ceil(toleranceHz / binHz));
      const local = medianAround(db, hz / binHz, LOCAL_BINS);
      if (loudest - local >= COMB_OVER_LOCAL_DB) {
        lines.push({ hz, db: loudest - peakDb, kind: 'artefact', harmonic: null });
      }
    }
  }
  return lines;
}

function loudestAround(db: Float32Array, centre: number, span: number): number {
  const first = Math.max(0, Math.round(centre) - span);
  const last = Math.min(db.length - 1, Math.round(centre) + span);
  let loudest = -Infinity;
  for (let bin = first; bin <= last; bin += 1) {
    if (db[bin]! > loudest) {
      loudest = db[bin]!;
    }
  }
  return loudest;
}

function medianAround(db: Float32Array, centre: number, span: number): number {
  const first = Math.max(0, Math.round(centre) - span);
  const last = Math.min(db.length - 1, Math.round(centre) + span);
  const around = Float32Array.from(db.subarray(first, last + 1)).sort();
  return around[around.length >> 1] ?? -Infinity;
}

/** Which harmonic of the note a line is, or `null`. Harmonic 1 is the note. */
export function harmonicOf(
  hz: number,
  fundamentalHz: number | null,
  toleranceHz: number,
): number | null {
  if (fundamentalHz === null || fundamentalHz <= 0) {
    return null;
  }
  const nearest = Math.round(hz / fundamentalHz);
  if (nearest < 1) {
    return null;
  }
  return Math.abs(hz - nearest * fundamentalHz) <= toleranceHz ? nearest : null;
}

/**
 * Whether a line belongs to the generator's comb: a multiple of 2 756.25 Hz, or
 * one of its two sidebands at ±f0.
 */
export function isArtefact(hz: number, fundamentalHz: number | null, toleranceHz: number): boolean {
  const comb = Math.round(hz / ARTEFACT_HZ) * ARTEFACT_HZ;
  if (comb < ARTEFACT_HZ) {
    return false;
  }
  if (Math.abs(hz - comb) <= toleranceHz) {
    return true;
  }
  if (fundamentalHz === null) {
    return false;
  }
  return (
    Math.abs(hz - (comb + fundamentalHz)) <= toleranceHz ||
    Math.abs(hz - (comb - fundamentalHz)) <= toleranceHz
  );
}

/**
 * The frequency the chip names, or `null` when no comb was seen.
 *
 * It is the **comb line** the lowest artefact belongs to, not the artefact's own
 * frequency: what is worth reading is 2 756 Hz — the sample clock divided by 16,
 * which is what tells the comb apart from a harmonic of the mains or from
 * aliasing — and not the 2 494 Hz of one of its sidebands.
 */
export function artefactChipHz(partials: readonly Partial[]): number | null {
  const lines = partials.filter((partial) => partial.kind === 'artefact');
  if (lines.length === 0) {
    return null;
  }
  const lowest = lines.reduce((found, partial) => Math.min(found, partial.hz), Infinity);
  return Math.max(1, Math.round(lowest / ARTEFACT_HZ)) * ARTEFACT_HZ;
}

/** The sub-bin offset of a peak, from the three log magnitudes around it. */
function parabolicShift(before: number, here: number, after: number): number {
  const denominator = before - 2 * here + after;
  if (denominator === 0) {
    return 0;
  }
  const shift = (0.5 * (before - after)) / denominator;
  return Math.abs(shift) > 1 ? 0 : shift;
}

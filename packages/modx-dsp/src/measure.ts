import { MEASURE_WINDOW, NOTHING_ENTERING, SAMPLE_RATE } from './constants';
import { Partial, artefactChipHz, findPartials } from './partials';
import { spectrum, windowPeak } from './spectrum';

/**
 * La medida: one window of 65 536, taken when MEDIR is pressed.
 *
 * **MEDIR is a shutter and the vista viva is a lamp.** Everything here is the
 * same code the vista viva runs — the same Hann window, the same FFT, the same
 * peak picker, the same artefact rule — with two differences, and only two:
 *
 * 1. the window is 65 536 samples instead of 4 096, which is 0.673 Hz per bin
 *    instead of 10.77 and 1.49 s of sound instead of 93 ms;
 * 2. what comes out is stamped `MEDIDO` and **never updates on its own**.
 *
 * The second is the point. A figure that moves while nobody touched it is a
 * figure nobody can write down, and every number this app publishes has to say
 * how it was obtained and how old it is.
 *
 * **Nothing is fitted here.** No fc/fm from the sidebands, no ratio inferred, no
 * Bessel for the modulation index: those read a measurement and produce a
 * *theory*, they are their own session, and the cells that will hold them stay
 * dead until then. What a medida is, today, is peaks and a partial table.
 */

/** The partial table of one medida, plus how it was obtained. */
export interface Medida {
  /** Samples analysed: 65 536, and it is on screen next to every figure. */
  readonly window: number;
  readonly sampleRate: number;
  /** Hz per bin: 0.673 at 65 536. What the frequencies below are worth. */
  readonly binHz: number;
  /**
   * The note the table was read against, or `null` when the keyboard was not
   * holding one. It numbers the harmonics and finds the comb's sidebands; with
   * no note the lines are still measured and simply have no harmonic number.
   */
  readonly fundamentalHz: number | null;
  /** The strongest bin, in dBFS. Fase 0's working level is −15 to −25. */
  readonly peakDb: number;
  /**
   * The noise floor in absolute dBFS, the same word and the same figure as the
   * vista viva's `FLOOR`. Fase 0 §3's `rel. al pico` numbers are this minus
   * {@link peakDb}.
   */
  readonly floorDb: number;
  /** The lines found, strongest first, each one content or comb. */
  readonly partials: readonly Partial[];
  /** The comb line the chip names, or `null` when the comb was not seen. */
  readonly artefactHz: number | null;
}

/**
 * The medida of one window, or `null` when there was nothing in it.
 *
 * `null` is «the shutter opened on silence», which is a real answer and not an
 * error: somebody pressed MEDIR between two notes. It is drawn as the dead state
 * of the column — dashes and `hay que volver a medir` — exactly like never
 * having measured, because that is what it is.
 *
 * Being handed fewer samples than the window, on the other hand, is a caller's
 * mistake and throws: a medida over a padded window is a medida of something
 * that never happened. The ring answers `None` rather than a short tail for the
 * same reason (`crates/modx-audio/src/ring.rs`).
 */
export function medida(
  samples: Float32Array,
  fundamentalHz: number | null,
  sampleRate: number = SAMPLE_RATE,
  window: number = MEASURE_WINDOW,
): Medida | null {
  if (samples.length < window) {
    throw new Error(`medida de ${window}: sólo hay ${samples.length} muestras`);
  }
  if (windowPeak(samples, window) < NOTHING_ENTERING) {
    return null;
  }

  const analysed = spectrum(samples, window, sampleRate);
  const partials = findPartials(analysed, fundamentalHz);

  return {
    window,
    sampleRate,
    binHz: analysed.binHz,
    fundamentalHz,
    peakDb: analysed.peakDb,
    floorDb: analysed.floorDb,
    partials,
    artefactHz: artefactChipHz(partials),
  };
}

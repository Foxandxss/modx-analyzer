/**
 * The frozen parameters of every analysis in the app.
 *
 * **None of these change without a written note in `docs/results`.** A figure on
 * screen says how it was obtained, and «Hann 4 096, salto 1 323» is part of how:
 * change one and every number measured before the change stops comparing.
 *
 * The hop is chosen as an **integer number of device callbacks** (three of the
 * 441-frame callbacks WASAPI hands over, fase 0 §4), so a trama never straddles a
 * partial buffer and the live rate is exactly the bloque rate.
 */

/** The only rate `Line (MODX)` offers. */
export const SAMPLE_RATE = 44100;

/** Interleaved stereo, and the analysis reads channel 0. */
export const CHANNELS = 2;

/** Frames per device callback: 441, constant, exactly 10.000 ms. */
export const CALLBACK_FRAMES = 441;

/** Three callbacks per bloque: 1 323 frames, 30.0 ms. */
export const BLOCK_FRAMES = CALLBACK_FRAMES * 3;

/** Vista viva: one Hann window of 4 096 per hop of 1 323 — 68 % overlap. */
export const LIVE_WINDOW = 4096;

/** One hop per bloque, so the vista viva runs at the bloque rate: 33.3 fps. */
export const LIVE_HOP = BLOCK_FRAMES;

/** 10.77 Hz per bin at 4 096. */
export const LIVE_BIN_HZ = SAMPLE_RATE / LIVE_WINDOW;

/** Medida: one Hann window of 65 536, no overlap, taken when MEDIR is pressed. */
export const MEASURE_WINDOW = 65536;

/** The waterfall keeps the last 14 tramas: 462 ms. */
export const WATERFALL_FRAMES = 14;

/**
 * The generator's comb: peaks at multiples of `44100 / 16` that are not harmonics
 * of the note and sit around −72 dB in all four golden WAVs (fase 0 §7). Tied to
 * the sample clock, not to the note, so it never counts as content.
 */
export const ARTEFACT_HZ = SAMPLE_RATE / 16;

/**
 * The espectro's axis is **multiples of the note**, not hertz: `LOG 1×–32×`.
 *
 * It is the axis the design draws and it is the one that teaches: the harmonics
 * of any note land on the same marks, so the shape of a timbre stops moving when
 * the note does. It also means there is no espectro without a note — with nothing
 * periodic there is no 1×, and an empty frame is the honest drawing.
 */
export const AXIS_LOW_MULTIPLE = 1;
export const AXIS_HIGH_MULTIPLE = 32;

/**
 * Points of the drawn curve. 256 over five octaves is ~51 per octave, more than
 * the 700-odd pixels the panel is wide can show at the top of the axis, and it
 * makes a trama's message 1 KB instead of the 16 KB of the whole bin array.
 */
export const CURVE_POINTS = 256;

/** The armónicos panel: n1 … n16. */
export const HARMONIC_BARS = 16;

/**
 * How far down a bar is drawn from the loudest line of the frame before it is
 * nothing: 72 dB. It puts the fase 0 noise floor (−100 to −109 dB rel. al pico,
 * which is the same reference the bars are drawn against) off the
 * bottom, so a harmonic that is not there has no bar at all rather than a stub
 * of floor — and it keeps the whole odd skeleton of the modhigh vector, whose
 * quietest drawn harmonic is the 15th at −25 dB, comfortably on.
 */
export const HARMONIC_SPAN_DB = 72;

/**
 * Under this peak there is nothing to analyse: −80 dBFS, the scope's own floor.
 *
 * It is not «no entra audio» — that is exact digital zeros for a second, decided
 * in Rust — it is a window with nothing in it, which happens at every launch
 * before the first bloque, between two notes, and whenever the shutter of MEDIR
 * opens on a silence.
 */
export const NOTHING_ENTERING = 1e-4;

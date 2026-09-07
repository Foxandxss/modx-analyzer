/**
 * The frequency of a MIDI note in equal temperament, A4 = 440 Hz.
 *
 * This is `TEORÍA` and is stamped as such wherever it is drawn. The MODX's real
 * fundamental does **not** land here — fase 0 measured 261.763 Hz where this
 * formula says 261.626 — and seeing the two disagree is one of the things the app
 * is for. So it is never rounded into agreement and never called measured.
 */
export function equalTemperamentHz(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

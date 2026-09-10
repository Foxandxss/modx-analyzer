import { LockRefusal, SCOPE_CYCLES, ScopeLock } from 'modx-dsp';
import { WaterfallView } from '../audio/audio-service';

/**
 * The two Vistas vivas whose head says what the picture is, in one place.
 *
 * Both the scope and the waterfall can be drawn in a Ranura or in the bottom
 * strip, and a caption that read one way up in the column and another way down
 * in the strip would be the same signal described twice. Pure functions over
 * what {@link AudioService} already holds: no component, no injector, and
 * nothing here is a literal in a template.
 */

/**
 * The three reasons there is no enganche, in the screen's words.
 *
 * Two of them are lower case and one is not, and that is deliberate: `MORE THAN
 * ONE NOTE` is a fact about what is being played and the other two are the app
 * saying what it cannot do. `no capture yet` is not here — it cannot fire until
 * an fc is fitted, and copy that cannot appear is copy the next sweep has to
 * explain.
 */
const LOCK_REFUSAL: Record<LockRefusal, string> = {
  noHeldNote: 'no held note',
  pitchUnstable: 'pitch unstable',
  moreThanOneNote: 'MORE THAN ONE NOTE',
};

/** What is arriving does not clear the floor by 6 dB: it is the floor. */
const BELOW_FLOOR = 'SIGNAL BELOW FLOOR';

/** Nothing has been drawn yet, so there is no span to state. */
const NO_ROWS = 'WATERFALL · 0 FRAMES';

/**
 * The scope's caption, whole, from the enganche and nothing else.
 *
 * `LOCKED 349.23 Hz · 4 CYCLES · 11.5 ms` says what the trace is: the note it is
 * locked to, how much of it is drawn, and how long that is. A waveform that
 * stands still is a claim about the enganche and not about the sound, so when
 * there is no enganche the caption says `NO LOCK` and why, and when what is
 * arriving is the floor it says that instead.
 *
 * The frequency is printed to two decimals because that is what the note is
 * known to — it comes from equal temperament or from a fitted fc, not from a
 * peak that wanders — and the window to a tenth of a millisecond.
 */
export function lockCaption(lock: ScopeLock): string {
  if (lock.kind === 'belowFloor') {
    return BELOW_FLOOR;
  }
  if (lock.kind === 'noLock') {
    return `NO LOCK · ${LOCK_REFUSAL[lock.reason]}`;
  }
  return `LOCKED ${lock.frequencyHz.toFixed(2)} Hz · ${SCOPE_CYCLES} CYCLES · ${lock.windowMs.toFixed(1)} ms`;
}

/**
 * The waterfall's caption: the rows drawn and the span they cover, whole ms.
 *
 * It describes no shape. Whether an attack is bright is a property of the sound
 * and not of the panel, so the sentence that used to sit in the template could
 * only ever be right about one patch.
 *
 * With nothing drawn the span clause is absent rather than printed as a zero. A
 * picture of nothing has no first row and no last, so `0 → 0 ms` would be a
 * figure standing where there is no measurement.
 */
export function waterfallCaption(drawn: WaterfallView): string {
  if (drawn.frames === 0) {
    return NO_ROWS;
  }
  return `WATERFALL · ${drawn.frames} FRAMES · 0 → ${Math.round(drawn.spanMs)} ms`;
}

/** What the two axes of the waterfall are. The picture has no other legend. */
export const WATERFALL_AXES = 'TIME ↓ · FREQUENCY →';

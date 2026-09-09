import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { MEASURE_WINDOW, Partial } from 'modx-dsp';
import { AudioService } from '../../audio/audio-service';
import { BACKEND_GATEWAY, invalidated } from '../../backend/backend-gateway';
import { Clock } from '../../provenance/clock';
import { DEAD_MARK, PROVENANCE_LABEL } from '../../provenance/provenance';
import { Figure } from '../../provenance/figure';
import { CaptureButton } from '../../shell/capture/capture-button';
import { Shutter } from '../../shell/capture/shutter';
import { NOT_A_HARMONIC } from '../not-a-harmonic';

/** One line of the partial table, ready to draw. */
export interface PartialLine {
  readonly hz: string;
  readonly db: string;
  /**
   * `n9`, or {@link NOT_A_HARMONIC} for the comb, or the dash for neither.
   *
   * The tag is one column of a row whose **first column is the frequency**, so
   * the comb is named beside its hertz here exactly as it is on the chip. What
   * it is not is a second copy of the number twelve pixels to its right.
   */
  readonly tag: string;
  readonly artefact: boolean;
}

/**
 * The measured figures, and the copies of the patch.
 *
 * **The empty column is a contract, not a hole.** Every cell keeps its label and
 * its unit and loses only its figure — the void vocabulary, reused — so a dash
 * says which measurement is missing and what it would be measured in. Never a
 * zero and never a plausible placeholder: a ratio reading `0.00` before anything
 * was captured is the one failure this project exists to prevent.
 *
 * That state is **not onboarding**. The column goes back to dashes every time the
 * Performance changes, which is many times an hour, so it is permanent and
 * recurring and is drawn as one thing: one sentence at the head over the same
 * shutter glyph the button carries, and the `CAPTURE` button repeated at the foot
 * where the eye already is. What it does not do is repeat a variant of "not in
 * this session" under five separate cells.
 *
 * **Nothing here updates on its own**: a medida is something you did, so the
 * table stands still and only the age underneath it moves.
 *
 * The four cells at the top — ratio, fc/fm, the modulation index and the worst
 * partial — exist and stay dead all session. They are not measurements but *fits*
 * over one: a sideband fit for fc/fm, a Bessel fit for I and for the gap. Drawing
 * them empty says the app knows they are missing; leaving them out would say
 * nobody had thought of them.
 *
 * The last cell is the volcado de seguridad: how much of it came back, what it is
 * called and the full folder path. A safety file you cannot locate does not count
 * as safety, so the path is on screen whether the dump worked or not.
 */
@Component({
  selector: 'app-figures-column',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Figure, Shutter, CaptureButton],
  templateUrl: './figures-column.html',
  styleUrl: './figures-column.scss',
})
export class FiguresColumn {
  private readonly backend = inject(BACKEND_GATEWAY);
  private readonly audio = inject(AudioService);
  private readonly clock = inject(Clock);

  protected readonly dead = invalidated<string>();

  /** `65536`, said next to every measured figure: the window is part of the how. */
  protected readonly window = MEASURE_WINDOW;

  /** Asked once over invoke, so the folder is on screen before any dump exists. */
  private readonly dumpsFolder = resource<string | null, unknown>({
    defaultValue: null,
    loader: async () => (await this.backend.appInfo()).dumpsFolder,
  });

  private readonly dump = this.backend.dump;

  /** The dump's own folder once it has one; `app_info`'s until then. */
  protected readonly folder = computed(() => this.dump()?.folder ?? this.dumpsFolder.value());

  /** The whole volcado came back. Only then is the number drawn as a live figure. */
  protected readonly saved = computed(() => this.dump()?.state === 'saved');

  /** Short or failed: the two states the aviso strip is up for. */
  protected readonly bad = computed(() => {
    const state = this.dump()?.state;
    return state === 'short' || state === 'failed';
  });

  /** `7669 B · 123 MSG`, or the dash while the keyboard has not answered. */
  protected readonly line = computed(() => {
    const taken = this.dump();
    if (taken === null || taken.state === 'failed') {
      return DEAD_MARK;
    }
    return `${taken.bytes} B · ${taken.messages} MSG`;
  });

  /** The file name on its own: the path underneath already carries the folder. */
  protected readonly fileName = computed(() => {
    const path = this.dump()?.path;
    return path ? (/[^\\/]+$/.exec(path)?.[0] ?? path) : null;
  });

  /** What to say when there is no file: what is happening, or what went wrong. */
  protected readonly dumpNote = computed(() => {
    const taken = this.dump();
    if (taken === null) {
      return 'dumping the edit buffer';
    }
    return taken.reason ?? 'no file';
  });

  /** The last medida, or `null`. It changes when MEDIR is pressed and never else. */
  private readonly medida = this.audio.medida;

  protected readonly measuring = this.audio.measuring;

  /**
   * How old the medida is, in whole seconds. **The only thing on this cell that
   * moves**, and it moves because a number that does not say how old it is stops
   * being a measurement the moment the sound changes.
   */
  protected readonly ageSeconds = computed(() => {
    const taken = this.medida();
    return taken === null ? null : Math.floor((this.clock.now() - taken.takenAt) / 1000);
  });

  /** `MEASURED · 65536 · 14 s ago`, or nothing at all when there is no medida. */
  protected readonly stamp = computed(() => {
    const age = this.ageSeconds();
    return age === null
      ? null
      : `${PROVENANCE_LABEL.measured} · ${this.window} · ${Math.max(0, age)} s ago`;
  });

  /** The lines of the table, strongest first, or `null` in the dead state. */
  protected readonly partials = computed<PartialLine[] | null>(() => {
    const taken = this.medida();
    return taken === null ? null : taken.medida.partials.map((partial) => toLine(partial));
  });

  /** `NOTE 261.8 Hz · PEAK −18 dBFS`: what the shutter caught, in one line. */
  protected readonly caught = computed(() => {
    const taken = this.medida();
    if (taken === null) {
      return null;
    }
    const { fundamentalHz, peakDb } = taken.medida;
    const note = fundamentalHz === null ? DEAD_MARK : `${fundamentalHz.toFixed(1)} Hz`;
    return `NOTE ${note} · PEAK ${peakDb.toFixed(1)} dBFS`;
  });

  /**
   * Why the shutter came back empty, when it did, and `null` when there is
   * nothing to say. Two causes and no more — the ring not filled and the shutter
   * over a silence — plus `capturing` while it is open. That the sound was
   * changed underneath is **not** here: the column at rest says it, and the
   * header says it in words.
   */
  protected readonly note = computed(() =>
    this.measuring() ? 'capturing' : this.audio.measureNote(),
  );

  /** No capture on screen: the invitation stands and every cell is a dash. */
  protected readonly resting = computed(() => this.medida() === null);
}

/** One partial as the column draws it. The comb keeps its badge here too. */
function toLine(partial: Partial): PartialLine {
  return {
    hz: partial.hz.toFixed(1),
    db: partial.db.toFixed(1),
    tag:
      partial.kind === 'artefact'
        ? NOT_A_HARMONIC
        : partial.harmonic === null
          ? DEAD_MARK
          : `n${partial.harmonic}`,
    artefact: partial.kind === 'artefact',
  };
}

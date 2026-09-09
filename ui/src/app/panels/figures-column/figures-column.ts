import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { MEASURE_WINDOW, Partial } from 'modx-dsp';
import { AudioService } from '../../audio/audio-service';
import { BACKEND_GATEWAY, invalidated } from '../../backend/backend-gateway';
import { Clock } from '../../provenance/clock';
import { DEAD_MARK, PROVENANCE_LABEL } from '../../provenance/provenance';
import { Figure } from '../../provenance/figure';

/** One line of the partial table, ready to draw. */
export interface PartialLine {
  readonly hz: string;
  readonly db: string;
  /** `n9`, or `NOT A HARMONIC` for the generator's comb, or the dash for neither. */
  readonly tag: string;
  readonly artefact: boolean;
}

/**
 * The measured figures, and the copies of the patch.
 *
 * With no valid medida the column shows dashes and `NOT MEASURED IN THIS SOUND` —
 * never zeros, because an absent number that looks like a number is worse than
 * no number. **Nothing here updates on its own**: a medida is something you did,
 * so the table stands still and only the age underneath it moves.
 *
 * The three cells at the top — ratio, fc/fm and the modulation index — exist and
 * stay dead all session. They are not measurements but *fits* over one: a
 * sideband fit for fc/fm, a Bessel fit for I. Drawing them empty says the app
 * knows they are missing; leaving them out would say nobody had thought of them.
 *
 * The last cell is the volcado de seguridad: how much of it came back, what it is
 * called and the full folder path. A safety file you cannot locate does not count
 * as safety, so the path is on screen whether the dump worked or not.
 */
@Component({
  selector: 'app-figures-column',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Figure],
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

  /** `7669 B · 123 MSJ`, or the dash while the keyboard has not answered. */
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
  protected readonly note = computed(() => {
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
   * Why the column is empty, when it is. «Nunca se ha medido» and «se midió y no
   * había nada» are different facts and the second one is a result.
   */
  protected readonly why = computed(() => this.audio.measureNote() ?? 'NOT MEASURED IN THIS SOUND');
}

/** One partial as the column draws it. The comb keeps its badge here too. */
function toLine(partial: Partial): PartialLine {
  return {
    hz: partial.hz.toFixed(1),
    db: partial.db.toFixed(1),
    tag:
      partial.kind === 'artefact'
        ? 'NOT A HARMONIC'
        : partial.harmonic === null
          ? DEAD_MARK
          : `n${partial.harmonic}`,
    artefact: partial.kind === 'artefact',
  };
}

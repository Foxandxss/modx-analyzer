import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { BACKEND_GATEWAY, invalidated } from '../../backend/backend-gateway';
import { DEAD_MARK } from '../../provenance/provenance';
import { Figure } from '../../provenance/figure';

/**
 * The measured figures, and the copies of the patch.
 *
 * With no valid medida the column shows dashes and `hay que volver a medir` —
 * never zeros, because an absent number that looks like a number is worse than
 * no number. Nothing here updates on its own: a medida is something you did.
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

  protected readonly dead = invalidated<string>();

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
    return `${taken.bytes} B · ${taken.messages} MSJ`;
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
      return 'volcando el buffer de edición';
    }
    return taken.reason ?? 'sin fichero';
  });
}

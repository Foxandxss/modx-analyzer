import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { BACKEND_GATEWAY, invalidated } from '../../backend/backend-gateway';
import { Figure } from '../../provenance/figure';

/**
 * The measured figures, and the folder where the copies live.
 *
 * With no valid medida the column shows dashes and `hay que volver a medir` —
 * never zeros, because an absent number that looks like a number is worse than
 * no number. Nothing here updates on its own: a medida is something you did.
 *
 * The last cell is the dumps folder, read once over invoke. A safety file you
 * cannot locate does not count as safety, so the full path is on screen.
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

  protected readonly dumpsFolder = resource<string | null, unknown>({
    defaultValue: null,
    loader: async () => (await this.backend.appInfo()).dumpsFolder,
  });
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Composition, RanuraIndex } from '../../shell/composition';

/**
 * What is left of the glass column when both ranuras are empty: two handles.
 *
 * Emptying both hands the algorithm the screen, and this is the handle left
 * behind so that **one press brings a panel back**. It is the bench drawer's
 * closed vocabulary stood on its end — the same 52 px of `--drawer-grab`, the
 * same grip, the same micro type in inert ink — because it is the same sentence:
 * there is something here, it is shut, and this is where you pull.
 *
 * Two handles and not one, one per ranura, because the halves are fixed: the top
 * handle fills the top half. And each is **labelled with the panel it will put
 * back** ({@link Composition.handles}), so the press that the rail promises is a
 * press whose result is written on it rather than a surprise.
 *
 * It is not drawn for `KEEP IT BIG`. That state has its own handle — the pin,
 * still lit, in the header of the panel it is about — and a rail beside it would
 * be a second control for the same one press.
 */
@Component({
  selector: 'app-column-rail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (name of handles(); track $index) {
      <button type="button" class="handle" (click)="restore($index)">
        <span class="handle__grip" aria-hidden="true"></span>
        <span class="handle__name">{{ name }}</span>
      </button>
    }
  `,
  styleUrl: './column-rail.scss',
})
export class ColumnRail {
  private readonly composition = inject(Composition);

  /** What each handle would bring back, top first. It is what each one says. */
  protected readonly handles = this.composition.handles;

  protected restore(ranura: number): void {
    this.composition.restore(ranura as RanuraIndex);
  }
}

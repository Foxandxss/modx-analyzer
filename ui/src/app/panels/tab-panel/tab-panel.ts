import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

/** The two views that share the bottom strip. */
export type BottomView = 'WATERFALL' | 'SCOPE';

export const BOTTOM_VIEWS: readonly BottomView[] = ['WATERFALL', 'SCOPE'];

/**
 * Waterfall and scope, sharing 156 px.
 *
 * The waterfall is the default the moment a note is live and the scope is asked
 * for; with no audio yet the tabs are here, at their 44 px touch height, and the
 * frame is empty.
 */
@Component({
  selector: 'app-tab-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist">
      @for (view of views; track view) {
        <button
          type="button"
          class="tabs__tab"
          role="tab"
          [class.tabs__tab--on]="view === selected()"
          [attr.aria-selected]="view === selected()"
          (click)="selected.set(view)"
        >
          {{ view }}
        </button>
      }
      <span class="tabs__note">el ataque brillante apagándose · 14 tramas · 0 → 460 ms</span>
      <span class="tabs__axes">TIEMPO ↓ · FRECUENCIA →</span>
    </div>
    <div class="frame"></div>
  `,
  styleUrl: './tab-panel.scss',
})
export class TabPanel {
  protected readonly views = BOTTOM_VIEWS;
  protected readonly selected = signal<BottomView>('WATERFALL');
}

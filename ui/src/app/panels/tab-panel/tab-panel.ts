import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AudioService } from '../../audio/audio-service';
import { DEAD_MARK } from '../../provenance/provenance';
import { Scope } from '../scope/scope';

/** The two views that share the bottom strip. */
export type BottomView = 'WATERFALL' | 'SCOPE';

export const BOTTOM_VIEWS: readonly BottomView[] = ['WATERFALL', 'SCOPE'];

/**
 * Waterfall and scope, sharing 156 px.
 *
 * The scope is live: it draws the trace the worker triggered, and its readout says
 * how it was triggered — `TRIGGER ↑0 · 2 CICLOS · 261.8 Hz` — because a waveform
 * that stands still is a claim about the trigger, not about the sound. The
 * waterfall is still an empty frame; it arrives with the vista viva (#9), and with
 * it the rule that it becomes the default tab the moment a note is live.
 */
@Component({
  selector: 'app-tab-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Scope],
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
      @if (selected() === 'SCOPE') {
        <span class="tabs__note">TRIGGER ↑0 · 2 CICLOS · {{ trigger() }}</span>
      } @else {
        <span class="tabs__note">el ataque brillante apagándose · 14 tramas · 0 → 460 ms</span>
        <span class="tabs__axes">TIEMPO ↓ · FRECUENCIA →</span>
      }
    </div>
    <div class="frame">
      @if (selected() === 'SCOPE') {
        <app-scope />
      }
    </div>
  `,
  styleUrl: './tab-panel.scss',
})
export class TabPanel {
  private readonly audio = inject(AudioService);

  protected readonly views = BOTTOM_VIEWS;
  protected readonly selected = signal<BottomView>('WATERFALL');

  /** The frequency the trace was triggered at, in tenths so it stops flickering. */
  protected readonly trigger = computed(() => {
    const hertz = this.audio.frequencyHz();
    return hertz === null ? `${DEAD_MARK} Hz` : `${(Math.round(hertz * 10) / 10).toFixed(1)} Hz`;
  });
}

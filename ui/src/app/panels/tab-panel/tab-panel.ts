import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { AudioService } from '../../audio/audio-service';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { DEAD_MARK } from '../../provenance/provenance';
import { Scope } from '../scope/scope';
import { Waterfall } from '../waterfall/waterfall';

/** The two views that share the bottom strip. */
export type BottomView = 'WATERFALL' | 'SCOPE';

export const BOTTOM_VIEWS: readonly BottomView[] = ['WATERFALL', 'SCOPE'];

/**
 * Waterfall and scope, sharing 156 px.
 *
 * **The waterfall is the default the moment a note is live**; the scope is asked
 * for. Somebody who asks for it keeps it for as long as they are playing — a tab
 * that snapped back under a held chord would be the app arguing — and the request
 * expires when the keyboard falls silent, so the next note starts on the
 * waterfall again.
 *
 * The scope's readout says how the trace was triggered — `TRIGGER ↑0 · 2 CICLOS ·
 * 261.8 Hz` — because a waveform that stands still is a claim about the trigger,
 * not about the sound.
 */
@Component({
  selector: 'app-tab-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Scope, Waterfall],
  template: `
    <div class="tabs" role="tablist">
      @for (view of views; track view) {
        <button
          type="button"
          class="tabs__tab"
          role="tab"
          [class.tabs__tab--on]="view === selected()"
          [attr.aria-selected]="view === selected()"
          (click)="choose(view)"
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
      } @else {
        <app-waterfall />
      }
    </div>
  `,
  styleUrl: './tab-panel.scss',
})
export class TabPanel {
  private readonly audio = inject(AudioService);
  private readonly backend = inject(BACKEND_GATEWAY);

  protected readonly views = BOTTOM_VIEWS;

  /** What the user asked for, or `null` when nobody has asked for anything. */
  private readonly asked = signal<BottomView | null>(null);

  protected readonly selected = computed(() => this.asked() ?? 'WATERFALL');

  constructor() {
    // The request expires with the last note: a tab asked for during a phrase
    // belongs to that phrase.
    effect(() => {
      if (this.backend.liveNotes() === 0) {
        this.asked.set(null);
      }
    });
  }

  protected choose(view: BottomView): void {
    this.asked.set(view);
  }

  /** The frequency the trace was triggered at, in tenths so it stops flickering. */
  protected readonly trigger = computed(() => {
    const hertz = this.audio.frequencyHz();
    return hertz === null ? `${DEAD_MARK} Hz` : `${hertz.toFixed(1)} Hz`;
  });
}

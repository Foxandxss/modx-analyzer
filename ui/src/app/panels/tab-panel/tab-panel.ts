import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { LockRefusal, SCOPE_CYCLES } from 'modx-dsp';
import { AudioService } from '../../audio/audio-service';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { Scope } from '../scope/scope';
import { Waterfall } from '../waterfall/waterfall';

/** The two views that share the bottom strip. */
export type BottomView = 'WATERFALL' | 'SCOPE';

export const BOTTOM_VIEWS: readonly BottomView[] = ['WATERFALL', 'SCOPE'];

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

/**
 * Waterfall and scope, sharing 156 px.
 *
 * **The waterfall is the default the moment a note is live**; the scope is asked
 * for. Somebody who asks for it keeps it for as long as they are playing — a tab
 * that snapped back under a held chord would be the app arguing — and the request
 * expires when the keyboard falls silent, so the next note starts on the
 * waterfall again.
 *
 * **The scope's caption is its specification.** `LOCKED 349.23 Hz · 4 CYCLES ·
 * 11.5 ms` says what the trace is: the note it is locked to, how much of it is
 * drawn, and how long that is. A waveform that stands still is a claim about the
 * enganche and not about the sound, so when there is no enganche the caption says
 * `NO LOCK` and why, and when what is arriving is the floor it says that instead.
 * Every word of it comes from {@link AudioService.scope} and none of it from a
 * literal in this template.
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
        <span class="tabs__note">{{ enganche() }}</span>
      } @else {
        <span class="tabs__note">el ataque brillante apagándose · 14 tramas · 0 → 460 ms</span>
        <span class="tabs__axes">TIME ↓ · FREQUENCY →</span>
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

  /**
   * The caption, whole, from the enganche and nothing else.
   *
   * The frequency is printed to two decimals because that is what the note is
   * known to — it comes from equal temperament or from a fitted fc, not from a
   * peak that wanders — and the window to a tenth of a millisecond.
   */
  protected readonly enganche = computed(() => {
    const lock = this.audio.scope();
    if (lock.kind === 'belowFloor') {
      return BELOW_FLOOR;
    }
    if (lock.kind === 'noLock') {
      return `NO LOCK · ${LOCK_REFUSAL[lock.reason]}`;
    }
    return `LOCKED ${lock.frequencyHz.toFixed(2)} Hz · ${SCOPE_CYCLES} CYCLES · ${lock.windowMs.toFixed(1)} ms`;
  });
}

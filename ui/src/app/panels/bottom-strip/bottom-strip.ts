import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AudioService } from '../../audio/audio-service';
import { WATERFALL_AXES, waterfallCaption } from '../captions';
import { Waterfall } from '../waterfall/waterfall';

/**
 * The bottom strip: the waterfall, 156 px, and nothing to choose.
 *
 * It used to be a tab panel over the waterfall and the scope, with a rule that
 * expired a scope request when the keyboard fell silent. Both are gone: the
 * scope has a home that persists — a Ranura — so the strip holds **one view or
 * none**, and a strip with one tab is a tab that argues with nothing.
 *
 * Whether it is on screen at all is not this component's decision:
 * {@link Composition.strip} says whether the waterfall is down here or up in the
 * column, and the shell draws the strip only when it is down here. One signal is
 * never drawn twice in one frame.
 *
 * **Its caption describes no shape.** `WATERFALL · 12 FRAMES · 0 → 641 ms` is
 * two figures read off the picture, and it is the same sentence the column
 * prints when the waterfall is up there — one function, one wording.
 */
@Component({
  selector: 'app-bottom-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Waterfall],
  template: `
    <div class="head">
      <h2 class="head__title">WATERFALL</h2>
      <span class="head__note">{{ caption() }}</span>
      <span class="head__axes">{{ axes }}</span>
    </div>
    <div class="frame">
      <app-waterfall />
    </div>
  `,
  styleUrl: './bottom-strip.scss',
})
export class BottomStrip {
  private readonly audio = inject(AudioService);

  protected readonly axes = WATERFALL_AXES;

  protected readonly caption = computed(() => waterfallCaption(this.audio.waterfall()));
}

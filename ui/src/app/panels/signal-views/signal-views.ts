import { ChangeDetectionStrategy, Component } from '@angular/core';
import { invalidated } from '../../backend/backend-gateway';
import { Figure } from '../../provenance/figure';

/**
 * The two live panels: espectro on top, armónicos below.
 *
 * These are the one place that never dies — a vista viva is audio entering now,
 * so it is never invalidated. There is no audio bridge yet, so both frames are
 * empty and their readouts are dashes; the canvases arrive with the live views.
 */
@Component({
  selector: 'app-signal-views',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Figure],
  template: `
    <section class="view">
      <div class="view__head">
        <h2 class="view__title">ESPECTRO</h2>
        <span class="view__readout">
          LOG 1×–32× · SUELO <app-figure [value]="dead" [unit]="' dB'" />
        </span>
      </div>
      <div class="view__frame"></div>
    </section>

    <section class="view">
      <div class="view__head">
        <h2 class="view__title">ARMÓNICOS</h2>
        <span class="view__readout">n1 … n16</span>
      </div>
      <div class="view__frame"></div>
    </section>
  `,
  styleUrl: './signal-views.scss',
})
export class SignalViews {
  protected readonly dead = invalidated<number>();
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HARMONIC_BARS, HARMONIC_SPAN_DB } from 'modx-dsp';
import { AudioService } from '../../audio/audio-service';
import { LiveCanvas } from '../live-canvas';

/**
 * The armónicos: sixteen bars, `n1 … n16`, fed by the vista viva.
 *
 * **No Bessel overlay.** The design puts the theoretical curve on top of these
 * bars, and it belongs to the session that fits the modulation index; drawing it
 * from a formula next to a measurement, with nothing having been measured, is
 * exactly the confusion the provenance stamps exist to prevent.
 *
 * A bar is the height of a quantity and not a cell: nothing is drawn where there
 * is no note, and a harmonic that is not there is a bar of no height, never a
 * bar at the bottom of the frame with a zero next to it.
 */
@Component({
  selector: 'app-harmonics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas class="harmonics" aria-label="Live harmonics"></canvas>`,
  styles: `
    :host {
      display: block;
      height: 100%;
      min-height: 0;
    }
    .harmonics {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class Harmonics extends LiveCanvas {
  private readonly audio = inject(AudioService);

  protected override paint(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    styles: CSSStyleDeclaration,
  ): void {
    // The floor line is the axis the bars stand on and is always drawn.
    const base = height - this.ratio;
    context.strokeStyle = this.token(styles, '--rule-color', '#1c2422');
    context.lineWidth = this.ratio;
    context.beginPath();
    context.moveTo(0, base);
    context.lineTo(width, base);
    context.stroke();

    const bars = this.audio.live.trama.harmonics;
    if (bars === null) {
      return;
    }

    const slot = width / HARMONIC_BARS;
    const barWidth = Math.max(this.ratio, slot * 0.5);
    context.fillStyle = this.token(styles, '--signal-primary', '#7df0b0');
    for (let index = 0; index < bars.length; index += 1) {
      const over = HARMONIC_SPAN_DB + bars[index];
      if (over <= 0) {
        continue;
      }
      const tall = (over / HARMONIC_SPAN_DB) * base;
      context.fillRect(index * slot + (slot - barWidth) / 2, base - tall, barWidth, tall);
    }
  }
}

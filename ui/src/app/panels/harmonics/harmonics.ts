import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { HARMONIC_BARS, HARMONIC_SPAN_DB } from 'modx-dsp';
import { AudioService } from '../../audio/audio-service';
import { PROVENANCE_LABEL } from '../../provenance/provenance';
import { LiveCanvas } from '../live-canvas';

/**
 * The armónicos: sixteen bars, `n1 … n16`, fed by the vista viva.
 *
 * **No predicted overlay until there is a capture with a fitted index.** That is
 * the whole rule, and it is narrower than the one this panel used to carry: the
 * design's dashed Bessel curve is not forbidden, it is *unearned*. Drawing it
 * needs a modulation index, an index needs a fit over a capture, and a fit needs
 * a Level→index mapping — none of the three exists yet, so the curve would have
 * to come from a number somebody invented, laid over sixteen bars that were
 * measured. That is the failure the provenance stamps exist to prevent, drawn at
 * full size. The curve arrives with the fit and not before.
 *
 * So the legend says `MEASURED` and only `MEASURED`. A two-line legend under one
 * line of drawing is a caption promising a curve that is not there, and the eye
 * would go looking for it; `PREDICTED` joins it in the same commit as the
 * overlay it names. The measured column says the same thing in words, under the
 * index it cannot fill: `no I, no Bessel curve`.
 *
 * A bar is the height of a quantity and not a cell: nothing is drawn where there
 * is no note, and a harmonic that is not there is a bar of no height, never a
 * bar at the bottom of the frame with a zero next to it.
 *
 * **And the legend goes with them.** `MEASURED` qualifies the bars; with no note
 * there are no bars, so the word would be qualifying an empty frame. See
 * {@link bars}.
 */
@Component({
  selector: 'app-harmonics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas class="harmonics" aria-label="Live harmonics"></canvas>
    @if (bars()) {
      <p class="legend"><span class="legend__swatch" aria-hidden="true"></span>{{ measured }}</p>
    }`,
  styles: `
    :host {
      display: block;
      position: relative;
      height: 100%;
      min-height: 0;
    }
    .harmonics {
      display: block;
      width: 100%;
      height: 100%;
    }
    /* Dentro del marco, sobre el dibujo que nombra, como en la pieza dibujada.
       Una sola entrada: la barra maciza y la palabra. */
    .legend {
      position: absolute;
      inset-block-start: 5px;
      inset-inline-start: 10px;
      display: flex;
      align-items: center;
      gap: var(--space-1);
      margin: 0;
      font-family: var(--font-num);
      font-size: var(--text-micro);
      letter-spacing: 0.06em;
      color: var(--signal-primary);
      pointer-events: none;
    }
    .legend__swatch {
      display: block;
      width: 18px;
      height: 4px;
      background: var(--signal-primary);
    }
  `,
})
export class Harmonics extends LiveCanvas {
  private readonly audio = inject(AudioService);

  /** The stamp's own word, so the legend and the figures cannot say it twice. */
  protected readonly measured = PROVENANCE_LABEL.measured;

  /**
   * Whether there are bars under the legend to call `MEASURED`.
   *
   * A stamp is drawn beside a figure or it is not drawn: with no note there are
   * no bars, and a swatch and the word `MEASURED` over an empty frame label the
   * emptiness — the same failure `provenance.ts` maps `invalidated` to the empty
   * string to prevent. The axis stays, because an axis is not a reading.
   *
   * {@link AudioService.drawing} is the signal for it, and it is exactly the
   * right one: in `liveFrame` the curve and the bars are the **same** `null`,
   * both written by `fundamentalHz === null`, and the dead trama has both. This
   * panel reads `live` inside the paint loop, which is not reactive by design
   * (see {@link LiveCanvas}); `drawing` is the coalesced signal for the one bit
   * of it a template is allowed to move on, and the readout is forced the moment
   * that bit changes rather than waiting for the 4 Hz tick.
   */
  protected readonly bars = this.audio.drawing;

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

    const bars = this.audio.live.frame.harmonics;
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

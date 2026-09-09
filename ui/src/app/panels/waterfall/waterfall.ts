import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WATERFALL_FRAMES } from 'modx-dsp';
import { AudioService } from '../../audio/audio-service';
import { LiveCanvas } from '../live-canvas';

/**
 * The waterfall: the last fourteen tramas as flat ridgelines, 462 ms of the
 * bright attack fading.
 *
 * Flat and not in perspective, because a 3D waterfall lies about the heights it
 * hides and this one is being read, not admired. The newest trama is at the top
 * and the brightest; each older one is dimmer and thinner, so the direction of
 * time is legible without a legend.
 *
 * The frequency axis is the espectro's own `1×–32×`: the two panels are the same
 * numbers, one against time and one against nothing, and an axis that changed
 * between them would make the comparison a puzzle.
 */

/** How far below the peak a ridgeline reaches. Matches the espectro's frame. */
const SPAN_DB = 96;

/** How tall one ridgeline is drawn, as a fraction of the row it lives in. */
const RIDGE_HEIGHT = 2.2;

@Component({
  selector: 'app-waterfall',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas class="waterfall" aria-label="Live waterfall"></canvas>`,
  styles: `
    :host {
      display: block;
      height: 100%;
      min-height: 0;
    }
    .waterfall {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class Waterfall extends LiveCanvas {
  private readonly audio = inject(AudioService);

  protected override paint(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    styles: CSSStyleDeclaration,
  ): void {
    const rows = this.audio.live.waterfall;
    if (rows.length === 0) {
      return;
    }

    // A ridgeline stands on its own line and grows upwards over the ones before
    // it, which is what makes the shape readable; the newest stands high enough
    // for its peak to reach the top of the frame.
    const ridge = (height / WATERFALL_FRAMES) * RIDGE_HEIGHT;

    // Oldest first, so the newest is drawn last and over the others.
    for (let index = 0; index < rows.length; index += 1) {
      const curve = rows[index];
      const age = (rows.length - 1 - index) / Math.max(1, WATERFALL_FRAMES - 1);
      const baseline = ridge + age * (height - ridge);

      context.strokeStyle = fade(age);
      context.lineWidth = (1.4 - 0.4 * age) * this.ratio;
      context.lineJoin = 'round';
      context.beginPath();
      for (let point = 0; point < curve.length; point += 1) {
        const x = (point / (curve.length - 1)) * width;
        const over = Math.max(0, SPAN_DB + curve[point]) / SPAN_DB;
        const y = baseline - ridge * over;
        if (point === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }
      context.stroke();
    }

    this.drawCuts(context, width, height, ridge, rows.length, styles);
  }

  /**
   * The line where the sound changed underneath.
   *
   * Dashed and in `--cut-line`, which is the benign cut: nothing broke, the
   * vista viva did not die — what is below the line is simply another
   * Performance. It is drawn last so it sits over the ridgelines it separates.
   */
  private drawCuts(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    ridge: number,
    shown: number,
    styles: CSSStyleDeclaration,
  ): void {
    const { rows, cuts } = this.audio.live;
    if (cuts.length === 0) {
      return;
    }

    context.save();
    context.strokeStyle = this.token(styles, '--cut-line', '#58c8f5');
    context.lineWidth = 1.4 * this.ratio;
    context.setLineDash(CUT_DASH.map((step) => step * this.ratio));
    for (const cut of cuts) {
      // `waterfall[index]` is row `rows - shown + index`, so the cut sits on the
      // baseline of the first ridgeline that belongs to the new sound.
      const index = cut - (rows - shown);
      if (index < 0 || index >= shown) {
        continue;
      }
      const age = (shown - 1 - index) / Math.max(1, WATERFALL_FRAMES - 1);
      const y = ridge + age * (height - ridge);
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }
    context.restore();
  }
}

/** `--dash-cut`, in CSS pixels before the DPR scale. */
const CUT_DASH = [7, 5];

/**
 * From `#eafff4` when the trama has just arrived to `#1e7351` when it is 462 ms
 * old — the two ends the design gives for the ridgelines.
 */
function fade(age: number): string {
  const mix = (fresh: number, stale: number) => Math.round(fresh + (stale - fresh) * age);
  return `rgb(${mix(234, 30)}, ${mix(255, 115)}, ${mix(244, 81)})`;
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AXIS_HIGH_MULTIPLE, AXIS_LOW_MULTIPLE } from 'modx-dsp';
import { AudioService } from '../../audio/audio-service';
import { LiveCanvas } from '../live-canvas';

/**
 * The espectro: what is entering now, on an axis of multiples of the note.
 *
 * The x axis is `1×–32×` and logarithmic, so the harmonics of any note land on
 * the same marks and the shape of a timbre stops moving when the note does. The
 * y axis is decibels below the loudest line of the frame.
 *
 * The comb of the generator is drawn **dashed and in alert colour, over the
 * curve**, and its frequency goes on the chip in the panel header: fase 0 found
 * it at −72 dB in all four vectors, above the only real harmonic of the pure
 * sine, so a spectrum that did not mark it would be teaching the wrong thing
 * once a session. It is not hidden and it is not counted as a harmonic.
 */

/** How far below the peak the frame reaches. 96 dB puts the fase 0 floor on it. */
const SPAN_DB = 96;

@Component({
  selector: 'app-spectrum',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas class="spectrum" aria-label="Live spectrum"></canvas>`,
  styles: `
    :host {
      display: block;
      height: 100%;
      min-height: 0;
    }
    .spectrum {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class Spectrum extends LiveCanvas {
  private readonly audio = inject(AudioService);

  protected override paint(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    styles: CSSStyleDeclaration,
  ): void {
    const octaves = Math.log2(AXIS_HIGH_MULTIPLE / AXIS_LOW_MULTIPLE);

    // The marks of the axis: 1×, 2×, 4×, 8×, 16×, 32×. Always drawn, because an
    // axis is not a reading — but nothing else is drawn without a trama.
    context.strokeStyle = this.token(styles, '--rule-color', '#1c2422');
    context.lineWidth = this.ratio;
    for (let octave = 0; octave <= octaves; octave += 1) {
      const x = (octave / octaves) * width;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }

    const { curve, partials, fundamentalHz } = this.audio.live.frame;
    if (curve === null || fundamentalHz === null) {
      // No note, no axis, no drawing: an empty frame is the honest one.
      return;
    }

    context.strokeStyle = this.token(styles, '--signal-primary', '#7df0b0');
    context.lineWidth = 2 * this.ratio;
    context.lineJoin = 'round';
    context.beginPath();
    for (let point = 0; point < curve.length; point += 1) {
      const x = (point / (curve.length - 1)) * width;
      const y = this.levelToY(curve[point], height);
      if (point === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.stroke();

    context.strokeStyle = this.token(styles, '--alert', '#ff7a5c');
    context.lineWidth = 2 * this.ratio;
    context.setLineDash([3 * this.ratio, 3 * this.ratio]);
    for (const partial of partials) {
      if (partial.kind !== 'artefact') {
        continue;
      }
      const multiple = partial.hz / fundamentalHz;
      if (multiple < AXIS_LOW_MULTIPLE || multiple > AXIS_HIGH_MULTIPLE) {
        continue;
      }
      const x = (Math.log2(multiple / AXIS_LOW_MULTIPLE) / octaves) * width;
      context.beginPath();
      context.moveTo(x, this.levelToY(partial.db, height));
      context.lineTo(x, height);
      context.stroke();
    }
    context.setLineDash([]);
  }

  /** Decibels below the peak to a pixel, clamped to the frame. */
  private levelToY(db: number, height: number): number {
    const under = Math.min(Math.max(-db, 0), SPAN_DB);
    return (under / SPAN_DB) * height;
  }
}

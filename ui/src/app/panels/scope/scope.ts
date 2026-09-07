import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AudioService } from '../../audio/audio-service';
import { LiveCanvas } from '../live-canvas';

/**
 * The waveform, standing still.
 *
 * It draws the trace the worker already triggered and cut to two cycles (see
 * `scope.ts` in `modx-dsp`), so this file has no analysis in it at all: it owns a
 * canvas and nothing else. The loop and the DPR live in {@link LiveCanvas}.
 */
@Component({
  selector: 'app-scope',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas class="scope" aria-label="Forma de onda"></canvas>`,
  styles: `
    :host {
      display: block;
      height: 100%;
      min-height: 0;
    }
    .scope {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class Scope extends LiveCanvas {
  private readonly audio = inject(AudioService);

  protected override paint(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    styles: CSSStyleDeclaration,
  ): void {
    const middle = height / 2;

    // The zero line is always drawn: it is the axis, not a reading.
    context.strokeStyle = this.token(styles, '--rule-color', '#1c2422');
    context.lineWidth = 2 * this.ratio;
    context.beginPath();
    context.moveTo(0, middle);
    context.lineTo(width, middle);
    context.stroke();

    const trace = this.audio.live.trace;
    if (trace === null || trace.length < 2) {
      // No trace is an empty frame, never a flat line at zero: a flat line is a
      // measurement and this is the absence of one.
      return;
    }

    context.strokeStyle = this.token(styles, '--signal-primary', '#7df0b0');
    context.lineWidth = 2 * this.ratio;
    context.lineJoin = 'round';
    context.beginPath();
    for (let index = 0; index < trace.length; index += 1) {
      const x = (index / (trace.length - 1)) * width;
      const y = middle - trace[index] * middle * 0.92;
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    }
    context.stroke();
  }
}

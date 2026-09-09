import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AudioService } from '../../audio/audio-service';
import { LiveCanvas } from '../live-canvas';

/**
 * The waveform, standing still — or saying that it is not.
 *
 * The analysis is all in `scope.ts` of `modx-dsp`: this file owns a canvas and
 * chooses a register from the enganche the worker already decided. Three of them,
 * and they are three different claims:
 *
 * - **Locked.** The signal's own colour, solid, with the period drawn on it. The
 *   boundaries are what make «four cycles» checkable by eye instead of a promise
 *   in the caption.
 * - **No lock.** The same audio, untriggered, in the predicted register — amber
 *   and dashed (`--theory`, `--dash-theory`) — because a trace nothing is aligned
 *   to is not a measurement of anything and must not be drawn as one.
 * - **Under the floor.** No trace at all: a band as tall as the swing that is
 *   arriving, which is the honest picture of noise. The caption says so.
 */
@Component({
  selector: 'app-scope',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas class="scope" aria-label="Waveform"></canvas>`,
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

    const lock = this.audio.live.scope;
    if (lock.kind === 'belowFloor') {
      this.band(context, width, middle, lock.band, styles);
      return;
    }

    const trace = this.audio.live.trace;
    if (trace === null || trace.length < 2) {
      // Nothing to draw is an empty frame, never a flat line at zero: a flat line
      // is a measurement and this is the absence of one.
      return;
    }

    if (lock.kind === 'locked') {
      this.boundaries(context, width, height, trace.length, lock.periodSamples, styles);
      context.strokeStyle = this.token(styles, '--signal-primary', '#7df0b0');
      context.setLineDash([]);
    } else {
      context.strokeStyle = this.token(styles, '--theory', '#f0b37d');
      context.setLineDash(THEORY_DASH.map((step) => step * this.ratio));
    }

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
    context.setLineDash([]);
  }

  /** One rule per period boundary, so the four cycles can be counted off. */
  private boundaries(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    length: number,
    periodSamples: number,
    styles: CSSStyleDeclaration,
  ): void {
    context.strokeStyle = this.token(styles, '--rule-color', '#1c2422');
    context.lineWidth = 1 * this.ratio;
    for (let cycle = 1; cycle * periodSamples < length; cycle += 1) {
      const x = ((cycle * periodSamples) / (length - 1)) * width;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
  }

  /**
   * The noise floor as a band around zero, as tall as what is actually arriving.
   *
   * It never collapses onto the zero line: at digital silence the band would be
   * nothing at all, and a flat line is exactly the reading this is refusing to
   * make. Two pixels of band say «this is the floor», which is the claim.
   */
  private band(
    context: CanvasRenderingContext2D,
    width: number,
    middle: number,
    amplitude: number,
    styles: CSSStyleDeclaration,
  ): void {
    const half = Math.max(amplitude * middle * 0.92, this.ratio);
    context.strokeStyle = this.token(styles, '--theory', '#f0b37d');
    context.lineWidth = 1 * this.ratio;
    context.setLineDash(THEORY_DASH.map((step) => step * this.ratio));
    for (const edge of [middle - half, middle + half]) {
      context.beginPath();
      context.moveTo(0, edge);
      context.lineTo(width, edge);
      context.stroke();
    }
    context.setLineDash([]);
  }
}

/** `--dash-theory`: la teoría SIEMPRE discontinua. Scaled by the DPR. */
const THEORY_DASH = [5, 4];

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { AudioService } from '../../audio/audio-service';

/**
 * The waveform, standing still.
 *
 * It draws the trace the worker already triggered and cut to two cycles (see
 * `audio/scope` in `modx-dsp`), so this file has no analysis in it at all: it
 * owns a canvas, a `requestAnimationFrame` loop and nothing else.
 *
 * The loop lives outside change detection on purpose. Angular is told about the
 * frequency once it has changed by a tenth of a hertz and about nothing else; the
 * 33 tramas a second go straight to the canvas, which is the only way a zoneless
 * app keeps a 33 ms frame budget.
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
export class Scope {
  private readonly audio = inject(AudioService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    afterNextRender(() => this.paintForever());
  }

  private paintForever(): void {
    const canvas = this.canvas().nativeElement;
    const context = canvas.getContext('2d');
    if (context === null) {
      return;
    }

    let pending = 0;
    const paint = () => {
      this.paint(canvas, context);
      pending = requestAnimationFrame(paint);
    };
    pending = requestAnimationFrame(paint);

    this.destroyRef.onDestroy(() => cancelAnimationFrame(pending));
  }

  private paint(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): void {
    const ratio = devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (width === 0 || height === 0) {
      return;
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    context.clearRect(0, 0, width, height);

    const styles = getComputedStyle(canvas);
    const middle = height / 2;

    // The zero line is always drawn: it is the axis, not a reading.
    context.strokeStyle = styles.getPropertyValue('--rule-color').trim() || '#1c2422';
    context.lineWidth = 2 * ratio;
    context.beginPath();
    context.moveTo(0, middle);
    context.lineTo(width, middle);
    context.stroke();

    const trace = this.audio.trace();
    if (trace === null || trace.length < 2) {
      // No trace is an empty frame, never a flat line at zero: a flat line is a
      // measurement and this is the absence of one.
      return;
    }

    context.strokeStyle = styles.getPropertyValue('--signal-primary').trim() || '#7df0b0';
    context.lineWidth = 2 * ratio;
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

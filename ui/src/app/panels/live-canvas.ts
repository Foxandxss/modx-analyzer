import {
  DestroyRef,
  Directive,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';

/**
 * What every vista viva shares: a canvas, a `requestAnimationFrame` loop, and the
 * device pixel ratio.
 *
 * The loop lives **outside change detection** and reads
 * {@link AudioService.live}, which is a plain object and not a signal. That is
 * the whole reason this base class exists: 33 tramas a second must not be 33
 * change detections a second, and every panel that draws audio has to do it the
 * same way or the budget is spent by whichever one forgets (ADR-0001).
 *
 * A subclass supplies a template with `#canvas` and implements {@link paint}.
 * The canvas is sized and cleared before every call; nothing else is assumed.
 */
// An abstract directive and not a plain class: signal queries only exist inside
// one of Angular's decorators, and `#canvas` is the one thing every panel shares.
@Directive()
export abstract class LiveCanvas {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  /** Device pixels per CSS pixel of the last paint: 1.5 on the target laptop. */
  protected ratio = 1;

  constructor() {
    afterNextRender(() => this.paintForever());
  }

  /** Draw one frame. The canvas is already sized to `width × height` and clear. */
  protected abstract paint(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    styles: CSSStyleDeclaration,
  ): void;

  /** The value of a CSS custom property, or the fallback when it is not set. */
  protected token(styles: CSSStyleDeclaration, name: string, fallback: string): string {
    return styles.getPropertyValue(name).trim() || fallback;
  }

  private paintForever(): void {
    const canvas = this.canvas().nativeElement;
    const context = canvas.getContext('2d');
    if (context === null) {
      return;
    }

    let pending = 0;
    const frame = () => {
      this.resizeAndPaint(canvas, context);
      pending = requestAnimationFrame(frame);
    };
    pending = requestAnimationFrame(frame);

    this.destroyRef.onDestroy(() => cancelAnimationFrame(pending));
  }

  private resizeAndPaint(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): void {
    // Scaled by DPR and never a fixed-size bitmap: at 1.5 a canvas drawn at CSS
    // size is a blurred canvas.
    this.ratio = devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * this.ratio);
    const height = Math.round(canvas.clientHeight * this.ratio);
    if (width === 0 || height === 0) {
      return;
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    context.clearRect(0, 0, width, height);
    this.paint(context, width, height, getComputedStyle(canvas));
  }
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The shutter, drawn once.
 *
 * It appears in two places and they are one mechanism, so they are one drawing:
 * inside the `CAPTURE` button, and at the head of the measured column where the
 * dashed variant stands over the sentence that says what fills the column. The
 * dashes are the void vocabulary — an outline kept, its figure gone — and the
 * ring closes the moment there is a capture to show.
 *
 * Both circles are `currentColor`, so the button's three states (dead, armed,
 * exposing) recolour the glyph without a second copy of the drawing.
 */
@Component({
  selector: 'app-shutter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg viewBox="0 0 26 26" aria-hidden="true">
    <circle
      cx="13"
      cy="13"
      r="11"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      [attr.stroke-dasharray]="dashed() ? '5 4' : null"
    />
    <circle cx="13" cy="13" r="4" fill="currentColor" />
  </svg>`,
  styles: `
    :host {
      display: block;
      width: 26px;
      height: 26px;
      flex: none;
    }
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class Shutter {
  /** Open ring: nothing has been captured, so the outline is there and empty. */
  readonly dashed = input(false);
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** The words, in one place, so the table and the chip cannot drift apart. */
export const NOT_A_HARMONIC = 'NOT A HARMONIC';

/**
 * `NOT A HARMONIC · 2756 Hz`.
 *
 * Anything that is not at a predicted partial is **marked, never hidden, and
 * never counted as a harmonic** (`DESIGN.md` §8.4). The chip is useless without
 * its frequency: the hertz is what tells the note generator's comb from a
 * harmonic of the mains from aliasing, and a warning nobody can act on is worse
 * than no warning, because it is still alarming.
 *
 * So the frequency is a **required input**. A chip with no number is not a state
 * this app can get into by mistake; it is a template that does not compile.
 */
@Component({
  selector: 'app-not-a-harmonic',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `{{ words }} · {{ hertz() }} Hz`,
  styles: `
    :host {
      display: inline-block;
      padding: 3px 8px;
      border: var(--rule-min) solid oklch(0.72 0.16 35 / 0.4);
      border-radius: var(--radius-pill);
      background: oklch(0.72 0.16 35 / 0.1);
      font-family: var(--font-num);
      font-size: var(--text-micro);
      letter-spacing: 0.06em;
      white-space: nowrap;
      color: var(--alert);
    }
  `,
})
export class NotAHarmonic {
  /** Where the comb is, in hertz. Rounded here: nobody reads a decimal on a chip. */
  readonly hz = input.required<number>();

  protected readonly words = NOT_A_HARMONIC;

  protected readonly hertz = computed(() => Math.round(this.hz()));
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PolledValue } from '../backend/backend-gateway';
import { DEAD_MARK } from './provenance';

/**
 * One figure in its slot.
 *
 * The slot keeps its shape whatever happens to the number: when there is no
 * value the dash takes its place, drawn in dead ink. Never `opacity` on the
 * container — that would take the prose with it.
 */
@Component({
  selector: 'app-figure',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="figure" [class.figure--dead]="isDead()">{{ text() }}</span>`,
  styles: `
    .figure {
      font-family: var(--font-num);
      font-variant-numeric: tabular-nums;
    }
    .figure--dead {
      color: var(--dead-ink);
    }
  `,
})
export class Figure {
  readonly value = input.required<PolledValue<string | number>>();

  /** Zero-pad a number to this width, the way the algorithm pill reads `06`. */
  readonly pad = input(0);

  /** Written after the number when there is one, e.g. ` Hz`. Absent on a dash. */
  readonly unit = input('');

  protected readonly isDead = computed(() => this.value().value === null);

  protected readonly text = computed(() => {
    const held = this.value().value;
    if (held === null) {
      return DEAD_MARK;
    }
    const body = typeof held === 'number' ? String(held).padStart(this.pad(), '0') : held;
    return `${body}${this.unit()}`;
  });
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PanicService } from './panic-service';

/**
 * What the pánico says afterwards.
 *
 * It draws **under** the header, like the unhappy-state cards, so the pánico itself
 * stays reachable while the notice is up. There is nothing to dismiss and nothing
 * to undo: it leaves on its own.
 */
@Component({
  selector: 'app-panic-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (notice(); as said) {
      <p class="notice" [class.notice--failed]="said.failed" role="status">{{ said.text }}</p>
    }
  `,
  styles: `
    .notice {
      margin: 0;
      padding: 11px 22px;
      border-bottom: var(--rule-min) solid var(--rule-color);
      background: var(--panic-live-bg);
      font-family: var(--font-num);
      font-size: var(--text-label);
      letter-spacing: 0.06em;
      color: var(--ink-secondary);
    }
    .notice--failed {
      color: var(--alert);
    }
  `,
})
export class PanicNotice {
  private readonly panic = inject(PanicService);

  protected readonly notice = this.panic.notice;
}

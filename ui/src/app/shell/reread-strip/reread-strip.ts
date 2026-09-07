import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { DEAD_MARK, REREAD_TOTAL } from '../../provenance/provenance';

/**
 * The relectura, seen happening.
 *
 * The count is the point: `118 DE 416` says the keyboard is answering and at what
 * rate, which a spinner does not. Placeholder for now — the ancla ticket makes it
 * count real addresses at startup and after every change of patch.
 */
@Component({
  selector: 'app-reread-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="strip">
      <span class="strip__mark" aria-hidden="true"></span>
      <span class="strip__text">RELECTURA · {{ count() }} DE {{ total }}</span>
    </div>
  `,
  styles: `
    .strip {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: 10px 22px;
      border-bottom: var(--rule-min) solid var(--rule-color);
      background: var(--surface-panel);
    }
    .strip__mark {
      width: 20px;
      height: 20px;
      border: var(--rule-min) solid var(--dead-ink);
    }
    .strip__text {
      font-family: var(--font-num);
      font-size: var(--text-label);
      letter-spacing: 0.08em;
      color: var(--dead-note-ink);
    }
  `,
})
export class RereadStrip {
  private readonly backend = inject(BACKEND_GATEWAY);

  protected readonly total = REREAD_TOTAL;

  protected readonly count = computed(() => this.backend.reread()?.done ?? DEAD_MARK);
}

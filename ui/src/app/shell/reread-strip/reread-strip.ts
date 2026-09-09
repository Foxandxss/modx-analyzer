import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BACKEND_GATEWAY, rereadRunning } from '../../backend/backend-gateway';

/**
 * The relectura, seen happening.
 *
 * The count is the point: `118 OF 384` says the keyboard is answering and at
 * what rate, which a spinner does not. It runs at startup and after every change
 * of ancla, and there is **no «releer» button**: the app recovers on its own and
 * shows what that costs instead of hiding it.
 *
 * It is drawn only while a relectura is running. A strip permanently claiming a
 * relectura would be the one kind of lie this screen is built to avoid — and it
 * draws **under** the header, like every other notice, so the pánico is never
 * covered.
 */
@Component({
  selector: 'app-reread-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (running(); as pass) {
      <div class="strip" role="status">
        <span class="strip__mark" aria-hidden="true"></span>
        <span class="strip__text">REREAD · {{ pass.done }} OF {{ pass.total }}</span>
      </div>
    }
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

  /**
   * The pass in progress, or nothing. A relectura that has finished carries how
   * long it took, which is what takes the strip down: the count stops climbing
   * because it arrived, not because it stalled.
   */
  protected readonly running = computed(() => rereadRunning(this.backend.reread()));
}

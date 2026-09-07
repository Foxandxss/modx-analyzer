import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AudioService } from '../../audio/audio-service';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { DEAD_MARK } from '../../provenance/provenance';

/**
 * The instrument the session is measured with, not part of the design.
 *
 * The ten-minute runs of #3 and #8 ask for three numbers — bloques lost, sequence
 * gaps and p99 delivery latency — and a number nobody can read off the screen is a
 * number nobody will write down. So they are on screen, in the smallest type the
 * tokens allow, at the very bottom and under everything else.
 *
 * It goes when the measurements are in the results document and the tickets that
 * need it (#5's dump timing, #8's counts) are closed.
 */
@Component({
  selector: 'app-dev-readout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dev">
      <span class="dev__label">PUENTE</span>
      <span>{{ line() }}</span>
      @if (noAudio()) {
        <span class="dev__alert">SIN AUDIO · CEROS EXACTOS</span>
      }
      <span class="dev__label">VOLCADO</span>
      <span>{{ dumpLine() }}</span>
    </div>
  `,
  styles: `
    .dev {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
      padding: 5px 18px;
      border-top: var(--rule-min) solid var(--rule-color);
      background: var(--surface-base);
      font-family: var(--font-num);
      font-size: var(--text-micro);
      letter-spacing: 0.08em;
      color: var(--ink-inert);
    }
    .dev__label {
      color: var(--ink-tertiary);
    }
    .dev__alert {
      color: var(--alert);
    }
  `,
})
export class DevReadout {
  private readonly audio = inject(AudioService);
  private readonly backend = inject(BACKEND_GATEWAY);

  protected readonly noAudio = this.audio.noAudio;

  /**
   * How long the volcado took, which is the number #5 asks to be written down.
   * It includes the silence the collector waits out, so it is an upper bound on
   * the transfer and an exact measure of what the startup costs.
   */
  protected readonly dumpLine = computed(() => {
    const taken = this.backend.dump();
    if (taken === null) {
      return `${DEAD_MARK} · en curso`;
    }
    return [
      `${taken.bytes} B`,
      `${taken.messages} DE ${taken.expectedMessages} MSJ`,
      taken.tookMs === null ? DEAD_MARK : `${(taken.tookMs / 1000).toFixed(2)} s`,
      taken.state.toUpperCase(),
    ].join(' · ');
  });

  protected readonly line = computed(() => {
    const stats = this.audio.stats();
    const callback =
      stats.minCallbackFrames === stats.maxCallbackFrames
        ? `${stats.callbackFrames}`
        : `${stats.minCallbackFrames}–${stats.maxCallbackFrames}`;

    return [
      `${stats.blocks} BLOQUES`,
      `HUECOS ${stats.gaps}`,
      `DESORDEN ${stats.outOfOrder}`,
      `CALLBACK ${stats.blocks === 0 ? DEAD_MARK : callback} f`,
      `p50 ${millis(stats.p50Ms)}`,
      `p99 ${millis(stats.p99Ms)}`,
      `max ${millis(stats.maxMs)}`,
    ].join(' · ');
  });
}

function millis(value: number | null): string {
  return value === null ? DEAD_MARK : `${value.toFixed(1)} ms`;
}

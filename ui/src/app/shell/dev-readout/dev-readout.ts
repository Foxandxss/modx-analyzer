import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AudioService } from '../../audio/audio-service';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { Clock } from '../../provenance/clock';
import { lastPollAt, pollAgeSeconds } from '../../provenance/last-poll';
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
      <span class="dev__label">TRAMA</span>
      <span>{{ tramaLine() }}</span>
      <span class="dev__label">MEDIDA</span>
      <span>{{ medidaLine() }}</span>
      <span class="dev__label">VOLCADO</span>
      <span>{{ dumpLine() }}</span>
      <span class="dev__label">RELECTURA</span>
      <span>{{ rereadLine() }}</span>
      <span class="dev__label">ENLACE</span>
      <span [class.dev__alert]="linkLost()">{{ linkLine() }}</span>
      <span class="dev__label">GENERADOR</span>
      <span [class.dev__alert]="starved()">{{ generatorLine() }}</span>
      <button type="button" class="dev__button" (click)="toggleGenerator()">
        {{ generator().running ? 'PARAR' : 'NOTAS DENSAS' }}
      </button>
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
    /* The one thing in this strip that can be pressed. It is deliberately plain:
       the design has no control for it, because the generator is not part of the
       app — it is how the app is measured. */
    .dev__button {
      font-family: var(--font-num);
      font-size: var(--text-micro);
      letter-spacing: 0.08em;
      color: var(--ink-secondary);
      background: var(--surface-raised);
      border: var(--rule-min) solid var(--rule-color);
      border-radius: 4px;
      padding: 3px 10px;
      min-height: 22px;
      cursor: pointer;
    }
  `,
})
export class DevReadout {
  private readonly audio = inject(AudioService);
  private readonly backend = inject(BACKEND_GATEWAY);
  private readonly clock = inject(Clock);

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

  /**
   * What one trama of the vista viva costs end to end in the worker, which is
   * the number #9 asks to be written down. The budget is one bloque: 33 ms.
   */
  protected readonly tramaLine = computed(() => {
    const stats = this.audio.stats();
    return [
      `p50 ${millis(stats.tramaP50Ms)}`,
      `p99 ${millis(stats.tramaP99Ms)}`,
      `max ${millis(stats.tramaMaxMs)}`,
      `${this.audio.fps() === null ? DEAD_MARK : this.audio.fps()!.toFixed(1)} fps`,
    ].join(' · ');
  });

  /**
   * What the last 65 536 cost, so the figure can be copied down in the same pass
   * as the others. It has no budget of its own: nothing is being drawn while it
   * runs. What it feeds is #14, which asks whether the anillo's polling changes
   * the spectrum a medida sees.
   */
  protected readonly medidaLine = computed(() => {
    const cost = this.audio.measureMs();
    return cost === null ? `${DEAD_MARK} · sin medir` : `65536 · ${cost.toFixed(1)} ms`;
  });

  /**
   * The last relectura: how many of the addresses answered and what the whole
   * pass cost. Both were measured on the MODX8 on 2026-09-08 (#13): **1,7 s and
   * 383 of 384**, four times running, and the same 1,7 s with a chord held right
   * through the change. The design expected ~0,9 s idle and ~5,5 s playing; the
   * first was optimistic and the second was wrong — playing costs it nothing.
   */
  protected readonly rereadLine = computed(() => {
    const pass = this.backend.reread();
    if (pass === null) {
      return `${DEAD_MARK} · sin releer`;
    }
    const cost = pass.tookMs === null ? 'en curso' : `${(pass.tookMs / 1000).toFixed(2)} s`;
    return `${pass.answered} DE ${pass.total} · ${cost}`;
  });

  /**
   * Which of the two roads to `DESCONECTADO` the app took, and how long ago the
   * keyboard last answered anything.
   *
   * The card says the same thing in Spanish and without the word `timeouts`;
   * this line is what #15 asks to be written down after pulling the USB cable,
   * because «it went red» is not a result and «enumeration, 4 s» is.
   */
  protected readonly linkLost = computed(() => this.backend.connection().port === 'disconnected');

  protected readonly linkLine = computed(() => {
    const connection = this.backend.connection();
    if (connection.port === 'connected') {
      return `${connection.portName ?? DEAD_MARK} · ABIERTO`;
    }
    const at = lastPollAt(this.backend.patch(), this.backend.operators());
    const since = at === null ? DEAD_MARK : `${pollAgeSeconds(at, this.clock.now()).toFixed(1)} s`;
    return `DESCONECTADO · ${connection.loss ?? DEAD_MARK} · ÚLTIMO SONDEO ${since}`;
  });

  protected readonly generator = this.backend.generator;

  /**
   * The port never got round to the generator, or refused it.
   *
   * It is drawn in alert because it changes what the run means and not because
   * anything is broken: the generator is served last of everything (ADR-0004),
   * so a gap between what it asked for and what went out is a **result** about
   * the port under load. A run whose load did not happen must not be written
   * down as a run whose load did.
   */
  protected readonly starved = computed(() => {
    const run = this.generator();
    return run.sent < run.asked || run.refused > 0;
  });

  /**
   * What the note generator has done, and what came back.
   *
   * The two counts are #8's self-verification: `ENVIADAS` is what the port took,
   * `TRÁFICO` is what the **keyboard** said on its own. Under real hands the
   * second climbs with the playing; under generated notes it only climbs if the
   * MODX echoes them, which nobody has checked.
   */
  protected readonly generatorLine = computed(() => {
    const run = this.generator();
    if (!run.running && run.asked === 0) {
      return `PARADO · ${DEAD_MARK}`;
    }
    return [
      run.running ? `NOTAS CADA ${run.stepMs} ms` : 'PARADO',
      `${run.sent} DE ${run.asked} ENVIADAS`,
      `${run.held} VIVAS`,
      `RECHAZOS ${run.refused}`,
      `TRÁFICO ${run.traffic}`,
    ].join(' · ');
  });

  /**
   * Start or stop the run.
   *
   * Nothing is awaited into the state: the native side emits `modx://generator`
   * either way and the line is drawn off that event and nothing else, the same
   * one-writer rule the connection follows.
   */
  protected toggleGenerator(): void {
    void (this.generator().running ? this.backend.stopGenerator() : this.backend.startGenerator());
  }

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

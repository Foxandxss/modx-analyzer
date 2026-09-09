import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MEASURE_WINDOW } from 'modx-dsp';
import { AudioService } from '../../audio/audio-service';
import { LatencyLegs } from '../../audio/bridge';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { Clock } from '../../provenance/clock';
import { lastPollAt, pollAgeSeconds } from '../../provenance/last-poll';
import { DEAD_MARK } from '../../provenance/provenance';

/**
 * The four instruments this readout holds, one per retirement ticket.
 *
 * They are groups of readouts and not modes of a control: the drawer shows one
 * at a time because its chips are what choose, and closing a ticket deletes one
 * name from this type, one case from the template and one chip from the drawer.
 */
export type BenchGroup = 'BRIDGE' | 'STARTUP' | 'AUDIO' | 'PORT';

/**
 * The instrument the session is measured with, not part of the design.
 *
 * The ten-minute runs of #3 and #8 ask for three numbers — bloques lost, sequence
 * gaps and p99 delivery latency — and a number nobody can read off the screen is a
 * number nobody will write down. So they are on screen, in the smallest type the
 * tokens allow, behind the bench drawer's handle (#48).
 *
 * **Nothing here is ever in the alert register.** That belongs to the SysEx
 * console alone: a bridge log with 0 drops has nothing to say, and a temporary
 * instrument that nags is a temporary instrument nobody closes the ticket on. A
 * fact that changes what a run *means* — a negative leg, a starved generator, a
 * paused ancla — is still drawn apart from the rest, but in ink and not in amber.
 *
 * Each group goes when its own ticket closes: BRIDGE #44, STARTUP #45,
 * AUDIO #46, PORT #47.
 */
@Component({
  selector: 'app-dev-readout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dev">
      @switch (group()) {
        @case ('BRIDGE') {
          <span class="dev__label">BRIDGE</span>
          <span>{{ line() }}</span>
          <span class="dev__label">LATENCY</span>
          <span [class.dev__loud]="overBudget()">{{ latencyLine() }}</span>
          @if (brokenClock()) {
            <span class="dev__loud">BROKEN CLOCK</span>
          }
          <span class="dev__label">FRAME</span>
          <span>{{ tramaLine() }}</span>
        }
        @case ('STARTUP') {
          <span class="dev__label">DUMP</span>
          <span>{{ dumpLine() }}</span>
          <span class="dev__label">REREAD</span>
          <span>{{ rereadLine() }}</span>
        }
        @case ('AUDIO') {
          <span class="dev__label">AUDIO</span>
          <span [class.dev__loud]="audioState() !== 'alive'">{{ audioState().toUpperCase() }}</span>
          @if (exactZeros()) {
            <span class="dev__loud">EXACT ZEROS</span>
          }
          <span class="dev__label">CAPTURE</span>
          <span>{{ medidaLine() }}</span>
        }
        @case ('PORT') {
          <span class="dev__label">LINK</span>
          <span [class.dev__loud]="linkLost()">{{ linkLine() }}</span>
          <span class="dev__label">GENERATOR</span>
          <span [class.dev__loud]="starved()">{{ generatorLine() }}</span>
          <button type="button" class="dev__button" (click)="toggleGenerator()">
            {{ generator().running ? 'STOP' : 'DENSE NOTES' }}
          </button>
          <span class="dev__label">POLLING</span>
          <span [class.dev__loud]="paused()">{{ pollingLine() }}</span>
          <button type="button" class="dev__button" (click)="togglePolling()">
            {{ paused() ? 'POLL' : 'STOP POLLING' }}
          </button>
          <button
            type="button"
            class="dev__button"
            [disabled]="exporting()"
            (click)="exportWindow()"
          >
            EXPORT
          </button>
        }
      }
    </div>
  `,
  styles: `
    /* It wraps, and the buttons are what must never be pushed out.
     *
     * A flex item defaults to min-width auto and refuses to shrink below its own
     * text, so one long unbroken string — an exported file's path — made this row
     * wider than the window and carried EXPORT off the right edge with it.
     * Exactly what happened to the pánico in the header, twice in one session, so
     * the rule is written down here too: what is read yields, what is pressed
     * does not. It is the drawer's rule too (#48), inside a drawer that is 18 px
     * narrower than the window it used to have. */
    .dev {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: var(--space-3);
      padding: 14px 18px;
      font-family: var(--font-num);
      font-size: var(--text-micro);
      letter-spacing: 0.08em;
      color: var(--ink-inert);
    }
    .dev > span {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .dev > button {
      flex: 0 0 auto;
    }
    .dev__label {
      color: var(--ink-tertiary);
    }
    /* The fact that changes what the run means, drawn apart from the rest.
     *
     * It used to be the alert register, and the drawer took that away: alert is
     * the SysEx console's alone, because an unconfirmed write is a consequence
     * and a broken clock is a reading. The step is up the ink scale instead —
     * the brightest the app has, against the inert this strip is written in —
     * so a negative leg is still the first thing the eye lands on and nothing in
     * the drawer nags. */
    .dev__loud {
      color: var(--ink-primary);
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
  /** Which instrument the drawer asked for. There is no default: the chip says. */
  readonly group = input.required<BenchGroup>();

  private readonly audio = inject(AudioService);
  private readonly backend = inject(BACKEND_GATEWAY);
  private readonly clock = inject(Clock);

  /** The raw fact, and the dev strip is the one place it is drawn raw. */
  protected readonly exactZeros = this.audio.exactZeros;
  protected readonly mainThreadLag = this.audio.mainThreadLagMs;
  protected readonly mainThreadLagAt = this.audio.mainThreadLagAtSeconds;
  protected readonly audioState = this.audio.audioState;

  /**
   * How long the volcado took, which is the number #5 asks to be written down.
   * It includes the silence the collector waits out, so it is an upper bound on
   * the transfer and an exact measure of what the startup costs.
   */
  protected readonly dumpLine = computed(() => {
    const taken = this.backend.dump();
    if (taken === null) {
      return `${DEAD_MARK} · in progress`;
    }
    return [
      `${taken.bytes} B`,
      `${taken.messages} OF ${taken.expectedMessages} MSG`,
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
    return cost === null ? `${DEAD_MARK} · no capture` : `65536 · ${cost.toFixed(1)} ms`;
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
      return `${DEAD_MARK} · no reread`;
    }
    const cost = pass.tookMs === null ? 'in progress' : `${(pass.tookMs / 1000).toFixed(2)} s`;
    return `${pass.answered} OF ${pass.total} · ${cost}`;
  });

  /**
   * Which of the two roads to `DISCONNECTED` the app took, and how long ago the
   * keyboard last answered anything.
   *
   * The card says the same thing in prose and without the word `timeouts`;
   * this line is what #15 asks to be written down after pulling the USB cable,
   * because «it went red» is not a result and «enumeration, 4 s» is.
   */
  protected readonly linkLost = computed(() => this.backend.connection().port === 'disconnected');

  protected readonly linkLine = computed(() => {
    const connection = this.backend.connection();
    if (connection.port === 'connected') {
      return `${connection.portName ?? DEAD_MARK} · OPEN`;
    }
    const at = lastPollAt(this.backend.patch(), this.backend.operators());
    const since = at === null ? DEAD_MARK : `${pollAgeSeconds(at, this.clock.now()).toFixed(1)} s`;
    return `DISCONNECTED · ${connection.loss ?? DEAD_MARK} · LAST POLL ${since}`;
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
   * The two counts are #8's self-verification: `SENT` is what the port took,
   * `TRAFFIC` is what the **keyboard** said on its own. Under real hands the
   * second climbs with the playing; under generated notes it only climbs if the
   * MODX echoes them, which nobody has checked.
   */
  protected readonly generatorLine = computed(() => {
    const run = this.generator();
    if (!run.running && run.asked === 0) {
      return `STOPPED · ${DEAD_MARK}`;
    }
    return [
      run.running ? `A NOTE EVERY ${run.stepMs} ms` : 'STOPPED',
      `${run.sent} OF ${run.asked} SENT`,
      `${run.held} HELD`,
      `REJECTED ${run.refused}`,
      `TRAFFIC ${run.traffic}`,
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

  /**
   * #14's control: stop the ancla and the anillo ancho, take a window, compare.
   *
   * It is drawn in alert while paused and it says what that costs in the same
   * breath, because a paused app is an app that **cannot see a Performance
   * change** — the ancla is one of the two loops this stops. Everything on the
   * diagram ages to `CADUCO` on its own meanwhile, which is honest; the name in
   * the header is the one thing that would go on saying a sound that is no
   * longer loaded, and nothing on screen could tell.
   */
  protected readonly paused = computed(() => this.backend.polling().paused);

  protected readonly exporting = signal(false);

  /** Where the last window went, so the two paths can be copied in one pass. */
  private readonly exported = signal<string | null>(null);

  /**
   * The state, and the **file name** of the last export rather than its path.
   *
   * The folder is the same for every window and is already on screen under
   * `DUMP`; the name is the half that identifies which of the two this was,
   * because the native side puts the polling state in it. Printing the whole path
   * made this row wider than the window and pushed `EXPORT` out of reach.
   */
  protected readonly pollingLine = computed(() => {
    const where = this.exported();
    const state = this.paused() ? 'STOPPED · THE ANCHOR IS NOT LOOKING' : 'RUNNING';
    if (where === null) {
      return state;
    }
    const name = where.split(/[\\/]/).pop() ?? where;
    return `${state} · ${name}`;
  });

  protected togglePolling(): void {
    void this.backend.setPolling(!this.paused());
  }

  /**
   * Write the window the medida would analyse, labelled by the native side.
   *
   * The label is **not** passed from here: it comes off the polling flag in
   * Rust, so the two files cannot be swapped by a race between this click and
   * the button that toggles the pause.
   */
  protected exportWindow(): void {
    if (this.exporting()) {
      return;
    }
    this.exporting.set(true);
    void this.backend
      .exportWindow(MEASURE_WINDOW)
      .then((path) => this.exported.set(path))
      .catch((error: unknown) => this.exported.set(`${DEAD_MARK} ${String(error)}`))
      .finally(() => this.exporting.set(false));
  }

  protected readonly line = computed(() => {
    const stats = this.audio.stats();
    const callback =
      stats.minCallbackFrames === stats.maxCallbackFrames
        ? `${stats.callbackFrames}`
        : `${stats.minCallbackFrames}–${stats.maxCallbackFrames}`;

    return [
      `${stats.blocks} BLOCKS`,
      `GAPS ${stats.gaps}`,
      `OUT OF ORDER ${stats.outOfOrder}`,
      `CALLBACK ${stats.blocks === 0 ? DEAD_MARK : callback} f`,
      `p50 ${millis(stats.p50Ms)}`,
      `p99 ${millis(stats.p99Ms)}`,
      `max ${millis(stats.maxMs)}`,
      // **Which bloques the three figures above are about.** #23 is what happens
      // when nothing says: read early enough and `p99` reports the launch burst
      // and calls it the bridge. The count is next to the percentiles rather than
      // anywhere else because it is the sentence they are only true inside, and
      // it reads *after* them — `p99 12.4 ms OVER 300 BLOCKS` is the sentence;
      // a count in front of them looked like a fourth figure (ADR-0006).
      `OVER ${stats.measuredBlocks} BLOCKS`,
    ].join(' · ');
  });

  /**
   * Where the lateness was: the worst bloque of the launch and the worst one
   * after it, each split into the three legs of the path (#23).
   *
   * Both are on screen because they are two different facts. Every launch
   * measured so far bursts — 208 to 379 ms against a 33 ms budget, losing
   * nothing — and that burst is a property of the first seconds, not of the
   * bridge, so it is reported and kept out of the percentiles. What would be a
   * real failure is the second figure, and that is the one drawn in alert.
   *
   * The split is what makes the burst attributable rather than merely observed:
   * `QUEUE` is the wait between the audio thread and the IPC, `IPC` the crossing
   * itself, `WORKER` the wait behind the tramas already queued in the worker.
   * Two of the three are exact; only `IPC` spans the two clocks.
   */
  protected readonly latencyLine = computed(() => {
    const stats = this.audio.stats();
    return [
      `LAUNCH ${stats.warmupBlocks} BLOCKS max ${legs(stats.worstWarmup)}`,
      `AFTER max ${legs(stats.worstMeasured)}`,
      // The two that say whether any of the above is about the bridge at all: how
      // long the front went blind, and how late the main thread was to its own
      // timer over the same run. If those two agree, the thread was blocked and
      // the delivery figures are a symptom of it.
      `STALL ${millis(stats.worstGapMs)} AT ${stats.worstGapAtSeconds.toFixed(1)} s`,
      `LOOP ${millis(this.mainThreadLag())} AT ${this.mainThreadLagAt().toFixed(1)} s`,
    ].join(' · ');
  });

  /**
   * The bridge missed the budget somewhere other than the launch.
   *
   * It is deliberately **not** lit by the launch burst: that fires on every
   * single launch, and an alert that is always on is an alert nobody reads. This
   * one only lights for a bloque that was late once the capture was running,
   * which is the thing #8's criterion is actually about.
   */
  protected readonly overBudget = computed(() => {
    const worst = this.audio.stats().worstMeasured;
    return worst !== null && worst.totalMs > BUDGET_MS;
  });

  /**
   * A leg came back negative, which is never a fact about the bridge.
   *
   * All three are durations by construction: the queue and the worker are two
   * stamps each on one clock, and the crossing has the run's smallest crossing
   * taken off it, so none of them can go under zero unless the instrument itself
   * is wrong about which clock it is holding.
   *
   * It is here because that is exactly what happened on the first run of #23's
   * split: `WORKER −447,5 ms`, because `performance.now()` in a worker counts
   * from the worker's own creation and not the page's. The figure was nonsense
   * and nothing on screen said so — it was caught by a human noticing a minus
   * sign. **A measuring instrument that can be wrong should say when it is**,
   * so this says it, and the numbers next to it are not to be written down.
   */
  protected readonly brokenClock = computed(() => {
    const stats = this.audio.stats();
    return [stats.worstWarmup, stats.worstMeasured].some(
      (split) => split !== null && (split.queueMs < 0 || split.ipcMs < 0 || split.workerMs < 0),
    );
  });
}

/** One bloque of the vista viva: the budget every delivery is measured against. */
const BUDGET_MS = 33;

/** One bloque's lateness and where it was spent, or a dash for no such bloque. */
function legs(split: LatencyLegs | null): string {
  if (split === null) {
    return DEAD_MARK;
  }
  const where = [
    `QUEUE ${split.queueMs.toFixed(1)}`,
    `IPC ${split.ipcMs.toFixed(1)}`,
    `WORKER ${split.workerMs.toFixed(1)}`,
  ].join(' · ');
  // **When**, and not only how much. A worst bloque three seconds in is the
  // launch and one four minutes in is the bridge, and #23 is precisely the
  // question of which of those a figure is reporting.
  return `${split.totalMs.toFixed(1)} ms AT ${split.atSeconds.toFixed(1)} s (${where})`;
}

function millis(value: number | null): string {
  return value === null ? DEAD_MARK : `${value.toFixed(1)} ms`;
}

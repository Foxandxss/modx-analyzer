import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { DEAD_MARK } from '../../provenance/provenance';

/** The two Parts this session can say anything about. See {@link SweepReadout}. */
const PARTS = [1, 2];
const OPERATORS = [1, 2, 3, 4, 5, 6, 7, 8];

/**
 * El barrido: #16's instrument, and not part of the design either.
 *
 * Every operator parameter the app reads is addressed with
 * `am = (op << 4) | part`, and that rule was measured on the Part 1 and on the
 * Part 1 only. This is where it gets checked past it: pick a Part and an
 * operator, press `SWEEP`, and every offset of the block is asked for one at a
 * time and drawn with what came back — including the dashes, which are the half
 * that matters. The Data List accounts for 39 of the 47 as parameters and the
 * fase 0c blind sweep counted 43 answering; only the keyboard can say which.
 *
 * Nothing here writes. The whole path down to the port is a closure that reads
 * (`crates/modx-midi/src/sweep.rs`), so «no parameter written during the sweep»
 * is a property of the code and not a promise on a screen.
 *
 * The Part cycles between 1 and 2 because those are the two the ticket promotes:
 * a Performance has sixteen and the app can address any of them, but nothing
 * this session will have looked at Part 7, and a control that offered it would
 * be inviting a reading nobody is going to write down.
 *
 * It lives behind the bench drawer's `SWEEP` chip and goes with ticket **#43**:
 * when the `op<<4 | part` rule is confirmed past the Part 1 and written into
 * `CONTEXT.md`, the chip and this component are deleted together.
 *
 * **Nothing here is in the alert register.** The drawer keeps that for the SysEx
 * console; an offset that moved is drawn in the brightest ink instead.
 */
@Component({
  selector: 'app-sweep-readout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="sweep">
      <div class="sweep__line">
        <span class="sweep__label">SWEEP</span>
        <button type="button" class="sweep__button" (click)="nextPart()">PART {{ part() }}</button>
        <button type="button" class="sweep__button" (click)="nextOperator()">
          OP {{ operator() }}
        </button>
        <button type="button" class="sweep__button" [disabled]="running()" (click)="take()">
          SWEEP
        </button>
        <span>{{ line() }}</span>
        @if (changes(); as moved) {
          <span class="sweep__loud">CHANGED {{ moved }}</span>
        }
      </div>
      @if (offsets().length > 0) {
        <div class="sweep__grid">
          @for (offset of offsets(); track offset.al) {
            <span
              class="sweep__cell"
              [class.sweep__cell--silent]="offset.value === null"
              [class.sweep__cell--moved]="offset.changed"
            >
              <span class="sweep__al">{{ hex(offset.al) }}</span>
              <span>{{ offset.value === null ? dash : offset.value }}</span>
            </span>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .sweep {
      padding: 14px 18px;
      font-family: var(--font-num);
      font-size: var(--text-micro);
      letter-spacing: 0.08em;
      color: var(--ink-inert);
    }
    .sweep__line {
      display: flex;
      align-items: baseline;
      gap: var(--space-3);
    }
    .sweep__label {
      color: var(--ink-tertiary);
    }
    /* An offset that moved since the last sweep, which is the ticket's whole
       criterion. It is not in the alert register any more: the drawer keeps that
       for the SysEx console, where a colour means a consequence. Here it means
       «look at this one», so it is the brightest ink against the inert the rest
       of the strip is written in. */
    .sweep__loud {
      color: var(--ink-primary);
    }
    /* Forty-seven cells of fixed width: the offsets keep their columns from one
       sweep to the next, so a value that moved is a cell that moved and not a
       line to be read again. */
    .sweep__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, 62px);
      /* El hueco ENTRE celdas tiene que ser mayor que el hueco DENTRO de una,
         o el ojo empareja al revés. */
      gap: 2px var(--space-4);
      margin-top: 4px;
    }
    /* space-between empujaba la cifra al borde derecho de su caja de 62 px, o
       sea contra la etiqueta de la celda SIGUIENTE: «1A 99» se leía «99 1B», y
       en la sesión de #16 el 20 de 1A se apuntó como de 1B. La celda roja de
       CAMBIÓ era justo la peor colocada. Ahora el par va junto y a la
       izquierda, y lo que queda de la caja es el aire que lo separa del par
       siguiente (#19). */
    .sweep__cell {
      display: flex;
      justify-content: flex-start;
      gap: var(--space-1);
      color: var(--ink-secondary);
    }
    /* An offset that did not answer keeps its shape and shows the dash, the same
       rule every figure on the screen above follows. */
    .sweep__cell--silent {
      color: var(--ink-inert);
    }
    .sweep__cell--moved {
      color: var(--ink-primary);
    }
    .sweep__al {
      color: var(--ink-tertiary);
    }
    .sweep__button {
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
    .sweep__button:disabled {
      color: var(--ink-inert);
      cursor: default;
    }
  `,
})
export class SweepReadout {
  private readonly backend = inject(BACKEND_GATEWAY);

  protected readonly dash = DEAD_MARK;

  /** What the next press sweeps. It is not what is on screen: that is the sweep's own. */
  protected readonly part = signal(PARTS[0]);
  protected readonly operator = signal(OPERATORS[0]);

  private readonly sweep = this.backend.sweep;

  protected readonly running = computed(() => this.sweep()?.running === true);

  /** Only a finished sweep has a table: a half one would say a Part answers nowhere. */
  protected readonly offsets = computed(() => this.sweep()?.offsets ?? []);

  /**
   * What the pass did: which block it asked, how many answered, and what it cost.
   *
   * The address is the block and not the offset — `49 21` is Op3 of Part 2 — so
   * the one line says at which `am` the app went looking, which is the fact
   * under suspicion.
   */
  protected readonly line = computed(() => {
    const pass = this.sweep();
    if (pass === null) {
      return `${DEAD_MARK} · not swept`;
    }
    const block = `49 ${hex(((pass.operator - 1) << 4) | (pass.part - 1))}`;
    if (pass.running) {
      return `${block} · ${pass.done} OF ${pass.total}`;
    }
    const cost = pass.tookMs === null ? DEAD_MARK : `${(pass.tookMs / 1000).toFixed(2)} s`;
    const compared = pass.compared && pass.changed.length === 0 ? ' · NO CHANGES' : '';
    return `${block} · ${pass.answered} OF ${pass.total} · ${cost}${compared}`;
  });

  /**
   * The offsets that moved since the previous sweep of the same operator, named.
   *
   * This is the criterion of the ticket in one line: change one value on the
   * MODX's own panel between two sweeps and read off where it landed. It is
   * empty when nothing moved **and** when there is nothing to compare with, and
   * the line above tells those two apart.
   */
  protected readonly changes = computed(() => {
    const pass = this.sweep();
    if (pass === null || pass.changed.length === 0) {
      return '';
    }
    return pass.changed
      .map((al) => {
        const offset = pass.offsets.find((candidate) => candidate.al === al);
        return offset?.name ? `${hex(al)} ${offset.name}` : hex(al);
      })
      .join(' · ');
  });

  protected hex(byte: number): string {
    return hex(byte);
  }

  protected nextPart(): void {
    this.part.update((part) => PARTS[(PARTS.indexOf(part) + 1) % PARTS.length]);
  }

  protected nextOperator(): void {
    this.operator.update(
      (operator) => OPERATORS[(OPERATORS.indexOf(operator) + 1) % OPERATORS.length],
    );
  }

  /**
   * Take a sweep. Nothing is awaited into the state: the native side emits what
   * it finds, and a rejection — one already running, or a Part the keyboard does
   * not have — is a developer's line in the console and not a state on screen.
   */
  protected take(): void {
    void this.backend
      .sweepOperator(this.part(), this.operator())
      .catch((reason: unknown) => console.warn('modx: the sweep did not run', reason));
  }
}

function hex(byte: number): string {
  return byte.toString(16).toUpperCase().padStart(2, '0');
}

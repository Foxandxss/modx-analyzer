import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { DevReadout, BenchGroup } from '../dev-readout/dev-readout';
import { SweepReadout } from '../sweep-readout/sweep-readout';

/** Which instrument the drawer is showing. `SWEEP` is the one with its own component. */
export type BenchInstrument = BenchGroup | 'SWEEP';

/**
 * One temporary instrument, and the ticket that takes it off the screen.
 *
 * The ticket number is the whole point of the affordance: a panel labelled `#44`
 * is visibly on its way out, so nobody designs around it and closing the ticket
 * has an obvious consequence — the chip disappears and the drawer gets one item
 * shorter. When the last one goes the handle goes with it and no layout is
 * rethought: it was always 52 px on the outside.
 */
export interface BenchChip {
  readonly id: BenchInstrument;
  /** The retirement ticket. Every chip has one; the SysEx console will not. */
  readonly ticket: number;
  /** What has to be true for the chip to go, in the drawn piece's own words. */
  readonly retires: string;
}

/**
 * The five instruments, in the order the drawn piece lists them.
 *
 * They are the readouts the running build already had, grouped: nothing new is
 * measured here and nothing measured is dropped. Closing a retirement ticket
 * deletes one entry from this list and one case from {@link DevReadout}.
 */
export const BENCH_CHIPS: readonly BenchChip[] = [
  { id: 'BRIDGE', ticket: 44, retires: 'THE CAPTURE PATH IS TRUSTED' },
  { id: 'STARTUP', ticket: 45, retires: 'THE COPIES SCREEN LANDS' },
  { id: 'AUDIO', ticket: 46, retires: 'THE CHECK SCREEN LANDS' },
  { id: 'PORT', ticket: 47, retires: 'NOTHING NEEDS THE GENERATOR' },
  { id: 'SWEEP', ticket: 43, retires: 'PART 2 ADDRESSING IS CONFIRMED' },
];

/**
 * `8g`, one home for every temporary instrument.
 *
 * The five blocks of bench readout are the largest run of permanent text in the
 * app and they are all on their way out. They do not need a design each; they
 * need one affordance, and the SysEx console's drawer from `5c` is it,
 * generalised: the same 52 px handle, the same lift, the same phosphor edge, and
 * the same rule that it opens **over** the bottom strip instead of replacing the
 * screen behind it — you have to watch an instrument while the thing it measures
 * happens.
 *
 * Three rules it inherits and one it does not:
 *
 * - **Closed by default**, at 52 px, which is all the screen it ever costs when
 *   shut. The opening is out of flow, so nothing behind it moves.
 * - **Nothing inside animates or counts up.** Nothing in a drawer competes with
 *   the signal.
 * - **One chip per instrument, wearing its ticket number**, and pressing a chip
 *   is what opens the drawer on it. Pressing the open one again shuts it.
 * - **It does not inherit the alert register.** That belongs to the SysEx
 *   console alone, because an unconfirmed write is a consequence; a bridge log
 *   with 0 drops has nothing to say. A temporary instrument that nags is a
 *   temporary instrument nobody closes the ticket on, so nothing in here is ever
 *   amber or red — what a readout emphasises, it emphasises in ink.
 *
 * **There is no console chip.** The SysEx console is not built, and an
 * un-ticketed chip that opens nothing is a control that lies. It docks into this
 * same handle on the day it exists, and it is the one chip with no ticket, which
 * is how the one that stays is told from the five that go.
 */
@Component({
  selector: 'app-bench-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DevReadout, SweepReadout],
  templateUrl: './bench-drawer.html',
  styleUrl: './bench-drawer.scss',
})
export class BenchDrawer {
  protected readonly chips = BENCH_CHIPS;

  private readonly opened = signal<BenchInstrument | null>(null);

  /** Which instrument is on screen, or nothing at all: the drawer is shut. */
  protected readonly shown = this.opened.asReadonly();

  protected readonly open = computed(() => this.opened() !== null);

  /** The line that says what would have to be true for this panel to go. */
  protected readonly retirement = computed(() => {
    const chip = this.chips.find((candidate) => candidate.id === this.opened());
    return chip === undefined
      ? ''
      : `TICKET #${chip.ticket} · THIS PANEL GOES AWAY WHEN ${chip.retires}`;
  });

  /** The group the readout draws, or `null` while the sweep is the one shown. */
  protected readonly group = computed(() => {
    const shown = this.opened();
    return shown === null || shown === 'SWEEP' ? null : shown;
  });

  protected pick(id: BenchInstrument): void {
    this.opened.update((shown) => (shown === id ? null : id));
  }

  protected close(): void {
    this.opened.set(null);
  }
}

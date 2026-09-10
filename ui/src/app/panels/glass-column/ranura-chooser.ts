import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Composition, LIVE_VIEWS, Ranura, RanuraIndex } from '../../shell/composition';

/**
 * The panel's own title, which is the control for what the panel is.
 *
 * `SPECTRUM ▾` — the head of the ranura is the chooser, because the control for
 * a panel belongs where the panel is. There is no bar of tabs anywhere and no
 * settings screen: two ranuras and their two titles are the whole surface.
 *
 * Three rules, and the second is the one that keeps this honest:
 *
 * - **Five entries, always the same five.** The four Vistas vivas and
 *   {@link EMPTY_LABEL}, in both ranuras, in {@link LIVE_VIEWS}' order. The list
 *   does not depend on which ranura opened it and it does not depend on what the
 *   other one holds.
 * - **Nothing is ever greyed.** Choosing a panel the other ranura holds swaps
 *   the two ({@link Composition.choose}), so there is no entry that this chooser
 *   would have to refuse — and therefore no entry it has to explain. A disabled
 *   item is a question the user has to answer without being told the rule.
 * - **The current panel is not marked.** The button says it: it is the title.
 *
 * The list closes on a choice, on `Escape` and on a press anywhere else. It is
 * not a `<select>`: this is the console's own type at `--text-label`, and a
 * native menu would arrive in the platform's.
 */
@Component({
  selector: 'app-ranura-chooser',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onPressAnywhere($event)',
    '(keydown.escape)': 'close()',
  },
  template: `
    <button
      type="button"
      class="chooser"
      aria-haspopup="menu"
      [class.chooser--open]="open()"
      [attr.aria-expanded]="open()"
      (click)="toggle()"
    >
      <span class="chooser__name">{{ label() }}</span>
      <span class="chooser__caret" aria-hidden="true">▾</span>
    </button>
    @if (open()) {
      <ul class="menu" role="menu">
        @for (entry of entries; track entry) {
          <li role="none">
            <button type="button" class="menu__item" role="menuitem" (click)="pick(entry)">
              {{ entry ?? emptyLabel }}
            </button>
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './ranura-chooser.scss',
})
export class RanuraChooser {
  /** Which half of the column this title speaks for. */
  readonly ranura = input.required<RanuraIndex>();

  /** What that half holds right now, `null` for empty glass. */
  readonly holds = input.required<Ranura>();

  private readonly composition = inject(Composition);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly entries = ENTRIES;
  protected readonly emptyLabel = EMPTY_LABEL;

  private readonly showing = signal(false);
  protected readonly open = this.showing.asReadonly();

  protected readonly label = computed(() => this.holds() ?? EMPTY_LABEL);

  protected toggle(): void {
    this.showing.update((open) => !open);
  }

  protected close(): void {
    this.showing.set(false);
  }

  protected pick(entry: Ranura): void {
    this.composition.choose(this.ranura(), entry);
    this.close();
  }

  /**
   * A press anywhere that is not this chooser closes it.
   *
   * The button's own press arrives here too — the listener is on `document` and
   * the event bubbles — so the test is on where it landed and not on whether the
   * list is open, or opening it would immediately close it again.
   */
  protected onPressAnywhere(event: Event): void {
    const target = event.target;
    if (target instanceof Node && !this.element.nativeElement.contains(target)) {
      this.close();
    }
  }
}

/** The word for a ranura holding nothing, on the title and in the list. */
export const EMPTY_LABEL = 'EMPTY';

/** The five, in order. The same five in both ranuras, always. */
export const ENTRIES: readonly Ranura[] = [...LIVE_VIEWS, null];

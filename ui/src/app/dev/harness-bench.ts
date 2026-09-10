import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { App } from '../app';
import { HarnessPatch } from './harness-patch';

/** The three the round's own looks are taken on (#81, #85, #88). */
const LOOK_ALGORITHMS: readonly number[] = [1, 37, 66];

/**
 * The bench: the app, and a hand on the patch it is drawing.
 *
 * It renders `<app-root>` untouched and puts its controls in a **fixed** strip
 * over the bottom-right corner, so nothing about the app's layout is different
 * from the app's layout — which is the only reason a figure measured here is
 * worth writing down. The strip hides on a press, because a look taken with a
 * panel over the drawing is a look at the panel.
 *
 * It is deliberately ugly. It is not a screen, it borrows no token, and nothing
 * in it is designed: anything here that looked like the app would eventually be
 * mistaken for it.
 */
@Component({
  selector: 'app-harness',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [App],
  template: `
    <app-root />

    @if (open()) {
      <aside class="bench">
        <div class="row">
          <strong>BANCO</strong>
          <button type="button" (click)="open.set(false)">ocultar</button>
        </div>

        <label class="row">
          algoritmo
          <input
            type="number"
            min="1"
            max="88"
            [value]="patch.algorithm()"
            (input)="setAlgorithm($event)"
          />
        </label>
        <div class="row">
          @for (number of lookAlgorithms; track number) {
            <button type="button" (click)="patch.algorithm.set(number); patch.pass()">
              {{ number }}
            </button>
          }
        </div>

        <div class="levels">
          @for (level of patch.levels(); track $index) {
            <label>
              OP{{ $index + 1 }}
              <input
                type="number"
                min="0"
                max="99"
                [value]="level"
                (input)="setLevel($index + 1, $event)"
              />
            </label>
          }
        </div>
        <div class="row">
          niveles
          <button type="button" (click)="patch.setEveryLevel(99)">99</button>
          <button type="button" (click)="patch.setEveryLevel(85)">85</button>
          <button type="button" (click)="patch.setEveryLevel(0)">0</button>
        </div>

        <label class="row">
          ancla
          <input type="text" [value]="patch.performanceName()" (input)="setName($event)" />
        </label>

        <label class="row">
          nota
          <input
            type="number"
            min="0"
            max="127"
            [value]="patch.pitch() ?? ''"
            (input)="setPitch($event)"
          />
          <button type="button" (click)="patch.pitch.set(null); patch.pass()">soltar</button>
        </label>

        <label class="row">
          <input type="checkbox" [checked]="patch.folding()" (change)="toggleFolding()" />
          pliegue ({{ foldingLabel() }})
        </label>
      </aside>
    } @else {
      <button class="peek" type="button" (click)="open.set(true)">banco</button>
    }
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }

    .bench,
    .peek {
      position: fixed;
      right: 8px;
      bottom: 8px;
      z-index: 9000;
      font: 11px/1.6 monospace;
      color: #fff;
      background: #000;
      border: 1px solid #666;
      padding: 6px;
    }

    .bench {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-width: 260px;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .levels {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2px;
    }

    label {
      display: flex;
      align-items: center;
      gap: 2px;
    }

    input {
      width: 100%;
      min-width: 0;
      font: inherit;
      color: inherit;
      background: #222;
      border: 1px solid #666;
    }

    input[type='checkbox'] {
      width: auto;
    }

    button {
      font: inherit;
      color: inherit;
      background: #222;
      border: 1px solid #666;
      cursor: pointer;
    }
  `,
})
export class HarnessBench {
  protected readonly patch = inject(HarnessPatch);
  protected readonly lookAlgorithms = LOOK_ALGORITHMS;

  /** Whether the strip is up. It opens up, because a bench nobody can find is no bench. */
  protected readonly open = signal(true);

  protected readonly foldingLabel = computed(() => (this.patch.folding() ? 'on' : 'off'));

  protected setAlgorithm(event: Event): void {
    this.patch.algorithm.set(number(event));
    this.patch.pass();
  }

  protected setLevel(operator: number, event: Event): void {
    this.patch.setLevel(operator, number(event));
  }

  protected setName(event: Event): void {
    this.patch.performanceName.set((event.target as HTMLInputElement).value);
    this.patch.pass();
  }

  protected setPitch(event: Event): void {
    const held = (event.target as HTMLInputElement).value;
    this.patch.pitch.set(held === '' ? null : Number(held));
    this.patch.pass();
  }

  protected toggleFolding(): void {
    this.patch.folding.update((folding) => !folding);
  }
}

function number(event: Event): number {
  return Number((event.target as HTMLInputElement).value);
}

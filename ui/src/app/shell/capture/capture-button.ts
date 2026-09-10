import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { MEASURE_WINDOW } from 'modx-dsp';
import { AudioService } from '../../audio/audio-service';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { Shutter } from './shutter';

/** Where the shutter is standing. The control is the same in both. */
export type CapturePlace = 'header' | 'foot';

/**
 * The `CAPTURE` shutter, in one component and two places.
 *
 * It is in the header because that is where the transport lives, and it repeats
 * at the foot of the measured column because that is where the eye already is
 * when it reads that a capture is what fills the column. **The same control, not
 * a copy**: both instances arm off {@link AudioService.canMeasure}, disable
 * together, go busy together and take the same window, so there is no state in
 * which one of them is a lie about the other.
 *
 * The two places differ only in shape. The header's carries the window and the
 * held-note hint, because it is read cold; the foot's is a pill under cells that
 * have just said the same thing in their own units.
 *
 * **The hint and the button read different facts, on purpose.** The button arms
 * off {@link AudioService.canMeasure} — audio arriving, no capture in flight, the
 * anillo not paused — and knows nothing about the keyboard. The hint is written
 * from the Nota viva. An armed shutter with nothing held is a real and correct
 * state: it is the one that produces the answer `the shutter opened on silence`.
 */
@Component({
  selector: 'app-capture-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Shutter],
  template: `<button
    type="button"
    class="measure"
    [class.measure--foot]="place() === 'foot'"
    [class.measure--on]="canMeasure()"
    [class.measure--busy]="measuring()"
    [disabled]="!canMeasure()"
    aria-label="Capture: one window of 65536 samples"
    (click)="onMeasure()"
  >
    <app-shutter class="measure__shutter" />
    <span class="measure__label">CAPTURE</span>
    @if (place() === 'header') {
      <span class="measure__hint">{{ window }}<br />{{ held() }}</span>
    }
  </button>`,
  styles: `
    :host {
      display: contents;
    }

    .measure {
      all: unset;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      gap: 12px;
      min-height: var(--hit-min);
      padding: 13px 22px 13px 16px;
      border-radius: var(--radius-pill) 8px 8px var(--radius-pill);
      border: var(--rule-min) solid var(--dead-border);
      color: var(--dead-ink);
    }

    /* Al pie de la columna es una pastilla centrada: no hay transporte alrededor
       del que distinguirse, y lo que hay encima ya ha dicho la ventana. */
    .measure--foot {
      justify-content: center;
      gap: 9px;
      padding: 11px;
      border-radius: var(--radius-pill);
    }

    /* Con audio entrando el obturador está armado: borde de portadora, fondo
       cálido y el punto dentro del círculo. Es el mismo botón, no otro. */
    .measure--on {
      cursor: pointer;
      border-color: var(--carrier);
      background: linear-gradient(180deg, rgba(243, 177, 63, 0.22), rgba(243, 177, 63, 0.06));
      box-shadow: 0 0 28px -8px rgba(243, 177, 63, 0.7);
      color: var(--carrier);
    }

    /* Mientras dura la exposición. No es un estado de espera con reloj: son unas
       decenas de milisegundos y lo único que hace falta es que no se pulse dos
       veces. */
    .measure--busy {
      border-color: var(--carrier);
      background: rgba(243, 177, 63, 0.08);
      color: var(--carrier);
    }

    .measure--on .measure__label,
    .measure--busy .measure__label {
      color: var(--carrier);
    }

    .measure__label {
      font-family: var(--font-num);
      font-size: 14px;
      letter-spacing: 0.2em;
      color: var(--ink-inert);
    }

    .measure--foot .measure__label {
      font-size: 11px;
      letter-spacing: 0.14em;
    }

    .measure--foot .measure__shutter {
      width: 20px;
      height: 20px;
    }

    /* Dos líneas siempre, en los dos estados: la pista cambia de texto con la
       Nota viva y el bloque no puede cambiar de alto con ella, o el transporte
       daría un salto cada vez que se levanta el dedo. El nowrap es lo que lo
       decide: el salto de línea pone el segundo renglón y nada añade un
       tercero. */
    .measure__hint {
      padding-left: 11px;
      border-left: var(--rule-min) solid var(--rule-color);
      font-family: var(--font-num);
      font-size: 9px;
      letter-spacing: 0.1em;
      line-height: 1.25;
      white-space: nowrap;
      color: var(--ink-inert);
    }
  `,
})
export class CaptureButton {
  private readonly audio = inject(AudioService);
  private readonly backend = inject(BACKEND_GATEWAY);

  readonly place = input<CapturePlace>('header');

  /** `65536`, said next to the shutter: the window is part of the how. */
  protected readonly window = MEASURE_WINDOW;

  /**
   * The hint under the window, and it answers in **both** directions.
   *
   * `NEEDS A HELD NOTE` is a condition to satisfy and it is the right sentence
   * exactly while it is unsatisfied. With a note down it has been satisfied, and
   * leaving it up is the header telling the pianist to do the thing the pianist
   * is already doing while the scope beside it reads `LOCKED 261.63 Hz`. So the
   * satisfied state says what the app can see instead: how many pitches are
   * down, counted the way the Nota viva counts them — by distinct pitch, because
   * in Multi one key arrives once per Part.
   */
  protected readonly held = computed(() => {
    const notes = this.backend.liveNotes();
    return notes === 0 ? 'NEEDS A HELD NOTE' : `${notes} HELD`;
  });

  protected readonly measuring = this.audio.measuring;
  protected readonly canMeasure = this.audio.canMeasure;

  /** One press, one medida. A second press while one is running does nothing. */
  protected onMeasure(): void {
    void this.audio.measure();
  }
}

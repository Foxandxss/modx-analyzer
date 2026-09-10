import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AudioService } from './audio/audio-service';
import { BottomStrip } from './panels/bottom-strip/bottom-strip';
import { FiguresColumn } from './panels/figures-column/figures-column';
import { GlassColumn } from './panels/glass-column/glass-column';
import { OperatorDiagram } from './panels/operator-diagram/operator-diagram';
import { AlertStrip } from './shell/alert-strip/alert-strip';
import { BenchDrawer } from './shell/bench-drawer/bench-drawer';
import { Composition } from './shell/composition';
import { Header } from './shell/header/header';
import { PanicNotice } from './shell/panic/panic-notice';
import { RereadStrip } from './shell/reread-strip/reread-strip';
import { UnhappyCards } from './shell/unhappy-cards/unhappy-cards';

/**
 * `4a`, the screen you look at while you play.
 *
 * There is no startup screen and no generic progress bar: the whole shape is
 * here from the first frame with every slot in its invalidated look, and the
 * relectura strip says how far the keyboard has got.
 */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Header,
    PanicNotice,
    AlertStrip,
    RereadStrip,
    UnhappyCards,
    OperatorDiagram,
    GlassColumn,
    FiguresColumn,
    BottomStrip,
    BenchDrawer,
  ],
  template: `
    <app-header />
    <!-- Todo lo que avisa se dibuja DEBAJO de la cabecera: el pánico nunca se tapa. -->
    <app-panic-notice />
    <app-alert-strip />
    <app-unhappy-cards />
    <app-reread-strip />
    <!-- Dos composiciones de los mismos elementos, y lo que elige entre ellas es
         el estado de las dos Ranuras: nada de esta pantalla se mueve ya que no
         haya movido el pianista. La columna no se encoge: se va, porque un panel
         de 0 px sigue pintando 33 veces por segundo algo que nadie mira. -->
    <div class="body" [class.body--wide]="wide()">
      <app-operator-diagram />
      @if (panels()) {
        <app-glass-column />
      }
      <app-figures-column />
    </div>
    <!-- La tira de abajo existe cuando tiene algo dentro. Con el waterfall en una
         ranura no queda ni la caja: sus 156 px vuelven al cuerpo, que es lo que
         hace que no haya nada dibujado a un tamaño al que no se puede leer. -->
    @if (strip()) {
      <app-bottom-strip />
    }
    <!-- Los cinco instrumentos con los que se mide la sesión, no parte del
         diseño: 52 px de asa, cerrada, y cada chip con el número del ticket que
         la retira. Se abre POR ENCIMA de la tira de abajo, así que lo que hay
         detrás no se recoloca. -->
    <app-bench-drawer />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      /* Red de seguridad y nada más: en reposo no hay barra aquí porque el
         cuerpo se encoge hasta lo que quede. Sólo aparece si las tiras fijas
         llegasen a no caber, y entonces vale más una barra que recortar en
         silencio lo que se pulsa, que es como se perdieron el pánico y
         EXPORT. */
      overflow-y: auto;
    }

    /* Nada de la columna cede su altura salvo el cuerpo.
     *
     * Antes el cuerpo era el único flex: 1, así que cada tira que aparecía por
     * encima —la de relectura, una tarjeta infeliz— salía del diagrama y de las
     * vistas, que se quedaban en lascas mientras la tarjeta que explicaba el
     * problema se leía perfecta encima (#19). Una tarjeta sola cuesta lo mismo
     * que dos: las tarjetas van en dos columnas siempre.
     *
     * La tira de abajo, cuando la hay, no cede altura: lo que cede es el
     * cuerpo, y lo que no cabe dentro del cuerpo se baja con el dedo ahí
     * dentro. La app entera no scrollea. */
    :host > :not(.body) {
      flex-shrink: 0;
    }

    /* Las dos anchuras de la composición estrecha, una sola vez cada una. El
       diagrama no tiene la suya: es el que se lleva la holgura, así que su
       ancho es lo que sobra y a 1280 sale exactamente en los 700 px del
       diseño. Así el intercambio no puede desmentir al reposo. */
    :host {
      --composition-diagram: 700px;
      --composition-column: 208px;
    }

    /* El "filete" del cuerpo es un hueco de 2 px sobre el color de la rejilla,
       no un borde de 1 px: a DPR 1.5 un filete de 1 px se ve sucio. */
    .body {
      flex: 1 1 auto;
      min-height: 0;
      display: grid;
      /* Tres carriles siempre, y el de en medio es el que se cierra: dos listas
         de pistas con la misma forma son las que el navegador sabe interpolar,
         que es lo que hace que el cambio dure --dur-settle y no un fotograma. */
      grid-template-columns:
        minmax(0, 1fr)
        calc(100% - var(--composition-diagram) - var(--composition-column) - 2 * var(--rule-min))
        var(--composition-column);
      transition: grid-template-columns var(--dur-settle) var(--ease-instrument);
      /* El suelo va en la FILA, no en el cuerpo: el cuerpo se encoge con la
         ventana —así que en reposo no sobra nada y no hay barra— pero su fila
         nunca baja de 360 px, que es donde los ocho nodos dejan de tener
         números dentro y las vistas se quedan sin curva (#19). Cuando una
         tarjeta se lleva el alto, lo que scrollea es esta caja y sólo ella. */
      grid-template-rows: minmax(360px, 1fr);
      overflow-y: auto;
      gap: var(--rule-min);
      background: var(--rule-color);
    }

    /* Cada panel en su carril por nombre y no por orden de llegada: sin esto, el
       día que la columna de cristal no está, la columna de cifras se metería en el
       carril que acaba de cerrarse. */
    app-operator-diagram {
      grid-column: 1;
    }
    app-glass-column {
      grid-column: 2;
    }
    app-figures-column {
      grid-column: 3;
    }

    /* Las dos ranuras vacías, o el pin echado: el carril de en medio se cierra y
       el diagrama se lleva su holgura entera —los 368 px de la columna de
       cristal, 1 070 px a 1280 de ventana—. La columna de cifras se queda: es la
       que dice qué llenaría la medida que no hay (#33).
       El filete se parte por la mitad porque aquí hay dos huecos pegados con un
       carril de 0 px entre ellos, y dos filetes juntos se leen como una regla
       del doble de gruesa. */
    .body--wide {
      grid-template-columns: minmax(0, 1fr) 0px var(--composition-column);
      column-gap: calc(var(--rule-min) / 2);
    }
  `,
})
export class App {
  private readonly composition = inject(Composition);

  /** The algorithm has the room, and the glass column is not on screen. */
  protected readonly wide = this.composition.wide;
  protected readonly panels = this.composition.panels;

  /** The waterfall is down here, or it is up in a ranura and there is no strip. */
  protected readonly strip = this.composition.strip;

  constructor() {
    // The audio bridge is opened from the screen that draws it, once. Nothing
    // spins up a worker in a test that did not ask for one.
    inject(AudioService).start();
  }
}

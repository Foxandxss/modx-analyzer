import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AudioService } from './audio/audio-service';
import { BottomStrip } from './panels/bottom-strip/bottom-strip';
import { FiguresColumn } from './panels/figures-column/figures-column';
import { bodyGap } from './panels/glass-column/column-geometry';
import { ColumnRail } from './panels/glass-column/column-rail';
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
    ColumnRail,
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
         haya movido el pianista. La columna no se encoge: o está entera, o se
         queda en el asa, o no está —un panel de 0 px sigue pintando 33 veces por
         segundo algo que nadie mira. -->
    <!-- El filete del cuerpo se ata desde el modelo y no desde la hoja: es el
         único hueco de la app cuyo ancho depende de la forma que tenga el
         cuerpo, y declararlo en los dos sitios es lo que hizo que el modelo
         devolviera 1 068 mientras la pantalla dibujaba 1 070 (#76). -->
    <div
      class="body"
      [class.body--wide]="wide()"
      [class.body--rail]="rail()"
      [style.column-gap.px]="gap()"
    >
      <app-operator-diagram />
      @if (panels()) {
        <app-glass-column />
      } @else if (rail()) {
        <!-- Vaciar las dos deja un asa: 52 px con el vocabulario del cajón
             cerrado, y una pulsación devuelve el panel que esa mitad tenía. Con
             el pin echado no hay asa aquí porque el pin ES el asa. -->
        <app-column-rail />
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
      /* El asa del cajón, de canto. Es RAIL_W en column-geometry.ts, que es
         donde está modelada la caja de este carril. */
      --composition-rail: var(--drawer-grab);
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
         nunca baja de 378 px. Ese número NO es el de #19: #19 midió 360, que es
         donde los ocho nodos dejan de tener números dentro y las vistas se
         quedan sin curva, y lo midió con la leyenda a una fila. La leyenda son
         dos desde #65 y su banda sale del lienzo, así que el diagrama necesita
         esos 18 px de vuelta para seguir cumpliendo lo que 360 prometía. Las
         vistas no los necesitaban: por eso BODY_FLOOR se DERIVA de las dos
         medidas por separado en column-geometry.ts, y por eso este 378 se
         cambia allí en el mismo commit. Cuando una tarjeta se lleva el alto, lo
         que scrollea es esta caja y sólo ella. */
      grid-template-rows: minmax(378px, 1fr);
      overflow-y: auto;
      /* column-gap NO está aquí: lo ata bodyGap() en column-geometry.ts, que es
         el único sitio donde se decide cuánto mide este filete. Hay una sola
         fila, así que el cuerpo no tiene hueco entre filas que declarar. */
      background: var(--rule-color);
    }

    /* Cada panel en su carril por nombre y no por orden de llegada: sin esto, el
       día que la columna de cristal no está, la columna de cifras se metería en el
       carril que acaba de cerrarse. */
    app-operator-diagram {
      grid-column: 1;
    }
    app-glass-column,
    app-column-rail {
      grid-column: 2;
    }
    app-figures-column {
      grid-column: 3;
    }

    /* El pin echado: el carril de en medio se cierra del todo y el diagrama se
       lleva su holgura entera —los 368 px de la columna de cristal, 1 070 px a
       1280 de ventana—. La columna de cifras se queda: es la que dice qué
       llenaría la medida que no hay (#33).
       El filete se parte por la mitad —dos huecos pegados con un carril de 0 px
       entre ellos se leen como una regla del doble de gruesa—, pero quien lo
       dice es bodyGap() y no esta regla: la condición es la ADYACENCIA y no el
       nombre de la clase, así que una cuarta forma que cierre el carril de en
       medio la hereda en vez de tener que añadirse a una lista. */
    .body--wide {
      grid-template-columns: minmax(0, 1fr) 0px var(--composition-column);
    }

    /* Con las dos ranuras vacías el carril no se cierra del todo: se queda en el
       asa. Va DESPUÉS de .body--wide a propósito —las dos reglas tienen la
       misma especificidad, así que el orden es todo el mecanismo (#57)— y el
       cuerpo lleva las dos clases, porque el algoritmo se lleva la holgura
       igual. El filete vuelve a ser entero —aquí no hay dos huecos pegados—, y
       de eso ya se encarga bodyGap(): el carril mide 52 px y no cero. */
    .body--rail {
      grid-template-columns: minmax(0, 1fr) var(--composition-rail) var(--composition-column);
    }
  `,
})
export class App {
  private readonly composition = inject(Composition);

  /** The algorithm has the room, and the two ranuras are not on screen. */
  protected readonly wide = this.composition.wide;
  protected readonly panels = this.composition.panels;

  /** Both ranuras empty and the pin up: what is left of the column is the handles. */
  protected readonly rail = this.composition.rail;

  /** The waterfall is down here, or it is up in a ranura and there is no strip. */
  protected readonly strip = this.composition.strip;

  /**
   * The filete between two of the body's lanes, from the module that models the
   * lanes.
   *
   * It is bound and not declared in the sheet because the sheet cannot ask the
   * question it depends on — whether the lane between the two gaps has closed —
   * without naming a shape, and a name goes stale silently the day a fourth
   * shape has the same adjacency. Half a filete declared here as well as there
   * is how the model came to return 1 068 px while the screen drew 1 070 (#76).
   */
  protected readonly gap = computed(() => bodyGap(this.composition.shape()));

  constructor() {
    // The audio bridge is opened from the screen that draws it, once. Nothing
    // spins up a worker in a test that did not ask for one.
    inject(AudioService).start();
  }
}

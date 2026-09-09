import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AudioService } from './audio/audio-service';
import { FiguresColumn } from './panels/figures-column/figures-column';
import { OperatorDiagram } from './panels/operator-diagram/operator-diagram';
import { SignalViews } from './panels/signal-views/signal-views';
import { TabPanel } from './panels/tab-panel/tab-panel';
import { AlertStrip } from './shell/alert-strip/alert-strip';
import { DevReadout } from './shell/dev-readout/dev-readout';
import { Header } from './shell/header/header';
import { PanicNotice } from './shell/panic/panic-notice';
import { RereadStrip } from './shell/reread-strip/reread-strip';
import { SweepReadout } from './shell/sweep-readout/sweep-readout';
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
    SignalViews,
    FiguresColumn,
    TabPanel,
    DevReadout,
    SweepReadout,
  ],
  template: `
    <app-header />
    <!-- Todo lo que avisa se dibuja DEBAJO de la cabecera: el pánico nunca se tapa. -->
    <app-panic-notice />
    <app-alert-strip />
    <app-unhappy-cards />
    <app-reread-strip />
    <div class="body">
      <app-operator-diagram />
      <app-signal-views />
      <app-figures-column />
    </div>
    <app-tab-panel />
    <!-- El instrumento con el que se mide la sesión, no parte del diseño: se va
         cuando las cifras estén en docs/results. -->
    <app-dev-readout />
    <!-- El barrido de #16: mismo sitio y mismo trato que la lectura de arriba,
         debajo del todo porque es lo que menos se mira. -->
    <app-sweep-readout />
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
     * El waterfall y las lecturas de abajo no se mueven nunca: lo que cede es
     * el cuerpo, y lo que no cabe dentro del cuerpo se baja con el dedo ahí
     * dentro. La app entera no scrollea. */
    :host > :not(.body) {
      flex-shrink: 0;
    }

    /* El "filete" del cuerpo es un hueco de 2 px sobre el color de la rejilla,
       no un borde de 1 px: a DPR 1.5 un filete de 1 px se ve sucio. */
    .body {
      flex: 1 1 auto;
      min-height: 0;
      display: grid;
      grid-template-columns: 700px 1fr 208px;
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
  `,
})
export class App {
  constructor() {
    // The audio bridge is opened from the screen that draws it, once. Nothing
    // spins up a worker in a test that did not ask for one.
    inject(AudioService).start();
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AudioService } from './audio/audio-service';
import { FiguresColumn } from './panels/figures-column/figures-column';
import { OperatorDiagram } from './panels/operator-diagram/operator-diagram';
import { SignalViews } from './panels/signal-views/signal-views';
import { TabPanel } from './panels/tab-panel/tab-panel';
import { DevReadout } from './shell/dev-readout/dev-readout';
import { Header } from './shell/header/header';
import { PanicNotice } from './shell/panic/panic-notice';
import { RereadStrip } from './shell/reread-strip/reread-strip';

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
    RereadStrip,
    OperatorDiagram,
    SignalViews,
    FiguresColumn,
    TabPanel,
    DevReadout,
  ],
  template: `
    <app-header />
    <!-- Todo lo que avisa se dibuja DEBAJO de la cabecera: el pánico nunca se tapa. -->
    <app-panic-notice />
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
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    /* El "filete" del cuerpo es un hueco de 2 px sobre el color de la rejilla,
       no un borde de 1 px: a DPR 1.5 un filete de 1 px se ve sucio. */
    .body {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: 700px 1fr 208px;
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

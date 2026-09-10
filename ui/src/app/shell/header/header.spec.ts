import { TestBed } from '@angular/core/testing';
import { BLOCK_FRAMES } from 'modx-dsp';
import { AUDIO_WORKER, AudioService } from '../../audio/audio-service';
import { fakeBlock, heldNote } from '../../audio/fake-block';
import { FakeAudioWorker } from '../../audio/fake-audio-worker';
import { anchorAnswers, anchorWatching } from '../../backend/anchor-driver';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { FakeBackendGateway } from '../../backend/fake-backend-gateway';
import { DEAD_MARK } from '../../provenance/provenance';
import { ANCHOR_FLASH_MS } from '../../provenance/anchor';
import { Clock } from '../../provenance/clock';
import { PANIC_ACK_MS, PanicService } from '../panic/panic-service';
import { Header } from './header';

async function renderHeader() {
  const backend = new FakeBackendGateway();
  TestBed.configureTestingModule({
    imports: [Header],
    providers: [{ provide: BACKEND_GATEWAY, useValue: backend }],
  });
  const fixture = TestBed.createComponent(Header);
  await fixture.whenStable();
  return {
    backend,
    fixture,
    host: fixture.nativeElement as HTMLElement,
    panic: TestBed.inject(PanicService),
  };
}

/**
 * The pánico is 56×56 wherever it is drawn, and jsdom lays nothing out, so the
 * rect it would measure has to be given to it. A point outside this box is a
 * finger that was dragged off the octagon before it came up.
 */
function stubPanicBox(host: HTMLElement): HTMLButtonElement {
  const button = host.querySelector<HTMLButtonElement>('.panic')!;
  button.getBoundingClientRect = () => ({ left: 100, right: 156, top: 0, bottom: 56 }) as DOMRect;
  return button;
}

function pointer(type: string, clientX: number, clientY: number): Event {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerId: 1, clientX, clientY, detail: 1 });
  return event;
}

describe('Header', () => {
  it('opens with every polled slot showing the dash instead of a number', async () => {
    const { host } = await renderHeader();

    expect(host.querySelector('.anchor__name')?.textContent?.trim()).toBe(DEAD_MARK);
    expect(host.querySelector('.pill--algorithm')?.textContent).toContain(DEAD_MARK);
    expect(host.querySelector('.feedback')?.textContent).toContain(DEAD_MARK);
    expect(host.querySelector('.look__audio')?.textContent?.trim()).toBe(DEAD_MARK);
  });

  /**
   * The bar's order is a design decision and not an accident of the template, so
   * it is asserted as a list rather than one neighbour at a time. `HUSH` last,
   * behind the rule, is the part of it that has already cost this app a bug.
   */
  it('draws the bar in its canonical order, left to right', async () => {
    const { host } = await renderHeader();

    const slots = [...host.querySelector('.bar')!.children].map(
      (child) => child.className.split(' ')[0] || child.tagName.toLowerCase(),
    );

    expect(slots).toEqual([
      'port',
      // El filete que separa el puerto del ancla: mobiliario, no una ranura.
      'gap',
      'anchor',
      'pill',
      'feedback',
      'mode',
      'spacer',
      'look',
      'app-capture-button',
      'isolate',
      'panic',
    ]);
  });

  /**
   * The bar carries the facts of the patch and the transport, and nothing that
   * only a debugger reads. The anchor's poll rate and its SysEx address were the
   * last of that, and they belong to the check screen (#52), which does not
   * exist — so they are simply not drawn anywhere.
   */
  it('carries no poll rate and no SysEx address', async () => {
    const { host, fixture, backend } = await renderHeader();
    backend.anchorReads('Init Normal (FM-X)');
    await fixture.whenStable();

    expect(host.querySelector('.anchor__eyebrow')).toBeNull();
    expect(host.textContent).not.toContain('ANCLA');
    expect(host.textContent).not.toContain('31 00 00');
    expect(host.textContent).not.toContain('1 Hz');
  });

  it('shows the connection dot unlit until the port is open', async () => {
    const { backend, fixture, host } = await renderHeader();

    expect(host.querySelector('.dot')?.classList.contains('dot--on')).toBe(false);

    backend.portFound();
    await fixture.whenStable();

    expect(host.querySelector('.dot')?.classList.contains('dot--on')).toBe(true);
  });

  /**
   * The three stream facts, all three off the device the app opened. Nothing
   * here is a constant: the test proves it by making the gateway report another
   * rate and another channel count and reading the pill again.
   */
  it('says what stream is being watched, and says what the stream reported', async () => {
    const { backend, fixture, host } = await renderHeader();
    const line = () => host.querySelector('.look__audio')?.textContent?.trim();

    backend.audioOpen();
    await fixture.whenStable();
    expect(line()).toBe('Line (MODX) · 44100 Hz · 2 ch');

    backend.audioOpen('Line (MODX)', 48_000, 4);
    await fixture.whenStable();
    expect(line()).toBe('Line (MODX) · 48000 Hz · 4 ch');
  });

  it('goes back to the dash when the device closes, and never to a placeholder', async () => {
    const { backend, fixture, host } = await renderHeader();
    backend.audioOpen();
    await fixture.whenStable();

    backend.audioClosed();
    await fixture.whenStable();

    const line = host.querySelector('.look__audio')!;
    expect(line.textContent?.trim()).toBe(DEAD_MARK);
    // No half a fact either: a rate with no device to have reported it would be
    // the same lie the `LIVE` stamp over a dead stream is (#22).
    expect(line.textContent).not.toContain('Hz');
    expect(line.textContent).not.toContain('ch');
  });

  it('draws the algorithm and the feedback the anillo ancho read, zero-padded', async () => {
    const { backend, fixture, host } = await renderHeader();

    backend.patch.update((patch) => ({
      ...patch,
      algorithm: { value: 6, provenance: 'polled', readAt: 0 },
      feedback: { value: 3, provenance: 'polled', readAt: 0 },
      feedbackOperator: { value: 5, provenance: 'polled', readAt: 0 },
    }));
    await fixture.whenStable();

    expect(host.querySelector('.pill--algorithm')?.textContent).toContain('06');
    expect(host.querySelector('.feedback')?.textContent?.replace(/\s+/g, ' ')).toContain(
      'FB 3 · OP 5',
    );
  });

  it('states the one mode that is built and offers nothing to press', async () => {
    const { host } = await renderHeader();

    expect(host.querySelector('.mode__name')?.textContent?.trim()).toBe('BUILD');
    expect(host.querySelector('.mode__line')?.textContent?.trim()).toBe('the only mode built');

    // No control at all, so no inhabilitado to explain: A/B and LEARN are not
    // drawn anywhere in the bar until they have code behind them.
    expect(host.querySelector('.mode button, .mode [role="button"]')).toBeNull();
    expect(host.textContent).not.toContain('A/B');
    expect(host.textContent).not.toContain('LEARN');
  });

  it('leaves the pánico last, isolated, and nothing actionable in the isolation gap', async () => {
    const { host } = await renderHeader();

    const bar = host.querySelector('.bar');
    expect(bar?.lastElementChild?.classList.contains('panic')).toBe(true);

    const isolate = host.querySelector('.isolate');
    expect(isolate?.nextElementSibling?.classList.contains('panic')).toBe(true);
    expect(isolate?.querySelector('button, a, input')).toBeNull();
  });

  it('fills the pánico while a note is live', async () => {
    const { backend, fixture, host } = await renderHeader();

    expect(host.querySelector('.panic')?.classList.contains('panic--live')).toBe(false);

    backend.liveNotes.set(3);
    await fixture.whenStable();

    expect(host.querySelector('.panic')?.classList.contains('panic--live')).toBe(true);
  });

  it('acts when the finger comes up inside the octagon, with nothing to confirm', async () => {
    const { backend, fixture, host } = await renderHeader();
    backend.liveNotes.set(3);
    await fixture.whenStable();
    const button = stubPanicBox(host);

    button.dispatchEvent(pointer('pointerdown', 120, 20));
    // Nothing on the way down: a press that is never let go sends nothing.
    expect(backend.panicPresses).toBe(0);

    button.dispatchEvent(pointer('pointerup', 120, 20));
    await fixture.whenStable();

    expect(backend.panicPresses).toBe(1);
    // No dialog, no second step: the header is all there is.
    expect(document.querySelector('dialog')).toBeNull();
  });

  it('does nothing when the finger is dragged off before it comes up', async () => {
    const { backend, fixture, host } = await renderHeader();
    const button = stubPanicBox(host);

    button.dispatchEvent(pointer('pointerdown', 120, 20));
    button.dispatchEvent(pointer('pointerup', 400, 20));
    await fixture.whenStable();

    expect(backend.panicPresses).toBe(0);
  });

  it('reaches the pánico from the keyboard without sending it twice', async () => {
    const { backend, fixture, host } = await renderHeader();
    const button = stubPanicBox(host);

    // Enter on the focused button: a synthesised click, `detail === 0`.
    const synthesised = new Event('click', { bubbles: true });
    Object.assign(synthesised, { detail: 0 });
    button.dispatchEvent(synthesised);
    await fixture.whenStable();

    expect(backend.panicPresses).toBe(1);

    // The click the mouse produces after its own pointerup must not send again.
    button.dispatchEvent(pointer('pointerdown', 120, 20));
    button.dispatchEvent(pointer('pointerup', 120, 20));
    button.dispatchEvent(pointer('click', 120, 20));
    await fixture.whenStable();

    expect(backend.panicPresses).toBe(2);
  });

  it('says HUSHED for the length of the ack and then goes back to HUSH', async () => {
    const { fixture, host, panic } = await renderHeader();

    // Real timers up to here: Angular's own stabilisation runs on them.
    vi.useFakeTimers();
    try {
      await panic.press();
      fixture.detectChanges();
      expect(host.querySelector('.panic')?.textContent?.trim()).toBe('HUSHED');

      vi.advanceTimersByTime(PANIC_ACK_MS);
      fixture.detectChanges();

      expect(host.querySelector('.panic')?.textContent?.trim()).toBe('HUSH');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Header · el transporte', () => {
  it('deja LIVE muerto mientras no llega un bloque', async () => {
    const { host } = await renderHeader();

    // A heartbeat over a bridge that is not delivering would be the one lie this
    // bar cannot tell.
    expect(host.querySelector('.look')?.className).not.toContain('look--on');
    expect(host.querySelector('.look__text')?.textContent?.trim()).toBe(`LIVE · ${DEAD_MARK} fps`);
  });

  it('late y dice su cadencia medida en cuanto entra audio', async () => {
    const backend = new FakeBackendGateway();
    TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        { provide: BACKEND_GATEWAY, useValue: backend },
        { provide: AUDIO_WORKER, useValue: () => new FakeAudioWorker() },
      ],
    });
    const fixture = TestBed.createComponent(Header);
    TestBed.inject(AudioService).start();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;

    for (let sequence = 0; sequence < 10; sequence += 1) {
      backend.emitBlock(
        fakeBlock({
          sequence,
          sentAtMicros: sequence * 30_000,
          mono: heldNote(261.626, sequence * BLOCK_FRAMES),
        }),
      );
    }
    await fixture.whenStable();

    expect(host.querySelector('.look')?.className).toContain('look--on');
    expect(host.querySelector('.look__text')?.textContent?.trim()).toMatch(/^LIVE · [\d.]+ fps$/);
  });
});

/** The header with the bridge behind it, so CAPTURE has something to measure. */
async function renderWithAudio() {
  const backend = new FakeBackendGateway();
  TestBed.configureTestingModule({
    imports: [Header],
    providers: [
      { provide: BACKEND_GATEWAY, useValue: backend },
      { provide: AUDIO_WORKER, useValue: () => new FakeAudioWorker() },
    ],
  });
  const fixture = TestBed.createComponent(Header);
  const audio = TestBed.inject(AudioService);
  audio.start();
  // El ancla lleva unos segundos mirando, que es lo que permite avalar por sus
  // dos extremos la ventana de una captura tomada aquí (#38).
  anchorWatching(backend);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;

  return {
    audio,
    host,
    button: () => host.querySelector<HTMLButtonElement>('.measure')!,
    async hold(frequency: number, blocks: number) {
      backend.lowestLivePitch.set(60);
      await fixture.whenStable();
      for (let sequence = 0; sequence < blocks; sequence += 1) {
        backend.emitBlock(
          fakeBlock({
            sequence,
            sentAtMicros: sequence * 30_000,
            mono: heldNote(frequency, sequence * BLOCK_FRAMES),
          }),
        );
      }
      await fixture.whenStable();
    },
    settle: () => fixture.whenStable(),
    backend,
  };
}

/**
 * The `.measure__hint` rule as the browser got it. jsdom lays nothing out, so
 * «the block is the same height in both states» is asserted as the rule that
 * decides it, the way #39 reads a stylesheet.
 */
function hintRule(): string {
  const css = Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n');
  const start = css.indexOf('.measure__hint');
  return start === -1 ? '' : css.slice(start, css.indexOf('}', start));
}

describe('Header · el obturador', () => {
  it('dibuja CAPTURE desde el primer fotograma, con su ventana y su nota sostenida', async () => {
    const { host } = await renderHeader();

    const measure = host.querySelector('.measure');
    expect(measure?.textContent).toContain('CAPTURE');
    expect(measure?.textContent).toContain('65536');
    expect(measure?.textContent).toContain('NEEDS A HELD NOTE');
  });

  /**
   * La pista responde en las dos direcciones. Mientras no hay nada pulsado la
   * condición está sin cumplir y decirla es exacto; con notas abajo ya está
   * cumplida, y repetirla sería la cabecera pidiendo lo que el pianista ya hace
   * mientras el scope de al lado lee `LOCKED`.
   */
  it('cambia la pista con la Nota viva, y vuelve a pedirla cuando se levanta', async () => {
    const { backend, fixture, host } = await renderHeader();
    const hint = () => host.querySelector('.measure__hint')?.textContent?.trim();

    expect(hint()).toBe('65536NEEDS A HELD NOTE');

    backend.liveNotes.set(3);
    await fixture.whenStable();

    expect(hint()).toBe('655363 HELD');
    expect(host.querySelector('.measure')?.textContent).not.toContain('NEEDS A HELD NOTE');

    // Una sola tecla no es un caso aparte: la cifra es la cuenta, no un plural.
    backend.liveNotes.set(1);
    await fixture.whenStable();
    expect(hint()).toBe('655361 HELD');

    backend.liveNotes.set(0);
    await fixture.whenStable();
    expect(hint()).toBe('65536NEEDS A HELD NOTE');
  });

  /**
   * La ventana se queda al lado en todos los estados y el bloque no cambia de
   * alto con la pista: dos renglones siempre, y `nowrap` es lo que impide el
   * tercero. Un transporte que da un salto al levantar el dedo es la cabecera
   * moviéndose sola.
   */
  it('mantiene la ventana y el mismo alto de bloque con nota y sin ella', async () => {
    const { backend, fixture, host } = await renderHeader();
    const block = () => host.querySelector('.measure__hint')!;
    const lines = () => block().querySelectorAll('br').length + 1;

    expect(block().textContent).toContain('65536');
    expect(lines()).toBe(2);

    backend.liveNotes.set(3);
    await fixture.whenStable();

    expect(block().textContent).toContain('65536');
    expect(lines()).toBe(2);
    expect(hintRule()).toContain('nowrap');
  });

  /**
   * La pista y el botón leen hechos distintos a propósito. Armado sin ninguna
   * tecla pulsada es un estado real y correcto: es el que produce la respuesta
   * «el obturador se abrió sobre un silencio».
   */
  it('no toca el armado del botón en ninguno de esos estados', async () => {
    const { button, hold, settle, backend, host } = await renderWithAudio();

    // Sin audio no se arma, ni con tres teclas abajo.
    backend.liveNotes.set(3);
    await settle();
    expect(button().disabled).toBe(true);
    expect(host.querySelector('.measure__hint')?.textContent).toContain('3 HELD');

    // Con audio se arma, y soltarlo todo no lo desarma.
    await hold(261.626, 10);
    expect(button().disabled).toBe(false);

    backend.liveNotes.set(0);
    await settle();
    expect(button().disabled).toBe(false);
    expect(button().className).toContain('measure--on');
    expect(host.querySelector('.measure__hint')?.textContent).toContain('NEEDS A HELD NOTE');
  });

  it('está apagado mientras el anillo no tiene nada que medir', async () => {
    const { button } = await renderWithAudio();

    // Antes del primer bloque no hay sonido guardado: el obturador no promete
    // una medida que la app no puede tomar.
    expect(button().disabled).toBe(true);
    expect(button().className).not.toContain('measure--on');
  });

  it('se arma en cuanto entra audio', async () => {
    const { button, hold } = await renderWithAudio();

    await hold(261.626, 10);

    expect(button().disabled).toBe(false);
    expect(button().className).toContain('measure--on');
  });

  it('tocarlo toma una medida de 65 536 muestras', async () => {
    const { button, hold, audio, settle, backend } = await renderWithAudio();

    await hold(261.626, 50);
    button().click();
    // El latido fuera de turno que la captura pidió: sin él no hay tabla que
    // dibujar, porque nadie ha dicho todavía de qué sonido es (#38).
    anchorAnswers(backend);
    await settle();

    expect(audio.medida()?.medida.window).toBe(65_536);
    expect(audio.medida()?.medida.partials[0]!.harmonic).toBe(1);
  });

  it('la tecla M es un extra del ratón, no la única vía', async () => {
    const { hold, audio, settle, backend } = await renderWithAudio();

    await hold(261.626, 50);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'm' }));
    anchorAnswers(backend);
    await settle();

    expect(audio.medida()).not.toBeNull();
  });

  it('ignora la tecla con modificador: Ctrl+M es de otro', async () => {
    const { hold, audio, settle } = await renderWithAudio();

    await hold(261.626, 50);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', ctrlKey: true }));
    await settle();

    expect(audio.medida()).toBeNull();
  });
});

describe('Header · el ancla', () => {
  it('dibuja el nombre nuevo con el destello, y el viejo ya no se dibuja', async () => {
    const { host, settle, backend } = await renderWithAudio();
    backend.anchorReads('Init Normal (FM-X)');
    await settle();

    const anchor = () => host.querySelector('.anchor')!;
    expect(anchor().textContent).toContain('Init Normal (FM-X)');
    expect(anchor().classList.contains('anchor--changed')).toBe(false);

    backend.loadPerformance('Bright FM Keys');
    await settle();

    expect(anchor().querySelector('.anchor__name')?.textContent).toContain('Bright FM Keys');
    // El viejo tachado se fue: con los 20 caracteres del MODX se metía debajo
    // del chip `ALG` y de `FB`, y lo que hay que leer en el destello es el
    // nombre nuevo (#19). El destello sigue diciendo que acaba de cambiar.
    expect(anchor().textContent).not.toContain('Init Normal (FM-X)');
    expect(anchor().classList.contains('anchor--changed')).toBe(true);
    // Y en reposo el ancla es el nombre y nada más: la cejilla con la cadencia
    // y la dirección SysEx se fue con #35, sin sitio al que ir (#52).
    expect(anchor().querySelector('.anchor__eyebrow')).toBeNull();
  });

  // El criterio de #19: el nombre más largo que admite el MODX —20 caracteres,
  // medidos con el teclado delante el 2026-09-08— con el chip `ALG` dibujado.
  //
  // El solape no era un desbordamiento cualquiera: era el `flex` del ancla, que
  // crecía con el nombre y lo metía debajo del chip. Ahora la ranura es fija y
  // el nombre se corta dentro con elipsis.
  it('dibuja entero el nombre más largo que admite el MODX', async () => {
    const { host, settle, backend } = await renderWithAudio();
    backend.anchorReads('Init Normal (FM-X)');
    await settle();

    const anchor = () => host.querySelector<HTMLElement>('.anchor')!;

    // 20 «W»: el nombre más ancho que puede llegar a esta ranura.
    backend.loadPerformance('W'.repeat(20));
    await settle();

    expect(anchor().querySelector('.anchor__name')?.textContent).toContain('W'.repeat(20));
    // Y sigue habiendo un solo hijo que pueda crecer: el que se llevaba el
    // ancho por delante era el tachado, y ya no está.
    expect(anchor().querySelector('.anchor__old')).toBeNull();

    // Aquí se acaba lo que esta tira puede decir: jsdom no hace layout, así que
    // getBoundingClientRect() devuelve cero para todo y una comprobación de
    // anchura sería verde sin mirar nada. Que el chip ALG siga legible con este
    // nombre es el tercer criterio de #19 y se verifica a tamaño real, con el
    // teclado delante. Esta prueba cubre el contenido; el píxel, no.
  });

  it('se queda en NOT MEASURED IN THIS SOUND hasta que haya otra medida', async () => {
    const { host, hold, settle, backend } = await renderWithAudio();
    await hold(261.626, 50);
    const anchor = () => host.querySelector('.anchor')!;

    // Al arrancar no lo dice: nunca se ha medido nada y eso no es una noticia.
    expect(anchor().textContent).not.toContain('NOT MEASURED IN THIS SOUND');

    backend.loadPerformance('Bright FM Keys');
    await settle();
    expect(anchor().textContent).toContain('NOT MEASURED IN THIS SOUND');

    // El destello se va solo a los 2 200 ms; la petición de medida no.
    TestBed.inject(Clock).now.set(performance.now() + ANCHOR_FLASH_MS);
    // Y el audio sigue entrando mientras tanto, que es lo que pasa de verdad:
    // adelantar el reloj 2 200 ms sin un bloque detrás sería un dispositivo que
    // lleva dos segundos sin entregar, y entonces MEDIR se niega con razón (#22).
    await hold(261.626, 2);
    await settle();
    expect(anchor().classList.contains('anchor--changed')).toBe(false);
    expect(anchor().textContent).toContain('NOT MEASURED IN THIS SOUND');

    // Y el ancla lleva ya un rato leyendo el nombre nuevo, que es lo que hace
    // avalable una ventana de este sonido: el latido anterior a su primera
    // muestra tiene que haber leído el mismo nombre que el posterior (#38).
    anchorWatching(backend, 'Bright FM Keys');
    await settle();

    // Y se va cuando alguien vuelve a pulsar el obturador y el ancla avala lo
    // que cogió, y sólo entonces.
    host.querySelector<HTMLButtonElement>('.measure')!.click();
    anchorAnswers(backend);
    await settle();
    expect(anchor().textContent).not.toContain('NOT MEASURED IN THIS SOUND');
  });
});

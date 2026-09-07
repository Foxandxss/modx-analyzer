import { TestBed } from '@angular/core/testing';
import { AUDIO_WORKER, AudioService } from '../../audio/audio-service';
import { fakeBlock, heldNote } from '../../audio/fake-block';
import { FakeAudioWorker } from '../../audio/fake-audio-worker';
import { BACKEND_GATEWAY, PortLoss } from '../../backend/backend-gateway';
import { FakeBackendGateway } from '../../backend/fake-backend-gateway';
import { Clock } from '../../provenance/clock';
import { DEAD_MARK } from '../../provenance/provenance';
import { UnhappyCards } from './unhappy-cards';

async function renderCards() {
  const backend = new FakeBackendGateway();
  TestBed.configureTestingModule({
    imports: [UnhappyCards],
    providers: [
      { provide: BACKEND_GATEWAY, useValue: backend },
      { provide: AUDIO_WORKER, useValue: () => new FakeAudioWorker() },
    ],
  });
  const fixture = TestBed.createComponent(UnhappyCards);
  const audio = TestBed.inject(AudioService);
  audio.start();
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;

  return {
    backend,
    clock: TestBed.inject(Clock),
    host,
    settle: () => fixture.whenStable(),
    text: () => host.textContent ?? '',
    cards: () => host.querySelectorAll('.card').length,
    async lose(loss: PortLoss) {
      backend.portLost(loss);
      await fixture.whenStable();
    },
    /** Bloques of exact digital zeros, flagged by the native side as such. */
    async silence(blocks: number) {
      for (let sequence = 0; sequence < blocks; sequence += 1) {
        backend.emitBlock(fakeBlock({ sequence, sentAtMicros: sequence * 30_000, silent: true }));
      }
      await fixture.whenStable();
    },
    async play(blocks: number) {
      for (let sequence = 0; sequence < blocks; sequence += 1) {
        backend.emitBlock(
          fakeBlock({
            sequence,
            sentAtMicros: sequence * 30_000,
            mono: heldNote(261.626, sequence * 1323),
          }),
        );
      }
      await fixture.whenStable();
    },
    retry: async () => {
      host.querySelector<HTMLButtonElement>('.card--alert .card__action')!.click();
      await fixture.whenStable();
      await fixture.whenStable();
    },
  };
}

describe('UnhappyCards · el teclado no conectado', () => {
  /**
   * The app opens disconnected because nothing has looked yet, and the port is
   * opened on a thread before this window has run a line of JavaScript. A card
   * here would say the keyboard is not there before anybody has been to see.
   */
  it('no dibuja nada en el arranque, antes de que nadie haya mirado', async () => {
    const { cards } = await renderCards();

    expect(cards()).toBe(0);
  });

  it('no dibuja nada mientras el puerto está abierto', async () => {
    const { backend, settle, cards } = await renderCards();
    backend.portFound();
    await settle();

    expect(cards()).toBe(0);
  });

  it('dice que el diagrama está congelado y desde cuándo', async () => {
    const { backend, clock, lose, settle, text } = await renderCards();
    // The keyboard answered four seconds ago and then the cable went.
    backend.anchorReads('Init Normal (FM-X)');
    const readAt = backend.patch().performanceName.readAt!;
    await lose('enumeration');
    clock.now.set(readAt + 4000);
    await settle();

    expect(text()).toContain('DIAGRAMA CONGELADO · ÚLTIMO SONDEO 4 s');
  });

  it('cuenta sola: nadie va a mandar un evento con el puerto caído', async () => {
    const { backend, clock, lose, settle, text } = await renderCards();
    backend.anchorReads('Init Normal (FM-X)');
    const readAt = backend.patch().performanceName.readAt!;
    await lose('enumeration');

    clock.now.set(readAt + 11_000);
    await settle();

    expect(text()).toContain('ÚLTIMO SONDEO 11 s');
  });

  it('con un teclado que nunca contestó pone la raya y no un cero', async () => {
    const { lose, text } = await renderCards();

    await lose('enumeration');

    // `0 s` would say it answered just now, which is the opposite of the truth.
    expect(text()).toContain(`ÚLTIMO SONDEO ${DEAD_MARK}`);
  });

  it('dice cuál de los dos caminos fue', async () => {
    const { lose, text } = await renderCards();

    await lose('enumeration');
    expect(text()).toContain('no está o lo tiene otra app');

    await lose('timeouts');
    expect(text()).toContain('no ha contestado al ancla tres veces seguidas');
  });

  it('REINTENTAR vuelve a abrir y el estado se va cuando el falso contesta', async () => {
    const { backend, lose, retry, cards } = await renderCards();
    await lose('enumeration');
    expect(cards()).toBe(1);

    await retry();

    expect(backend.retryPresses).toBe(1);
    expect(cards()).toBe(0);
  });

  it('con el teclado todavía apagado la tarjeta se queda', async () => {
    const { backend, lose, retry, cards, text } = await renderCards();
    backend.retryResult = () => Promise.reject(new Error('el puerto MODX-1 no está'));
    await lose('enumeration');

    await retry();

    expect(backend.retryPresses).toBe(1);
    expect(cards()).toBe(1);
    expect(text()).toContain('REINTENTAR');
  });
});

describe('UnhappyCards · sin audio entrando', () => {
  it('no dibuja nada mientras entra sonido', async () => {
    const { backend, play, cards } = await renderCards();
    backend.portFound();

    await play(6);

    expect(cards()).toBe(0);
  });

  it('aparece cuando el lado nativo dice que son ceros exactos', async () => {
    const { backend, silence, text, cards } = await renderCards();
    backend.portFound();

    await silence(1);

    expect(cards()).toBe(1);
    expect(text()).toContain('SILENCIO REAL ≠ CABLE MAL PUESTO');
    expect(text()).toContain('Sin audio entrando');
  });

  /**
   * The rule the card hangs off is «every sample exactly 0.0 for a second»,
   * decided in `crates/modx-audio/src/silence.rs`. A held note dying away, a
   * patch that ends in silence and the MODX with its volume down all make very
   * small numbers and none of them make zeros — so the card must not appear over
   * real silence, and the flag is the only thing it looks at.
   */
  it('no aparece por un silencio de verdad del MODX', async () => {
    const { backend, play, cards } = await renderCards();
    backend.portFound();
    await play(6);

    // Bloques with no flag: the device is delivering, the sound has just stopped.
    for (let sequence = 6; sequence < 40; sequence += 1) {
      backend.emitBlock(fakeBlock({ sequence, sentAtMicros: sequence * 30_000 }));
    }
    await play(0);

    expect(cards()).toBe(0);
  });

  it('el botón a la pantalla que no existe se dibuja y no se pulsa', async () => {
    const { backend, silence, host } = await renderCards();
    backend.portFound();
    await silence(1);

    const action = host.querySelector<HTMLButtonElement>('.card--carrier .card__action')!;
    expect(action.textContent?.trim()).toBe('VER LA DISCIPLINA DE INIT');
    expect(action.disabled).toBe(true);
  });
});

describe('UnhappyCards · las dos a la vez', () => {
  it('dibuja las dos sin taparse', async () => {
    const { lose, silence, cards } = await renderCards();

    await lose('timeouts');
    await silence(1);

    expect(cards()).toBe(2);
  });
});

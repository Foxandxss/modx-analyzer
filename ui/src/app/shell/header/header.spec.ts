import { TestBed } from '@angular/core/testing';
import { BLOCK_FRAMES } from 'modx-dsp';
import { AUDIO_WORKER, AudioService } from '../../audio/audio-service';
import { fakeBlock, heldNote } from '../../audio/fake-block';
import { FakeAudioWorker } from '../../audio/fake-audio-worker';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { FakeBackendGateway } from '../../backend/fake-backend-gateway';
import { DEAD_MARK } from '../../provenance/provenance';
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
    expect(host.querySelector('.audio')?.textContent?.trim()).toBe(DEAD_MARK);
  });

  it('shows the connection dot unlit until the port is open', async () => {
    const { backend, fixture, host } = await renderHeader();

    expect(host.querySelector('.dot')?.classList.contains('dot--on')).toBe(false);

    backend.connection.set({
      port: 'connected',
      portName: 'MODX-1',
      audioDevice: 'Line (MODX)',
      sampleRate: 44100,
    });
    await fixture.whenStable();

    expect(host.querySelector('.dot')?.classList.contains('dot--on')).toBe(true);
    expect(host.querySelector('.audio')?.textContent).toContain('Line (MODX) · 44100 Hz');
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

  it('offers only CREAR of the three modes', async () => {
    const { host } = await renderHeader();

    const modes = [...host.querySelectorAll<HTMLButtonElement>('.modes__item')];
    expect(modes.map((mode) => mode.textContent?.trim())).toEqual(['CREAR', 'A/B', 'APRENDER']);
    expect(modes.filter((mode) => !mode.disabled).map((mode) => mode.textContent?.trim())).toEqual([
      'CREAR',
    ]);
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

  it('says HECHO for the length of the ack and then goes back to CALLA', async () => {
    const { fixture, host, panic } = await renderHeader();

    // Real timers up to here: Angular's own stabilisation runs on them.
    vi.useFakeTimers();
    try {
      await panic.press();
      fixture.detectChanges();
      expect(host.querySelector('.panic')?.textContent?.trim()).toBe('HECHO');

      vi.advanceTimersByTime(PANIC_ACK_MS);
      fixture.detectChanges();

      expect(host.querySelector('.panic')?.textContent?.trim()).toBe('CALLA');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Header · el transporte', () => {
  it('deja MIRAR muerto mientras no llega un bloque', async () => {
    const { host } = await renderHeader();

    // A heartbeat over a bridge that is not delivering would be the one lie this
    // bar cannot tell.
    expect(host.querySelector('.look')?.className).not.toContain('look--on');
    expect(host.querySelector('.look__text')?.textContent?.trim()).toBe(`MIRAR · ${DEAD_MARK} fps`);
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
    expect(host.querySelector('.look__text')?.textContent?.trim()).toMatch(/^MIRAR · [\d.]+ fps$/);
  });
});

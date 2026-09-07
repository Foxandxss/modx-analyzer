import { TestBed } from '@angular/core/testing';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { FakeBackendGateway } from '../../backend/fake-backend-gateway';
import { DEAD_MARK } from '../../provenance/provenance';
import { Header } from './header';

async function renderHeader() {
  const backend = new FakeBackendGateway();
  TestBed.configureTestingModule({
    imports: [Header],
    providers: [{ provide: BACKEND_GATEWAY, useValue: backend }],
  });
  const fixture = TestBed.createComponent(Header);
  await fixture.whenStable();
  return { backend, fixture, host: fixture.nativeElement as HTMLElement };
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

  it('draws the algorithm zero-padded once the ring has read it', async () => {
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
});

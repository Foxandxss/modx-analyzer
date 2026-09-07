import { TestBed } from '@angular/core/testing';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { FakeBackendGateway } from '../../backend/fake-backend-gateway';
import { PANIC_ACK_MS, PanicService } from './panic-service';
import { PanicNotice } from './panic-notice';

async function renderNotice() {
  const backend = new FakeBackendGateway();
  TestBed.configureTestingModule({
    imports: [PanicNotice],
    providers: [{ provide: BACKEND_GATEWAY, useValue: backend }],
  });
  const fixture = TestBed.createComponent(PanicNotice);
  await fixture.whenStable();
  return {
    backend,
    fixture,
    host: fixture.nativeElement as HTMLElement,
    panic: TestBed.inject(PanicService),
  };
}

describe('PanicNotice', () => {
  it('says nothing until the pánico has been pressed', async () => {
    const { host } = await renderNotice();

    expect(host.querySelector('.notice')).toBeNull();
  });

  it('says how many notes it silenced and that the patch is intact', async () => {
    const { backend, fixture, panic } = await renderNotice();
    backend.liveNotes.set(3);

    await panic.press();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain(
      'Silenciadas 3 notas · tu patch está intacto',
    );
  });

  it('gets the number right when there was only one note', async () => {
    const { backend, fixture, panic } = await renderNotice();
    backend.liveNotes.set(1);

    await panic.press();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Silenciada 1 nota');
  });

  it('leaves on its own, with nothing to dismiss', async () => {
    const { fixture, host, panic } = await renderNotice();

    // Real timers up to here: Angular's own stabilisation runs on them.
    vi.useFakeTimers();
    try {
      await panic.press();
      fixture.detectChanges();
      expect(host.querySelector('.notice')).not.toBeNull();
      // Nothing to press: the notice is not a dialog.
      expect(host.querySelector('button, a')).toBeNull();

      vi.advanceTimersByTime(PANIC_ACK_MS);
      fixture.detectChanges();

      expect(host.querySelector('.notice')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('says so out loud when the keyboard did not answer', async () => {
    const { backend, fixture, host, panic } = await renderNotice();
    backend.panicResult = () => Promise.reject(new Error('el puerto MODX-1 no está'));

    await panic.press();
    await fixture.whenStable();

    expect(host.querySelector('.notice')?.classList.contains('notice--failed')).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('TU PATCH ESTÁ INTACTO');
  });
});

import { TestBed } from '@angular/core/testing';
import { BACKEND_GATEWAY, DumpView } from '../../backend/backend-gateway';
import { FakeBackendGateway } from '../../backend/fake-backend-gateway';
import { AlertStrip } from './alert-strip';

const FOLDER = 'C:\\Users\\jesus\\AppData\\Roaming\\modx-analyzer\\dumps';

function dump(over: Partial<DumpView> = {}): DumpView {
  return {
    state: 'saved',
    path: `${FOLDER}\\2026-09-07_193305 Init Normal (FM-X).syx`,
    folder: FOLDER,
    bytes: 7669,
    messages: 123,
    tookMs: 2400,
    reason: null,
    expectedMessages: 123,
    expectedBytes: 7669,
    ...over,
  };
}

async function renderStrip() {
  const backend = new FakeBackendGateway();
  TestBed.configureTestingModule({
    imports: [AlertStrip],
    providers: [{ provide: BACKEND_GATEWAY, useValue: backend }],
  });
  const fixture = TestBed.createComponent(AlertStrip);
  await fixture.whenStable();

  return {
    backend,
    async show(view: DumpView | null) {
      backend.dump.set(view);
      await fixture.whenStable();
      return (fixture.nativeElement as HTMLElement).textContent ?? '';
    },
    text: () => (fixture.nativeElement as HTMLElement).textContent ?? '',
  };
}

describe('AlertStrip', () => {
  it('says nothing while the volcado is still being taken', async () => {
    const { text } = await renderStrip();

    expect(text().trim()).toBe('');
  });

  it('says nothing when the volcado came back whole', async () => {
    const { show } = await renderStrip();

    expect((await show(dump())).trim()).toBe('');
  });

  it('gives the folder path when the keyboard did not answer', async () => {
    const { show } = await renderStrip();

    const text = await show(
      dump({
        state: 'failed',
        path: null,
        bytes: 0,
        messages: 0,
        tookMs: null,
        reason: 'el teclado no contestó al volcado de 0E 25 00',
      }),
    );

    expect(text).toContain('NO SAFETY DUMP');
    // The session writes nothing, so this is a warning and not a block — and the
    // path is the whole point of the warning.
    expect(text).toContain('THIS SESSION WRITES NOTHING');
    expect(text).toContain(FOLDER);
    expect(text).toContain('0E 25 00');
  });

  it('counts the bytes it did get when the volcado came back short', async () => {
    const { show } = await renderStrip();

    const text = await show(
      dump({ state: 'short', bytes: 2480, messages: 40, reason: 'volcado corto' }),
    );

    expect(text).toContain('SHORT DUMP');
    expect(text).toContain('2480 OF 7669 BYTES');
    expect(text).toContain(FOLDER);
  });
});

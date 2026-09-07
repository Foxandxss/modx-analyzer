import { TestBed } from '@angular/core/testing';
import { BACKEND_GATEWAY, DumpView } from '../../backend/backend-gateway';
import { FakeBackendGateway } from '../../backend/fake-backend-gateway';
import { FiguresColumn } from './figures-column';

const FOLDER = 'C:\\Users\\jesus\\AppData\\Roaming\\modx-analyzer\\dumps';
const FILE = '2026-09-07_193305 Init Normal (FM-X).syx';

function dump(over: Partial<DumpView> = {}): DumpView {
  return {
    state: 'saved',
    path: `${FOLDER}\\${FILE}`,
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

async function renderColumn() {
  const backend = new FakeBackendGateway();
  backend.appInfoResult = { version: '0.1.0', dumpsFolder: FOLDER };
  TestBed.configureTestingModule({
    imports: [FiguresColumn],
    providers: [{ provide: BACKEND_GATEWAY, useValue: backend }],
  });
  const fixture = TestBed.createComponent(FiguresColumn);
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

describe('FiguresColumn', () => {
  it('shows the dumps folder before any volcado exists', async () => {
    const { text } = await renderColumn();

    // A safety file the owner cannot find does not count as safety, so the path is
    // on screen from the first frame — before the keyboard has answered anything.
    expect(text()).toContain(FOLDER);
    expect(text()).toContain('volcando el buffer de edición');
  });

  it('names the file and its size once the volcado is on disk', async () => {
    const { show } = await renderColumn();

    const text = await show(dump());

    expect(text).toContain('7669 B · 123 MSJ');
    expect(text).toContain(FILE);
    expect(text).toContain(FOLDER);
  });

  it('keeps the folder and says why when the volcado failed', async () => {
    const { show } = await renderColumn();

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

    expect(text).toContain('—');
    expect(text).toContain('el teclado no contestó');
    expect(text).toContain(FOLDER);
    expect(text).not.toContain('0 B · 0 MSJ');
  });

  it('never draws a zero where a medida is missing', async () => {
    const { text } = await renderColumn();

    expect(text()).toContain('hay que volver a medir');
    expect(text()).not.toContain('0.00');
  });
});

import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BLOCK_FRAMES } from 'modx-dsp';
import { AUDIO_WORKER, AudioService } from '../../audio/audio-service';
import { fakeBlock, heldNote } from '../../audio/fake-block';
import { FakeAudioWorker } from '../../audio/fake-audio-worker';
import { Clock } from '../../provenance/clock';
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
    expect(text()).toContain('dumping the edit buffer');
  });

  it('names the file and its size once the volcado is on disk', async () => {
    const { show } = await renderColumn();

    const text = await show(dump());

    expect(text).toContain('7669 B · 123 MSG');
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
        reason: 'the keyboard did not answer the 0E 25 00 dump',
      }),
    );

    expect(text).toContain('—');
    expect(text).toContain('the keyboard did not answer');
    expect(text).toContain(FOLDER);
    expect(text).not.toContain('0 B · 0 MSG');
  });

  it('never draws a zero where a medida is missing', async () => {
    const { text } = await renderColumn();

    expect(text()).toContain('NOT MEASURED IN THIS SOUND');
    expect(text()).not.toContain('0.00');
  });
});

/**
 * The column with the audio bridge behind it, so that pressing CAPTURE runs the
 * real analysis over the real path: bloques in, ring filled, window out, worker,
 * table. Nothing about the medida is stubbed — only the thread and the device.
 */
async function renderWithAudio() {
  const backend = new FakeBackendGateway();
  backend.appInfoResult = { version: '0.1.0', dumpsFolder: FOLDER };
  TestBed.configureTestingModule({
    imports: [FiguresColumn],
    providers: [
      { provide: BACKEND_GATEWAY, useValue: backend },
      { provide: AUDIO_WORKER, useValue: () => new FakeAudioWorker() },
    ],
  });
  const fixture = TestBed.createComponent(FiguresColumn);
  const audio = TestBed.inject(AudioService);
  audio.start();
  await fixture.whenStable();

  return {
    audio,
    /** Hold `frequency` long enough to fill the ring the medida takes from. */
    async hold(frequency: number, blocks = BLOCKS_FOR_A_MEDIDA) {
      backend.lowestLivePitch.set(60);
      await fixture.whenStable();
      for (let sequence = 0; sequence < blocks; sequence += 1) {
        const start = sequence * BLOCK_FRAMES;
        backend.emitBlock(
          fakeBlock({
            sequence,
            sentAtMicros: sequence * 30_000,
            mono: heldNote(frequency, start),
          }),
        );
      }
      await fixture.whenStable();
    },
    async press() {
      await audio.measure();
      await fixture.whenStable();
    },
    text: () => (fixture.nativeElement as HTMLElement).textContent ?? '',
    rows: () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.lines__row')),
  };
}

/** 50 bloques of 1 323 frames: 66 150 samples, the first window with room. */
const BLOCKS_FOR_A_MEDIDA = 50;

describe('FiguresColumn · la medida', () => {
  it('empieza muerta: guiones y «NOT MEASURED IN THIS SOUND», nunca ceros', async () => {
    const { text, rows } = await renderWithAudio();

    expect(rows()).toHaveLength(0);
    expect(text()).toContain('NOT MEASURED IN THIS SOUND');
    expect(text()).not.toContain('MEASURED · ');
  });

  it('dice que no hay audio bastante en vez de medir un silencio inventado', async () => {
    const { press, text } = await renderWithAudio();

    // El anillo no se ha llenado: la orden contesta que no hay ventana.
    await press();

    expect(text()).toContain('not 1.5 s of audio yet');
    expect(text()).not.toContain('MEASURED · ');
  });

  it('publica la tabla de parciales sellada con su ventana y su edad', async () => {
    const { hold, press, text, rows } = await renderWithAudio();

    await hold(261.626);
    await press();

    expect(text()).toContain('MEASURED · 65536 · 0 s ago');
    const lines = rows();
    expect(lines.length).toBeGreaterThan(0);
    // La nota tocada es la primera línea y sale numerada como el armónico 1.
    expect(lines[0]!.textContent).toContain('261.6');
    expect(lines[0]!.textContent).toContain('n1');
  });

  it('dice qué cogió el obturador: la nota y el pico en dBFS', async () => {
    const { hold, press, text } = await renderWithAudio();

    await hold(261.626);
    await press();

    expect(text()).toMatch(/NOTE 261\.6 Hz · PEAK -\d+\.\d dBFS/);
    expect(text()).toContain('65536 · 0 s ago');
  });

  it('no cambia sola: la tabla sigue igual mientras entra más audio', async () => {
    const { hold, press, rows } = await renderWithAudio();

    await hold(261.626);
    await press();
    const measured = rows().map((row) => row.textContent);

    // Otra nota entrando por el cable no toca una cifra medida. Una medida es
    // algo que hiciste, no algo que pasó.
    await hold(440, 10);

    expect(rows().map((row) => row.textContent)).toEqual(measured);
  });
});

describe('FiguresColumn · la edad de la medida', () => {
  it('envejece con el reloj sin que la tabla se toque', async () => {
    const backend = new FakeBackendGateway();
    backend.appInfoResult = { version: '0.1.0', dumpsFolder: FOLDER };
    // El mismo reloj de 10 Hz que decide el `CADUCO`, movido a mano: en un test
    // el tiempo se pone, no se espera.
    const clock: Clock = { now: signal(0) };
    TestBed.configureTestingModule({
      imports: [FiguresColumn],
      providers: [
        { provide: BACKEND_GATEWAY, useValue: backend },
        { provide: AUDIO_WORKER, useValue: () => new FakeAudioWorker() },
        { provide: Clock, useValue: clock },
      ],
    });
    const fixture = TestBed.createComponent(FiguresColumn);
    const audio = TestBed.inject(AudioService);
    audio.start();
    backend.lowestLivePitch.set(60);
    await fixture.whenStable();
    for (let sequence = 0; sequence < BLOCKS_FOR_A_MEDIDA; sequence += 1) {
      backend.emitBlock(
        fakeBlock({
          sequence,
          sentAtMicros: sequence * 30_000,
          mono: heldNote(261.626, sequence * BLOCK_FRAMES),
        }),
      );
    }
    await fixture.whenStable();

    clock.now.set(performance.now());
    await audio.measure();
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const table = Array.from(host.querySelectorAll('.lines__row')).map((row) => row.textContent);

    clock.now.set(performance.now() + 14_000);
    await fixture.whenStable();

    expect(host.textContent).toContain('MEASURED · 65536 · 14 s ago');
    // Catorce segundos después, la tabla es la misma tabla.
    expect(Array.from(host.querySelectorAll('.lines__row')).map((row) => row.textContent)).toEqual(
      table,
    );
  });
});

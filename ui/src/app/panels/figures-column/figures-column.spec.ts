import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BLOCK_FRAMES } from 'modx-dsp';
import { AUDIO_WORKER, AudioService } from '../../audio/audio-service';
import { fakeBlock, heldNote } from '../../audio/fake-block';
import { FakeAudioWorker } from '../../audio/fake-audio-worker';
import { Clock } from '../../provenance/clock';
import { anchorAnswers, anchorWatching } from '../../backend/anchor-driver';
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

    expect(text()).toContain(SENTENCE);
    expect(text()).not.toContain('0.00');
  });
});

/** The one sentence of the resting column, verbatim from `DESIGN.md` §10.1. */
const SENTENCE = 'Hold a note and press CAPTURE. One 1.5 s window fills every cell below.';

/** Every cell of the resting column, in the order the design stacks them. */
const CELLS = [
  'MEASURED RATIO',
  'fc / fm',
  'INDEX I · FITTED',
  'WORST PARTIAL',
  'PARTIALS',
  'LAST CAPTURE',
] as const;

describe('FiguresColumn · the resting state', () => {
  it('keeps every label and unit and loses only the figure', async () => {
    const { text } = await renderColumn();
    const host = text();

    // The void vocabulary: the outline stays, the number goes. A cell that lost
    // its label with its figure would be a hole; this one is a contract.
    for (const label of CELLS) {
      expect(host).toContain(label);
    }
    for (const unit of ['fm / fc', 'Hz', 'no I, no Bessel curve', 'dB off prediction']) {
      expect(host).toContain(unit);
    }
    expect(host).toContain('—');
    // Never a zero and never a plausible placeholder: the one rule this state
    // must not break.
    expect(host).not.toMatch(/\b0(\.0+)?\s*(Hz|dB)/);
    expect(host).not.toContain('0.00');
  });

  it('says its sentence once and does not repeat a variant of it under the cells', async () => {
    const { text } = await renderColumn();
    const host = text();

    expect(host.split(SENTENCE)).toHaveLength(2);
    // The five repeated notes are gone. `NOT MEASURED IN THIS SOUND` is the
    // ancla's, in the header, and it is not written a second time down here.
    expect(host).not.toContain('los ajustes no entran en esta sesión');
    expect(host).not.toContain('NOT MEASURED IN THIS SOUND');
  });

  it('stacks the cells in the designed order, worst partial before the table', async () => {
    const backend = new FakeBackendGateway();
    backend.appInfoResult = { version: '0.1.0', dumpsFolder: FOLDER };
    TestBed.configureTestingModule({
      imports: [FiguresColumn],
      providers: [{ provide: BACKEND_GATEWAY, useValue: backend }],
    });
    const fixture = TestBed.createComponent(FiguresColumn);
    await fixture.whenStable();

    const drawn = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.cell__eyebrow'),
    ).map((eyebrow) => eyebrow.textContent);

    expect(drawn).toEqual([...CELLS, 'SAFETY DUMP']);
  });

  it('repeats the shutter at the foot as the very same control', async () => {
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
    anchorWatching(backend);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const foot = () => host.querySelector<HTMLButtonElement>('.measure')!;

    // Nothing has arrived, so the shutter is dead in both places at once.
    expect(foot().disabled).toBe(true);
    expect(audio.canMeasure()).toBe(false);

    // La pista de la nota es de la cabecera, que se lee en frío. Aquí encima hay
    // celdas que acaban de decirlo en sus propias unidades, y la Nota viva no la
    // trae al pie ni cuando hay teclas abajo (#55).
    backend.liveNotes.set(3);
    await fixture.whenStable();
    expect(host.querySelector('.measure__hint')).toBeNull();
    expect(host.textContent).not.toContain('HELD');

    backend.lowestLivePitch.set(60);
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

    expect(foot().disabled).toBe(false);
    expect(foot().className).toContain('measure--on');

    // And it is the control, not a picture of one: pressing it captures — once
    // the ancla's next pass has vouched for the window it took (#38).
    foot().click();
    anchorAnswers(backend);
    await fixture.whenStable();

    expect(audio.medida()).not.toBeNull();
    // With a capture on screen the invitation goes: `NOTHING MEASURED YET` over
    // a table of partials would be the caption lying about what is under it.
    expect(host.textContent).not.toContain(SENTENCE);
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
  // The ancla has been looking for a few seconds, which is what lets a capture
  // taken below be vouched for at both ends of its window (#38).
  anchorWatching(backend);
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
    /** The shutter, and the out-of-turn pass that vouches for what it took. */
    async press(answer: 'same' | 'changed' = 'same') {
      const drawn = audio.measure();
      anchorAnswers(backend, answer, answer === 'changed' ? 'Bright FM Keys' : undefined);
      await drawn;
      await fixture.whenStable();
    },
    backend,
    settle: () => fixture.whenStable(),
    text: () => (fixture.nativeElement as HTMLElement).textContent ?? '',
    rows: () => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.lines__row')),
  };
}

/** 50 bloques of 1 323 frames: 66 150 samples, the first window with room. */
const BLOCKS_FOR_A_MEDIDA = 50;

describe('FiguresColumn · la medida', () => {
  it('empieza muerta: guiones y la invitación, nunca ceros', async () => {
    const { text, rows } = await renderWithAudio();

    expect(rows()).toHaveLength(0);
    expect(text()).toContain(SENTENCE);
    expect(text()).not.toContain('MEASURED · ');
  });

  it('vuelve al reposo cuando cambia la Performance, sin una quinta frase', async () => {
    const { hold, press, backend, settle, text, rows } = await renderWithAudio();

    await hold(261.626);
    await press();
    expect(rows().length).toBeGreaterThan(0);

    // El sonido cambió debajo: la medida era de otro patch y se va entera.
    backend.loadPerformance('Bright FM Keys');
    await settle();

    expect(rows()).toHaveLength(0);
    expect(text()).toContain(SENTENCE);
    expect(text()).toContain('WORST PARTIAL');
    // Y ni una nota más: lo dice la columna en reposo y la cabecera con letras.
    expect(text()).not.toContain('NOT MEASURED IN THIS SOUND');
  });

  it('se queda en reposo cuando el aval tira la captura sin haberse visto', async () => {
    const { hold, press, text, rows } = await renderWithAudio();

    await hold(261.626);
    // Alguien giró el dial un momento antes de pulsar: el segundo y medio del
    // anillo es del sonido que era, y el nombre en pantalla es el que es (#38).
    await press('changed');

    expect(rows()).toHaveLength(0);
    expect(text()).toContain(SENTENCE);
    // Y ni una frase debajo: la columna en reposo lo dice y la cabecera con
    // letras. Una nota bajo una celda ya dibujada vacía es etiquetar el hueco.
    expect(text()).not.toContain('the shutter opened on silence');
    expect(text()).not.toContain('capturing');
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
    anchorWatching(backend);
    const drawn = audio.measure();
    anchorAnswers(backend);
    await drawn;
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

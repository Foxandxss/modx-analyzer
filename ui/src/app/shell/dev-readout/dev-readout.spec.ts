import { TestBed } from '@angular/core/testing';
import { BLOCK_FRAMES, MEASURE_WINDOW } from 'modx-dsp';
import { AUDIO_WORKER, AudioService } from '../../audio/audio-service';
import { fakeBlock, heldNote } from '../../audio/fake-block';
import { LatencyLegs, WARMUP_BLOCKS } from '../../audio/bridge';
import { NO_STATS } from '../../audio/audio-service';
import { FakeAudioWorker } from '../../audio/fake-audio-worker';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { FakeBackendGateway } from '../../backend/fake-backend-gateway';
import { DevReadout } from './dev-readout';

async function renderReadout() {
  const backend = new FakeBackendGateway();
  TestBed.configureTestingModule({
    imports: [DevReadout],
    providers: [
      { provide: BACKEND_GATEWAY, useValue: backend },
      { provide: AUDIO_WORKER, useValue: () => new FakeAudioWorker() },
    ],
  });
  const fixture = TestBed.createComponent(DevReadout);
  TestBed.inject(AudioService).start();
  await fixture.whenStable();

  return {
    backend,
    fixture,
    async push(...buffers: ArrayBuffer[]) {
      for (const buffer of buffers) {
        backend.emitBlock(buffer);
      }
      await fixture.whenStable();
      return (fixture.nativeElement as HTMLElement).textContent ?? '';
    },
    text: () => (fixture.nativeElement as HTMLElement).textContent ?? '',
    /** Only what is drawn in alert, so «it is on screen» and «it is red» differ. */
    fixtureAlerts: () =>
      Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.dev__alert'))
        .map((element) => element.textContent ?? '')
        .join(' '),
  };
}

describe('DevReadout', () => {
  it('claims nothing before the first bloque', async () => {
    const { text } = await renderReadout();

    expect(text()).toContain('0 BLOQUES');
    expect(text()).toContain('p99 —');
    expect(text()).toContain('CALLBACK — f');
  });

  it('counts the bloques and the size of the device callback', async () => {
    const { push } = await renderReadout();

    const text = await push(
      ...[0, 1, 2].map((sequence) =>
        fakeBlock({ sequence, sentAtMicros: sequence * 30_000, mono: heldNote(440) }),
      ),
    );

    expect(text).toContain('3 BLOQUES');
    expect(text).toContain('HUECOS 0');
    expect(text).toContain('CALLBACK 441 f');
  });

  it('says how many bloques the bridge lost', async () => {
    const { push } = await renderReadout();

    // 2 and 3 never arrive: the go/no-go of ADR-0001 is that this stays at zero.
    const text = await push(
      ...[0, 1, 4].map((sequence) => fakeBlock({ sequence, sentAtMicros: sequence * 30_000 })),
    );

    expect(text).toContain('3 BLOQUES');
    expect(text).toContain('HUECOS 2');
  });

  /**
   * #23: the launch burst must not be readable as a run.
   *
   * Four bloques in, the app is still launching, so there is no window to take a
   * percentile over and the strip says so with a dash. What it does show is the
   * count the figures will be about, which is the sentence #23 says was missing:
   * «p99 under 33 ms» is a claim about a window and nothing named the window.
   */
  it('takes no percentile while the app is still launching, and says so', async () => {
    const { push } = await renderReadout();

    const text = await push(
      ...[0, 1, 2, 3].map((sequence) => fakeBlock({ sequence, sentAtMicros: sequence * 30_000 })),
    );

    expect(text).toContain('SOBRE 0');
    expect(text).toContain('ARRANQUE 4 BLOQUES');
    expect(text).toMatch(/SOBRE 0 · p50 — · p99 — · max —/);
  });

  it('shows the spread of the delivery once the launch is over', async () => {
    const { push } = await renderReadout();

    await push(
      ...Array.from({ length: WARMUP_BLOCKS + 5 }, (_, sequence) =>
        fakeBlock({ sequence, sentAtMicros: sequence * 30_000 }),
      ),
    );

    const text = (await push()).replace(/\s+/g, ' ');
    expect(text).toContain(`ARRANQUE ${WARMUP_BLOCKS} BLOQUES`);
    expect(text).toMatch(/SOBRE 5 · p50 \d+\.\d ms · p99 \d+\.\d ms/);
  });

  /**
   * Where the lateness was, which is what makes #23's burst attributable rather
   * than merely observed. The three legs are on screen because the one figure
   * they add up to could not say whether the wait was in the queue to the IPC,
   * in the crossing, or in the worker's own backlog.
   */
  it('splits the worst bloque into the three legs of the path', async () => {
    const { push } = await renderReadout();

    const text = await push(fakeBlock({ sequence: 0, sentAtMicros: 30_000 }));

    expect(text).toContain('COLA');
    expect(text).toContain('IPC');
    expect(text).toContain('WORKER');
    // And when it was, because a max the launch explains and one it does not are
    // two different answers wearing the same number.
    expect(text).toContain('A LOS 0.0 s');
  });

  /**
   * The instrument saying it is broken, which on the first run of #23 it could
   * not: a worker leg of −447,5 ms was drawn as calmly as any other figure,
   * because `performance.now()` counts from a different origin on each thread.
   * A duration cannot be negative, so a negative one is never a result.
   */
  it('says so when a leg comes back negative instead of drawing it as a figure', async () => {
    const { fixture, fixtureAlerts } = await renderReadout();
    const broken: LatencyLegs = {
      queueMs: 0,
      ipcMs: 202.2,
      workerMs: -447.5,
      totalMs: -245.3,
      atSeconds: 1.2,
    };

    TestBed.inject(AudioService).stats.set({ ...NO_STATS, blocks: 1, worstWarmup: broken });
    await fixture.whenStable();

    expect(fixtureAlerts()).toContain('RELOJ ROTO');
  });

  /**
   * The dev strip is the one place the **raw** fact is drawn, separately from
   * what it means: `CEROS EXACTOS` is what Rust saw in the samples, and `AUDIO`
   * is the state that comes of combining it with the notes and with whether
   * bloques are arriving at all. Before #21 the two were one word, and the word
   * was wrong in both directions.
   */
  it('draws the exact-zeros flag apart from what it means', async () => {
    const { push, text } = await renderReadout();

    await push(fakeBlock({ sequence: 0, mono: new Float32Array(BLOCK_FRAMES) }));
    expect(text()).not.toContain('CEROS EXACTOS');
    expect(text()).toContain('ALIVE');

    await push(fakeBlock({ sequence: 1, silent: true }));
    expect(text()).toContain('CEROS EXACTOS');
    // Zeros with nobody playing is the MODX idling, not a fault.
    expect(text()).toContain('IDLE');
  });

  it('has the volcado on screen so its time can be written down', async () => {
    const { backend, fixture, text } = await renderReadout();

    expect(text()).toContain('VOLCADO');
    expect(text()).toContain('en curso');

    backend.dump.set({
      state: 'saved',
      path: 'C:\\dumps\\2026-09-07_193305 Init Normal (FM-X).syx',
      folder: 'C:\\dumps',
      bytes: 7669,
      messages: 123,
      tookMs: 2410,
      reason: null,
      expectedMessages: 123,
      expectedBytes: 7669,
    });
    await fixture.whenStable();

    expect(text()).toContain('7669 B · 123 DE 123 MSJ · 2.41 s · SAVED');
  });

  it('claims no load before the generator has been started', async () => {
    const { text } = await renderReadout();

    expect(text()).toContain('GENERADOR');
    expect(text()).toContain('PARADO · —');
    expect(text()).toContain('NOTAS DENSAS');
  });

  it('starts and stops the generator from the one control there is', async () => {
    const { backend, fixture, text } = await renderReadout();
    const button = () =>
      (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;

    button().click();
    await fixture.whenStable();

    expect(backend.generatorStarts).toBe(1);
    expect(text()).toContain('NOTAS CADA 40 ms');
    expect(button().textContent).toContain('PARAR');

    button().click();
    await fixture.whenStable();

    expect(backend.generatorStops).toBe(1);
    expect(button().textContent).toContain('NOTAS DENSAS');
  });

  it('puts the load and the keyboard’s own traffic side by side', async () => {
    const { backend, fixture, text } = await renderReadout();

    backend.generatorRuns({ asked: 1_248, held: 4, traffic: 0 });
    await fixture.whenStable();

    // What the port took, what is being held, and what the keyboard said back:
    // the load is counted at both ends and nothing here is assumed.
    expect(text()).toContain('1248 DE 1248 ENVIADAS · 4 VIVAS · RECHAZOS 0 · TRÁFICO 0');
  });

  it('says so in alert when the load did not happen', async () => {
    const { backend, fixture, fixtureAlerts } = await renderReadout();

    // Served last of everything, so a run under a loaded port can be starved.
    // That is a result about the port and it must not be written down as a
    // successful run.
    backend.generatorRuns({ asked: 1_000, sent: 640, refused: 12 });
    await fixture.whenStable();

    expect(fixtureAlerts()).toContain('640 DE 1000 ENVIADAS');
  });

  it('shows the run stopped the moment the pánico takes the keyboard back', async () => {
    const { backend, fixture, text } = await renderReadout();

    backend.generatorRuns({ asked: 500, held: 4 });
    await fixture.whenStable();
    expect(text()).toContain('4 VIVAS');

    await backend.panic();
    await fixture.whenStable();

    expect(text()).toContain('PARADO · 500 DE 500 ENVIADAS · 0 VIVAS');
  });
});

/**
 * #14's control. It is the one thing in the app that makes it stop knowing
 * something on purpose, so what these check is that it says so.
 */
describe('DevReadout · el sondeo de #14', () => {
  function press(fixture: { nativeElement: unknown }, label: string): void {
    const button = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((candidate) => (candidate.textContent ?? '').trim() === label);
    if (button === undefined) {
      throw new Error(`no hay botón «${label}»`);
    }
    button.click();
  }

  it('stops the two loops and says what that costs, in alert', async () => {
    const { backend, fixture, text, fixtureAlerts } = await renderReadout();

    expect(text()).toContain('CORRIENDO');
    expect(fixtureAlerts()).not.toContain('EL ANCLA NO MIRA');

    press(fixture, 'PARAR SONDEO');
    await fixture.whenStable();

    expect(backend.polling().paused).toBe(true);
    // Not «PARADO» on its own: a paused app cannot see a Performance change, and
    // the readout is the only thing that can say so.
    expect(fixtureAlerts()).toContain('PARADO · EL ANCLA NO MIRA');
  });

  it('goes back to polling on the second press', async () => {
    const { backend, fixture, text } = await renderReadout();

    press(fixture, 'PARAR SONDEO');
    await fixture.whenStable();
    press(fixture, 'SONDEAR');
    await fixture.whenStable();

    expect(backend.polling().paused).toBe(false);
    expect(text()).toContain('CORRIENDO');
  });

  /**
   * The one mistake that would quietly ruin the measurement: filing a polled
   * window as an unpolled one. The label is never passed from the front — it is
   * read off the flag by the side that owns it.
   */
  it('labels each exported window by the polling state and not by the caller', async () => {
    const { backend, fixture, text } = await renderReadout();

    press(fixture, 'EXPORTAR');
    await fixture.whenStable();
    expect(backend.exported.at(-1)).toContain('-sondeo-');
    expect(text()).toContain('-sondeo-');

    press(fixture, 'PARAR SONDEO');
    await fixture.whenStable();
    press(fixture, 'EXPORTAR');
    await fixture.whenStable();

    expect(backend.exported.at(-1)).toContain('-sin-sondeo-');
    expect(backend.exported).toHaveLength(2);
  });

  it('exports the window the medida analyses and no other size', async () => {
    const { backend, fixture } = await renderReadout();

    press(fixture, 'EXPORTAR');
    await fixture.whenStable();

    expect(backend.exported.at(-1)).toContain(`-${MEASURE_WINDOW}.f32`);
  });
});

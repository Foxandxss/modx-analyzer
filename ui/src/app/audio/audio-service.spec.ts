import { TestBed } from '@angular/core/testing';
import { ARTEFACT_HZ, BLOCK_FRAMES, WATERFALL_FRAMES } from 'modx-dsp';
import { AUDIO_WORKER, AudioService, waterfallView } from './audio-service';
import { fakeBlock, heldNote, withComb } from './fake-block';
import { FakeAudioWorker } from './fake-audio-worker';
import { anchorAnswers, anchorWatching } from '../backend/anchor-driver';
import { BACKEND_GATEWAY, BeatAnswer } from '../backend/backend-gateway';
import { FakeBackendGateway } from '../backend/fake-backend-gateway';

function setUp() {
  const backend = new FakeBackendGateway();
  const worker = new FakeAudioWorker();
  TestBed.configureTestingModule({
    providers: [
      { provide: BACKEND_GATEWAY, useValue: backend },
      { provide: AUDIO_WORKER, useValue: () => worker },
    ],
  });
  const audio = TestBed.inject(AudioService);
  audio.start();

  return {
    backend,
    worker,
    audio,
    hold(blocks: number, frequency = 261.626) {
      for (let sequence = 0; sequence < blocks; sequence += 1) {
        backend.emitBlock(
          fakeBlock({
            sequence,
            sentAtMicros: sequence * 30_000,
            mono: heldNote(frequency, sequence * BLOCK_FRAMES),
          }),
        );
      }
    },
    /** The ancla having watched, so a capture pressed now has both its ends. */
    watching: () => anchorWatching(backend),
    /** The out-of-turn pass the capture asked for, started after its press. */
    vouches: (answer: BeatAnswer = 'same', name?: string) => anchorAnswers(backend, answer, name),
  };
}

describe('AudioService', () => {
  it('sends the played note to the worker, in hertz, when the keyboard says one', () => {
    const { backend, worker } = setUp();

    backend.lowestLivePitch.set(60);
    TestBed.tick();

    // C4 at equal temperament: 261.626, and stamped `TEORÍA` wherever it is
    // drawn. The MODX's own C4 is 261.763, which is the point.
    expect(worker.notes.at(-1)).toBeCloseTo(261.626, 3);
  });

  it('tells the worker the note is gone when the keys come up', () => {
    const { backend, worker } = setUp();
    backend.lowestLivePitch.set(60);
    TestBed.tick();

    backend.lowestLivePitch.set(null);
    TestBed.tick();

    expect(worker.notes.at(-1)).toBeNull();
  });

  it('keeps the last fourteen frames and no more, each with its own stamp', () => {
    const { audio, hold } = setUp();

    hold(WATERFALL_FRAMES + 12);

    expect(audio.live.waterfall.length).toBe(WATERFALL_FRAMES);
    expect(audio.live.stamps.length).toBe(WATERFALL_FRAMES);
    expect(audio.live.version).toBe(WATERFALL_FRAMES + 12);

    // Consecutive bloques: one hop of 1 323 frames apart, 30 ms each, so the
    // fourteen rows span thirteen hops. That is the only case in which the
    // arithmetic and the stamps agree, and it is not the case the caption is
    // written for.
    expect(waterfallView(audio.live.stamps)).toEqual({
      frames: WATERFALL_FRAMES,
      spanMs: (WATERFALL_FRAMES - 1) * 30,
    });
  });

  it('counts up from one frame, and the first row spans nothing', () => {
    const { audio, backend } = setUp();
    backend.lowestLivePitch.set(60);
    backend.liveNotes.set(1);
    TestBed.tick();

    backend.emitBlock(fakeBlock({ sequence: 0, sentAtMicros: 0, mono: heldNote(261.626, 0) }));

    // One ridgeline is one instant: `0 → 0 ms` is the true reading of it, and the
    // caption starts here rather than at fourteen.
    expect(audio.waterfall()).toEqual({ frames: 1, spanMs: 0 });
  });

  it('spans the silence in a phrase, because the rows carry their own time', () => {
    const { audio, backend } = setUp();
    backend.lowestLivePitch.set(60);
    backend.liveNotes.set(1);
    TestBed.tick();
    const play = (from: number, to: number) => {
      for (let sequence = from; sequence < to; sequence += 1) {
        backend.emitBlock(
          fakeBlock({
            sequence,
            sentAtMicros: sequence * 30_000,
            mono: heldNote(261.626, sequence * BLOCK_FRAMES),
          }),
        );
      }
    };
    const rest = (from: number, to: number) => {
      for (let sequence = from; sequence < to; sequence += 1) {
        backend.emitBlock(fakeBlock({ sequence, sentAtMicros: sequence * 30_000 }));
      }
    };

    play(0, WATERFALL_FRAMES);
    rest(WATERFALL_FRAMES, 41);
    play(41, 42);

    // Rows are pushed only when there is a curve, so the breath is skipped and
    // the window still holds fourteen of them. Count × hop would call that
    // 420 ms and be describing a picture that is not on screen.
    const drawn = audio.waterfall();
    expect(drawn).toEqual(waterfallView(audio.live.stamps));
    expect(drawn.frames).toBe(WATERFALL_FRAMES);
    expect(drawn.spanMs).toBeGreaterThan(drawn.frames * 30);
  });

  it('adds no ridgeline for a frame with nothing in it', () => {
    const { audio, backend, hold } = setUp();
    hold(6);

    // The four bloques of history empty one at a time, so the first few silent
    // ones still carry the tail of the note and still draw.
    const silence = (from: number, to: number) => {
      for (let sequence = from; sequence < to; sequence += 1) {
        backend.emitBlock(fakeBlock({ sequence, sentAtMicros: sequence * 30_000 }));
      }
    };
    silence(6, 12);
    const drawn = audio.live.waterfall.length;
    silence(12, 24);

    // The note is over. What is already drawn is its tail; the frame does not
    // fill with the noise floor.
    expect(audio.live.waterfall.length).toBe(drawn);
    expect(audio.live.frame.curve).toBeNull();
  });

  it('throws the medida away when the sound changes and does not bring it back', async () => {
    const { audio, backend, hold, watching, vouches } = setUp();
    // 50 bloques of 1 323 frames: 66 150 samples, the first window with room.
    hold(50);
    backend.lowestLivePitch.set(60);
    watching();
    TestBed.tick();
    const drawn = audio.measure();
    vouches();
    await drawn;
    expect(audio.medida()).not.toBeNull();

    backend.loadPerformance('Bright FM Keys');
    TestBed.tick();

    expect(audio.medida()).toBeNull();
    // And **no note**. The column going back to labels, units and dashes is the
    // statement, and the ancla is already saying it in words in the header; a
    // third copy under a cell that is drawn empty is labelling the blank (#33).
    expect(audio.measureNote()).toBeNull();

    // And it stays gone. Nothing is going to press MEDIR on the owner's behalf,
    // and a table that came back on its own would be a measurement that happened
    // rather than one somebody did.
    hold(60);
    TestBed.tick();
    expect(audio.medida()).toBeNull();
  });

  it('keeps the vista viva running through the change and cuts the waterfall', () => {
    const { audio, backend, hold } = setUp();
    hold(8);
    const before = audio.live.waterfall.length;

    backend.loadPerformance('Bright FM Keys');
    TestBed.tick();

    // The vista viva is audio entering now: it belongs to no patch and it is not
    // invalidated by anything the ancla says. What it gains is a line where the
    // sound changed, drawn above the first ridgeline of the new one.
    expect(audio.live.cuts).toEqual([audio.live.rows]);
    hold(4);
    expect(audio.live.waterfall.length).toBeGreaterThan(before);
    expect(audio.live.frame.curve).not.toBeNull();
  });

  it('forgets a cut once the ridgelines it separated have scrolled away', () => {
    const { audio, backend, hold } = setUp();
    hold(4);
    backend.loadPerformance('Bright FM Keys');
    TestBed.tick();
    expect(audio.live.cuts).toHaveLength(1);

    hold(WATERFALL_FRAMES * 2);

    // A line between two sounds that are both off the top of the frame is a line
    // about nothing on screen.
    expect(audio.live.cuts).toHaveLength(0);
  });

  it('does not call the first name the ancla reads a change', async () => {
    const { audio, backend, hold, watching, vouches } = setUp();
    // 50 bloques of 1 323 frames: 66 150 samples, the first window with room.
    hold(50);
    backend.lowestLivePitch.set(60);
    watching();
    TestBed.tick();
    const drawn = audio.measure();
    vouches();
    await drawn;

    // The launch: the ancla answers for the first time. Nothing preceded it, so
    // there is nothing of a previous patch to throw away.
    backend.anchorReads('Init Normal (FM-X)');
    TestBed.tick();

    expect(audio.medida()).not.toBeNull();
    expect(audio.live.cuts).toHaveLength(0);
  });
  // El chip parpadeaba dos veces por segundo. `artefactChipHz` ya responde con
  // la línea más baja, pero de SU ventana: medido con el teclado delante el
  // 2026-09-08, un C4 se queda en 2 756 Hz y un C5 en 5 513 y ninguno se mueve,
  // pero un G4 va y viene porque la de 2 756 cae por debajo del detector en
  // algunas ventanas y la más baja pasa a ser la de 5 513 (#19).
  //
  // La regla es sobre el tiempo y no sobre una ventana.
  it('sostiene la línea más baja del comb cuando una ventana no la ve', () => {
    const { backend, audio } = setUp();
    const push = (sequence: number, multiples: number[]) => {
      const start = sequence * BLOCK_FRAMES;
      let mono = heldNote(261.626, start);
      for (const multiple of multiples) {
        mono = withComb(mono, start, 1.25e-4, multiple);
      }
      backend.emitBlock(fakeBlock({ sequence, sentAtMicros: sequence * 30_000, mono }));
    };

    // Las dos líneas presentes: el chip nombra la baja.
    for (let sequence = 0; sequence < 12; sequence += 1) {
      push(sequence, [1, 2]);
    }
    expect(audio.artefactHz()).toBeCloseTo(ARTEFACT_HZ, 2);

    // La de 2 756 desaparece de la ventana y sólo queda la de 5 513. El chip no
    // se mueve: dentro del sostenimiento manda la más baja que se ha visto.
    for (let sequence = 12; sequence < 28; sequence += 1) {
      push(sequence, [2]);
    }
    expect(audio.artefactHz()).toBeCloseTo(ARTEFACT_HZ, 2);
  });

  // Y el sostenimiento no se arrastra hasta la nota siguiente: existe para que
  // la línea no baile dentro de UNA nota. Con el teclado delante, pasar de C4 a
  // C5 tardaba el sostenimiento entero en mover el chip.
  it('suelta la línea sostenida en cuanto cambia la nota', () => {
    const { backend, audio } = setUp();
    const push = (sequence: number, note: number, multiples: number[]) => {
      const start = sequence * BLOCK_FRAMES;
      let mono = heldNote(note, start);
      for (const multiple of multiples) {
        mono = withComb(mono, start, 1.25e-4, multiple);
      }
      backend.emitBlock(fakeBlock({ sequence, sentAtMicros: sequence * 30_000, mono }));
    };

    for (let sequence = 0; sequence < 12; sequence += 1) {
      push(sequence, 261.626, [1, 2]);
    }
    expect(audio.artefactHz()).toBeCloseTo(ARTEFACT_HZ, 2);

    // Otra nota, y en ella sólo está la línea de 5 513. El chip la nombra sin
    // esperar: nada de esto tarda el segundo del sostenimiento.
    for (let sequence = 12; sequence < 28; sequence += 1) {
      push(sequence, 523.251, [2]);
    }
    expect(audio.artefactHz()).toBeCloseTo(ARTEFACT_HZ * 2, 2);
  });
});

/**
 * ADR-0005's rule, extended from a polled figure to the capture (#38).
 *
 * The window reaches 1,486 s into the past and the ancla takes up to a second to
 * see a change, so a Performance changed in the second **before** the press
 * yields a table of the old sound that nothing downstream would ever kill. These
 * are the four outcomes at the seam the shutter is actually pressed at.
 */
describe('AudioService · el aval de la medida', () => {
  /** 50 bloques of 1 323 frames: 66 150 samples, the first window with room. */
  const BLOCKS_FOR_A_MEDIDA = 50;

  function ready() {
    const bench = setUp();
    bench.hold(BLOCKS_FOR_A_MEDIDA);
    bench.backend.lowestLivePitch.set(60);
    bench.watching();
    TestBed.tick();
    return bench;
  }

  it('draws a capture bracketed by two passes that read the same name', async () => {
    const { audio, vouches } = ready();

    const drawn = audio.measure();
    vouches('same');
    const view = await drawn;

    expect(view).not.toBeNull();
    expect(audio.medida()).toBe(view);
    expect(audio.medida()?.medida.window).toBe(65_536);
    expect(audio.measuring()).toBe(false);
    expect(audio.measureNote()).toBeNull();
  });

  it('never draws a capture whose pass answers that the sound changed', async () => {
    const { audio, vouches } = ready();

    const drawn = audio.measure();
    // The one failure this whole application exists to prevent: somebody turned
    // the dial a moment before pressing, so the 1,5 s in the ring is the sound
    // that was and the name on screen is the sound that is.
    vouches('changed', 'Bright FM Keys');

    expect(await drawn).toBeNull();
    expect(audio.medida()).toBeNull();
    expect(audio.measuring()).toBe(false);
    // Discarded unseen, and nothing written under the cells: the column at rest
    // is the statement and the header says it in words (#33).
    expect(audio.measureNote()).toBeNull();
  });

  it('holds the shutter busy and the previous capture still while no pass has spoken', async () => {
    const { audio, hold, vouches } = ready();
    const first = audio.measure();
    vouches('same');
    const before = await first;
    expect(before).not.toBeNull();

    // A second press, and this time the ancla says nothing yet.
    hold(BLOCKS_FOR_A_MEDIDA);
    void audio.measure();
    await Promise.resolve();
    await Promise.resolve();

    expect(audio.measuring()).toBe(true);
    // The table on screen does not blink: it is the one that was vouched for,
    // exactly as it was, until another one has been.
    expect(audio.medida()).toBe(before);
  });

  it('asks the ancla for a pass out of turn, so the hold is a fraction of a beat', () => {
    const { audio, backend } = ready();

    void audio.measure();

    // The same hint the anillo ancho makes: the ancla owns its cadence and may
    // answer «at the usual second», which is why this is one request and not a
    // wait on one.
    expect(backend.beatRequests).toBe(1);
  });

  it('throws a waiting capture away the moment the sound changes underneath', async () => {
    const { audio, backend } = ready();

    const drawn = audio.measure();
    await Promise.resolve();
    await Promise.resolve();
    expect(audio.measuring()).toBe(true);

    backend.loadPerformance('Bright FM Keys');
    TestBed.tick();

    expect(await drawn).toBeNull();
    expect(audio.medida()).toBeNull();
    expect(audio.measuring()).toBe(false);
  });

  it('does not open a shutter nothing could vouch for: the ancla is switched off', async () => {
    const { audio, backend } = ready();

    await backend.setPolling(true);
    TestBed.tick();

    // #14's instrument exists so the app stops noticing a Performance change.
    // With it on no capture could ever be vouched for, so the shutter is dead
    // rather than producing a table nothing can ever draw.
    expect(audio.canMeasure()).toBe(false);
  });

  it('throws away a capture left waiting when the ancla is switched off under it', async () => {
    const { audio, backend } = ready();

    const drawn = audio.measure();
    await Promise.resolve();
    await Promise.resolve();
    expect(audio.measuring()).toBe(true);

    await backend.setPolling(true);
    TestBed.tick();

    // No beat is ever coming. Holding the capture would leave the shutter busy
    // for the rest of the session, waiting on something that is switched off.
    expect(await drawn).toBeNull();
    expect(audio.medida()).toBeNull();
    expect(audio.measuring()).toBe(false);
  });

  it('answers the press when the sound changes while the worker is still counting', async () => {
    const { audio, backend, worker } = ready();

    const drawn = audio.measure();
    // Before the worker has been handed anything: `measureWindow` is a promise
    // and the change lands in the microtask between the press and the table.
    backend.loadPerformance('Bright FM Keys');
    TestBed.tick();

    expect(await drawn).toBeNull();
    expect(audio.medida()).toBeNull();
    expect(audio.measuring()).toBe(false);
    // And the window is never even handed over: it is of a patch that is gone,
    // so there is no outcome it could have that anything would draw.
    expect(worker.measured).toBe(0);
    expect(audio.measureNote()).toBeNull();
  });

  it('still refuses before the ring has 1,5 s, and says so instead of waiting', async () => {
    const { audio, watching } = setUp();
    watching();
    TestBed.tick();

    // Nothing entered: the ring cannot serve the window, so there is no window
    // to vouch for and the aval never comes into it.
    expect(await audio.measure()).toBeNull();
    expect(audio.measuring()).toBe(false);
    expect(audio.measureNote()).toBe('not 1.5 s of audio yet');
  });
});

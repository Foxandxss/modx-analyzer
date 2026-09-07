import { TestBed } from '@angular/core/testing';
import { BLOCK_FRAMES, WATERFALL_FRAMES } from 'modx-dsp';
import { AUDIO_WORKER, AudioService } from './audio-service';
import { fakeBlock, heldNote } from './fake-block';
import { FakeAudioWorker } from './fake-audio-worker';
import { BACKEND_GATEWAY } from '../backend/backend-gateway';
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

  it('keeps the last fourteen tramas and no more: 462 ms of waterfall', () => {
    const { audio, hold } = setUp();

    hold(WATERFALL_FRAMES + 12);

    expect(audio.live.waterfall.length).toBe(WATERFALL_FRAMES);
    expect(audio.live.version).toBe(WATERFALL_FRAMES + 12);
  });

  it('adds no ridgeline for a trama with nothing in it', () => {
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
    expect(audio.live.trama.curve).toBeNull();
  });

  it('throws the medida away when the sound changes and does not bring it back', async () => {
    const { audio, backend, hold } = setUp();
    // 50 bloques of 1 323 frames: 66 150 samples, the first window with room.
    hold(50);
    backend.lowestLivePitch.set(60);
    TestBed.tick();
    await audio.measure();
    expect(audio.medida()).not.toBeNull();

    backend.loadPerformance('Bright FM Keys');
    TestBed.tick();

    expect(audio.medida()).toBeNull();
    expect(audio.measureNote()).toBe('la medida era de otro sonido');

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
    expect(audio.live.trama.curve).not.toBeNull();
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
    const { audio, backend, hold } = setUp();
    // 50 bloques of 1 323 frames: 66 150 samples, the first window with room.
    hold(50);
    backend.lowestLivePitch.set(60);
    TestBed.tick();
    await audio.measure();

    // The launch: the ancla answers for the first time. Nothing preceded it, so
    // there is nothing of a previous patch to throw away.
    backend.anchorReads('Init Normal (FM-X)');
    TestBed.tick();

    expect(audio.medida()).not.toBeNull();
    expect(audio.live.cuts).toHaveLength(0);
  });
});

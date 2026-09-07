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
});

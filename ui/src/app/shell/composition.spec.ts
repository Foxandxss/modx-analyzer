import { TestBed } from '@angular/core/testing';
import { AUDIO_WORKER, AudioService } from '../audio/audio-service';
import { FakeAudioWorker } from '../audio/fake-audio-worker';
import { BLOCK_FRAMES } from 'modx-dsp';
import { fakeBlock, heldNote } from '../audio/fake-block';
import { anchorAnswers, anchorWatching } from '../backend/anchor-driver';
import { BACKEND_GATEWAY } from '../backend/backend-gateway';
import { FakeBackendGateway } from '../backend/fake-backend-gateway';
import { ANCHOR_FLASH_MS } from '../provenance/anchor';
import { Clock } from '../provenance/clock';
import { KEEP_IT_BIG_KEY, Composition } from './composition';

/** 50 bloques of 1 323 frames: 66 150 samples, the first window with room. */
const BLOCKS_FOR_A_MEDIDA = 50;

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
  const composition = TestBed.inject(Composition);
  const clock = TestBed.inject(Clock);
  TestBed.tick();

  return {
    backend,
    audio,
    composition,
    clock,
    /** A vouched capture, which is the only kind that reaches the screen. */
    async capture(): Promise<void> {
      for (let sequence = 0; sequence < BLOCKS_FOR_A_MEDIDA; sequence += 1) {
        backend.emitBlock(
          fakeBlock({
            sequence,
            sentAtMicros: sequence * 30_000,
            mono: heldNote(261.626, sequence * BLOCK_FRAMES),
          }),
        );
      }
      backend.lowestLivePitch.set(60);
      anchorWatching(backend);
      TestBed.tick();
      const drawn = audio.measure();
      anchorAnswers(backend, 'same');
      await drawn;
      TestBed.tick();
    },
    /** Let the 2 200 ms flash run out, off the clock the ancla reads. */
    flashOver(): void {
      clock.now.set(performance.now() + ANCHOR_FLASH_MS + 1);
      TestBed.tick();
    },
  };
}

afterEach(() => localStorage.clear());

describe('Composition (8f)', () => {
  it('opens wide, because nothing has been measured and there is nothing to be beside', () => {
    const { composition } = setUp();

    expect(composition.wide()).toBe(true);
    expect(composition.panels()).toBe(false);
  });

  it('gives the room back the moment a vouched capture lands', async () => {
    const { composition, capture } = setUp();

    await capture();

    expect(composition.wide()).toBe(false);
    expect(composition.panels()).toBe(true);
  });

  it('stays wide for a capture the aval threw away', async () => {
    const { audio, backend, composition } = setUp();
    for (let sequence = 0; sequence < BLOCKS_FOR_A_MEDIDA; sequence += 1) {
      backend.emitBlock(
        fakeBlock({
          sequence,
          sentAtMicros: sequence * 30_000,
          mono: heldNote(261.626, sequence * BLOCK_FRAMES),
        }),
      );
    }
    backend.lowestLivePitch.set(60);
    anchorWatching(backend);
    TestBed.tick();

    const drawn = audio.measure();
    // Somebody turned the dial in the second before the press: the window is of
    // the sound that was, and it never becomes a table on screen.
    anchorAnswers(backend, 'changed', 'Bright FM Keys');
    expect(await drawn).toBeNull();
    TestBed.tick();

    expect(composition.wide()).toBe(true);
  });

  it('holds the big composition when KEEP IT BIG is down, capture or no capture', async () => {
    const { composition, capture } = setUp();
    composition.togglePin();
    TestBed.tick();

    await capture();

    expect(composition.pinned()).toBe(true);
    expect(composition.wide()).toBe(true);
    expect(composition.panels()).toBe(false);
  });

  it('lets the pin up and the panels come back to the capture that is still there', async () => {
    const { composition, capture } = setUp();
    composition.togglePin();
    await capture();

    composition.togglePin();
    TestBed.tick();

    expect(composition.wide()).toBe(false);
  });

  it('writes the pin through, so it is still down at the next launch', () => {
    const first = setUp();
    first.composition.togglePin();
    expect(localStorage.getItem(KEEP_IT_BIG_KEY)).toBe('on');

    // A relaunch: nothing of the session survives but what was written.
    TestBed.resetTestingModule();
    const second = setUp();

    expect(second.composition.pinned()).toBe(true);
    expect(second.composition.wide()).toBe(true);
  });

  /**
   * The one decision this ticket makes that the specification left conditional.
   * A Performance change already puts two things on screen — the 2 200 ms flash
   * and the relectura strip — and a panel resizing under them would be a third,
   * with nothing to say which of the three was about which.
   */
  it('does not grow back into the flash and the relectura strip', async () => {
    const { backend, composition, capture, flashOver } = setUp();
    await capture();
    expect(composition.wide()).toBe(false);

    // The sound is changed underneath: the medida dies at once.
    backend.loadPerformance('Bright FM Keys');
    backend.reread.set({ done: 12, total: 384, answered: 12, tookMs: null });
    TestBed.tick();
    expect(composition.wide()).toBe(false);

    // The flash runs out and the strip is still up. Still not yet.
    flashOver();
    expect(composition.wide()).toBe(false);

    // A pass that carries how long it took is a pass that arrived: the strip
    // goes and the algorithm takes the room.
    backend.reread.set({ done: 384, total: 384, answered: 383, tookMs: 912 });
    TestBed.tick();
    expect(composition.wide()).toBe(true);
  });

  it('grows back on the flash alone when no relectura follows the change', async () => {
    const { backend, composition, capture, flashOver } = setUp();
    await capture();

    backend.loadPerformance('Bright FM Keys');
    TestBed.tick();
    expect(composition.wide()).toBe(false);

    flashOver();
    expect(composition.wide()).toBe(true);
  });

  it('never waits to shrink: a capture during a relectura brings the panels back at once', async () => {
    const { backend, composition, capture } = setUp();
    backend.reread.set({ done: 12, total: 384, answered: 12, tookMs: null });
    TestBed.tick();

    await capture();

    expect(composition.wide()).toBe(false);
  });
});

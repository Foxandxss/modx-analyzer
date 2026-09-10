import { TestBed } from '@angular/core/testing';
import { AUDIO_WORKER, AudioService } from '../audio/audio-service';
import { FakeAudioWorker } from '../audio/fake-audio-worker';
import { BLOCK_FRAMES } from 'modx-dsp';
import { fakeBlock, heldNote } from '../audio/fake-block';
import { anchorAnswers, anchorWatching } from '../backend/anchor-driver';
import { BACKEND_GATEWAY } from '../backend/backend-gateway';
import { FakeBackendGateway } from '../backend/fake-backend-gateway';
import { FACTORY_PAIR, KEEP_IT_BIG_KEY, RANURAS_KEY, Composition } from './composition';

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
  TestBed.tick();

  return {
    backend,
    audio,
    composition,
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
  };
}

afterEach(() => localStorage.clear());

describe('Composition (8f)', () => {
  it('opens on the factory pair: the scope, and empty glass under it', () => {
    const { composition } = setUp();

    expect(composition.slots()).toEqual(FACTORY_PAIR);
    expect(composition.slots()).toEqual(['SCOPE', null]);
  });

  /**
   * The inversion ADR-0007 exists to record: the app used to open wide because
   * nothing had been measured, and now it opens narrow because the factory pair
   * puts a panel in the column.
   */
  it('opens narrow, because the factory pair is not both ranuras empty', () => {
    const { composition } = setUp();

    expect(composition.wide()).toBe(false);
    expect(composition.panels()).toBe(true);
  });

  it('is wide with both ranuras empty and narrow again the moment one is filled', () => {
    const { composition } = setUp();

    composition.choose(0, null);
    expect(composition.wide()).toBe(true);
    expect(composition.panels()).toBe(false);

    composition.choose(1, 'HARMONICS');
    expect(composition.wide()).toBe(false);
    expect(composition.slots()).toEqual([null, 'HARMONICS']);
  });

  /**
   * The retired behaviour, and the reason this ticket exists: nothing on this
   * screen moves any more that the pianist did not move. A capture used to be
   * what put the column on screen.
   */
  it('moves nothing when a capture lands', async () => {
    const { audio, composition, capture } = setUp();
    const before = composition.slots();

    await capture();

    expect(audio.medida()).not.toBeNull();
    expect(composition.slots()).toBe(before);
    expect(composition.wide()).toBe(false);
    expect(composition.strip()).toBe('WATERFALL');
  });

  it('moves nothing when a capture lands on both ranuras empty either', async () => {
    const { composition, capture } = setUp();
    composition.choose(0, null);
    expect(composition.wide()).toBe(true);

    await capture();

    expect(composition.wide()).toBe(true);
    expect(composition.panels()).toBe(false);
  });

  it('forces wide with KEEP IT BIG and gives the pair back exactly when it is let up', () => {
    const { composition } = setUp();
    composition.choose(1, 'SPECTRUM');
    const pair = composition.slots();

    composition.togglePin();

    expect(composition.pinned()).toBe(true);
    expect(composition.wide()).toBe(true);
    // The pin is a pin and not a mode: the pair it hides is the pair it keeps.
    expect(composition.slots()).toEqual(pair);

    composition.togglePin();

    expect(composition.wide()).toBe(false);
    expect(composition.slots()).toEqual(pair);
  });

  it('swaps the two when the panel chosen is the one the other ranura holds', () => {
    const { composition } = setUp();
    composition.choose(1, 'SPECTRUM');
    expect(composition.slots()).toEqual(['SCOPE', 'SPECTRUM']);

    // Asking the top ranura for what the bottom one holds is also the only way
    // to reorder the pair, and «no panel in both» holds by construction.
    composition.choose(0, 'SPECTRUM');

    expect(composition.slots()).toEqual(['SPECTRUM', 'SCOPE']);
  });

  it('never leaves one panel in both ranuras, whichever way round it is asked', () => {
    const { composition } = setUp();
    composition.choose(0, 'WATERFALL');
    composition.choose(1, 'HARMONICS');

    composition.choose(1, 'WATERFALL');

    expect(composition.slots()).toEqual(['HARMONICS', 'WATERFALL']);
  });

  it('empties one ranura without touching the other', () => {
    const { composition } = setUp();
    composition.choose(1, 'HARMONICS');

    composition.choose(0, null);

    expect(composition.slots()).toEqual([null, 'HARMONICS']);
  });

  it('hands the bottom strip its waterfall back when the pair takes it out again', () => {
    const { composition } = setUp();
    expect(composition.strip()).toBe('WATERFALL');

    composition.choose(1, 'WATERFALL');
    // One signal is never drawn twice in one frame.
    expect(composition.strip()).toBeNull();

    composition.choose(1, null);
    expect(composition.strip()).toBe('WATERFALL');
  });

  /**
   * «One place at a time» was never an argument for none. The pin takes the
   * whole column off screen without touching the stored pair, so the ranura that
   * holds the waterfall is not drawing it and the strip is where it goes.
   */
  it('gives the waterfall back to the strip while KEEP IT BIG hides the ranura holding it', () => {
    const { composition } = setUp();
    composition.choose(0, 'WATERFALL');
    expect(composition.strip()).toBeNull();

    composition.togglePin();

    expect(composition.strip()).toBe('WATERFALL');
    expect(composition.slots()).toEqual(['WATERFALL', null]);

    composition.togglePin();
    expect(composition.strip()).toBeNull();
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

  it('writes the pair through on the same path, so the app opens on it', () => {
    const first = setUp();
    first.composition.choose(0, 'SPECTRUM');
    first.composition.choose(1, 'HARMONICS');
    expect(localStorage.getItem(RANURAS_KEY)).toBe('SPECTRUM,HARMONICS');

    TestBed.resetTestingModule();
    const second = setUp();

    expect(second.composition.slots()).toEqual(['SPECTRUM', 'HARMONICS']);
    expect(second.composition.wide()).toBe(false);
  });

  it('remembers both ranuras empty, which is a pair and not a missing one', () => {
    const first = setUp();
    first.composition.choose(0, null);
    expect(localStorage.getItem(RANURAS_KEY)).toBe(',');

    TestBed.resetTestingModule();
    const second = setUp();

    expect(second.composition.slots()).toEqual([null, null]);
    expect(second.composition.wide()).toBe(true);
  });

  it('falls back to the factory pair for storage this build cannot read', () => {
    for (const stored of ['', 'SCOPE', 'SCOPE,HARMONICS,WATERFALL', 'SCOPE,BODE PLOT', '{}']) {
      localStorage.setItem(RANURAS_KEY, stored);
      TestBed.resetTestingModule();
      const { composition } = setUp();

      expect(composition.slots()).toEqual(FACTORY_PAIR);
      // And it costs nothing else: the pin beside it is read on its own line.
      expect(composition.pinned()).toBe(false);
    }
  });
});

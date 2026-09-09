import { TestBed } from '@angular/core/testing';
import { BLOCK_FRAMES } from 'modx-dsp';
import { AUDIO_WORKER, AudioService } from '../../audio/audio-service';
import { fakeBlock, heldNote, withComb } from '../../audio/fake-block';
import { FakeAudioWorker } from '../../audio/fake-audio-worker';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { FakeBackendGateway } from '../../backend/fake-backend-gateway';
import { DEAD_MARK } from '../../provenance/provenance';
import { SignalViews } from './signal-views';

async function renderViews() {
  const backend = new FakeBackendGateway();
  TestBed.configureTestingModule({
    imports: [SignalViews],
    providers: [
      { provide: BACKEND_GATEWAY, useValue: backend },
      { provide: AUDIO_WORKER, useValue: () => new FakeAudioWorker() },
    ],
  });
  const fixture = TestBed.createComponent(SignalViews);
  TestBed.inject(AudioService).start();
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;

  return {
    backend,
    fixture,
    host,
    /** Hold a note for `blocks` bloques, with or without the generator's comb. */
    async hold(frequency: number, { comb = false, blocks = 10 } = {}) {
      for (let sequence = 0; sequence < blocks; sequence += 1) {
        const start = sequence * BLOCK_FRAMES;
        const note = heldNote(frequency, start);
        backend.emitBlock(
          fakeBlock({
            sequence,
            sentAtMicros: sequence * 30_000,
            mono: comb ? withComb(note, start) : note,
          }),
        );
      }
      await fixture.whenStable();
    },
    text: (selector: string) => host.querySelector(selector)?.textContent?.trim() ?? null,
  };
}

describe('SignalViews', () => {
  it('draws both live panels with their canvases from the first frame', async () => {
    const { host } = await renderViews();

    expect(host.querySelector('app-spectrum canvas')).not.toBeNull();
    expect(host.querySelector('app-harmonics canvas')).not.toBeNull();
  });

  it('says the axis is multiples of the note and not hertz', async () => {
    const { text } = await renderViews();

    expect(text('.view__readout')).toContain('LOG 1×–32×');
  });

  it('claims no floor and no rate before a single bloque', async () => {
    const { text } = await renderViews();

    expect(text('.view__readout')).toContain(`FLOOR ${DEAD_MARK} dBFS`);
    expect(text('.view__live')).toBe(`LIVE · ${DEAD_MARK} fps`);
  });

  it('reports the noise floor it measured while a note is held', async () => {
    const { hold, text } = await renderViews();

    await hold(261.626);

    // A synthetic tone has no floor to speak of; what is asserted is that the
    // readout stopped being a dash and became a level in dBFS, which is what
    // `FLOOR` means everywhere — the level-independence of that reading is the
    // DSP package's test, on a signal that has a floor.
    expect(text('.view__readout')).toMatch(/FLOOR -\d+ dBFS/);
  });

  it('names the comb with its frequency instead of hiding it', async () => {
    const { hold, text } = await renderViews();

    await hold(261.626, { comb: true });

    // **Never a badge without its number**: the hertz is what tells the
    // generator's comb apart from a harmonic of the mains or from aliasing.
    expect(text('.view__artefact')).toBe('NOT A HARMONIC · 2756 Hz');
  });

  it('does not put an artefact chip on a sound that has no comb in it', async () => {
    const { hold, host } = await renderViews();

    await hold(261.626);

    expect(host.querySelector('.view__artefact')).toBeNull();
  });
});

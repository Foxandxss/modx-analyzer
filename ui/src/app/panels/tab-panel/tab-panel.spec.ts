import { TestBed } from '@angular/core/testing';
import { BLOCK_FRAMES } from 'modx-dsp';
import { AUDIO_WORKER, AudioService } from '../../audio/audio-service';
import { fakeBlock, heldNote } from '../../audio/fake-block';
import { FakeAudioWorker } from '../../audio/fake-audio-worker';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { FakeBackendGateway } from '../../backend/fake-backend-gateway';
import { TabPanel } from './tab-panel';

/** One bloque with no period in it at all, loud enough to clear the floor. */
function noise(seed: number): Float32Array {
  const mono = new Float32Array(BLOCK_FRAMES);
  let state = seed * 7919 + 1;
  for (let index = 0; index < mono.length; index += 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    mono[index] = (state / 0x3fffffff - 1) * 0.5;
  }
  return mono;
}

async function renderPanel() {
  const backend = new FakeBackendGateway();
  TestBed.configureTestingModule({
    imports: [TabPanel],
    providers: [
      { provide: BACKEND_GATEWAY, useValue: backend },
      { provide: AUDIO_WORKER, useValue: () => new FakeAudioWorker() },
    ],
  });
  const fixture = TestBed.createComponent(TabPanel);
  TestBed.inject(AudioService).start();
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;

  return {
    backend,
    fixture,
    host,
    async selectScope() {
      const tabs = [...host.querySelectorAll<HTMLButtonElement>('.tabs__tab')];
      tabs.find((tab) => tab.textContent?.trim() === 'SCOPE')?.click();
      await fixture.whenStable();
    },
    /**
     * The keyboard holding a note and the sound of it arriving, which are two
     * separate facts: the scope locks to the first and verifies against the
     * second. `pitches` is how many keys are down; `pitch` is the MIDI note the
     * lock is granted at, `null` for audio with no keyboard behind it.
     */
    async holdNote(frequency: number, pitch: number | null = 60, pitches = pitch === null ? 0 : 1) {
      backend.lowestLivePitch.set(pitch);
      backend.liveNotes.set(pitches);
      await fixture.whenStable();
      for (let sequence = 0; sequence < 9; sequence += 1) {
        backend.emitBlock(
          fakeBlock({
            sequence,
            sentAtMicros: sequence * 30_000,
            mono: heldNote(frequency, sequence * BLOCK_FRAMES),
          }),
        );
      }
      await fixture.whenStable();
    },
    note: () => host.querySelector('.tabs__note')?.textContent?.trim() ?? '',
  };
}

describe('TabPanel', () => {
  it('opens on the waterfall and shows the scope on request', async () => {
    const { host, selectScope } = await renderPanel();

    expect(host.querySelector('app-scope')).toBeNull();
    expect(host.querySelector('app-waterfall canvas')).not.toBeNull();

    await selectScope();

    expect(host.querySelector('app-scope')).not.toBeNull();
    expect(host.querySelector('app-waterfall')).toBeNull();
  });

  it('shows the waterfall as soon as a note is live', async () => {
    const { backend, fixture, host } = await renderPanel();

    backend.liveNotes.set(1);
    await fixture.whenStable();

    expect(host.querySelector('app-waterfall')).not.toBeNull();
  });

  it('keeps the scope for as long as the note that asked for it lasts', async () => {
    const { backend, fixture, host, selectScope } = await renderPanel();
    backend.liveNotes.set(2);
    await fixture.whenStable();

    await selectScope();
    backend.liveNotes.set(1);
    await fixture.whenStable();

    // A tab that snapped back under a held chord would be the app arguing.
    expect(host.querySelector('app-scope')).not.toBeNull();

    backend.liveNotes.set(0);
    await fixture.whenStable();

    // The request expires with the phrase: the next note starts on the waterfall.
    expect(host.querySelector('app-waterfall')).not.toBeNull();
  });

  it('has no enganche before any audio, and says which of the three it is', async () => {
    const { selectScope, note } = await renderPanel();

    await selectScope();

    expect(note()).toBe('NO LOCK · no held note');
  });

  it('says the note, the count of cycles and the window while one note is held', async () => {
    const { selectScope, holdNote, note } = await renderPanel();
    await selectScope();

    // C4 at equal temperament, which is what the keyboard's pitch 60 is worth.
    await holdNote(261.626, 60);

    expect(note()).toBe('LOCKED 261.63 Hz · 4 CYCLES · 15.3 ms');
  });

  it('refuses under a chord: two pitches have no fundamental between them', async () => {
    const { selectScope, holdNote, note } = await renderPanel();
    await selectScope();

    await holdNote(261.626, 60, 3);

    expect(note()).toBe('NO LOCK · MORE THAN ONE NOTE');
  });

  it('refuses when the held note is not in what is arriving', async () => {
    const { selectScope, holdNote, backend, fixture, note } = await renderPanel();
    await selectScope();
    // A key down over something with no period in it: an enganche here would be
    // standing a shape still that the audio does not have.
    await holdNote(261.626, 60);

    for (let sequence = 9; sequence < 18; sequence += 1) {
      backend.emitBlock(
        fakeBlock({ sequence, sentAtMicros: sequence * 30_000, mono: noise(sequence) }),
      );
    }
    await fixture.whenStable();

    expect(note()).toBe('NO LOCK · pitch unstable');
  });

  it('says the audio is under the floor rather than drawing the floor', async () => {
    const { selectScope, holdNote, backend, fixture, note } = await renderPanel();
    await selectScope();
    await holdNote(261.626, 60);

    for (let sequence = 9; sequence < 18; sequence += 1) {
      backend.emitBlock(fakeBlock({ sequence, sentAtMicros: sequence * 30_000 }));
    }
    await fixture.whenStable();

    expect(note()).toBe('SIGNAL BELOW FLOOR');
  });
});

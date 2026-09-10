import { TestBed } from '@angular/core/testing';
import { BLOCK_FRAMES } from 'modx-dsp';
import { AUDIO_WORKER, AudioService } from '../../audio/audio-service';
import { fakeBlock, heldNote } from '../../audio/fake-block';
import { FakeAudioWorker } from '../../audio/fake-audio-worker';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { FakeBackendGateway } from '../../backend/fake-backend-gateway';
import { BottomStrip } from './bottom-strip';

async function renderStrip() {
  const backend = new FakeBackendGateway();
  TestBed.configureTestingModule({
    imports: [BottomStrip],
    providers: [
      { provide: BACKEND_GATEWAY, useValue: backend },
      { provide: AUDIO_WORKER, useValue: () => new FakeAudioWorker() },
    ],
  });
  const fixture = TestBed.createComponent(BottomStrip);
  TestBed.inject(AudioService).start();
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;

  return {
    backend,
    fixture,
    host,
    /** One phrase, drawn as ridgelines, with the bloque numbers it is played on. */
    async play(from: number, to: number, frequency = 261.626) {
      backend.lowestLivePitch.set(60);
      backend.liveNotes.set(1);
      await fixture.whenStable();
      for (let sequence = from; sequence < to; sequence += 1) {
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
    note: () => host.querySelector('.head__note')?.textContent?.trim() ?? '',
  };
}

describe('BottomStrip', () => {
  it('draws the waterfall and nothing to choose between', async () => {
    const { host } = await renderStrip();

    expect(host.querySelector('app-waterfall canvas')).not.toBeNull();
    // The strip stopped being a tab panel when the scope got a home that
    // persists: one view or none, and a strip with one tab argues with nothing.
    expect(host.querySelector('[role="tab"]')).toBeNull();
    expect(host.querySelector('app-scope')).toBeNull();
    expect(host.querySelector('.head__title')?.textContent?.trim()).toBe('WATERFALL');
  });

  it('names the two axes of the picture, which is its only legend', async () => {
    const { host } = await renderStrip();

    expect(host.querySelector('.head__axes')?.textContent?.trim()).toBe('TIME ↓ · FREQUENCY →');
  });

  it('counts no frames before anything has been drawn, and states no span', async () => {
    const { note } = await renderStrip();

    // A picture of nothing has no first row and no last: `0 → 0 ms` would be a
    // figure standing where there is no measurement.
    expect(note()).toBe('WATERFALL · 0 FRAMES');
  });

  it('counts up from one frame, with the span the rows themselves report', async () => {
    const { play, note } = await renderStrip();

    await play(0, 1);
    expect(note()).toBe('WATERFALL · 1 FRAMES · 0 → 0 ms');

    await play(1, 9);
    expect(note()).toBe('WATERFALL · 9 FRAMES · 0 → 240 ms');
  });
});

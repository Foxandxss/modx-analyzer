import { TestBed } from '@angular/core/testing';
import { BLOCK_FRAMES } from 'modx-dsp';
import { AUDIO_WORKER, AudioService } from '../../audio/audio-service';
import { fakeBlock, heldNote } from '../../audio/fake-block';
import { FakeAudioWorker } from '../../audio/fake-audio-worker';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { FakeBackendGateway } from '../../backend/fake-backend-gateway';
import { TabPanel } from './tab-panel';

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
    async holdNote(frequency: number, blocks = 5) {
      for (let sequence = 0; sequence < blocks; sequence += 1) {
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

    await selectScope();

    expect(host.querySelector('app-scope')).not.toBeNull();
  });

  it('says the scope has nothing to trigger on before any audio', async () => {
    const { selectScope, note } = await renderPanel();

    await selectScope();

    expect(note()).toBe('TRIGGER ↑0 · 2 CICLOS · — Hz');
  });

  it('says at what frequency it triggered while a note is held', async () => {
    const { selectScope, holdNote, note } = await renderPanel();
    await selectScope();

    await holdNote(261.626);

    expect(note()).toMatch(/^TRIGGER ↑0 · 2 CICLOS · 26[12]\.\d Hz$/);
  });

  it('goes back to the dash when the audio is digital silence', async () => {
    const { selectScope, holdNote, backend, fixture, note } = await renderPanel();
    await selectScope();
    await holdNote(261.626);

    for (let sequence = 5; sequence < 10; sequence += 1) {
      backend.emitBlock(fakeBlock({ sequence, sentAtMicros: sequence * 30_000 }));
    }
    await fixture.whenStable();

    expect(note()).toBe('TRIGGER ↑0 · 2 CICLOS · — Hz');
  });
});

import { TestBed } from '@angular/core/testing';
import { BLOCK_FRAMES } from 'modx-dsp';
import { AUDIO_WORKER, AudioService } from '../../audio/audio-service';
import { fakeBlock, heldNote } from '../../audio/fake-block';
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

  it('shows the spread of the delivery once bloques have arrived', async () => {
    const { push } = await renderReadout();

    const text = await push(
      ...[0, 1, 2, 3].map((sequence) => fakeBlock({ sequence, sentAtMicros: sequence * 30_000 })),
    );

    expect(text).toMatch(/p50 \d+\.\d ms/);
    expect(text).toMatch(/p99 \d+\.\d ms/);
  });

  it('says «sin audio» only when Rust saw exact digital zeros for a second', async () => {
    const { push, text } = await renderReadout();

    await push(fakeBlock({ sequence: 0, mono: new Float32Array(BLOCK_FRAMES) }));
    expect(text()).not.toContain('SIN AUDIO');

    await push(fakeBlock({ sequence: 1, silent: true }));
    expect(text()).toContain('SIN AUDIO · CEROS EXACTOS');
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
});

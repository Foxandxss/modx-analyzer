import { TestBed } from '@angular/core/testing';
import { BLOCK_FRAMES } from 'modx-dsp';
import { AUDIO_WORKER, AudioService } from '../../audio/audio-service';
import { FakeAudioWorker } from '../../audio/fake-audio-worker';
import { fakeBlock, heldNote } from '../../audio/fake-block';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { FakeBackendGateway } from '../../backend/fake-backend-gateway';
import { Harmonics } from './harmonics';

/** Every drawing call the panel makes, in order, plus the dashes it asked for. */
interface Recorder {
  readonly calls: string[];
  readonly dashes: number[][];
  readonly context: CanvasRenderingContext2D;
}

function recorder(): Recorder {
  const calls: string[] = [];
  const dashes: number[][] = [];
  const context = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    beginPath: () => calls.push('beginPath'),
    moveTo: () => calls.push('moveTo'),
    lineTo: () => calls.push('lineTo'),
    stroke: () => calls.push('stroke'),
    fillRect: () => calls.push('fillRect'),
    setLineDash: (pattern: number[]) => dashes.push(pattern),
  };

  return { calls, dashes, context: context as unknown as CanvasRenderingContext2D };
}

/** jsdom computes no styles for a canvas; the panel's fallbacks are what paint. */
const noStyles = {
  getPropertyValue: () => '',
} as unknown as CSSStyleDeclaration;

async function renderHarmonics() {
  const backend = new FakeBackendGateway();
  TestBed.configureTestingModule({
    imports: [Harmonics],
    providers: [
      { provide: BACKEND_GATEWAY, useValue: backend },
      { provide: AUDIO_WORKER, useValue: () => new FakeAudioWorker() },
    ],
  });
  const fixture = TestBed.createComponent(Harmonics);
  TestBed.inject(AudioService).start();
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;

  // One running sequence for the whole test, so a phrase and the silence after
  // it are the same stream and not two: the bridge counts gaps, and the note's
  // phase carries across the blocks the way a held key does.
  let sequence = 0;
  const emit = (mono?: Float32Array) => {
    backend.emitBlock(fakeBlock({ sequence, sentAtMicros: sequence * 30_000, mono }));
    sequence += 1;
  };

  return {
    host,
    async hold(frequency: number, blocks = 10) {
      for (let block = 0; block < blocks; block += 1) {
        emit(heldNote(frequency, sequence * BLOCK_FRAMES));
      }
      await fixture.whenStable();
    },
    /** The key let go: blocks of digital zeros, which is no note and no bars. */
    async silence(blocks = 10) {
      for (let block = 0; block < blocks; block += 1) {
        emit();
      }
      await fixture.whenStable();
    },
    /** One frame, painted into a recorder instead of onto a canvas jsdom has not. */
    draw() {
      const drawn = recorder();
      const panel = fixture.componentInstance as unknown as {
        paint(
          context: CanvasRenderingContext2D,
          width: number,
          height: number,
          styles: CSSStyleDeclaration,
        ): void;
      };
      panel.paint(drawn.context, 400, 150, noStyles);
      return drawn;
    },
  };
}

describe('Harmonics', () => {
  it('says the bars are MEASURED, and says nothing else', async () => {
    const { hold, host } = await renderHarmonics();

    await hold(261.626);

    expect(host.querySelector('.legend')?.textContent?.trim()).toBe('MEASURED');
    expect(host.textContent).not.toContain('PREDICTED');
  });

  // A stamp beside nothing labels the nothing: `MEASURED` is what the bars are,
  // and with no note there are no bars for it to be about.
  it('writes no legend at all while there are no bars', async () => {
    const { host } = await renderHarmonics();

    expect(host.querySelector('.legend')).toBeNull();
    expect(host.textContent).not.toContain('MEASURED');
  });

  it('takes the legend away again when the note goes', async () => {
    const { hold, silence, host } = await renderHarmonics();

    await hold(261.626);
    expect(host.querySelector('.legend')).not.toBeNull();

    await silence();
    expect(host.querySelector('.legend')).toBeNull();
  });

  // No fit, no fitted index, no Level→index mapping: the dashed Bessel curve
  // would be arithmetic on an invented number laid over sixteen measured bars.
  it('draws no dashed curve before a note is held', async () => {
    const { draw } = await renderHarmonics();

    const drawn = draw();

    expect(drawn.dashes).toEqual([]);
    // The one stroke is the axis the bars stand on. Nothing else is drawn.
    expect(drawn.calls.filter((call) => call === 'stroke')).toHaveLength(1);
    expect(drawn.calls).not.toContain('fillRect');
  });

  it('draws bars and still no dashed curve with a note held', async () => {
    const { hold, draw } = await renderHarmonics();

    await hold(261.626);
    const drawn = draw();

    expect(drawn.calls.filter((call) => call === 'fillRect').length).toBeGreaterThan(0);
    expect(drawn.dashes).toEqual([]);
    expect(drawn.calls.filter((call) => call === 'stroke')).toHaveLength(1);
  });
});

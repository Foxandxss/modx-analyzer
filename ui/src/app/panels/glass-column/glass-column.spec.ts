import { TestBed } from '@angular/core/testing';
import { BLOCK_FRAMES } from 'modx-dsp';
import { AUDIO_WORKER, AudioService } from '../../audio/audio-service';
import { fakeBlock, heldNote, withComb } from '../../audio/fake-block';
import { FakeAudioWorker } from '../../audio/fake-audio-worker';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { FakeBackendGateway } from '../../backend/fake-backend-gateway';
import { DEAD_MARK } from '../../provenance/provenance';
import { Composition, Ranura, RanuraIndex } from '../../shell/composition';
import { GlassColumn } from './glass-column';
import { EMPTY_LABEL } from './ranura-chooser';

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

async function renderColumn(pair: readonly [Ranura, Ranura] = ['SPECTRUM', 'HARMONICS']) {
  const backend = new FakeBackendGateway();
  TestBed.configureTestingModule({
    imports: [GlassColumn],
    providers: [
      { provide: BACKEND_GATEWAY, useValue: backend },
      { provide: AUDIO_WORKER, useValue: () => new FakeAudioWorker() },
    ],
  });
  const composition = TestBed.inject(Composition);
  composition.choose(0, pair[0]);
  composition.choose(1, pair[1]);
  const fixture = TestBed.createComponent(GlassColumn);
  TestBed.inject(AudioService).start();
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;

  return {
    backend,
    composition,
    fixture,
    host,
    settle: () => fixture.whenStable(),
    async put(ranura: RanuraIndex, view: Ranura) {
      composition.choose(ranura, view);
      await fixture.whenStable();
    },
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
    /**
     * The keyboard holding a note and the sound of it arriving, which are two
     * separate facts: the scope locks to the first and verifies against the
     * second. `pitches` is how many keys are down; `pitch` is the MIDI note the
     * lock is granted at, `null` for audio with no keyboard behind it.
     */
    async holdForScope(frequency: number, pitch: number | null = 60, pitches = 1) {
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
    /**
     * The two titles, which are the two choosers. There are always two: an empty
     * ranura says {@link EMPTY_LABEL} rather than saying nothing, because the
     * title is the only way back into that half.
     */
    titles: () =>
      [...host.querySelectorAll('.chooser__name')].map((title) => title.textContent?.trim()),
    /** Open the chooser of one ranura and read the list it offers. */
    async openChooser(ranura: RanuraIndex) {
      const buttons = host.querySelectorAll<HTMLButtonElement>('.chooser');
      buttons[ranura].click();
      await fixture.whenStable();
      const menu = host.querySelectorAll('.view')[ranura].querySelector('.menu');
      return [...(menu?.querySelectorAll<HTMLButtonElement>('.menu__item') ?? [])];
    },
    readouts: () =>
      [...host.querySelectorAll('.view__readout')].map((line) => line.textContent?.trim()),
    text: (selector: string) => host.querySelector(selector)?.textContent?.trim() ?? null,
  };
}

afterEach(() => localStorage.clear());

describe('GlassColumn', () => {
  it('draws the two ranuras and the panel each one holds', async () => {
    const { host, titles } = await renderColumn(['SCOPE', 'WATERFALL']);

    expect(titles()).toEqual(['SCOPE', 'WATERFALL']);
    expect(host.querySelector('app-scope canvas')).not.toBeNull();
    expect(host.querySelector('app-waterfall canvas')).not.toBeNull();
  });

  /**
   * Fixed geometry: the top half is the top half whatever the other one holds.
   * An empty ranura is empty glass — the section is still drawn, with nothing in
   * it — and not room the other panel takes.
   */
  it('keeps both ranuras drawn when one of them is empty', async () => {
    const { host, titles } = await renderColumn(['SCOPE', null]);

    expect(host.querySelectorAll('.view')).toHaveLength(2);
    expect(titles()).toEqual(['SCOPE', EMPTY_LABEL]);
    // Empty glass: the frame is drawn and there is nothing painting inside it.
    const empty = host.querySelectorAll('.view')[1];
    expect(empty.querySelector('.view__frame')?.children).toHaveLength(0);
    expect(empty.querySelector('.view__readout')).toBeNull();
  });

  it('puts a panel in a ranura and takes it out again without touching the other', async () => {
    const { host, titles, put } = await renderColumn(['SCOPE', null]);

    await put(1, 'HARMONICS');
    expect(titles()).toEqual(['SCOPE', 'HARMONICS']);
    expect(host.querySelector('app-harmonics canvas')).not.toBeNull();

    await put(1, null);
    expect(titles()).toEqual(['SCOPE', EMPTY_LABEL]);
    expect(host.querySelector('app-harmonics')).toBeNull();
    expect(host.querySelector('app-scope canvas')).not.toBeNull();
  });

  /**
   * The control for a panel is where the panel is: its own title. Five entries,
   * the same five in both ranuras, and **none greyed** — choosing what the other
   * half holds swaps them, so there is nothing the chooser has to refuse and
   * therefore nothing it would have to explain.
   */
  it('offers the same five entries in both ranuras, none of them greyed', async () => {
    const { openChooser } = await renderColumn(['SPECTRUM', 'HARMONICS']);

    for (const ranura of [0, 1] as const) {
      const entries = await openChooser(ranura);
      expect(entries.map((entry) => entry.textContent?.trim())).toEqual([
        'SPECTRUM',
        'HARMONICS',
        'SCOPE',
        'WATERFALL',
        EMPTY_LABEL,
      ]);
      expect(entries.some((entry) => entry.disabled)).toBe(false);
    }
  });

  it('is the panel title that opens it, caret and all', async () => {
    const { host, titles } = await renderColumn(['SPECTRUM', null]);

    const chooser = host.querySelector('.chooser')!;
    expect(titles()[0]).toBe('SPECTRUM');
    // No space between them in the markup: the air is the flex gap, so the
    // caret cannot be left behind on a line of its own.
    expect(chooser.textContent?.replace(/\s+/g, '')).toBe('SPECTRUM▾');
    expect(chooser.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector('.view__title')?.tagName).toBe('H2');
  });

  it('puts the chosen panel in the ranura whose title was pressed', async () => {
    const { openChooser, titles, settle } = await renderColumn(['SPECTRUM', null]);

    (await openChooser(1))[2].click();
    await settle();

    expect(titles()).toEqual(['SPECTRUM', 'SCOPE']);
  });

  /** The chooser never refuses: the panel the other half holds changes places. */
  it('swaps the two when the panel chosen is the one the other half holds', async () => {
    const { openChooser, titles, settle } = await renderColumn(['SPECTRUM', 'SCOPE']);

    (await openChooser(0))[2].click();
    await settle();

    expect(titles()).toEqual(['SCOPE', 'SPECTRUM']);
  });

  it('gives an empty ranura the title that fills it again', async () => {
    const { openChooser, titles, settle } = await renderColumn(['SCOPE', null]);

    expect(titles()[1]).toBe(EMPTY_LABEL);
    (await openChooser(1))[1].click();
    await settle();

    expect(titles()).toEqual(['SCOPE', 'HARMONICS']);
  });

  it('draws both live canvases from the first frame', async () => {
    const { host } = await renderColumn();

    expect(host.querySelector('app-spectrum canvas')).not.toBeNull();
    expect(host.querySelector('app-harmonics canvas')).not.toBeNull();
  });

  it('says the axis is multiples of the note and not hertz', async () => {
    const { readouts } = await renderColumn();

    expect(readouts()[0]).toContain('LOG 1×–32×');
    expect(readouts()[1]).toBe('n1 … n16');
  });

  it('claims no floor and no rate before a single bloque', async () => {
    const { readouts, text } = await renderColumn();

    expect(readouts()[0]).toContain(`FLOOR ${DEAD_MARK} dBFS`);
    expect(text('.view__live')).toBe(`LIVE · ${DEAD_MARK} fps`);
  });

  it('reports the noise floor it measured while a note is held', async () => {
    const { hold, readouts } = await renderColumn();

    await hold(261.626);

    // A synthetic tone has no floor to speak of; what is asserted is that the
    // readout stopped being a dash and became a level in dBFS, which is what
    // `FLOOR` means everywhere — the level-independence of that reading is the
    // DSP package's test, on a signal that has a floor.
    expect(readouts()[0]).toMatch(/FLOOR -\d+ dBFS/);
  });

  it('names the comb with its frequency instead of hiding it', async () => {
    const { hold, text } = await renderColumn();

    await hold(261.626, { comb: true });

    // **Never a badge without its number**: the hertz is what tells the
    // generator's comb apart from a harmonic of the mains or from aliasing. The
    // chip takes it as a required input, so this is the only shape it has.
    expect(text('app-not-a-harmonic')).toBe('NOT A HARMONIC · 2756 Hz');
  });

  it('does not put an artefact chip on a sound that has no comb in it', async () => {
    const { hold, host } = await renderColumn();

    await hold(261.626);

    expect(host.querySelector('app-not-a-harmonic')).toBeNull();
  });

  it('keeps the artefact chip on the spectrum, wherever the spectrum is', async () => {
    const { hold, host } = await renderColumn(['HARMONICS', 'SPECTRUM']);

    await hold(261.626, { comb: true });

    // The chip belongs to the panel and not to the ranura: it is the espectro's
    // reading, so it goes wherever the espectro went.
    expect(host.querySelectorAll('app-not-a-harmonic')).toHaveLength(1);
    const views = host.querySelectorAll('.view');
    expect(views[1].querySelector('app-not-a-harmonic')).not.toBeNull();
  });

  // The dashed overlay belongs to the fit, and the fit does not exist. A legend
  // naming a curve nobody drew sends the eye hunting for it.
  it('offers only the MEASURED legend on the harmonics panel', async () => {
    const { hold, host } = await renderColumn();

    await hold(261.626);

    expect(host.querySelector('app-harmonics .legend')?.textContent?.trim()).toBe('MEASURED');
    expect(host.textContent).not.toContain('PREDICTED');
  });

  it('has no enganche before any audio, and says which of the three it is', async () => {
    const { readouts } = await renderColumn(['SCOPE', null]);

    expect(readouts()[0]).toBe('NO LOCK · no held note');
  });

  it('says the note, the count of cycles and the window while one note is held', async () => {
    const { holdForScope, readouts } = await renderColumn(['SCOPE', null]);

    // C4 at equal temperament, which is what the keyboard's pitch 60 is worth.
    await holdForScope(261.626, 60);

    expect(readouts()[0]).toBe('LOCKED 261.63 Hz · 4 CYCLES · 15.3 ms');
  });

  it('refuses under a chord: two pitches have no fundamental between them', async () => {
    const { holdForScope, readouts } = await renderColumn(['SCOPE', null]);

    await holdForScope(261.626, 60, 3);

    expect(readouts()[0]).toBe('NO LOCK · MORE THAN ONE NOTE');
  });

  it('refuses when the held note is not in what is arriving', async () => {
    const { holdForScope, backend, fixture, readouts } = await renderColumn(['SCOPE', null]);
    // A key down over something with no period in it: an enganche here would be
    // standing a shape still that the audio does not have.
    await holdForScope(261.626, 60);

    for (let sequence = 9; sequence < 18; sequence += 1) {
      backend.emitBlock(
        fakeBlock({ sequence, sentAtMicros: sequence * 30_000, mono: noise(sequence) }),
      );
    }
    await fixture.whenStable();

    expect(readouts()[0]).toBe('NO LOCK · pitch unstable');
  });

  it('says the audio is under the floor rather than drawing the floor', async () => {
    const { holdForScope, backend, fixture, readouts } = await renderColumn(['SCOPE', null]);
    await holdForScope(261.626, 60);

    for (let sequence = 9; sequence < 18; sequence += 1) {
      backend.emitBlock(fakeBlock({ sequence, sentAtMicros: sequence * 30_000 }));
    }
    await fixture.whenStable();

    expect(readouts()[0]).toBe('SIGNAL BELOW FLOOR');
  });

  /**
   * One wording, one function: the caption of a panel does not depend on
   * whether the panel is up in a ranura or down in the bottom strip.
   */
  it('gives the waterfall in a ranura the caption the strip gives it', async () => {
    const { backend, fixture, readouts, host } = await renderColumn(['WATERFALL', null]);

    expect(readouts()[0]).toBe('WATERFALL · 0 FRAMES');
    expect(host.querySelector('.view__axes')?.textContent?.trim()).toBe('TIME ↓ · FREQUENCY →');

    backend.lowestLivePitch.set(60);
    backend.liveNotes.set(1);
    await fixture.whenStable();
    for (let sequence = 0; sequence < 9; sequence += 1) {
      backend.emitBlock(
        fakeBlock({
          sequence,
          sentAtMicros: sequence * 30_000,
          mono: heldNote(261.626, sequence * BLOCK_FRAMES),
        }),
      );
    }
    await fixture.whenStable();

    expect(readouts()[0]).toBe('WATERFALL · 9 FRAMES · 0 → 240 ms');
  });
});

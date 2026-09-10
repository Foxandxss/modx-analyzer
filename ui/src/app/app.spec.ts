import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BLOCK_FRAMES } from 'modx-dsp';
import { App } from './app';
import { AUDIO_WORKER, AudioService } from './audio/audio-service';
import { fakeBlock, heldNote } from './audio/fake-block';
import { FakeAudioWorker } from './audio/fake-audio-worker';
import { anchorAnswers, anchorWatching } from './backend/anchor-driver';
import { BACKEND_GATEWAY, noOperators } from './backend/backend-gateway';
import { FakeBackendGateway } from './backend/fake-backend-gateway';
import { DEAD_MARK } from './provenance/provenance';
import { Composition } from './shell/composition';

/** 50 bloques of 1 323 frames: 66 150 samples, the first window with room. */
const BLOCKS_FOR_A_MEDIDA = 50;

async function renderApp() {
  const backend = new FakeBackendGateway();
  const worker = new FakeAudioWorker();
  TestBed.configureTestingModule({
    imports: [App],
    providers: [
      { provide: BACKEND_GATEWAY, useValue: backend },
      // The bridge runs in place: a `Worker` needs a window and this suite has none.
      { provide: AUDIO_WORKER, useValue: () => worker },
    ],
  });
  const fixture = TestBed.createComponent(App);
  await fixture.whenStable();
  return {
    backend,
    worker,
    fixture,
    host: fixture.nativeElement as HTMLElement,
    /**
     * A capture the ancla vouched for at both ends of its window, which is the
     * only kind that reaches the screen. Since the ranuras decide the
     * composición it moves no panel at all, which is what one of these tests is
     * for.
     */
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
      await fixture.whenStable();

      const drawn = TestBed.inject(AudioService).measure();
      anchorAnswers(backend, 'same');
      await drawn;
      await fixture.whenStable();
    },
  };
}

/**
 * Open the bench drawer on one of its five chips.
 *
 * Closed is the default and nothing inside is rendered until a chip is pressed,
 * so this is how a test that reads an instrument gets at one.
 */
async function openChip(
  fixture: ComponentFixture<App>,
  host: HTMLElement,
  name: string,
): Promise<void> {
  const chip = Array.from(host.querySelectorAll<HTMLButtonElement>('.chip')).find((candidate) =>
    (candidate.textContent ?? '').includes(name),
  );
  if (chip === undefined) {
    throw new Error(`no hay chip «${name}»`);
  }
  chip.click();
  await fixture.whenStable();
}

// The pin and the pair are both preferences, and both are written through the
// moment they are touched: nothing of one test leaks into the next.
afterEach(() => localStorage.clear());

describe('App (4a)', () => {
  it('has the whole shape of the screen from the first frame', async () => {
    const { host } = await renderApp();

    expect(host.querySelector('app-header')).not.toBeNull();
    expect(host.querySelector('app-operator-diagram')).not.toBeNull();
    expect(host.querySelector('app-figures-column')).not.toBeNull();
    expect(host.querySelector('app-bottom-strip')).not.toBeNull();
  });

  /**
   * The main screen is two compositions of the same elements, and what chooses
   * between them is the state of the two Ranuras. The factory pair is `SCOPE`
   * and empty, so the app opens **narrow** — the inversion ADR-0007 records.
   */
  it('opens on the factory pair, with the scope in the column', async () => {
    const { host } = await renderApp();

    expect(host.querySelector('.body')?.classList.contains('body--wide')).toBe(false);
    expect(host.querySelector('app-glass-column app-scope canvas')).not.toBeNull();
  });

  /**
   * The retired behaviour, and the one this session was asked for: nothing on
   * this screen moves that the pianist did not move.
   */
  it('moves nothing in the composition when a vouched capture lands', async () => {
    const { host, capture } = await renderApp();

    await capture();

    expect(host.querySelector('.body')?.classList.contains('body--wide')).toBe(false);
    expect(host.querySelector('app-glass-column app-scope canvas')).not.toBeNull();
    expect(host.querySelector('app-bottom-strip')).not.toBeNull();
  });

  it('pins the big composition with KEEP IT BIG, and the column goes away', async () => {
    const { host, fixture, capture } = await renderApp();
    const pin = host.querySelector<HTMLButtonElement>('.pin')!;
    expect(pin.textContent?.trim()).toBe('KEEP IT BIG');

    pin.click();
    await fixture.whenStable();
    await capture();

    expect(pin.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('.body')?.classList.contains('body--wide')).toBe(true);
    // Not shrunk to nothing: absent. A panel of 0 px is still painting a curve
    // 33 times a second for nobody.
    expect(host.querySelector('app-glass-column')).toBeNull();
  });

  /**
   * Emptying both hands the algorithm the screen and leaves a handle behind, so
   * that one press brings a panel back. Two handles, one per ranura, each
   * labelled with the panel it will put back — the fixed geometry does not lapse
   * because the halves are empty.
   */
  it('collapses the column to a rail with two handles when both ranuras are emptied', async () => {
    const { host, fixture } = await renderApp();
    const composition = TestBed.inject(Composition);

    composition.choose(0, null);
    await fixture.whenStable();

    expect(host.querySelector('app-glass-column')).toBeNull();
    expect(host.querySelector('.body')?.classList.contains('body--rail')).toBe(true);
    const handles = [...host.querySelectorAll<HTMLButtonElement>('app-column-rail .handle')];
    expect(handles.map((handle) => handle.textContent?.trim())).toEqual(['SCOPE', 'SPECTRUM']);

    // One press, and the panel that half was holding is back in that half.
    handles[0].click();
    await fixture.whenStable();

    expect(composition.slots()).toEqual(['SCOPE', null]);
    expect(host.querySelector('app-column-rail')).toBeNull();
    expect(host.querySelector('app-glass-column app-scope canvas')).not.toBeNull();
    expect(host.querySelector('.body')?.classList.contains('body--rail')).toBe(false);
  });

  /**
   * The pin has its own handle — itself, lit, in the header of the panel it is
   * about — so there is no rail beside it. A second control for the same one
   * press is a second thing to learn.
   */
  it('leaves no rail under KEEP IT BIG, whatever the pair holds', async () => {
    const { host, fixture } = await renderApp();
    const pin = host.querySelector<HTMLButtonElement>('.pin')!;

    pin.click();
    await fixture.whenStable();

    expect(host.querySelector('app-column-rail')).toBeNull();
    expect(host.querySelector('app-glass-column')).toBeNull();
    expect(host.querySelector('.body')?.classList.contains('body--wide')).toBe(true);
    expect(host.querySelector('.body')?.classList.contains('body--rail')).toBe(false);
  });

  /**
   * One signal is never drawn twice in one frame, and the emptied strip hands
   * its 156 px back rather than staying as a box holding a panel that moved out.
   */
  it('takes the bottom strip off screen when a ranura holds the waterfall', async () => {
    const { host, fixture } = await renderApp();
    const composition = TestBed.inject(Composition);

    composition.choose(1, 'WATERFALL');
    await fixture.whenStable();

    expect(host.querySelectorAll('app-waterfall')).toHaveLength(1);
    expect(host.querySelector('app-bottom-strip')).toBeNull();
    expect(host.querySelector('app-glass-column app-waterfall')).not.toBeNull();

    composition.choose(1, null);
    await fixture.whenStable();

    expect(host.querySelector('app-bottom-strip app-waterfall')).not.toBeNull();
  });

  it('draws the eight operator nodes with their shape kept and their number lost', async () => {
    const { host } = await renderApp();

    const nodes = [...host.querySelectorAll('.node')];
    expect(nodes).toHaveLength(8);
    expect(nodes.map((node) => node.querySelector('.node__id')?.textContent)).toEqual([
      'OP1',
      'OP2',
      'OP3',
      'OP4',
      'OP5',
      'OP6',
      'OP7',
      'OP8',
    ]);
    for (const node of nodes) {
      expect(node.querySelector('.node__level')?.textContent?.trim()).toBe(DEAD_MARK);
    }
  });

  it('says what a capture would fill instead of showing zeros', async () => {
    const { host } = await renderApp();

    // The empty column is a contract, not a hole: it says what fills it, and it
    // says it once. `NOT MEASURED IN THIS SOUND` is the ancla's line, up in the
    // header, not a fifth sentence down here.
    const column = host.querySelector('app-figures-column');
    expect(column?.textContent).toContain(
      'Hold a note and press CAPTURE. One 1.5 s window fills every cell below.',
    );
    expect(column?.textContent).toContain(DEAD_MARK);
    expect(column?.textContent).not.toContain('NOT MEASURED IN THIS SOUND');
  });

  it('counts the relectura against the addresses the app actually asks for', async () => {
    const { backend, fixture, host } = await renderApp();

    // No relectura has begun, so there is no strip. A strip claiming a relectura
    // that is not running would be the one kind of lie this screen avoids.
    expect(host.querySelector('.strip__text')).toBeNull();

    backend.reread.set({ done: 118, total: 384, answered: 118, tookMs: null });
    await fixture.whenStable();
    expect(host.querySelector('.strip__text')?.textContent).toBe('REREAD · 118 OF 384');

    // A pass that carries how long it took is a pass that finished: the strip
    // comes down, and the count is behind the drawer's `STARTUP` chip, which is
    // where it is written down from.
    backend.reread.set({ done: 384, total: 384, answered: 383, tookMs: 912 });
    await fixture.whenStable();
    expect(host.querySelector('.strip__text')).toBeNull();

    await openChip(fixture, host, 'STARTUP');
    expect(host.querySelector('app-dev-readout')?.textContent).toContain('383 OF 384 · 0.91 s');
  });

  it('takes every polled figure to the dash when the Performance changes underneath', async () => {
    const { backend, fixture, host, capture } = await renderApp();
    // The glass column is on screen on the factory pair alone, which is what
    // lets this test check the one figure that survives the change.
    await capture();
    backend.anchorReads('Init Normal (FM-X)');
    backend.patch.update((patch) => ({
      ...patch,
      algorithm: { value: 2, provenance: 'polled', readAt: performance.now() },
    }));
    backend.operators.set({
      operators: noOperators().operators.map((node) => ({
        ...node,
        level: { value: 75, provenance: 'polled', readAt: performance.now() },
      })),
      passMs: 84,
      passes: 3,
    });
    await fixture.whenStable();
    expect(host.querySelector('.pill--algorithm')?.textContent).toContain('02');

    // Somebody loads another sound on the panel. Not one byte announces it.
    backend.loadPerformance('Bright FM Keys');
    await fixture.whenStable();

    // El nombre nuevo y el destello. El viejo tachado ya no se dibuja: con 20
    // caracteres se metía debajo del chip `ALG` (#19).
    const anchor = host.querySelector('.anchor');
    expect(anchor?.textContent).toContain('Bright FM Keys');
    expect(anchor?.textContent).not.toContain('Init Normal (FM-X)');
    expect(anchor?.classList.contains('anchor--changed')).toBe(true);
    expect(anchor?.textContent).toContain('NOT MEASURED IN THIS SOUND');

    // Every polled figure keeps its shape and loses its number. Not one of them
    // was replaced by a figure of the new patch without passing through the dash.
    expect(host.querySelector('.pill--algorithm')?.textContent).toContain(DEAD_MARK);
    for (const node of host.querySelectorAll('.node')) {
      expect(node.querySelector('.node__level')?.textContent?.trim()).toBe(DEAD_MARK);
    }

    // And the one thing that never dies says so, because it is the only figure
    // left standing on a screen that just went to dashes.
    expect(host.querySelector('app-glass-column')?.textContent).toContain(
      'STILL TRUE · THIS IS AUDIO',
    );
  });

  /**
   * The rule of the whole shell: everything that warns draws **under** the
   * header. The pánico is the last thing that stops working, and a card that
   * covered it would take the one gesture that stops a hung note.
   */
  it('draws the unhappy cards under the header, with the pánico still reachable', async () => {
    const { backend, fixture, host } = await renderApp();
    expect(host.querySelector('.card')).toBeNull();

    backend.portLost('timeouts');
    await fixture.whenStable();

    const card = host.querySelector('.card')!;
    const panic = host.querySelector<HTMLButtonElement>('.panic')!;
    expect(card.textContent).toContain('POLLING STOPPED');
    expect(panic.disabled).toBe(false);
    // Under, in the document order the shell lays out top to bottom: the header
    // comes first and nothing overlaps it.
    expect(
      host.querySelector('app-header')!.compareDocumentPosition(card) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // And the pánico still goes out: `DESCONECTADO` is exactly the state it is
    // built to survive, and the native side reopens the port and sends anyway.
    panic.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true }));
    panic.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
    await fixture.whenStable();
    expect(backend.panicPresses).toBe(1);
  });

  /**
   * The five instruments used to be about 130 px of permanent text under the
   * bottom strip. The body gets that height back, and what the drawer costs the
   * screen is the handle — the readouts are not in the shell at all until a chip
   * is pressed.
   */
  it('keeps the five temporary instruments behind one handle, shut', async () => {
    const { fixture, host } = await renderApp();

    expect(host.querySelector('app-bench-drawer')).not.toBeNull();
    expect(host.querySelector('app-dev-readout')).toBeNull();
    expect(host.querySelector('app-sweep-readout')).toBeNull();

    await openChip(fixture, host, 'SWEEP');
    expect(host.querySelector('app-sweep-readout')).not.toBeNull();
    // The strip it opened over is still there behind it: a drawer that replaced
    // the screen would take away the thing the instrument is measuring.
    expect(host.querySelector('app-bottom-strip')).not.toBeNull();
  });

  it('holds the waterfall in the bottom strip, with nothing to choose between', async () => {
    const { host } = await renderApp();

    expect(host.querySelector('app-bottom-strip .head__title')?.textContent?.trim()).toBe(
      'WATERFALL',
    );
    expect(host.querySelector('[role="tab"]')).toBeNull();
  });
});

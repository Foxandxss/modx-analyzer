import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { AUDIO_WORKER } from './audio/audio-service';
import { FakeAudioWorker } from './audio/fake-audio-worker';
import { BACKEND_GATEWAY, noOperators } from './backend/backend-gateway';
import { FakeBackendGateway } from './backend/fake-backend-gateway';
import { DEAD_MARK } from './provenance/provenance';

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
  return { backend, worker, fixture, host: fixture.nativeElement as HTMLElement };
}

describe('App (4a)', () => {
  it('has the whole shape of the screen from the first frame', async () => {
    const { host } = await renderApp();

    expect(host.querySelector('app-header')).not.toBeNull();
    expect(host.querySelector('app-operator-diagram')).not.toBeNull();
    expect(host.querySelector('app-signal-views')).not.toBeNull();
    expect(host.querySelector('app-figures-column')).not.toBeNull();
    expect(host.querySelector('app-tab-panel')).not.toBeNull();
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
    // comes down, and the count moves to the dev readout where it is written from.
    backend.reread.set({ done: 384, total: 384, answered: 383, tookMs: 912 });
    await fixture.whenStable();
    expect(host.querySelector('.strip__text')).toBeNull();
    expect(host.querySelector('app-dev-readout')?.textContent).toContain('383 OF 384 · 0.91 s');
  });

  it('takes every polled figure to the dash when the Performance changes underneath', async () => {
    const { backend, fixture, host } = await renderApp();
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
    expect(host.querySelector('app-signal-views')?.textContent).toContain(
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

  it('opens on the waterfall, the default the moment a note is live', async () => {
    const { host } = await renderApp();

    const selected = host.querySelector('.tabs__tab--on');
    expect(selected?.textContent?.trim()).toBe('WATERFALL');
  });
});

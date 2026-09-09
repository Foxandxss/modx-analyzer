import { TestBed } from '@angular/core/testing';
import { AUDIO_WORKER } from '../../audio/audio-service';
import { FakeAudioWorker } from '../../audio/fake-audio-worker';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { FakeBackendGateway } from '../../backend/fake-backend-gateway';
import { BENCH_CHIPS, BenchDrawer } from './bench-drawer';

async function renderDrawer() {
  const backend = new FakeBackendGateway();
  TestBed.configureTestingModule({
    imports: [BenchDrawer],
    providers: [
      { provide: BACKEND_GATEWAY, useValue: backend },
      { provide: AUDIO_WORKER, useValue: () => new FakeAudioWorker() },
    ],
  });
  const fixture = TestBed.createComponent(BenchDrawer);
  await fixture.whenStable();
  const host = fixture.nativeElement as HTMLElement;

  return {
    backend,
    fixture,
    host,
    text: () => host.textContent ?? '',
    chips: () => Array.from(host.querySelectorAll<HTMLButtonElement>('.chip')),
    async press(label: string) {
      const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
        (candidate) => (candidate.textContent ?? '').includes(label),
      );
      if (button === undefined) {
        throw new Error(`no hay chip «${label}»`);
      }
      button.click();
      await fixture.whenStable();
    },
  };
}

/**
 * The panel's own stylesheet, the way #39 reads one: jsdom lays nothing out, so
 * «it opens over the bottom strip» is asserted as the rule that puts it there.
 */
function componentCss(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n');
}

describe('BenchDrawer (8g)', () => {
  it('is shut by default, and no instrument is drawn behind it', async () => {
    const { host, text } = await renderDrawer();

    expect(text()).toContain('TEMPORARY INSTRUMENTS');
    expect(host.querySelector('.drawer')?.classList.contains('drawer--open')).toBe(false);
    expect(host.querySelector('app-dev-readout')).toBeNull();
    expect(host.querySelector('app-sweep-readout')).toBeNull();
    expect(host.querySelector('.drawer__body')).toBeNull();
  });

  /**
   * The whole point of the affordance: a panel wearing a ticket number is
   * visibly on its way out, so nobody designs around it and closing the ticket
   * has an obvious consequence.
   */
  it('wears one chip per instrument with the number of the ticket that retires it', async () => {
    const { chips } = await renderDrawer();

    const worn = chips().map(
      (chip) =>
        `${chip.querySelector('.chip__name')?.textContent} ${chip.querySelector('.chip__ticket')?.textContent}`,
    );
    expect(worn).toEqual(['BRIDGE #44', 'STARTUP #45', 'AUDIO #46', 'PORT #47', 'SWEEP #43']);
  });

  /**
   * The console is the one chip with no ticket, which is how the one that stays
   * is told from the five that go — and it is not built, so it is not drawn. An
   * un-ticketed chip that opens nothing is a control that lies (#34's rule).
   */
  it('draws no chip for the console that does not exist', async () => {
    const { text, chips } = await renderDrawer();

    expect(text()).not.toContain('SYSEX');
    expect(chips()).toHaveLength(BENCH_CHIPS.length);
    for (const chip of chips()) {
      expect(chip.textContent).toMatch(/#\d+/);
    }
  });

  it('opens on the chip that was pressed, and shuts on the same one', async () => {
    const { host, press, text } = await renderDrawer();

    await press('BRIDGE');
    expect(host.querySelector('.drawer')?.classList.contains('drawer--open')).toBe(true);
    expect(host.querySelector('app-dev-readout')).not.toBeNull();
    expect(text()).toContain('LATENCY');
    // And it says what would have to be true for this panel to go.
    expect(text()).toContain('TICKET #44 · THIS PANEL GOES AWAY WHEN THE CAPTURE PATH IS TRUSTED');

    await press('BRIDGE');
    expect(host.querySelector('.drawer')?.classList.contains('drawer--open')).toBe(false);
    expect(host.querySelector('app-dev-readout')).toBeNull();
  });

  it('shows one instrument at a time, and the sweep is its own', async () => {
    const { host, press, text } = await renderDrawer();

    await press('STARTUP');
    expect(text()).toContain('REREAD');
    expect(text()).not.toContain('LATENCY');

    await press('SWEEP');
    expect(host.querySelector('app-dev-readout')).toBeNull();
    expect(host.querySelector('app-sweep-readout')).not.toBeNull();
    expect(text()).toContain('not swept');
  });

  it('closes from the handle without changing which chip is next', async () => {
    const { host, press, text } = await renderDrawer();

    await press('PORT');
    expect(text()).toContain('EXPORT');

    await press('CLOSE');
    expect(host.querySelector('.drawer')?.classList.contains('drawer--open')).toBe(false);
    expect(text()).toContain('TICKET SHOWING = ON ITS WAY OUT');
  });

  /**
   * Alert behaviour belongs to the SysEx console alone: an unconfirmed write is
   * a consequence, and a bridge log with 0 drops has nothing to say. A temporary
   * instrument that nags is a temporary instrument nobody closes the ticket on,
   * so the register is not in the drawer's vocabulary at all — not in the chips,
   * not in the readouts inside them.
   */
  it('is never in the alert register, in any state', async () => {
    const { press } = await renderDrawer();

    // Shut, and then open on each of the five in turn: Angular drops a
    // component's styles when its last instance goes, so every instrument is
    // read while it is the one on screen.
    expect(componentCss()).not.toContain('var(--alert)');
    for (const chip of BENCH_CHIPS) {
      await press(chip.id);
      // The stylesheet has to hold the instrument that is open, or the line
      // below would pass on a drawer with nothing inside it and assert nothing.
      expect(componentCss()).toContain(chip.id === 'SWEEP' ? 'sweep__loud' : 'dev__loud');
      expect(componentCss()).not.toContain('var(--alert)');
      await press(chip.id);
    }
  });

  /**
   * «Opening it does not reflow the screen behind» cannot be measured in jsdom.
   * What can be asserted is the rule that decides it: the host reserves the
   * handle and nothing else, and the panel inside it is out of flow with its
   * bottom pinned there, so the drawer grows upward over the strip below.
   */
  it('opens over the bottom strip instead of pushing it', async () => {
    await renderDrawer();

    // The selectors carry Angular's scoping attribute, so the rule is matched
    // with it optional rather than by an exact string.
    const css = componentCss().replace(/\s+/g, ' ');
    expect(css).toContain('flex: 0 0 var(--drawer-grab)');
    expect(css).toMatch(/\.drawer(\[[^\]]*\])?\s*\{[^}]*position: absolute/);
    expect(css).toMatch(/\.drawer(\[[^\]]*\])?\s*\{[^}]*bottom: 0/);
  });
});

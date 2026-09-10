import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { appConfig } from '../app.config';
import { BACKEND_GATEWAY } from '../backend/backend-gateway';
import { FakeBackendGateway } from '../backend/fake-backend-gateway';
import { TauriBackendGateway } from '../backend/tauri-backend-gateway';
import { staleAfterMs } from '../provenance/freshness';
import { harnessTopology } from './algorithm-table';
import { HarnessBench } from './harness-bench';
import { HARNESS_LEVELS, HARNESS_PASS_MS, HarnessPatch } from './harness-patch';
import { harnessConfig } from './harness.config';

/**
 * The bench, rendered through **its own wiring**.
 *
 * `harnessConfig.providers` and not a hand-built list: what the bench claims is
 * that the app draws with no MODX and no Rust side behind it, and a test that
 * assembled its own providers would prove that about a fourth configuration
 * nobody runs. This is the one the `harness` build target boots.
 */
async function renderBench() {
  TestBed.configureTestingModule({
    imports: [HarnessBench],
    providers: [...harnessConfig.providers],
  });
  const fixture = TestBed.createComponent(HarnessBench);
  await fixture.whenStable();
  return {
    fixture,
    patch: TestBed.inject(HarnessPatch),
    backend: TestBed.inject(FakeBackendGateway),
    host: fixture.nativeElement as HTMLElement,
  };
}

function nodes(host: HTMLElement): HTMLElement[] {
  return Array.from(host.querySelectorAll<HTMLElement>('.node'));
}

function node(host: HTMLElement, operator: number): HTMLElement {
  const found = host.querySelector<HTMLElement>(`.node[data-operator="${operator}"]`);
  if (found === null) {
    throw new Error(`no hay nodo OP${operator}`);
  }
  return found;
}

/** The height of one node's fill, as a share of its track. The Level *is* this. */
function fill(host: HTMLElement, operator: number): number {
  const drawn = node(host, operator).querySelector<HTMLElement>('.node__fill');
  return Number.parseFloat(drawn?.style.height ?? '');
}

/** A `top: 12.5%` back as the number, which is how the drawing rides the canvas. */
function percent(value: string | undefined): number {
  return Number.parseFloat(value ?? '');
}

function diagram(host: HTMLElement): HTMLElement {
  const found = host.querySelector<HTMLElement>('app-operator-diagram');
  if (found === null) {
    throw new Error('no hay diagrama');
  }
  return found;
}

describe('the bench without the keyboard', () => {
  it('draws a patch with no keyboard, no Rust side and nothing driven by hand', async () => {
    const { host } = await renderBench();

    // Eight nodes, each carrying a figure the bench said it read. This is the
    // criterion: the app renders a chosen patch on a machine with no MODX.
    expect(nodes(host)).toHaveLength(8);
    for (const drawn of nodes(host)) {
      expect(drawn.dataset['stamp']).toBe('polled');
    }
    // And the drawing is the algorithm's own: three routes is the 1-2-3-4 chain
    // of `Init Normal (FM-X)`, from the table and not from this file.
    expect(host.querySelectorAll('.route')).toHaveLength(harnessTopology(2)?.routes.length ?? 0);
    expect(host.querySelector('.no-table')).toBeNull();
  });

  /**
   * Nothing covers the drawing.
   *
   * With the port shut the app draws two unhappy cards over the top of the body
   * and takes the height out of the diagram (#19), which is a screen no look in
   * this round is about. So the bench opens the port and the device, and this is
   * what says it did.
   */
  it('opens the port, so no unhappy card is standing over the body', async () => {
    const { host } = await renderBench();

    expect(host.querySelector('.card')).toBeNull();
  });

  it('takes the algorithm by hand and redraws from the table', async () => {
    const { fixture, host, patch } = await renderBench();

    // The 66: the single chain of eight, the deepest drawing that exists and the
    // one #81's floor is measured on.
    patch.algorithm.set(66);
    patch.pass();
    await fixture.whenStable();

    expect(host.querySelectorAll('.route')).toHaveLength(7);
    // And the eight are laid out by their depth, which is the half of the table
    // a route count cannot see: Op1 is the head of the chain and Op8 is the
    // portadora on the bus, so Op1 stands above it. The bench opens in the
    // narrow composición, where the eight are a depth-sorted 3 × 3 grid — so
    // this is asserted as an order and not as eight rows.
    expect(percent(node(host, 1).style.top)).toBeLessThan(percent(node(host, 8).style.top));

    // And a number outside the 88 draws the refusal rather than a diagram of a
    // patch that does not exist.
    patch.algorithm.set(89);
    patch.pass();
    await fixture.whenStable();

    expect(host.querySelector('.no-table')?.textContent).toContain('ALGORITHM 89');
  });

  it('takes the eight Levels by hand, and the fill follows them', async () => {
    const { fixture, host, patch } = await renderBench();

    // The bench opens on the running build's own reading, which is what makes a
    // look taken on it a look at a real patch.
    expect(fill(host, 8)).toBe(HARNESS_LEVELS[7]);

    patch.setLevel(3, 12);
    await fixture.whenStable();

    expect(fill(host, 3)).toBe(12);
    // The other seven stay where they were: a bench that reset the patch on
    // every keystroke could not be used to compare two Levels.
    expect(fill(host, 1)).toBe(HARNESS_LEVELS[0]);

    patch.setEveryLevel(85);
    await fixture.whenStable();

    expect(nodes(host).map((_, index) => fill(host, index + 1))).toEqual(Array(8).fill(85));
  });

  it('clamps a Level to the range the keyboard has', async () => {
    const { patch } = await renderBench();

    patch.setLevel(1, 500);
    expect(patch.levels()[0]).toBe(99);
    patch.setLevel(1, -20);
    expect(patch.levels()[0]).toBe(0);
  });

  it('takes the ancla by hand, and the header says so', async () => {
    const { fixture, host, patch } = await renderBench();

    patch.performanceName.set('Banco sin teclado');
    patch.pass();
    await fixture.whenStable();

    expect(host.textContent).toContain('Banco sin teclado');
  });

  /**
   * The fold-off switch, which is a constraint from #81 and not a convenience.
   *
   * Folding does not exist yet, so what is asserted is the whole of what the
   * drawing can honour today: it publishes which way the switch is set. #82 reads
   * the same signal for the geometry, and this test is what will fail if that
   * commit invents a second switch instead.
   */
  it('has a fold-off switch, and the drawing says which way it is set', async () => {
    const { fixture, host, patch } = await renderBench();

    // On is the default and the app the laptop runs never sees anything else, so
    // there is no attribute at all: the production markup is unchanged.
    expect(diagram(host).hasAttribute('data-folding')).toBe(false);

    patch.folding.set(false);
    await fixture.whenStable();

    expect(diagram(host).dataset['folding']).toBe('off');
  });

  /**
   * The bench keeps its own ink live, and the margin is written down.
   *
   * `CADUCO` is four passes with a 400 ms floor, and it is the one change on this
   * screen that happens because *nothing* arrived. A bench that set the eight
   * nodes once would therefore be drawing the app's alert ink half a second after
   * launch — every figure broken-outlined, which is not the drawing any of the
   * looks are about, and the kind of thing somebody photographs without noticing.
   */
  it('passes far sooner than its own figures go CADUCO', () => {
    const stale = staleAfterMs(HARNESS_PASS_MS);

    expect(HARNESS_PASS_MS).toBeLessThan(stale);
    // 302 ms of margin at the bench's cadence, recorded rather than classified:
    // the pass could take three times as long and the ink would still be live.
    expect(stale - HARNESS_PASS_MS).toBe(302);
  });

  it('re-reads every figure on every pass rather than repeating the first one', async () => {
    const { patch, backend } = await renderBench();
    const before = backend.operators();

    patch.pass();
    const after = backend.operators();

    expect(after.passes).toBe(before.passes + 1);
    expect(after.passMs).toBe(HARNESS_PASS_MS);
    for (const drawn of after.operators) {
      const was = before.operators[drawn.operator - 1];
      expect(drawn.level.readAt).not.toBeNull();
      expect(drawn.level.readAt ?? 0).toBeGreaterThanOrEqual(was.level.readAt ?? 0);
      expect(drawn.level.provenance).toBe('polled');
    }
  });

  /**
   * A node with no algorithm has no role — the app's own refusal, and the bench
   * does not get to be the one place it is broken by handing over a polled
   * `null`.
   */
  it('draws no role at all for a number the table has no entry for', async () => {
    const { fixture, patch, backend } = await renderBench();

    patch.algorithm.set(89);
    patch.pass();
    await fixture.whenStable();

    for (const drawn of backend.operators().operators) {
      expect(drawn.role.value).toBeNull();
      expect(drawn.role.provenance).toBe('invalidated');
      // The Level still crosses: what the keyboard answered does not depend on
      // whether the table has a drawing for the algorithm.
      expect(drawn.level.provenance).toBe('polled');
    }
  });

  /**
   * The app the laptop runs is still wired to the keyboard.
   *
   * It cannot prove the bench is absent from a production bundle — that is a
   * fact about the module graph, and it is true because `ng build` builds
   * `main.ts`, which imports nothing under `dev/`. What it can catch is the
   * realistic way that stops being true: somebody wiring the fake gateway into
   * `app.config.ts` to make a screenshot easier, and the app shipping with a
   * keyboard nobody is holding.
   */
  it('leaves the app wired to the real gateway', () => {
    const wiring = appConfig.providers.find(
      (provider) =>
        typeof provider === 'object' &&
        'provide' in provider &&
        provider.provide === BACKEND_GATEWAY,
    );

    expect(wiring).toEqual({ provide: BACKEND_GATEWAY, useClass: TauriBackendGateway });
  });

  it('parks an operator by taking its Level to zero, wherever the algorithm put it', async () => {
    const { fixture, host, patch } = await renderBench();

    patch.setLevel(4, 0);
    await fixture.whenStable();

    // Algorithm 2 makes Op4 a portadora; at Level 0 it is inactivo anyway.
    expect(node(host, 4).dataset['role']).toBe('inert');
    expect(node(host, 3).dataset['role']).toBe('modulator');
  });
});

import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  BACKEND_GATEWAY,
  FrequencyMode,
  OperatorRole,
  OperatorView,
  OperatorsView,
  PolledValue,
  Topology,
  invalidated,
  noOperators,
} from '../../backend/backend-gateway';
import { FakeBackendGateway } from '../../backend/fake-backend-gateway';
import { Clock } from '../../provenance/clock';
import { Composition } from '../../shell/composition';
import { staleAfterMs } from '../../provenance/freshness';
import { DEAD_MARK } from '../../provenance/provenance';
import { CANVAS_H, CANVAS_W, NODE_H } from './layout';
import { OperatorDiagram } from './operator-diagram';
import { SPECTRAL_GLYPH } from './spectral-glyph';
import { WIDE_CANVAS_H, WIDE_CANVAS_W } from './wide-layout';

/** The two cadences that were measured: 42 addresses in silence, and under notes. */
const IDLE_PASS_MS = 84;
const PLAYING_PASS_MS = 430;

/** What time it is, in every test here. A real clock would decide the answers. */
const NOW = 10_000;

/**
 * Which composition the panel is drawing in, handed over rather than derived.
 *
 * The real one reads the audio service and the ancla to decide, and this panel
 * has nothing to say about either: what it has to do is draw two different
 * layouts of the same eight nodes, and a test that cannot say which one it is
 * looking at tests neither.
 */
function composition(wide: boolean) {
  const big = signal(wide);
  const pin = signal(false);
  return {
    big,
    wide: big.asReadonly(),
    panels: computed(() => !big()),
    pinned: pin.asReadonly(),
    togglePin: () => pin.set(!pin()),
  };
}

async function renderDiagram({ wide = false } = {}) {
  const backend = new FakeBackendGateway();
  const room = composition(wide);
  // The clock is handed over rather than left running: the thing under test is a
  // decision about what time it is, and a test that cannot say what time it is
  // tests nothing. Clock carries only its `now`.
  const clock: Clock = { now: signal(NOW) };
  TestBed.configureTestingModule({
    imports: [OperatorDiagram],
    providers: [
      { provide: BACKEND_GATEWAY, useValue: backend },
      { provide: Clock, useValue: clock },
      { provide: Composition, useValue: room },
    ],
  });
  const fixture = TestBed.createComponent(OperatorDiagram);
  await fixture.whenStable();
  return { backend, fixture, clock, room, host: fixture.nativeElement as HTMLElement };
}

function polled<T>(value: T, readAt: number): PolledValue<T> {
  return { value, provenance: 'polled', readAt };
}

/** One operator as the ring would have delivered it, all five figures at once. */
function reading(
  operator: number,
  what: {
    role: OperatorRole;
    level: number;
    ratio?: number;
    form?: string;
    mode?: FrequencyMode;
  },
  readAt: number,
): OperatorView {
  return {
    operator,
    role: polled(what.role, readAt),
    level: polled(what.level, readAt),
    ratio: what.ratio === undefined ? invalidated<number>() : polled(what.ratio, readAt),
    frequencyMode: polled(what.mode ?? 'ratio', readAt),
    spectralForm: polled(what.form ?? 'Sine', readAt),
  };
}

/** The fase 0c patch: algorithm 2, Op3 a modulador at 75, Op4 a portadora at 99. */
function eight(readAt: number, passMs: number): OperatorsView {
  const roles: OperatorRole[] = [
    'inert',
    'inert',
    'modulator',
    'carrier',
    'inert',
    'inert',
    'inert',
    'inert',
  ];
  const levels = [0, 0, 75, 99, 0, 0, 0, 0];
  return {
    operators: roles.map((role, index) =>
      reading(index + 1, { role, level: levels[index], ratio: 1 }, readAt),
    ),
    passMs,
    passes: 12,
  };
}

function nodes(host: HTMLElement): HTMLElement[] {
  return Array.from(host.querySelectorAll<HTMLElement>('.node'));
}

/**
 * The patch the running build reads off the keyboard: six of the eight identical
 * to the eye, which is the whole reason the ceiling datum exists.
 */
function theBuildsOwnPatch(readAt: number): OperatorsView {
  const levels = [90, 90, 71, 90, 90, 85, 90, 99];
  return {
    operators: levels.map((level, index) =>
      reading(index + 1, { role: index === 7 ? 'carrier' : 'modulator', level, ratio: 1 }, readAt),
    ),
    passMs: IDLE_PASS_MS,
    passes: 12,
  };
}

/**
 * The component's own compiled stylesheet, as Angular put it in the document.
 *
 * jsdom lays nothing out, so «no ellipsis at 118 px» cannot be measured here.
 * What can be asserted is the rule that would do the trimming: with no
 * `text-overflow` anywhere in the panel, no figure in the node can be replaced
 * by three dots, whatever width it ends up at.
 */
function componentCss(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((style) => style.textContent ?? '')
    .join('\n');
}

function routes(host: HTMLElement): SVGPathElement[] {
  return Array.from(host.querySelectorAll<SVGPathElement>('.route'));
}

/** The two algorithms the tests below draw, as the table sends them. */
const ALGORITHM_2: Topology = {
  number: 2,
  routes: [
    { from: 1, into: 2 },
    { from: 2, into: 3 },
    { from: 3, into: 4 },
  ],
  carriers: [4, 5, 6, 7, 8],
  feedback: { from: 1, into: 1 },
  depth: [3, 2, 1, 0, 0, 0, 0, 0],
  branch: [1, 1, 1, 1, 5, 6, 7, 8],
  provenance: 'documented',
};

/** The 66: the single chain of eight, which is the deepest of the 88 (#40). */
const ALGORITHM_66: Topology = {
  number: 66,
  routes: [1, 2, 3, 4, 5, 6, 7].map((from) => ({ from, into: from + 1 })),
  carriers: [8],
  feedback: { from: 1, into: 1 },
  depth: [7, 6, 5, 4, 3, 2, 1, 0],
  branch: [1, 1, 1, 1, 1, 1, 1, 1],
  provenance: 'documented',
};

/** Algorithm 6, the one fase 0c ran on: two pairs, six portadoras, loop on Op1. */
const ALGORITHM_6: Topology = {
  number: 6,
  routes: [
    { from: 1, into: 2 },
    { from: 3, into: 4 },
  ],
  carriers: [2, 4, 5, 6, 7, 8],
  feedback: { from: 1, into: 1 },
  depth: [1, 0, 1, 0, 0, 0, 0, 0],
  branch: [1, 1, 3, 3, 5, 6, 7, 8],
  provenance: 'documented',
};

describe('OperatorDiagram', () => {
  it('opens with eight nodes that have no role and no figure', async () => {
    const { host } = await renderDiagram();

    const drawn = nodes(host);
    expect(drawn.length).toBe(8);
    for (const node of drawn) {
      expect(node.dataset['role']).toBeUndefined();
      expect(node.classList.contains('node--carrier')).toBe(false);
      expect(node.classList.contains('node--modulator')).toBe(false);
      expect(node.querySelector('.node__level')?.textContent?.trim()).toBe(DEAD_MARK);
    }
    // And the cadence is not invented either: nothing has completed a pass.
    expect(host.querySelector('.zone__cadence')?.textContent).toContain(DEAD_MARK);
  });

  it('draws no line at all until an algorithm has been read', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.operators.set(eight(NOW, IDLE_PASS_MS));
    await fixture.whenStable();

    // Eight nodes and nothing between them: a diagram with no algorithm is not
    // a diagram of algorithm 1.
    expect(routes(host)).toHaveLength(0);
    expect(host.querySelectorAll('.bus')).toHaveLength(0);
    expect(host.querySelector('.feedback')).toBeNull();
    expect(host.querySelector('.no-table')).toBeNull();
  });

  it('draws the routes of the algorithm it was given', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.operators.set(eight(NOW, IDLE_PASS_MS));
    backend.topology.set(ALGORITHM_2);
    await fixture.whenStable();

    // Three modulations, five portadoras on the bus plus the bus itself, one loop.
    expect(routes(host)).toHaveLength(3);
    expect(host.querySelectorAll('.bus')).toHaveLength(6);
    expect(host.querySelector('.feedback')).not.toBeNull();
    expect(host.textContent).toContain('OUT L/R');
    // The routes are paper until somebody compares them with the MODX's screen,
    // and the zone says so.
    expect(host.querySelector('.zone__table')?.textContent).toContain('DOCUMENTED');
  });

  it('redraws the routes when the algorithm changes underneath', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.operators.set(eight(NOW, IDLE_PASS_MS));
    backend.topology.set(ALGORITHM_2);
    await fixture.whenStable();
    const chain = routes(host).map((route) => route.getAttribute('d'));

    backend.topology.set(ALGORITHM_6);
    await fixture.whenStable();

    const pairs = routes(host).map((route) => route.getAttribute('d'));
    expect(pairs).toHaveLength(2);
    expect(pairs).not.toEqual(chain);
    // And the nodes moved with them: Op3 modulates in 6 and is a depth behind.
    expect(nodes(host)[2].style.top).not.toBe('');
  });

  it('says there is no table instead of drawing a plausible diagram', async () => {
    const { backend, fixture, host } = await renderDiagram();

    // `48 0p 4F` answered a byte outside the 88. The number is a fact and it is
    // shown; the drawing is not invented.
    backend.patch.set({ ...backend.patch(), algorithm: polled(89, NOW) });
    await fixture.whenStable();

    expect(host.querySelector('.no-table')?.textContent).toContain('NO TABLE');
    expect(host.querySelector('.no-table')?.textContent).toContain('89');
    expect(routes(host)).toHaveLength(0);
  });

  it('cuts the route of an operator at zero instead of hiding it', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.topology.set(ALGORITHM_6);
    backend.operators.set({
      ...eight(NOW, IDLE_PASS_MS),
      operators: [
        // Op1 modulates Op2 and is at zero; Op3 modulates Op4 and is not.
        reading(1, { role: 'inert', level: 0, ratio: 1 }, NOW),
        reading(2, { role: 'carrier', level: 99, ratio: 1 }, NOW),
        reading(3, { role: 'modulator', level: 80, ratio: 1 }, NOW),
        ...eight(NOW, IDLE_PASS_MS).operators.slice(3),
      ],
    });
    await fixture.whenStable();

    const drawn = routes(host);
    expect(drawn[0].classList.contains('route--inert')).toBe(true);
    expect(drawn[1].classList.contains('route--inert')).toBe(false);
  });

  it('writes the feedback value beside its loop, or the dash', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.topology.set(ALGORITHM_2);
    await fixture.whenStable();
    // Nothing has read the Level of the loop yet: the arc is where the chart
    // puts it, and the number is the dash rather than a zero.
    expect(host.querySelector('.label--feedback')?.textContent?.trim()).toBe(`FB ${DEAD_MARK}`);

    backend.patch.set({ ...backend.patch(), feedback: polled(3, NOW) });
    await fixture.whenStable();
    expect(host.querySelector('.label--feedback')?.textContent?.trim()).toBe('FB 3');
  });

  it('draws the loop inert when the feedback amount is zero, and keeps the figure', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.topology.set(ALGORITHM_2);
    await fixture.whenStable();
    // Nobody has polled the amount yet. That is not an amount of none, so the
    // arc is not cut: a dash beside a solid loop says «unread», which is true.
    expect(host.querySelector('.feedback')?.classList.contains('feedback--inert')).toBe(false);

    backend.patch.set({ ...backend.patch(), feedback: polled(0, NOW) });
    await fixture.whenStable();
    // The route is in the table whatever the amount is, so it stays drawn — and
    // says it carries nothing in the same discontinua an operator at zero uses.
    expect(host.querySelector('.feedback')?.classList.contains('feedback--inert')).toBe(true);
    // And the figure the anillo went and read is still on screen: hiding it is
    // the empty-column rule run backwards.
    expect(host.querySelector('.label--feedback')?.textContent?.trim()).toBe('FB 0');

    backend.patch.set({ ...backend.patch(), feedback: polled(3, NOW) });
    await fixture.whenStable();
    expect(host.querySelector('.feedback')?.classList.contains('feedback--inert')).toBe(false);
  });

  it('inks the inert loop with the very pair the parked stub uses', async () => {
    const { backend, fixture } = await renderDiagram();

    backend.topology.set(ALGORITHM_2);
    backend.patch.set({ ...backend.patch(), feedback: polled(0, NOW) });
    await fixture.whenStable();

    // «The same discontinua as the stub» is a fact about the compiled rule and
    // not about a class name — jsdom lays nothing out and computes no stroke. So
    // what is asserted is that the four selectors share one declaration block,
    // which is what makes them the same line by construction.
    const inert = componentCss().match(/\.route--inert[^{]*\{[^}]*\}/)?.[0] ?? '';
    expect(inert).toContain('.feedback--inert');
    expect(inert).toContain('.stub');
    expect(inert).toContain('var(--inert)');
    expect(inert).toContain('var(--dash-inactive)');
    // And it is the modifier that wins: the base `.feedback` rule has the same
    // specificity, so only the order in the sheet decides.
    expect(componentCss().indexOf('.feedback--inert')).toBeGreaterThan(
      componentCss().search(/\.feedback\[[^\]]*\]\s*\{/),
    );
    // The base stroke rule that made room for the fourth selector is the direct
    // child of the SVG, which is what keeps the arrowhead out of it: the marker
    // lives in <defs> and is the one path in the drawing that is filled.
    const base = componentCss().match(/\.routes[^{]*>[^{]*path[^{]*\{[^}]*\}/)?.[0] ?? '';
    expect(base).toMatch(/fill:\s*none/);
    expect(base).not.toContain('.arrow');
  });

  it('draws the role by shape from what the ring read', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.operators.set(eight(NOW, IDLE_PASS_MS));
    await fixture.whenStable();

    const drawn = nodes(host);
    expect(drawn[2].classList.contains('node--modulator')).toBe(true);
    expect(drawn[3].classList.contains('node--carrier')).toBe(true);
    expect(drawn[0].classList.contains('node--inert')).toBe(true);
    expect(drawn[2].querySelector('.node__role')?.textContent?.trim()).toBe('MOD');
    expect(drawn[3].querySelector('.node__role')?.textContent?.trim()).toBe('CARR');
    expect(drawn[0].querySelector('.node__role')?.textContent?.trim()).toBe('ZERO');
  });

  it('makes the Level the height of the fill and the number only confirm it', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.operators.set(eight(NOW, IDLE_PASS_MS));
    await fixture.whenStable();

    const drawn = nodes(host);
    expect(drawn[3].querySelector<HTMLElement>('.node__fill')?.style.height).toBe('99%');
    expect(drawn[3].querySelector('.node__level')?.textContent?.trim()).toBe('99');
    expect(drawn[2].querySelector<HTMLElement>('.node__fill')?.style.height).toBe('75%');
    // An operator at zero has no fill at all, and it is cut, not absent.
    expect(drawn[0].querySelector<HTMLElement>('.node__fill')?.style.height).toBe('0%');
  });

  it('says the ring cadence it measured, not the one on paper', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.operators.set(eight(NOW, IDLE_PASS_MS));
    await fixture.whenStable();
    expect(host.querySelector('.zone__cadence')?.textContent).toContain('11.9 Hz');

    // Somebody starts playing: the same 42 addresses cost five times as much.
    backend.operators.set(eight(NOW, PLAYING_PASS_MS));
    await fixture.whenStable();
    expect(host.querySelector('.zone__cadence')?.textContent).toContain('2.3 Hz');
  });

  it('goes stale past four passes and not before', async () => {
    const { backend, clock, fixture, host } = await renderDiagram();
    const readAt = NOW;

    // Four idle passes is 336 ms, under the 400 ms floor, so here the floor is
    // the threshold. Neither is ever a number this component chose.
    const threshold = staleAfterMs(IDLE_PASS_MS);
    backend.operators.set(eight(readAt, IDLE_PASS_MS));
    clock.now.set(readAt + threshold - 1);
    await fixture.whenStable();
    expect(nodes(host)[3].dataset['stamp']).toBe('polled');

    clock.now.set(readAt + threshold + 1);
    await fixture.whenStable();
    const stale = nodes(host)[3];
    expect(stale.dataset['stamp']).toBe('stale');
    expect(stale.classList.contains('node--stale')).toBe(true);
    // The shape survives: it is old, not gone.
    expect(stale.querySelector('.node__level')?.textContent?.trim()).toBe('99');
    // Stale keeps no word of its own (GLOSSARY §2): it is `POLLED` plus age,
    // and the age is the broken outline the two assertions above already made.
    expect(stale.querySelector('.node__stamp')?.textContent?.trim()).toBe('POLLED');
  });

  it('does not go stale just because somebody is playing', async () => {
    const { backend, clock, fixture, host } = await renderDiagram();
    const readAt = NOW;

    // A whole pass under notes is 430 ms — longer than the idle threshold of
    // 400 ms. A fixed threshold would stamp the diagram stale every time the
    // owner touched a key, which is exactly when it has to be believable.
    backend.operators.set(eight(readAt, PLAYING_PASS_MS));
    clock.now.set(readAt + PLAYING_PASS_MS + 1);
    await fixture.whenStable();

    expect(nodes(host)[3].dataset['stamp']).toBe('polled');

    // Four of its own passes later, it is stale on any cadence.
    clock.now.set(readAt + 4 * PLAYING_PASS_MS + 1);
    await fixture.whenStable();
    expect(nodes(host)[3].dataset['stamp']).toBe('stale');
  });

  it('shows the real frequency as PREDICTED only while a note is held', async () => {
    const { backend, fixture, host } = await renderDiagram();
    const readAt = NOW;

    backend.operators.set({
      ...eight(readAt, IDLE_PASS_MS),
      operators: [
        reading(1, { role: 'carrier', level: 99, ratio: 1 }, readAt),
        ...eight(readAt, IDLE_PASS_MS).operators.slice(1),
      ],
    });
    await fixture.whenStable();
    // The dash keeps the line's shape; the word does not stand beside it. A
    // stamp on a blank is a stamp on the blank, and it is what the whole eight
    // did in idle before #56.
    const idle = nodes(host)[0].querySelector('.node__hz')?.textContent ?? '';
    expect(idle).toContain(DEAD_MARK);
    expect(idle).not.toContain('PREDICTED');

    // Middle C. Equal temperament says 261.63; the MODX measures 261.763, which
    // is the disagreement the stamp exists to keep visible.
    backend.lowestLivePitch.set(60);
    await fixture.whenStable();
    const line = nodes(host)[0].querySelector('.node__hz')?.textContent ?? '';
    expect(line).toContain('261.63 Hz');
    expect(line).toContain('PREDICTED');
  });

  // The whole eight, not the one node the test above holds: with nothing held
  // every one of them is a dash, so every one of them is a bare stamp.
  it('writes no PREDICTED anywhere in the panel with no note held', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.operators.set(theBuildsOwnPatch(NOW));
    await fixture.whenStable();

    expect(nodes(host)).toHaveLength(8);
    for (const node of nodes(host)) {
      expect(node.querySelector('.node__hz')?.textContent).toContain(DEAD_MARK);
      expect(node.querySelector('.node__hz-stamp')?.textContent?.trim()).toBe('');
    }

    backend.lowestLivePitch.set(60);
    await fixture.whenStable();
    for (const node of nodes(host)) {
      expect(node.querySelector('.node__hz-stamp')?.textContent?.trim()).toBe('PREDICTED');
    }
  });

  it('hangs one ceiling datum at the loudest operator, across all eight nodes', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.operators.set(theBuildsOwnPatch(NOW));
    await fixture.whenStable();

    const datums = Array.from(host.querySelectorAll<HTMLElement>('.node__datum'));
    expect(datums).toHaveLength(8);
    // One line, so one height: the eight are read by the gap above each fill.
    for (const datum of datums) {
      expect(datum.style.bottom).toBe('99%');
    }

    // 71 against a ceiling of 99 is 28 % of the node's 108 px — 30 px of
    // daylight, which is what makes the difference visible at all.
    const fill = nodes(host)[2].querySelector<HTMLElement>('.node__fill');
    expect(fill?.style.height).toBe('71%');
    expect(((99 - 71) / 100) * NODE_H).toBeCloseTo(30, 0);
  });

  it('hangs no datum until something has answered its Level', async () => {
    const { host } = await renderDiagram();

    // A ceiling over eight dashes would be a baseline the patch does not have.
    expect(host.querySelectorAll('.node__datum')).toHaveLength(0);
  });

  it('draws the spectral form and never writes its name', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.operators.set({
      ...eight(NOW, IDLE_PASS_MS),
      operators: [
        reading(1, { role: 'carrier', level: 99, ratio: 1, form: 'Sine' }, NOW),
        reading(2, { role: 'modulator', level: 90, ratio: 1, form: 'All 1' }, NOW),
        reading(3, { role: 'modulator', level: 90, ratio: 1, form: 'Odd 2' }, NOW),
        reading(4, { role: 'modulator', level: 90, ratio: 1, form: 'Res 1' }, NOW),
        ...eight(NOW, IDLE_PASS_MS).operators.slice(4),
      ],
    });
    await fixture.whenStable();

    const drawn = nodes(host);
    for (const form of ['Sine', 'All 1', 'Odd 2', 'Res 1']) {
      expect(host.textContent).not.toContain(form);
    }
    expect(drawn[0].querySelector('.node__glyph path')?.getAttribute('d')).toBe(
      SPECTRAL_GLYPH.Sine,
    );
    expect(drawn[1].querySelector('.node__glyph path')?.getAttribute('d')).toBe(SPECTRAL_GLYPH.All);
    expect(drawn[2].querySelector('.node__glyph path')?.getAttribute('d')).toBe(SPECTRAL_GLYPH.Odd);
    expect(drawn[3].querySelector('.node__glyph path')?.getAttribute('d')).toBe(SPECTRAL_GLYPH.Res);
  });

  it('draws the dash where the glyph goes until the form has been read', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.operators.set({
      ...noOperators(),
      passMs: IDLE_PASS_MS,
      operators: [
        {
          ...reading(1, { role: 'carrier', level: 99, ratio: 1 }, NOW),
          spectralForm: invalidated(),
        },
        ...noOperators().operators.slice(1),
      ],
    });
    await fixture.whenStable();

    const node = nodes(host)[0];
    expect(node.querySelector('.node__glyph path')).toBeNull();
    expect(node.querySelector('.node__glyph')?.textContent?.trim()).toBe(DEAD_MARK);
  });

  it('writes nothing in the node that can ellipsise, at the widest figures there are', async () => {
    const { backend, fixture, host } = await renderDiagram();

    // The widest the node ever gets: a three-figure ratio and the frequency it
    // makes of the top of the keyboard. jsdom lays nothing out, so what is
    // asserted is that the figures reach the DOM whole and that no slot in the
    // node is allowed to trim one.
    backend.lowestLivePitch.set(108);
    backend.operators.set({
      ...noOperators(),
      passMs: IDLE_PASS_MS,
      operators: [
        reading(1, { role: 'carrier', level: 99, ratio: 31.99, form: 'Res 2' }, NOW),
        ...noOperators().operators.slice(1),
      ],
    });
    await fixture.whenStable();

    const node = nodes(host)[0];
    expect(node.querySelector('.node__ratio')?.textContent?.trim()).toBe('×31.99');
    expect(node.querySelector('.node__hz')?.textContent).toContain('133910 Hz');
    expect(node.textContent).not.toContain('…');
    expect(node.textContent).not.toContain('...');
    // The stylesheet has to be the panel's own, or the line below would pass on
    // an empty string and assert nothing.
    expect(componentCss()).toContain('node__ratio');
    expect(componentCss()).not.toContain('text-overflow');
  });

  it('draws the open corner on all eight and gives it nothing to press', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.operators.set(theBuildsOwnPatch(NOW));
    await fixture.whenStable();

    const corners = Array.from(host.querySelectorAll('.node__corner'));
    expect(corners).toHaveLength(8);
    for (const corner of corners) {
      // Inert this session: the operator editor does not exist, so neither the
      // corner nor the node body opens anything.
      expect(corner.tagName.toLowerCase()).not.toBe('button');
      expect(corner.querySelector('path')?.getAttribute('d')).toBe('M21 9v12H9');
    }
    expect(host.querySelectorAll('.node button')).toHaveLength(0);

    // And the words that name it stay with the editor they promise: a legend
    // line pointing at a path that does not exist is a caption lying.
    expect(host.textContent).not.toContain('43 facts');
    expect(host.textContent).not.toContain('the corner');
  });

  it('names the shared datum in the legend, once', async () => {
    const { host } = await renderDiagram();

    // Without this the dashed line crossing the eight nodes is a line that does
    // not say what it is of.
    const legend = host.querySelector('.legend');
    expect(legend?.textContent).toContain('THE LOUDEST OPERATOR IN THIS PATCH');
    expect(legend?.querySelectorAll('.legend__swatch--datum')).toHaveLength(1);
  });

  it('gives a fixed operator no ratio and no frequency', async () => {
    const { backend, fixture, host } = await renderDiagram();
    const readAt = NOW;

    backend.lowestLivePitch.set(60);
    backend.operators.set({
      ...noOperators(),
      passMs: IDLE_PASS_MS,
      operators: [
        reading(1, { role: 'carrier', level: 99, mode: 'fixed' }, readAt),
        ...noOperators().operators.slice(1),
      ],
    });
    await fixture.whenStable();

    const node = nodes(host)[0];
    expect(node.querySelector('.node__ratio')?.textContent).toContain(DEAD_MARK);
    expect(node.querySelector('.node__hz')?.textContent).toContain(DEAD_MARK);
    // The Level is still a number: one figure missing does not take the node down.
    expect(node.querySelector('.node__level')?.textContent?.trim()).toBe('99');
  });

  describe('with the room of the wide composition', () => {
    it('draws in the box the algorithm surface was sized to', async () => {
      const { backend, fixture, host } = await renderDiagram({ wide: true });

      backend.operators.set(theBuildsOwnPatch(NOW));
      backend.topology.set(ALGORITHM_2);
      await fixture.whenStable();

      expect(host.querySelector('.routes')?.getAttribute('viewBox')).toBe(
        `0 0 ${WIDE_CANVAS_W} ${WIDE_CANVAS_H}`,
      );
      // Role reads from position: the five portadoras stand together on the bus
      // row and Op1, three deep, is drawn above every one of them.
      const feet = [4, 5, 6, 7, 8].map((operator) => nodes(host)[operator - 1].style.top);
      expect(new Set(feet).size).toBe(1);
      expect(parseFloat(nodes(host)[0].style.top)).toBeLessThan(parseFloat(feet[0]));
      expect(host.querySelectorAll('.bus')).toHaveLength(6);
      expect(host.querySelectorAll('.stub')).toHaveLength(0);
    });

    it('parks the operators at zero on a stub and draws no line of theirs', async () => {
      const { backend, fixture, host } = await renderDiagram({ wide: true });

      // The fase 0c patch: two operators sounding and six at zero, which is an
      // ordinary two-operator sound and not an edge case.
      backend.topology.set(ALGORITHM_2);
      backend.operators.set(eight(NOW, IDLE_PASS_MS));
      await fixture.whenStable();

      expect(host.querySelectorAll('.stub')).toHaveLength(6);
      // Op3 into Op4 is the one route left standing; the three that leave an
      // operator at zero are not drawn cut, they are not drawn at all.
      expect(routes(host)).toHaveLength(1);
      expect(routes(host)[0].classList.contains('route--inert')).toBe(false);
      // And the parked ones keep their dashed outline and their place: eight
      // nodes, drawn and never deleted.
      expect(nodes(host)).toHaveLength(8);
      expect(nodes(host)[0].classList.contains('node--inert')).toBe(true);
      const parked = parseFloat(nodes(host)[0].style.left);
      expect(parked).toBeGreaterThan(parseFloat(nodes(host)[2].style.left));
    });

    it('lays the five facts of the node in a row when the depth leaves no height', async () => {
      const { backend, fixture, host } = await renderDiagram({ wide: true });

      // Algorithm 6 is two rows, and two rows leave the node the height it has
      // in the 700 px composition, so it stacks its facts exactly as it does
      // there.
      backend.operators.set(theBuildsOwnPatch(NOW));
      backend.topology.set(ALGORITHM_6);
      await fixture.whenStable();
      expect(nodes(host)[0].classList.contains('node--squat')).toBe(false);

      // Eight rows in the same box: the node cannot stack its five facts in an
      // eighth of it, so it lies them down and takes the width to do it.
      backend.topology.set(ALGORITHM_66);
      await fixture.whenStable();
      for (const node of nodes(host)) {
        expect(node.classList.contains('node--squat')).toBe(true);
      }
      expect(parseFloat(nodes(host)[0].style.height)).toBeLessThan(100 / 8);
    });

    it('gives the 700 px grid back exactly as it was when a capture takes the room', async () => {
      const { backend, fixture, host, room } = await renderDiagram({ wide: true });

      backend.operators.set(eight(NOW, IDLE_PASS_MS));
      backend.topology.set(ALGORITHM_2);
      await fixture.whenStable();

      room.big.set(false);
      await fixture.whenStable();

      expect(host.querySelector('.routes')?.getAttribute('viewBox')).toBe(
        `0 0 ${CANVAS_W} ${CANVAS_H}`,
      );
      // The narrow composition parks nothing and cuts nothing out: the three
      // routes are back, and the ones out of an operator at zero are drawn cut.
      expect(routes(host)).toHaveLength(3);
      expect(host.querySelectorAll('.stub')).toHaveLength(0);
      expect(host.querySelectorAll('.bus')).toHaveLength(6);
    });

    it('cuts the loop at zero here too, so the two drawings say the same thing', async () => {
      const { backend, fixture, host } = await renderDiagram({ wide: true });

      // Op1 carries the loop and is at 90, so nothing is parked and the arc is
      // drawn: what is at zero is the feedback amount, which is a reading of its
      // own and not the operator's Level.
      backend.operators.set(theBuildsOwnPatch(NOW));
      backend.topology.set(ALGORITHM_2);
      backend.patch.set({ ...backend.patch(), feedback: polled(0, NOW) });
      await fixture.whenStable();

      expect(host.querySelectorAll('.stub')).toHaveLength(0);
      expect(host.querySelector('.feedback')?.classList.contains('feedback--inert')).toBe(true);
      expect(host.querySelector('.label--feedback')?.textContent?.trim()).toBe('FB 0');

      backend.patch.set({ ...backend.patch(), feedback: polled(7, NOW) });
      await fixture.whenStable();
      expect(host.querySelector('.feedback')?.classList.contains('feedback--inert')).toBe(false);
    });
  });
});

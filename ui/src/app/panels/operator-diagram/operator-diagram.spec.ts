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
import { ColumnShape, DESIGN_BODY_W, diagramLane } from '../glass-column/column-geometry';
import { Composition } from '../../shell/composition';
import { staleAfterMs } from '../../provenance/freshness';
import { DEAD_MARK } from '../../provenance/provenance';
import { FOLDING, NEVER_FOLDS } from './folding';
import { CANVAS_H, CANVAS_W } from './layout';
import { LEGEND, ZONE_PAD_X } from './legend';
import {
  DAYLIGHT_CRITERION,
  LEVEL_MAX,
  PIXELS_PER_POINT,
  bodyWidthFloor,
  canvasWidth,
  datumDaylight,
  floorCanvasWidth,
  laneFloor,
  levelTrackInset,
  narrowestGridCard,
  narrowestWideCard,
  originGone,
  originOffset,
  readableCard,
  readableTrack,
  trackInset,
  trackLength,
} from './node-geometry';
import { OperatorDiagram } from './operator-diagram';
import { SPECTRAL_GLYPH } from './spectral-glyph';
import {
  COL_GAP,
  MARGIN_X,
  WIDE_CANVAS_H,
  WIDE_CANVAS_W,
  WIDE_COLUMNS,
  wideLayout,
} from './wide-layout';

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
  const scrolled = signal(0);
  return {
    big,
    wide: big.asReadonly(),
    panels: computed(() => !big()),
    pinned: pin.asReadonly(),
    // The three shapes, from the same two signals the real one derives them
    // from: the fold's width trigger is per lane, and the rail and the pinned
    // composición are 54 px apart (`folding.ts`).
    shape: computed<ColumnShape>(() => (big() ? (pin() ? 'gone' : 'rail') : 'ranuras')),
    togglePin: () => pin.set(!pin()),
    // Where the body's horizontal scroll is, handed over: the body is `app.ts`'s
    // box and this panel only reads where it was left (#86).
    scrollLeft: scrolled.asReadonly(),
    scrollBody: (left: number) => scrolled.set(left),
  };
}

async function renderDiagram({ wide = false, folding = true } = {}) {
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
      // The bench's switch, handed over the same way (`folding.ts`). The app
      // never sees it off; #81 measures the floor on the drawing it makes.
      { provide: FOLDING, useValue: signal(folding).asReadonly() },
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

function datums(host: HTMLElement): HTMLElement[] {
  return Array.from(host.querySelectorAll<HTMLElement>('.node__datum'));
}

/**
 * One node's fill, as the two percentages the drawing wrote on it.
 *
 * Both are read, never just the one the caller expects: the Level is the length
 * along the axis its composición carries it on, and the other dimension is the
 * whole of the track. A helper that returned a single number would be making the
 * choice the test is supposed to be checking.
 */
function fillOf(node: HTMLElement): { width: string; height: string } {
  const fill = node.querySelector<HTMLElement>('.node__fill');
  return { width: fill?.style.width ?? '', height: fill?.style.height ?? '' };
}

/** Where a node's ceiling mark hangs, as the pair the template wrote. */
function datumOf(node: HTMLElement): { left: string; bottom: string } {
  const datum = node.querySelector<HTMLElement>('.node__datum');
  return { left: datum?.style.left ?? '', bottom: datum?.style.bottom ?? '' };
}

/** A `left: 12.5%` back as the number, which is how the drawing rides the canvas. */
function percent(value: string | undefined): number {
  return Number.parseFloat(value ?? '');
}

/**
 * The patch the app boots into, and #67's case: `Init Normal (FM-X)` reads
 * `99 · 14 · 16 · 99 · 99 · 99 · 9 · 53`, so the ceiling is at the top of the
 * range and four operators are tied at it.
 *
 * Not the same thing as the two hardware readings that confirmed the defect —
 * those were taken with the algorithm and the Levels edited on the keyboard, so
 * the ancla still said `Init Normal (FM-X)` while the patch was no longer it.
 * This is the factory patch as it ships, which is what the acceptance is about:
 * it is the first thing anyone opens.
 */
function theBootPatch(readAt: number): OperatorsView {
  const levels = [99, 14, 16, 99, 99, 99, 9, 53];
  return {
    operators: levels.map((level, index) =>
      reading(index + 1, { role: index === 7 ? 'carrier' : 'modulator', level, ratio: 1 }, readAt),
    ),
    passMs: IDLE_PASS_MS,
    passes: 12,
  };
}

/** Eight operators read, every one of them at zero. A ceiling with no gaps under it. */
function everythingSilent(readAt: number): OperatorsView {
  return {
    operators: [1, 2, 3, 4, 5, 6, 7, 8].map((operator) =>
      reading(operator, { role: 'modulator', level: 0, ratio: 1 }, readAt),
    ),
    passMs: IDLE_PASS_MS,
    passes: 12,
  };
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

/**
 * The **1**: eight portadoras on the bus and not one line between them. The
 * widest the wide drawing gets, so the gutter between two cards is at its
 * narrowest — which is what put `FB 0` on top of Op2 (#68).
 */
const ALGORITHM_1: Topology = {
  number: 1,
  routes: [],
  carriers: [1, 2, 3, 4, 5, 6, 7, 8],
  feedback: { from: 1, into: 1 },
  depth: [0, 0, 0, 0, 0, 0, 0, 0],
  branch: [1, 2, 3, 4, 5, 6, 7, 8],
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

  /**
   * The label rule, and the reason it broke: the labels were written before the nodes,
   * so the node painted over the left half of `FB 0` and the anillo's figure
   * read `B 0` (#68). Paint order was a consequence of template order and
   * nothing said so, which is why nothing failed when it changed.
   *
   * Both halves are asserted because either alone passes while the other fails.
   * The order settles it between siblings that share a stacking context; the
   * `z-index` settles it if a card ever gets one of its own — a transform, a
   * filter — and quietly wins its way back on top.
   */
  it('draws every label after the nodes, and says so in the sheet too', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.operators.set(eight(NOW, IDLE_PASS_MS));
    backend.topology.set(ALGORITHM_2);
    await fixture.whenStable();

    const drawn = nodes(host);
    const written = Array.from(host.querySelectorAll<HTMLElement>('.label'));
    expect(drawn.length).toBe(8);
    expect(written.length).toBe(2);
    for (const label of written) {
      for (const node of drawn) {
        // DOCUMENT_POSITION_FOLLOWING: the label comes after the node.
        expect(node.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    }

    const rule = componentCss().match(/\.label\[[^\]]*\]\s*\{[^}]*\}/)?.[0] ?? '';
    expect(rule).toMatch(/z-index:\s*1/);
    // And the anchor is the label's near edge, not its centre: a centred label
    // is one that starts half its width back over the box it belongs to.
    expect(rule).toContain('translateY(-50%)');
    expect(rule).not.toContain('translate(-50%');
  });

  /**
   * The 1 in the wide drawing: eight cards on the bus row, so the gutter beside
   * Op1 is `COL_GAP` and the words do not fit in it. The label goes into the gap
   * above the row instead, and what the test asserts is the property — the
   * anchor is not inside any card — rather than which of the two places it
   * ended up in, which is `wide-layout.spec.ts`'s question.
   */
  it('never anchors the feedback label inside a node, at the widest algorithm', async () => {
    const { backend, fixture, host } = await renderDiagram({ wide: true });

    backend.operators.set(eight(NOW, IDLE_PASS_MS));
    for (const drawn of [ALGORITHM_1, ALGORITHM_2]) {
      backend.topology.set(drawn);
      await fixture.whenStable();

      const label = host.querySelector<HTMLElement>('.label--feedback');
      const at = { x: percent(label?.style.left), y: percent(label?.style.top) };
      for (const node of nodes(host)) {
        const box = {
          left: percent(node.style.left),
          top: percent(node.style.top),
          width: percent(node.style.width),
          height: percent(node.style.height),
        };
        const over =
          at.x >= box.left &&
          at.x <= box.left + box.width &&
          at.y >= box.top &&
          at.y <= box.top + box.height;
        expect(over, `algorithm ${drawn.number}, Op${node.dataset['operator']}`).toBe(false);
      }
    }
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

  it('makes the Level the length of the fill and the number only confirm it', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.operators.set(eight(NOW, IDLE_PASS_MS));
    await fixture.whenStable();

    const drawn = nodes(host);
    expect(fillOf(drawn[3]).height).toBe('99%');
    expect(drawn[3].querySelector('.node__level')?.textContent?.trim()).toBe('99');
    expect(fillOf(drawn[2]).height).toBe('75%');
    // An operator at zero has no fill at all, and it is cut, not absent.
    expect(fillOf(drawn[0]).height).toBe('0%');
  });

  it('carries Level in the grid node’s height, which round 10 did not turn', async () => {
    const { backend, fixture, host } = await renderDiagram();
    backend.operators.set(eight(NOW, IDLE_PASS_MS));
    await fixture.whenStable();

    // The 3 × 3 grid measures up the node, and the cross dimension is the whole
    // of the track and says nothing. Both numbers are written, so which of them
    // is the measurement is a fact about the drawing rather than about a rule.
    const node = nodes(host)[2];
    expect(node.classList.contains('node--level-width')).toBe(false);
    expect(fillOf(node)).toEqual({ width: '100%', height: '75%' });
  });

  it('carries Level in the width in both of the wide composición’s boxes', async () => {
    const { backend, fixture, host } = await renderDiagram({ wide: true });

    // Algorithm 66 is eight rows deep, so its cards are battens; algorithm 2 with
    // six of the eight at zero is three, so they are stacked nodes. Two boxes with
    // different proportions and one axis: the axis is the composición's and never
    // the box's, and a rule read off the proportions would answer differently on
    // these two — and would change its answer again on a window resize, with
    // nothing failing.
    //
    // The batten is drawn on a patch with **nothing** at zero, and it has to be
    // since #83: a parked operator leaves the stack and the stack closes up behind
    // it, so the 66 with six parked is a two-row chain and not an eight-row one.
    backend.topology.set(ALGORITHM_66);
    backend.operators.set(theBuildsOwnPatch(NOW));
    await fixture.whenStable();

    const batten = nodes(host)[2];
    expect(batten.classList.contains('node--squat')).toBe(true);
    expect(batten.classList.contains('node--level-width')).toBe(true);
    expect(fillOf(batten)).toEqual({ width: '71%', height: '100%' });

    backend.topology.set(ALGORITHM_2);
    backend.operators.set(eight(NOW, IDLE_PASS_MS));
    await fixture.whenStable();

    const stacked = nodes(host)[2];
    expect(stacked.classList.contains('node--squat')).toBe(false);
    expect(stacked.classList.contains('node--level-width')).toBe(true);
    expect(fillOf(stacked)).toEqual({ width: '75%', height: '100%' });
  });

  /**
   * The fill's ink runs WITH the axis: dense at the origin, fading toward the
   * far end, in the direction the composición declares (#93, ADR-0008 §2.6).
   *
   * What this asserts is that the **stylesheet spells the axis** — a literal
   * `to top` on the grid's fill and a literal `to right` under
   * `.node--level-width` — and not that the drawing reads. The only evidence
   * that the rotated bar reads is look 1 of ADR-0008 §8, taken on a screen; a
   * green run here is not that evidence, and citing it as such is the fossil
   * failure with a test as the fossil.
   *
   * Four positive assertions and not two, on purpose. Role sets the stops and
   * composición sets the direction — never the product of the two — so the two
   * direction declarations are role-blind by construction. Two assertions
   * cannot tell that structure from the product version; carrier and modulator
   * in each composición can, and they are what fails the day a role is "fixed"
   * by writing a `background` with a direction on `.node--carrier`.
   *
   * Read from `background-image` and never the `background` shorthand: jsdom
   * reserialises the shorthand and drops the gradient, while the longhand comes
   * back with `var()` unsubstituted and its whitespace reflowed — hence a
   * pattern and not a string. This is the suite's first
   * `getComputedStyle`. If a jsdom upgrade ever returns empty here, the two
   * honest moves are to assert the two rules against `componentCss()`, or to
   * drop the test and record in ADR-0008 §8 that the ink's axis is unasserted.
   * The move that is not honest is the negative — «no longer contains
   * `to top`» — which goes green when the bed sees no stylesheet at all.
   */
  it('runs the fill’s ink along the axis the composición declares, whatever the role', async () => {
    const direction = (node: HTMLElement): string => {
      const fill = node.querySelector<HTMLElement>('.node__fill');
      return fill ? getComputedStyle(fill).backgroundImage : '';
    };
    // `eight()` reads OP3 as a modulator and OP4 as a carrier, both lit.
    const { backend, fixture, host, room } = await renderDiagram();
    backend.operators.set(eight(NOW, IDLE_PASS_MS));
    await fixture.whenStable();
    const [, , gridModulator, gridCarrier] = nodes(host);
    expect(gridModulator.dataset['role']).toBe('modulator');
    expect(gridCarrier.dataset['role']).toBe('carrier');
    expect(direction(gridModulator)).toMatch(/linear-gradient\(\s*to top,/);
    expect(direction(gridCarrier)).toMatch(/linear-gradient\(\s*to top,/);

    room.big.set(true);
    await fixture.whenStable();
    const [, , wideModulator, wideCarrier] = nodes(host);
    expect(wideModulator.classList.contains('node--level-width')).toBe(true);
    expect(wideModulator.dataset['role']).toBe('modulator');
    expect(wideCarrier.dataset['role']).toBe('carrier');
    expect(direction(wideModulator)).toMatch(/linear-gradient\(\s*to right,/);
    expect(direction(wideCarrier)).toMatch(/linear-gradient\(\s*to right,/);
  });

  /**
   * The claim the body's floor is anchored on: **folding can only ever buy
   * margin** (#81).
   *
   * The floor is measured on the unfolded drawing at the deepest algorithm and
   * taken as the floor at every depth. That cuts the loop — a floor measured on
   * the folded drawing sets a threshold that shallows the binding case that
   * lowers the floor again — but only while a folded node is never *taller* than
   * the unfolded one whose facts it collapses, at the same row count. It is
   * exactly the shape of a fact that stops being true quietly: a band that grows
   * a second line, a stamp that needs its own row, and the anchor sits silently
   * below the real floor with nothing failing.
   *
   * **Written against the switch and not against the fold**, which is why it can
   * be here before #82 is. `FOLDING` is the seam the fold reads (`folding.ts`),
   * so what this compares is the drawing the app makes against the drawing the
   * bench makes, at the same algorithm — the two are equal today, because the
   * only thing folding changes so far is an attribute, and this goes red the day
   * a folded band comes out taller than the card it replaced.
   *
   * Both wide classes, forced by algorithm number: the 66 is eight rows and a
   * batten, the 2 is three rows and a stacked node, and the 1 is the shallowest
   * drawing there is. A predicate could drift; a number cannot.
   */
  it('never gives a node a taller card with folding on than with it off', async () => {
    const classes = new Set<boolean>();
    for (const drawn of [ALGORITHM_66, ALGORITHM_2, ALGORITHM_1]) {
      const cards = [];
      for (const folding of [false, true]) {
        // Two drawings in one test, so the module is torn down between them: the
        // switch is a provider, and the whole claim is that it is the only thing
        // that differs.
        TestBed.resetTestingModule();
        const { backend, fixture, host } = await renderDiagram({ wide: true, folding });
        backend.topology.set(drawn);
        // The patch the floor was measured on, and nothing at zero: a parked
        // operator leaves the branches and would draw a shallower 66 than the
        // one the anchor is about.
        backend.operators.set(theBuildsOwnPatch(NOW));
        await fixture.whenStable();

        cards.push(
          nodes(host).map((node) => ({
            operator: node.dataset['operator'],
            row: percent(node.style.top),
            height: percent(node.style.height),
            squat: node.classList.contains('node--squat'),
          })),
        );
      }
      const [unfolded, folded] = cards;

      for (const [index, node] of folded.entries()) {
        const where = `algorithm ${drawn.number}, Op${node.operator}`;
        expect(node.height, where).toBeLessThanOrEqual(unfolded[index].height);
        // And the positions do not fold: depth is height, so an operator that
        // gave up its facts is still above what it modulates.
        expect(node.row, where).toBe(unfolded[index].row);
        expect(node.operator, where).toBe(unfolded[index].operator);
        classes.add(node.squat);
      }
    }
    // Both wide classes are in the sweep, so this is about the drawing and not
    // about whichever box the deepest algorithm happens to use: the 66 at eight
    // rows is a batten, the 1 at one row is a stacked node.
    expect(classes).toEqual(new Set([true, false]));
  });

  it('measures the fill against the track and never against the card', async () => {
    // The claim is about pixels and jsdom lays nothing out, so what the rendered
    // node can say is that the fill's box is the *track*'s and the track is the
    // card less the headroom at one end. The px half is `node-geometry.ts`'s.
    const { backend, fixture, host } = await renderDiagram();
    backend.operators.set(theBuildsOwnPatch(NOW));
    await fixture.whenStable();

    const track = nodes(host)[2].querySelector<HTMLElement>('.node__track');
    expect(track?.style.top).toBe(`${levelTrackInset('height')}px`);
    // At one end and nowhere else: three zeros, written rather than left to the
    // sheet, because a zero only a stylesheet holds is one no test can fail on.
    expect(track?.style.right).toBe('0px');
    expect(track?.style.bottom).toBe('0px');
    expect(track?.style.left).toBe('0px');

    // 71 against a ceiling of 99 is 28 % of the **track**, which on the smallest
    // card the grid draws is about 15.4 px of gap — and that gap is the whole
    // comparison. Against the card it would be a fifth wider and its far end
    // would be the border the ceiling has to be drawn against (#67).
    //
    // It was 15.7 until #81 read the legend's rendered band: the legend takes 8
    // px more than this build was spending, the floor grew by 4 to keep what the
    // 360 promised the canvas, and the canvas at the floor came out 4 px shorter
    // than the model said. Every figure derived through that scale moved with it.
    const gap = ((99 - 71) / 100) * trackLength(narrowestGridCard(), 'height');
    expect(gap).toBeCloseTo(15.4, 1);
    expect(gap).toBeLessThan(((99 - 71) / 100) * narrowestGridCard());
  });

  it('puts the headroom at the far end of the axis that carries Level, in the wide drawing', async () => {
    const { backend, fixture, host } = await renderDiagram({ wide: true });
    backend.topology.set(ALGORITHM_66);
    backend.operators.set(theBuildsOwnPatch(NOW));
    await fixture.whenStable();

    // The loud end is the right one now, so that is where the datum's ink needs
    // its room — and the other three edges are the card's own, which is what
    // keeps the fill's corners rounded by `.node`'s `overflow: hidden`.
    const track = nodes(host)[2].querySelector<HTMLElement>('.node__track');
    expect(track?.style.right).toBe(`${levelTrackInset('width')}px`);
    expect(track?.style.top).toBe('0px');
    expect(track?.style.bottom).toBe('0px');
    expect(track?.style.left).toBe('0px');
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

  it('repeats the ceiling mark on all eight at one offset, in both compositions', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.operators.set(theBuildsOwnPatch(NOW));
    await fixture.whenStable();

    expect(datums(host)).toHaveLength(8);
    // Not one line across the eight — it never was one, in either drawing. What
    // makes the eight comparable is that the mark sits at the same fraction of
    // an identical track on every card: one origin and one scale. Asserted as
    // the offset and not as `element-exists`, which is the check that stayed
    // green for the whole life of the old defect.
    for (const node of nodes(host)) {
      expect(datumOf(node)).toEqual({ left: '0%', bottom: '99%' });
      expect(fillOf(node).width).toBe('100%');
    }

    // The gap the mark measures is the fill's, so the loudest operator's fill
    // ends where every card's mark is and the other seven are read off it.
    expect(fillOf(nodes(host)[2]).height).toBe('71%');
    expect(fillOf(nodes(host)[7]).height).toBe('99%');
  });

  it('turns the ceiling mark with the axis, and hangs it off the shared origin', async () => {
    const { backend, fixture, host } = await renderDiagram({ wide: true });

    backend.topology.set(ALGORITHM_66);
    backend.operators.set(theBuildsOwnPatch(NOW));
    await fixture.whenStable();

    // The same claim, ninety degrees round: the mark is positioned along the
    // carrying axis and pinned at the origin on the other, on all eight. Where
    // the cards are stacked in one column they measure from the same left edge
    // at the same scale, so the eight marks line up into a rule that can be
    // sighted along — which is the deep case, and the case the datum was
    // failing hardest in.
    expect(datums(host)).toHaveLength(8);
    for (const node of nodes(host)) {
      expect(datumOf(node)).toEqual({ left: '99%', bottom: '0%' });
      expect(fillOf(node).height).toBe('100%');
    }
    const left = nodes(host).map((node) => node.style.left);
    const width = nodes(host).map((node) => node.style.width);
    expect(new Set(left).size).toBe(1);
    expect(new Set(width).size).toBe(1);
  });

  it('hangs no datum until something has answered its Level', async () => {
    const { host } = await renderDiagram();

    // A ceiling over eight dashes would be a baseline the patch does not have.
    expect(datums(host)).toHaveLength(0);
  });

  it('hangs no datum when every operator has answered zero', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.operators.set(everythingSilent(NOW));
    await fixture.whenStable();

    // Not because the figure is missing — it is 0 and it was read. The datum
    // turns eight heights into seven gaps, and a flat floor has none to make, so
    // `THE LOUDEST OPERATOR IN THIS PATCH` would be naming a silent one.
    expect(datums(host)).toHaveLength(0);
  });

  it('keeps the ceiling as a measurement even where it draws nothing', async () => {
    const { backend, fixture } = await renderDiagram();
    const panel = fixture.componentInstance as unknown as {
      ceiling: () => number | null;
      ceilingLine: () => number | null;
    };

    expect(panel.ceiling()).toBeNull();

    backend.operators.set(everythingSilent(NOW));
    await fixture.whenStable();

    // Read-and-silent is not unread, exactly as `FB 0` is not a feedback nobody
    // polled. Only the drawing collapses them; the model must not, or the next
    // thing to ask gets a wrong answer with no way to tell.
    expect(panel.ceiling()).toBe(0);
    expect(panel.ceilingLine()).toBeNull();
  });

  it('still hangs the datum over an operator that answered zero', async () => {
    const { backend, fixture, host } = await renderDiagram();

    backend.operators.set({
      ...eight(NOW, IDLE_PASS_MS),
      operators: [
        reading(1, { role: 'carrier', level: 99, ratio: 1 }, NOW),
        reading(2, { role: 'modulator', level: 0, ratio: 1 }, NOW),
        ...[3, 4, 5, 6, 7, 8].map((operator) =>
          reading(operator, { role: 'modulator', level: 40, ratio: 1 }, NOW),
        ),
      ],
    });
    await fixture.whenStable();

    // One ceiling, so one height on all eight — including the node at zero,
    // whose whole gap is the reading. A `level > 0` filter drifting out of the
    // ceiling and into the nodes would take this node's line away and leave the
    // other seven looking correct.
    const hung = datums(host);
    expect(hung).toHaveLength(8);
    for (const datum of hung) {
      expect(datum.style.bottom).toBe('99%');
    }
    expect(fillOf(nodes(host)[1]).height).toBe('0%');
  });

  it('leaves the datum daylight against the card border, on the boot patch', async () => {
    const { backend, fixture, host } = await renderDiagram({ wide: true });

    backend.topology.set(ALGORITHM_66);
    backend.operators.set(theBootPatch(NOW));
    await fixture.whenStable();

    // The rendered subject: the ceiling is at the top of the range, four
    // operators tied at it, in the drawing that makes the smallest card.
    const hung = datums(host);
    expect(hung).toHaveLength(8);
    for (const node of nodes(host)) {
      expect(datumOf(node)).toEqual({ left: '99%', bottom: '0%' });
    }

    // And the claim about it, which jsdom cannot lay out and `node-geometry.ts`
    // therefore models: at that offset, the stroke's ink clears the card's own
    // border by `DAYLIGHT_CRITERION`. Before the track this was negative — the
    // line was inside the border and `overflow: hidden` had taken most of it —
    // while an assertion that the element existed went green on a line nobody
    // could see (#67).
    const card = narrowestWideCard();
    expect(datumDaylight(card, 'width', LEVEL_MAX)).toBeGreaterThanOrEqual(DAYLIGHT_CRITERION);
  });

  it('earns one inset per composición against that composición’s narrowest card', () => {
    // Two numbers now, because the two compositions measure along different
    // axes and their narrowest cards are different boxes. Both recomputed,
    // never written down: the grid's from `BODY_FLOOR`, the legend's rows and
    // the zone's chrome; the wide one from the card the width floor stops at,
    // which is the readable track plus what that track's own inset costs (#86).
    expect(levelTrackInset('height')).toBe(8);
    expect(levelTrackInset('width')).toBe(7);

    // The grid keeps the inset it shipped with, and it is no longer earned
    // against the wide composición's card: that card is three times smaller and
    // it no longer carries Level in its height, so a `Math.min` across the two
    // would be comparing a measurement with a dimension that stopped measuring.
    //
    // 67.1 and not the 68.0 that shipped: the canvas at the floor is 282 px and
    // not 286, because the legend's band is 62 px and not 54 (#81). The inset it
    // earns is 8 either way, and the pixel-at-a-time check below is what says so
    // rather than the number itself.
    expect(narrowestGridCard()).toBeCloseTo(67.1, 1);
    // 111 and not the 113.0 the rail left at the shipped window: the narrowest
    // card is the floor's now, and the window stops before the card gets there.
    expect(narrowestWideCard()).toBe(readableCard());
    expect(narrowestWideCard()).toBeGreaterThan(narrowestGridCard());

    for (const [card, axis] of [
      [narrowestGridCard(), 'height'],
      [narrowestWideCard(), 'width'],
    ] as const) {
      const daylight = datumDaylight(card, axis, LEVEL_MAX);
      expect(daylight).toBeGreaterThanOrEqual(DAYLIGHT_CRITERION);
      // And one pixel less of inset would not clear it, which is what makes each
      // of them earned rather than chosen. A pixel of inset is worth a pixel of
      // daylight less the point of track it takes back.
      expect(daylight - (1 - 1 / 100)).toBeLessThan(DAYLIGHT_CRITERION);
    }
  });

  it('never draws one Level point under a pixel on the axis that carries it', () => {
    // The number the whole rotation is about, and the reason it is not a taste
    // argument: on the vertical axis at the body's floor the deepest algorithm
    // drew a Level point at about a tenth of a pixel, so 99 and 96 were three
    // points and a third of a pixel apart. Since #86 the window stops where the
    // narrowest card would take a point under `PIXELS_PER_POINT`, so at that
    // card the track is exactly one pixel a point — not more, which would mean
    // the floor was set somewhere other than the criterion.
    expect(trackLength(narrowestWideCard(), 'width') / 100).toBe(PIXELS_PER_POINT);
    expect(readableTrack()).toBe(100);
    expect(readableCard()).toBe(111);
  });

  /**
   * The width floor, derived and never typed, and the two arithmetics that have
   * to agree on it.
   *
   * The floor's card is written in the *track* form of #67's derivation (the
   * track given, 100 px; the inset it earns, 7) and the inset the drawing binds
   * is earned in the *card* form (the card given, the inset solved for). They
   * are one derivation read from both ends, and 111 → 7 → 111 is the fixed point
   * both land on. Asserted as the round trip and not as either number: an inset
   * of 8 earned against a card of 110.999… would pass a check on «7» written
   * somewhere else and quietly put a pixel of the track into the headroom.
   */
  it('earns the floor’s inset from both ends of the same derivation', () => {
    expect(trackInset(readableCard())).toBe(levelTrackInset('width'));
    expect(readableCard() - 2 * 2 - trackInset(readableCard())).toBe(readableTrack());
    // And recomputed the other way — the floor's canvas, of which the eight-column
    // card is the share the four constants decide — the card is the same one.
    const pitchX = (WIDE_CANVAS_W - 2 * MARGIN_X) / WIDE_COLUMNS;
    expect(((pitchX - COL_GAP) / WIDE_CANVAS_W) * floorCanvasWidth()).toBeCloseTo(
      readableCard(),
      6,
    );
    expect(floorCanvasWidth()).toBeCloseTo(963.04, 2);
  });

  /**
   * The body's minimum is per shape and there is no per-shape constant: the lane
   * is one number, and what differs is what stands beside it. Both arms are
   * asserted with the slack the shipped window leaves, so the direction cannot
   * read as good news — the rail is the arm that binds, by 17 px.
   */
  it('puts the width floor on the body per shape, from one lane and no literal', () => {
    expect(laneFloor()).toBeCloseTo(999.04, 2);
    expect(laneFloor()).toBe(floorCanvasWidth() + 2 * ZONE_PAD_X);

    // 1 263 in the rail and 1 209 pinned — not the proposal's 1 211, which
    // predates the filete halving with the pin down (#76). The build wins.
    expect(bodyWidthFloor('rail')).toBeCloseTo(1263.04, 2);
    expect(bodyWidthFloor('gone')).toBeCloseTo(1209.04, 2);
    expect(DESIGN_BODY_W - bodyWidthFloor('rail')!).toBeCloseTo(17, 0);
    expect(DESIGN_BODY_W - bodyWidthFloor('gone')!).toBeCloseTo(71, 0);
    // The ranuras have no floor from here: their Level runs along the height.
    expect(bodyWidthFloor('ranuras')).toBeNull();

    // The floor is the body at which the lane is exactly the floor's lane, in
    // both shapes — the grid's sum and the model's are one arithmetic.
    for (const shape of ['rail', 'gone'] as const) {
      expect(diagramLane(shape, bodyWidthFloor(shape)!)).toBeCloseTo(laneFloor(), 9);
    }
    // And the shipped window is above it in both, which is why the app does not
    // scroll at rest.
    expect(canvasWidth('rail')).toBeGreaterThan(floorCanvasWidth());
    expect(canvasWidth('gone')).toBeGreaterThan(floorCanvasWidth());
  });

  it('does not clip the track, which is the one revert that hides the line again', async () => {
    await renderDiagram();

    // The datum's ink reaches past the line it names, on purpose, into the
    // headroom the inset just bought. A clipping track cuts it off at its own
    // edge exactly as the card's border did (#67) — and every other check here
    // would still pass, because the arithmetic would be unchanged.
    // Angular writes its own `[_ngcontent-…]` between the class and the brace.
    const track = /\.node__track[^{]*\{[^}]*\}/.exec(componentCss())?.[0] ?? '';
    expect(track).toContain('overflow: visible');
    // And the sheet declares no inset of its own: there are two of them now and
    // both live in `node-geometry.ts`, bound onto the track. A sheet that kept a
    // copy is how the model came to disagree with the screen in the first place.
    expect(track).not.toContain('inset:');
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

  it('draws the legend that legend.ts measures, in its rows and in order', async () => {
    const { host } = await renderDiagram();

    // The bridge between the drawing and the arithmetic. `legend.spec.ts` proves
    // each row of LEGEND fits its lane; this proves LEGEND is what is on screen.
    // Without it the width check would be summing a second copy of the strings
    // and could stay green while the panel said something else — which is the
    // shape of the assertion #65 replaced, one layer down.
    //
    // Read from LEGEND's own structure, so a copy edit that moves an entry
    // between rows fails here instead of silently redefining what is summed.
    const rows = host.querySelectorAll('.legend__row');
    expect(rows).toHaveLength(LEGEND.length);

    LEGEND.forEach((row, i) => {
      const items = rows[i].querySelectorAll('.legend__item');
      expect(items).toHaveLength(row.length);

      row.forEach((entry, j) => {
        // Order, not membership: the pairing is a rule, and a set check over
        // four strings passes whether AT ZERO · SILENT is on row 1 or row 2.
        expect(items[j].textContent?.trim()).toBe(entry.words);
        expect(items[j].querySelector(`.legend__swatch--${entry.swatch}`)).not.toBeNull();
      });
    });
  });

  it('names both dashed vocabularies, each once', async () => {
    const { host } = await renderDiagram();

    // Two dashes, not one. `--dash-inactive` is the shared one — the route out
    // of an operator at zero, its drop to the bus, the FB 0 arc (#57), the stub
    // and the inert contour — and `AT ZERO · SILENT` names it. The patch's
    // ceiling has its own, `--datum-ceiling-*`, and without the fourth entry it
    // is a line crossing all eight nodes that does not say what it is of.
    const legend = host.querySelector('.legend');
    expect(legend?.querySelectorAll('.legend__swatch--inert')).toHaveLength(1);
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
    /**
     * The origin under horizontal scroll, which is the decision #86 had to take
     * and ADR-0008 §5 records: a card whose zero has scrolled off the body's
     * left edge **stops claiming the axis** — its fill and its datum go, the
     * figure stays — and it does so per card, because the origin is a column's
     * and the leftmost column loses it first.
     *
     * Algorithm 1 is the drawing with eight columns, so eight distinct origins.
     * The thresholds come from the same arithmetic the drawing reads, on the
     * slots the layout actually places, and every step is asserted in both
     * directions: the card just past its origin is unanchored, the next column
     * over is not.
     */
    it('stops claiming the axis, card by card, as the scroll takes each origin away', async () => {
      const { backend, fixture, host, room } = await renderDiagram({ wide: true });

      backend.topology.set(ALGORITHM_1);
      backend.operators.set(theBuildsOwnPatch(NOW));
      await fixture.whenStable();

      const unanchored = () =>
        nodes(host)
          .filter((node) => node.classList.contains('node--unanchored'))
          .map((node) => Number(node.dataset['operator']));

      // At rest nothing has left: the body is at or above its floor and there is
      // nothing to scroll.
      expect(room.scrollLeft()).toBe(0);
      expect(unanchored()).toEqual([]);

      // Eight columns, eight origins, left to right — one per operator here.
      const origins = wideLayout(ALGORITHM_1, [], NEVER_FOLDS)
        .slots.map((slot) => ({ operator: slot.operator, at: originOffset(slot.x) }))
        .sort((a, b) => a.at - b.at);
      expect(new Set(origins.map((origin) => origin.at)).size).toBe(8);

      // Half a pixel short of the first origin, it is still on screen.
      room.scrollBody(origins[0].at - 0.5);
      await fixture.whenStable();
      expect(unanchored()).toEqual([]);

      // Half a pixel past it, that card and only that card has lost its zero.
      room.scrollBody(origins[0].at + 0.5);
      await fixture.whenStable();
      expect(unanchored()).toEqual([origins[0].operator]);
      // The figure is still on the card; what is gone is what measured from the
      // edge that left. The elements stay in the DOM and the sheet hides them,
      // which is what the rule below is checked for.
      const gone = nodes(host)[origins[0].operator - 1];
      expect(gone.querySelector('.node__level')?.textContent?.trim()).not.toBe('');
      expect(gone.querySelector('.node__fill')).not.toBeNull();

      // Past the fourth origin: four cards gone, four still measuring.
      room.scrollBody(origins[3].at + 0.5);
      await fixture.whenStable();
      expect(unanchored().sort()).toEqual(
        origins
          .slice(0, 4)
          .map((origin) => origin.operator)
          .sort(),
      );

      // Past the last, every card has stopped claiming the axis.
      room.scrollBody(origins[7].at + 0.5);
      await fixture.whenStable();
      expect(unanchored()).toHaveLength(8);

      // And back: the body widened or was scrolled home, and the bars return.
      room.scrollBody(0);
      await fixture.whenStable();
      expect(unanchored()).toEqual([]);
    });

    it('hides the fill and the datum of an unanchored card in the sheet, and nothing else', async () => {
      await renderDiagram({ wide: true });

      // `display: none` on both, because the datum is a border and a border with
      // no background stays painted. The figure is not in the rule: it stays.
      const rule =
        /\.node--unanchored[^{]*\.node__fill[^{]*,\s*\.node--unanchored[^{]*\.node__datum[^{]*\{[^}]*\}/.exec(
          componentCss(),
        )?.[0] ?? '';
      expect(rule).toContain('display: none');
      expect(rule).not.toContain('node__level');
    });

    it('never tells a grid card its origin left, whatever the body scrolled', async () => {
      // The narrow grid measures up from its own card's bottom edge, which no
      // horizontal scroll can take away — and its lane has no width floor for
      // the body to scroll under in the first place. Keyed to the axis, so a
      // scroll value that reaches this panel in the narrow composición is
      // ignored rather than misread.
      const { backend, fixture, host, room } = await renderDiagram({ wide: false });

      backend.topology.set(ALGORITHM_1);
      backend.operators.set(theBuildsOwnPatch(NOW));
      room.scrollBody(10_000);
      await fixture.whenStable();

      expect(host.querySelectorAll('.node--unanchored')).toHaveLength(0);
      expect(originGone(0, 10_000)).toBe(true);
    });

    it('puts every origin past the zone’s padding and the card’s border, at the floor', () => {
      // The offset is exact only at the floor, and that is the only time the
      // body scrolls sideways: the lane is then `laneFloor()` and the canvas
      // `floorCanvasWidth()`, so a card's `x` is a known share of a known width.
      const first = wideLayout(ALGORITHM_1, [], NEVER_FOLDS).slots.reduce((min, slot) =>
        slot.x < min.x ? slot : min,
      );
      expect(originOffset(first.x)).toBeCloseTo(
        ZONE_PAD_X + (first.x / WIDE_CANVAS_W) * floorCanvasWidth() + 2,
        9,
      );
      // About 34 px: the drawing is the first lane, so a body scrolled less than
      // that still shows every zero.
      expect(originOffset(first.x)).toBeGreaterThan(ZONE_PAD_X);
      expect(originOffset(first.x)).toBeLessThan(40);
    });

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
      // Out of the stack and not along the Level axis (#83): Op1 is drawn above
      // Op3, which is still in the branches, and at the same origin — the far end
      // of that axis is the loud end, and a silent operator drawn there would be a
      // position contradicting its own figure.
      expect(parseFloat(nodes(host)[0].style.top)).toBeLessThan(
        parseFloat(nodes(host)[2].style.top),
      );
      expect(parseFloat(nodes(host)[0].style.left)).toBe(parseFloat(nodes(host)[2].style.left));
    });

    /**
     * The inversion #70 reported, in the drawing's own ink: a live modulator whose
     * destination is parked is **drawn**, and it is drawn inert, so the drawing
     * never says less about a sounding operator than about a quiet one.
     *
     * The ink is the vocabulary `FB 0` already speaks (#57) — dashed and inert,
     * drawn and never deleted — and it is decided here rather than in the layout,
     * because this is where the Levels are. Both drawings therefore say it the same
     * way: the check below takes the wide one, where the route lands on a dead end,
     * and the narrow grid's `cuts the route of an operator at zero` covers the ink.
     */
    it('draws a live modulator into a parked operator, inert rather than not at all', async () => {
      const { backend, fixture, host } = await renderDiagram({ wide: true });

      // Algorithm 66 with Op2 alone at zero: Op1 is a modulador at 90 whose
      // documented destination is real and parked. It used to draw nothing at all.
      backend.topology.set(ALGORITHM_66);
      const patch = theBuildsOwnPatch(NOW);
      backend.operators.set({
        ...patch,
        operators: patch.operators.map((node) =>
          node.operator === 2 ? reading(2, { role: 'inert', level: 0, ratio: 1 }, NOW) : node,
        ),
      });
      await fixture.whenStable();

      expect(host.querySelectorAll('.stub')).toHaveLength(1);
      const drawn = routes(host);
      // Seven routes in the chain, less the one out of Op2, is six — and the one
      // into Op2 is among them, inert.
      expect(drawn).toHaveLength(6);
      const inert = drawn.filter((route) => route.classList.contains('route--inert'));
      expect(inert).toHaveLength(1);
      // It ends on the bar that closes Op2's stub, which is where the parked
      // operator now lives: `M x foot V bar …` against a route ending `… V bar`.
      const bar = (host.querySelector<SVGPathElement>('.stub')?.getAttribute('d') ?? '').split(' ');
      const ink = (inert[0].getAttribute('d') ?? '').split(' ');
      expect(Number(ink.at(-1))).toBeCloseTo(Number(bar[4]), 6);
    });

    it('lays the facts of the node in a row when the depth leaves no height', async () => {
      const { backend, fixture, host } = await renderDiagram({ wide: true, folding: false });

      // Algorithm 6 is two rows, and two rows leave the node the height it has
      // in the 700 px composition, so it stacks its facts exactly as it does
      // there.
      backend.operators.set(theBuildsOwnPatch(NOW));
      backend.topology.set(ALGORITHM_6);
      await fixture.whenStable();
      expect(nodes(host)[0].classList.contains('node--squat')).toBe(false);

      // Eight rows in the same box: the node cannot stack its five facts in an
      // eighth of it, so it lies them down and takes the width to do it. With
      // the switch off, which is the drawing #81 measured the floor on — with it
      // on this algorithm folds, and the test below is that one.
      backend.topology.set(ALGORITHM_66);
      await fixture.whenStable();
      for (const node of nodes(host)) {
        expect(node.classList.contains('node--squat')).toBe(true);
      }
      expect(parseFloat(nodes(host)[0].style.height)).toBeLessThan(100 / 8);
    });

    /**
     * What a folded node keeps and what it gives up, at the seam that draws it.
     *
     * The claim is not «three elements are missing» — it is that the two facts
     * the fold promised to keep are **still measurements**: the identity is
     * there, the Level's figure is there, and the fill still runs the whole
     * track against the same ceiling datum, so the loudest operator in the patch
     * is still found by eye. That is the one reading the fold may not cost, and
     * it is the one a check that counted elements would not have noticed losing.
     *
     * Forced by algorithm number, both triggers: the 66 is eight rows and folds
     * for its depth, the 1 is eight columns and folds for its width. And the
     * same drawing with the switch off is the five-fact node, which is what
     * makes this about the fold and not about the template.
     */
    it('keeps identity and Level in a folded node and gives up the other three', async () => {
      for (const drawn of [ALGORITHM_66, ALGORITHM_1]) {
        TestBed.resetTestingModule();
        const { backend, fixture, host } = await renderDiagram({ wide: true });
        backend.topology.set(drawn);
        backend.operators.set(theBuildsOwnPatch(NOW));
        backend.lowestLivePitch.set(60);
        await fixture.whenStable();

        for (const node of nodes(host)) {
          const where = `algorithm ${drawn.number}, Op${node.dataset['operator']}`;
          expect(node.classList.contains('node--folded'), where).toBe(true);
          expect(node.querySelector('.node__id')?.textContent?.trim(), where).toBe(
            `OP${node.dataset['operator']}`,
          );
          expect(node.querySelector('.node__level')?.textContent?.trim(), where).not.toBe('');
          // The three that fold, and the fill and the datum that do not.
          expect(node.querySelector('.node__line'), where).toBeNull();
          expect(node.querySelector('.node__hz'), where).toBeNull();
          expect(node.querySelector('.node__fill'), where).not.toBeNull();
          expect(node.querySelector('.node__datum'), where).not.toBeNull();
        }
        // Level is still the length of the fill, on the whole track: 99 against a
        // ceiling of 99 is the track's full width, and 71 is 71 % of the same one.
        expect(fillOf(nodes(host)[7])).toEqual({ width: '99%', height: '100%' });
        expect(fillOf(nodes(host)[2])).toEqual({ width: '71%', height: '100%' });
      }
    });

    it('gives the five facts back the moment the drawing has room for them', async () => {
      // The same algorithm, the same patch, the switch off: nothing folds, so
      // the three facts are back. What this is really asserting is that the fold
      // is a property of the drawing and not a state anything holds — there is
      // no unfolded/folded flag anywhere to get stuck.
      const { backend, fixture, host } = await renderDiagram({ wide: true, folding: false });
      backend.topology.set(ALGORITHM_66);
      backend.operators.set(theBuildsOwnPatch(NOW));
      await fixture.whenStable();

      for (const node of nodes(host)) {
        expect(node.classList.contains('node--folded')).toBe(false);
        expect(node.querySelector('.node__line')).not.toBeNull();
        expect(node.querySelector('.node__hz')).not.toBeNull();
      }
    });

    /**
     * The band wears **one** stamp and it is the weakest of the ones behind it.
     *
     * This is what stops the fold from folding the provenance and keeping the
     * value: three figures stopped being drawn, and the stamp that is left has
     * to answer for them too. The rank is written down at `FRESHNESS` — void,
     * then stale, then fresh, over the freshness of one source — because a rank
     * nobody can predict is a comparator and not a rule.
     *
     * Read at the rendered node, over a patch where the two disagree: Op3's
     * ratio is a whole threshold older than its Level, so a band that ranked its
     * figures the other way, or took the head's alone, would say `POLLED` over a
     * figure it is not currently backing.
     */
    it('stamps the folded band with the weakest of the figures behind it', async () => {
      const { backend, fixture, clock, host } = await renderDiagram({ wide: true });
      backend.topology.set(ALGORITHM_66);

      const old = NOW - staleAfterMs(IDLE_PASS_MS) - 1;
      backend.operators.set({
        ...theBuildsOwnPatch(NOW),
        operators: theBuildsOwnPatch(NOW).operators.map((node) =>
          node.operator === 3 ? { ...node, ratio: polled(1, old) } : node,
        ),
      });
      clock.now.set(NOW);
      await fixture.whenStable();

      const band = nodes(host)[2];
      expect(band.classList.contains('node--folded')).toBe(true);
      // One stamp, and it is the ratio's — a figure the band is no longer even
      // drawing.
      expect(band.querySelectorAll('.node__stamp')).toHaveLength(1);
      expect(band.dataset['stamp']).toBe('stale');
      // Stale keeps no word of its own (GLOSSARY §2): it is `POLLED` plus age,
      // and the age is the band's broken outline.
      expect(band.querySelector('.node__stamp')?.textContent?.trim()).toBe('POLLED');
      expect(band.classList.contains('node--stale')).toBe(true);
      // And a node whose figures all answered fresh is not dragged down with it:
      // the rank is per node, over what is in that node.
      expect(nodes(host)[3].dataset['stamp']).toBe('polled');
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

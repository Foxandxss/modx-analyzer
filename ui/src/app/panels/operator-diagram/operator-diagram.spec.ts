import { signal } from '@angular/core';
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
import { staleAfterMs } from '../../provenance/freshness';
import { DEAD_MARK } from '../../provenance/provenance';
import { OperatorDiagram } from './operator-diagram';

/** The two cadences that were measured: 42 addresses in silence, and under notes. */
const IDLE_PASS_MS = 84;
const PLAYING_PASS_MS = 430;

/** What time it is, in every test here. A real clock would decide the answers. */
const NOW = 10_000;

async function renderDiagram() {
  const backend = new FakeBackendGateway();
  // The clock is handed over rather than left running: the thing under test is a
  // decision about what time it is, and a test that cannot say what time it is
  // tests nothing. Clock carries only its `now`.
  const clock: Clock = { now: signal(NOW) };
  TestBed.configureTestingModule({
    imports: [OperatorDiagram],
    providers: [
      { provide: BACKEND_GATEWAY, useValue: backend },
      { provide: Clock, useValue: clock },
    ],
  });
  const fixture = TestBed.createComponent(OperatorDiagram);
  await fixture.whenStable();
  return { backend, fixture, clock, host: fixture.nativeElement as HTMLElement };
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
    expect(nodes(host)[0].querySelector('.node__hz')?.textContent).toContain(DEAD_MARK);

    // Middle C. Equal temperament says 261.63; the MODX measures 261.763, which
    // is the disagreement the stamp exists to keep visible.
    backend.lowestLivePitch.set(60);
    await fixture.whenStable();
    const line = nodes(host)[0].querySelector('.node__hz')?.textContent ?? '';
    expect(line).toContain('261.63 Hz');
    expect(line).toContain('PREDICTED');
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
    expect(node.querySelector('.node__line')?.textContent).toContain(DEAD_MARK);
    expect(node.querySelector('.node__hz')?.textContent).toContain(DEAD_MARK);
    // The Level is still a number: one figure missing does not take the node down.
    expect(node.querySelector('.node__level')?.textContent?.trim()).toBe('99');
  });
});

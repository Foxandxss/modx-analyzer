import { TestBed } from '@angular/core/testing';
import { BACKEND_GATEWAY } from '../../backend/backend-gateway';
import { FakeBackendGateway, fakeSweep } from '../../backend/fake-backend-gateway';
import { SweepReadout } from './sweep-readout';

async function renderSweep() {
  const backend = new FakeBackendGateway();
  TestBed.configureTestingModule({
    imports: [SweepReadout],
    providers: [{ provide: BACKEND_GATEWAY, useValue: backend }],
  });
  const fixture = TestBed.createComponent(SweepReadout);
  await fixture.whenStable();

  const element = () => fixture.nativeElement as HTMLElement;
  const buttons = () => Array.from(element().querySelectorAll('button'));

  return {
    backend,
    fixture,
    text: () => element().textContent ?? '',
    cells: () => Array.from(element().querySelectorAll('.sweep__cell')),
    alerts: () =>
      Array.from(element().querySelectorAll('.sweep__alert'))
        .map((node) => node.textContent ?? '')
        .join(' '),
    async press(label: string) {
      const button = buttons().find((candidate) => (candidate.textContent ?? '').includes(label));
      if (button === undefined) {
        throw new Error(`no hay botón «${label}»`);
      }
      button.click();
      await fixture.whenStable();
      return element().textContent ?? '';
    },
  };
}

describe('SweepReadout', () => {
  it('claims nothing before the first barrido', async () => {
    const { text, cells } = await renderSweep();

    expect(text()).toContain('SWEEP');
    expect(text()).toContain('— · not swept');
    expect(cells()).toHaveLength(0);
  });

  it('sweeps the Part and the operator the buttons say', async () => {
    const sweep = await renderSweep();

    await sweep.press('PART 1');
    await sweep.press('OP 1');
    await sweep.press('OP 2');
    await sweep.press('SWEEP');

    expect(sweep.backend.sweepCalls).toEqual([{ part: 2, operator: 3 }]);
  });

  it('says at which block it went looking, in the keyboard own hex', async () => {
    const sweep = await renderSweep();

    await sweep.press('PART 1');
    const text = await sweep.press('SWEEP');

    // Op1 of Part 2: `am = (0 << 4) | 1`.
    expect(text).toContain('49 01');
  });

  it('draws every offset of the block, dashes and all', async () => {
    const sweep = await renderSweep();

    await sweep.press('SWEEP');

    expect(sweep.cells()).toHaveLength(47);
    expect(sweep.text()).toContain('39 OF 47');
    // The eight the fake does not answer keep their shape and show the dash.
    const silent = sweep
      .cells()
      .filter((cell) => (cell.textContent ?? '').includes('—'))
      .map((cell) => cell.textContent ?? '');
    expect(silent).toHaveLength(8);
    expect(silent.some((cell) => cell.includes('2B'))).toBe(true);
  });

  /**
   * The criterion of the ticket: one value changed on the MODX's own panel
   * between two sweeps has to be readable as the offset that moved, by name.
   */
  it('names the offset that moved between two barridos', async () => {
    const sweep = await renderSweep();
    sweep.backend.sweepResult = (part, operator) => fakeSweep(part, operator, [0x1a]);

    await sweep.press('SWEEP');

    expect(sweep.alerts()).toContain('CHANGED 1A');
    expect(sweep.alerts()).toContain('Parameter 1A');
    expect(
      sweep.cells().filter((cell) => cell.classList.contains('sweep__cell--changed')),
    ).toHaveLength(1);
  });

  /** «Nothing moved» and «nothing to compare with» are two different sentences. */
  it('does not claim a comparison it never made', async () => {
    const sweep = await renderSweep();

    const first = await sweep.press('SWEEP');
    expect(first).not.toContain('NO CHANGES');

    sweep.backend.sweep.update((pass) => (pass === null ? pass : { ...pass, compared: true }));
    await sweep.fixture.whenStable();

    expect(sweep.text()).toContain('NO CHANGES');
  });

  it('shows the count climbing while the barrido is going and no table yet', async () => {
    const sweep = await renderSweep();
    sweep.backend.sweep.set({
      part: 2,
      operator: 1,
      done: 12,
      total: 47,
      answered: 9,
      running: true,
      tookMs: null,
      offsets: [],
      compared: false,
      changed: [],
    });
    await sweep.fixture.whenStable();

    expect(sweep.text()).toContain('12 OF 47');
    expect(sweep.cells()).toHaveLength(0);
    const barrer = Array.from(
      (sweep.fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((button) => (button.textContent ?? '').includes('SWEEP'));
    expect(barrer?.disabled).toBe(true);
  });

  /**
   * A Performance whose Part 2 is not FM-X. Forty-seven dashes is a **result**
   * and not a failure, and it must read as one: the block that was asked for,
   * and none of it answering.
   */
  it('draws a Part that answers nowhere as a finished sweep', async () => {
    const sweep = await renderSweep();
    sweep.backend.sweepResult = (part, operator) => ({
      ...fakeSweep(part, operator),
      answered: 0,
      offsets: fakeSweep(part, operator).offsets.map((offset) => ({ ...offset, value: null })),
    });

    const text = await sweep.press('SWEEP');

    expect(text).toContain('0 OF 47');
    expect(sweep.cells()).toHaveLength(47);
  });
});

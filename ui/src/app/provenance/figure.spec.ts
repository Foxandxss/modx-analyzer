import { TestBed } from '@angular/core/testing';
import { PolledValue, invalidated } from '../backend/backend-gateway';
import { Figure } from './figure';
import { DEAD_MARK } from './provenance';

async function render(value: PolledValue<string | number>, inputs: Record<string, unknown> = {}) {
  const fixture = TestBed.createComponent(Figure);
  fixture.componentRef.setInput('value', value);
  for (const [name, input] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, input);
  }
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('Figure', () => {
  it('draws the dash, in dead ink, when there is no value', async () => {
    const host = await render(invalidated<number>());

    const figure = host.querySelector('.figure');
    expect(figure?.textContent).toBe(DEAD_MARK);
    expect(figure?.classList.contains('figure--dead')).toBe(true);
  });

  it('never turns an absent value into a zero', async () => {
    const host = await render(invalidated<number>());

    expect(host.textContent).not.toContain('0');
  });

  it('pads to the width the slot draws', async () => {
    const host = await render({ value: 6, provenance: 'polled', readAt: 0 }, { pad: 2 });

    expect(host.querySelector('.figure')?.textContent).toBe('06');
    expect(host.querySelector('.figure')?.classList.contains('figure--dead')).toBe(false);
  });

  it('writes the unit next to a number and never next to a dash', async () => {
    expect(
      (await render({ value: 44100, provenance: 'polled', readAt: 0 }, { unit: ' Hz' }))
        .textContent,
    ).toBe('44100 Hz');
    expect((await render(invalidated<number>(), { unit: ' Hz' })).textContent).toBe(DEAD_MARK);
  });
});

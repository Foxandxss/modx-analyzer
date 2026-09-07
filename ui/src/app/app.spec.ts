import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { BACKEND_GATEWAY } from './backend/backend-gateway';
import { FakeBackendGateway } from './backend/fake-backend-gateway';
import { DEAD_MARK, REREAD_TOTAL } from './provenance/provenance';

async function renderApp() {
  const backend = new FakeBackendGateway();
  TestBed.configureTestingModule({
    imports: [App],
    providers: [{ provide: BACKEND_GATEWAY, useValue: backend }],
  });
  const fixture = TestBed.createComponent(App);
  await fixture.whenStable();
  return { backend, fixture, host: fixture.nativeElement as HTMLElement };
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

  it('says there is nothing measured instead of showing zeros', async () => {
    const { host } = await renderApp();

    const column = host.querySelector('app-figures-column');
    expect(column?.textContent).toContain('hay que volver a medir');
    expect(column?.textContent).toContain(DEAD_MARK);
  });

  it('counts the relectura against the 416 addresses of the patch', async () => {
    const { backend, fixture, host } = await renderApp();

    expect(host.querySelector('.strip__text')?.textContent).toBe(
      `RELECTURA · ${DEAD_MARK} DE ${REREAD_TOTAL}`,
    );

    backend.reread.set({ done: 118, total: REREAD_TOTAL });
    await fixture.whenStable();

    expect(host.querySelector('.strip__text')?.textContent).toBe('RELECTURA · 118 DE 416');
  });

  it('opens on the waterfall, the default the moment a note is live', async () => {
    const { host } = await renderApp();

    const selected = host.querySelector('.tabs__tab--on');
    expect(selected?.textContent?.trim()).toBe('WATERFALL');
  });
});

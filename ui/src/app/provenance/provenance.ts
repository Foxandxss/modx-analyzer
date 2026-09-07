import { Provenance } from '../backend/backend-gateway';

/**
 * The dash. A figure that is absent is drawn as a dash and never as a zero, and
 * a number never replaces another without passing through it.
 */
export const DEAD_MARK = '—';

/** What each stamp is called on screen. UI copy is Spanish; identifiers are not. */
export const PROVENANCE_LABEL: Readonly<Record<Provenance, string>> = {
  measured: 'MEDIDO',
  theory: 'TEORÍA',
  polled: 'SONDEADO',
  stale: 'CADUCO',
  invalidated: 'INVALIDADO',
};

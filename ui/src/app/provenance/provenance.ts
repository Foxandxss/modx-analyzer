import { Provenance } from '../backend/backend-gateway';

/**
 * The dash. A figure that is absent is drawn as a dash and never as a zero, and
 * a number never replaces another without passing through it.
 */
export const DEAD_MARK = '—';

/**
 * What each stamp is called on screen, per `GLOSSARY.md` §2 and §6.
 *
 * Four sources keep a word — `MEASURED`, `PREDICTED`, `POLLED`, `DOCUMENTED` —
 * because no shape tells a window of audio from arithmetic on a poll. The other
 * two lost theirs: **stale is not a source**, it is `POLLED` plus age, already
 * drawn by the broken outline and the seconds; and an invalidated figure is a
 * dash inside its kept outline, and writing a word beside a blank is labelling
 * the blank. Both keep their key, so nothing that reasons about provenance moves.
 */
export const PROVENANCE_LABEL: Readonly<Record<Provenance, string>> = {
  measured: 'MEASURED',
  theory: 'PREDICTED',
  polled: 'POLLED',
  stale: 'POLLED',
  invalidated: '',
};

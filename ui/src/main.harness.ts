import { bootstrapApplication } from '@angular/platform-browser';
import { HarnessBench } from './app/dev/harness-bench';
import { harnessConfig } from './app/dev/harness.config';

/**
 * The bench's entry point: the app, with a hand on the patch and no keyboard.
 *
 * It is a **second entry point** and not a flag inside `main.ts`, which is what
 * makes «it does not reach a production build» a fact about the module graph
 * rather than a promise: `ng build` builds `main.ts`, which imports nothing under
 * `dev/`, so no dead-code pass has to be trusted to strip anything.
 *
 * How to run it is in `README.md`. It is `pnpm run harness`.
 */
bootstrapApplication(HarnessBench, harnessConfig).catch((err) => console.error(err));

import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { AUDIO_WORKER } from '../audio/audio-service';
import { FakeAudioWorker } from '../audio/fake-audio-worker';
import { BACKEND_GATEWAY } from '../backend/backend-gateway';
import { FakeBackendGateway } from '../backend/fake-backend-gateway';
import { FOLDING } from '../panels/operator-diagram/folding';
import { HarnessPatch } from './harness-patch';

/**
 * The bench's wiring, and the whole of what makes it a bench.
 *
 * Three swaps against `app.config.ts` and nothing else: the gateway is the fake
 * one, the audio worker is the fake one, and the fold switch is bound to
 * something a hand can move. Everything else on screen — every component, every
 * sheet, every geometry module — is the app's.
 *
 * **It does not import `app.config.ts`, and `app.config.ts` does not import
 * this.** That is what keeps `TauriBackendGateway` out of a page with no Tauri
 * behind it, and this file out of the app the laptop runs: nothing reachable
 * from `src/main.ts` reaches anything under `dev/`.
 */
export const harnessConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // One instance behind two names: the app asks for the gateway, the bench
    // drives the fake, and they have to be the same object.
    FakeBackendGateway,
    { provide: BACKEND_GATEWAY, useExisting: FakeBackendGateway },
    HarnessPatch,
    // No bloques ever arrive, so the worker has nothing to do — but the screen
    // opens the bridge on its first frame, and a real `Worker` spun up to be
    // handed nothing is a thread and a wasm module for no reason.
    { provide: AUDIO_WORKER, useFactory: () => () => new FakeAudioWorker() },
    { provide: FOLDING, useFactory: (patch: HarnessPatch) => patch.folding, deps: [HarnessPatch] },
  ],
};

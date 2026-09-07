import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { BACKEND_GATEWAY } from './backend/backend-gateway';
import { TauriBackendGateway } from './backend/tauri-backend-gateway';

/**
 * The app the laptop runs. The only thing that differs from a test is which
 * implementation of the gateway is behind the token.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: BACKEND_GATEWAY, useClass: TauriBackendGateway },
  ],
};

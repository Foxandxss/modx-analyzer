import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BACKEND_GATEWAY, DumpView } from '../../backend/backend-gateway';

/**
 * La franja de aviso: the conditional strip of the unhappy states.
 *
 * It draws **under** the header, like the pánico's notice and the two cards, so
 * the pánico stays reachable while it is up. It carries one warning at a time and
 * it is not dismissible: what it is saying is still true.
 *
 * This session it carries exactly one thing — the volcado de seguridad that did
 * not go as it should. The message always ends in the full folder path, because a
 * warning about a safety file that does not say where to look is not a warning.
 */
@Component({
  selector: 'app-alert-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (warning(); as said) {
      <div class="strip" role="status">
        <span class="strip__mark" aria-hidden="true"></span>
        <span class="strip__text">{{ said.text }}</span>
        @if (said.reason; as reason) {
          <span class="strip__aside">{{ reason }}</span>
        }
        <span class="strip__aside">{{ said.path }}</span>
      </div>
    }
  `,
  styles: `
    .strip {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: 10px 22px;
      border-bottom: var(--rule-min) solid var(--alert);
      background: var(--panic-live-bg);
    }
    .strip__mark {
      flex: 0 0 auto;
      width: 20px;
      height: 20px;
      border: var(--rule-min) solid var(--alert);
      box-shadow: var(--glow-alert);
    }
    .strip__text {
      font-family: var(--font-num);
      font-size: var(--text-label);
      letter-spacing: 0.06em;
      color: var(--alert);
    }
    .strip__aside {
      font-family: var(--font-num);
      font-size: var(--text-micro);
      color: var(--ink-tertiary);
      overflow-wrap: anywhere;
    }
  `,
})
export class AlertStrip {
  private readonly backend = inject(BACKEND_GATEWAY);

  protected readonly warning = computed(() => dumpWarning(this.backend.dump()));
}

/**
 * What the strip says about a volcado, or nothing when there is nothing to say.
 *
 * `null` is the launch before the keyboard has answered — a volcado in progress is
 * not a warning — and `saved` is the happy path, which the VOLCADOS cell reports
 * and this strip stays out of.
 */
export function dumpWarning(
  dump: DumpView | null,
): { text: string; reason: string | null; path: string } | null {
  if (dump === null || dump.state === 'saved') {
    return null;
  }

  // The path of the folder and not of the file: on the failure there is no file,
  // and on the short one the folder is what the owner has to go and look inside.
  return {
    text:
      dump.state === 'short'
        ? `SHORT DUMP · ${dump.bytes} OF ${dump.expectedBytes} BYTES`
        : 'NO SAFETY DUMP · THIS SESSION WRITES NOTHING, SO CARRY ON',
    reason: dump.reason,
    path: dump.folder,
  };
}

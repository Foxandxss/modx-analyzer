import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AXIS_HIGH_MULTIPLE, AXIS_LOW_MULTIPLE } from 'modx-dsp';
import { AudioService } from '../../audio/audio-service';
import { Anchor } from '../../provenance/anchor';
import { DEAD_MARK } from '../../provenance/provenance';
import { Harmonics } from '../harmonics/harmonics';
import { Spectrum } from '../spectrum/spectrum';

/**
 * The two live panels: espectro on top, armónicos below.
 *
 * These are the one place that never dies — a vista viva is audio entering now,
 * so it is never invalidated and it carries nothing from the patch. Both wear the
 * `VIVO` stamp of their zone rather than one of the five figure stamps: what is
 * drawn here was neither measured, nor polled, nor computed from a parameter.
 *
 * The readouts move at 4 Hz and the canvases at 33, which is on purpose: a number
 * that changes 33 times a second is a number nobody can read, and a curve that
 * changes 4 times a second is a curve that stutters.
 */
@Component({
  selector: 'app-signal-views',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Spectrum, Harmonics],
  template: `
    <section class="view">
      <div class="view__head">
        <h2 class="view__title">ESPECTRO</h2>
        <span class="view__live" [class.view__live--dead]="stopped()">{{ liveStamp() }}</span>
        @if (patchChanged()) {
          <span class="view__alive">ESTO NO HA MUERTO · ES AUDIO</span>
        }
        <span class="view__readout"> LOG {{ axis }} · SUELO {{ floor() }} </span>
        @if (artefact(); as hz) {
          <span class="view__artefact">ARTEFACTO {{ hz }} Hz</span>
        }
      </div>
      <div class="view__frame">
        <app-spectrum />
      </div>
    </section>

    <section class="view">
      <div class="view__head">
        <h2 class="view__title">ARMÓNICOS</h2>
        <span class="view__live" [class.view__live--dead]="stopped()">{{ liveStamp() }}</span>
        @if (patchChanged()) {
          <span class="view__alive">ESTO NO HA MUERTO · ES AUDIO</span>
        }
        <span class="view__readout">n1 … n16</span>
      </div>
      <div class="view__frame">
        <app-harmonics />
      </div>
    </section>
  `,
  styleUrl: './signal-views.scss',
})
export class SignalViews {
  private readonly audio = inject(AudioService);

  /**
   * The chip that says out loud what these panels are, at the one moment the
   * rest of the screen has just gone to dashes.
   *
   * It is up for the 2 200 ms of the flash and no longer: the sentence is about
   * the change, not about the panel. Everything the ancla touched lost its
   * number and this did not, which without a word beside it looks like a bug.
   */
  protected readonly patchChanged = inject(Anchor).justChanged;

  /** `LOG 1×–32×`: the axis is multiples of the note, and it never changes. */
  protected readonly axis = `${AXIS_LOW_MULTIPLE}×–${AXIS_HIGH_MULTIPLE}×`;

  /** Measured, never the 33.3 of the constants: the panel says what it is doing. */
  protected readonly fps = computed(() => {
    const rate = this.audio.fps();
    return rate === null ? `${DEAD_MARK} fps` : `${rate.toFixed(1)} fps`;
  });

  /** The device stopped delivering, so these panels are a still and not a view. */
  protected readonly stopped = computed(() => this.audio.audioState() === 'gone');

  /**
   * `VIVO · N fps`, or the truth.
   *
   * «La vista viva nunca muere» was written on the premise that audio keeps
   * arriving whatever happens to MIDI. On this hardware that premise is false —
   * the two come down one USB cable — and a `VIVO` stamp over a stream that
   * ended is the worst thing this screen can say (#22). What is on the canvas
   * then is the last frame, held, and the stamp says so.
   */
  protected readonly liveStamp = computed(() =>
    this.stopped() ? 'PARADO · SIN DISPOSITIVO' : `VIVO · ${this.fps()}`,
  );

  protected readonly floor = computed(() => {
    const db = this.audio.floorDb();
    return db === null ? `${DEAD_MARK} dB` : `${db} dB`;
  });

  /**
   * The comb, named. **Never a badge without its frequency**: the hertz is what
   * tells the generator's comb apart from a harmonic of the mains or from
   * aliasing, so a warning with no number could not be acted on.
   */
  protected readonly artefact = computed(() => {
    const hz = this.audio.artefactHz();
    return hz === null ? null : Math.round(hz);
  });
}

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AXIS_HIGH_MULTIPLE, AXIS_LOW_MULTIPLE } from 'modx-dsp';
import { AudioService } from '../../audio/audio-service';
import { Anchor } from '../../provenance/anchor';
import { DEAD_MARK } from '../../provenance/provenance';
import { Composition, LiveView, Ranura, RanuraIndex } from '../../shell/composition';
import { RanuraChooser } from './ranura-chooser';
import { Harmonics } from '../harmonics/harmonics';
import { NotAHarmonic } from '../not-a-harmonic';
import { Scope } from '../scope/scope';
import { Spectrum } from '../spectrum/spectrum';
import { WATERFALL_AXES, lockCaption, waterfallCaption } from '../captions';
import { Waterfall } from '../waterfall/waterfall';

/**
 * The glass column: two Ranuras, and whichever Vista viva each one holds.
 *
 * The two ranuras are **fixed and never configurable**: the top half is always
 * the top half, whatever either holds, so a panel somebody has learned to read
 * is the same size every time they look at it. An empty ranura is empty glass —
 * `flex: 1` on both, unconditionally — and not room the other panel takes. The
 * boxes that come out of that are modelled in `column-geometry.ts`, which is
 * where the claim is checkable.
 *
 * Which of the four is in each is {@link Composition}'s business, and the pianist
 * gets at it through {@link RanuraChooser} — the panel's own title, in the head,
 * because the control for a panel belongs where the panel is. An empty ranura
 * keeps its head for exactly that reason: the title is the way back.
 *
 * These panels are the one place that never dies — a vista viva is audio
 * entering now, so it is never invalidated and it carries nothing from the
 * patch. All four wear the `LIVE` stamp of their zone rather than one of the
 * five figure stamps: what is drawn here was neither measured, nor polled, nor
 * computed from a parameter.
 *
 * The readouts move at 4 Hz and the canvases at 33, which is on purpose: a
 * number that changes 33 times a second is a number nobody can read, and a curve
 * that changes 4 times a second is a curve that stutters.
 */
@Component({
  selector: 'app-glass-column',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Spectrum, Harmonics, Scope, Waterfall, NotAHarmonic, RanuraChooser],
  template: `
    @for (ranura of ranuras(); track ranura.index) {
      <section class="view">
        <!-- La cabecera está SIEMPRE, tenga panel o no: el rótulo es el mando,
             así que una ranura vacía sin cabecera sería cristal sin manera de
             llenarlo. -->
        <div class="view__head">
          <h2 class="view__title">
            <app-ranura-chooser [ranura]="ranura.index" [holds]="ranura.holds" />
          </h2>
          @if (ranura.holds; as view) {
            <span class="view__live" [class.view__live--dead]="stopped()">{{ liveStamp() }}</span>
            @if (patchChanged()) {
              <span class="view__alive">STILL TRUE · THIS IS AUDIO</span>
            }
            <span class="view__readout">{{ readout(view) }}</span>
            @if (view === 'SPECTRUM' && artefact(); as hz) {
              <app-not-a-harmonic class="view__artefact" [hz]="hz" />
            }
            @if (view === 'WATERFALL') {
              <span class="view__axes">{{ axes }}</span>
            }
          }
        </div>
        <div class="view__frame">
          @switch (ranura.holds) {
            @case ('SPECTRUM') {
              <app-spectrum />
            }
            @case ('HARMONICS') {
              <app-harmonics />
            }
            @case ('SCOPE') {
              <app-scope />
            }
            @case ('WATERFALL') {
              <app-waterfall />
            }
          }
        </div>
      </section>
    }
  `,
  styleUrl: './glass-column.scss',
})
export class GlassColumn {
  private readonly audio = inject(AudioService);

  private readonly slots = inject(Composition).slots;

  /**
   * The pair, top first, each half carrying which half it is.
   *
   * Both entries are drawn and either may be empty glass. The index travels with
   * the contents because the chooser in the head speaks for a *ranura* and not
   * for a panel: it is the top half's title whether or not the top half holds
   * anything.
   */
  protected readonly ranuras = computed<readonly Slot[]>(() => {
    const [top, bottom] = this.slots();
    return [
      { index: 0, holds: top },
      { index: 1, holds: bottom },
    ];
  });

  protected readonly axes = WATERFALL_AXES;

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
  private readonly axis = `${AXIS_LOW_MULTIPLE}×–${AXIS_HIGH_MULTIPLE}×`;

  /** Measured, never the 33.3 of the constants: the panel says what it is doing. */
  protected readonly fps = computed(() => {
    const rate = this.audio.fps();
    return rate === null ? `${DEAD_MARK} fps` : `${rate.toFixed(1)} fps`;
  });

  /** The device stopped delivering, so these panels are a still and not a view. */
  protected readonly stopped = computed(() => this.audio.audioState() === 'gone');

  /**
   * `LIVE · N fps`, or the truth.
   *
   * «La vista viva nunca muere» was written on the premise that audio keeps
   * arriving whatever happens to MIDI. On this hardware that premise is false —
   * the two come down one USB cable — and a `LIVE` stamp over a stream that
   * ended is the worst thing this screen can say (#22). What is on the canvas
   * then is the last frame, held, and the stamp says so.
   */
  protected readonly liveStamp = computed(() =>
    this.stopped() ? 'STOPPED · NO DEVICE' : `LIVE · ${this.fps()}`,
  );

  /**
   * `FLOOR −66 dBFS`: the median bin, absolute, so this figure can be read
   * beside the floor of any other panel and beside the peak above it. It does
   * not move when the same sound is played louder — that was the old
   * relative-to-peak reading, which made a floor that never changed appear to.
   */
  private readonly floor = computed(() => {
    const db = this.audio.floorDb();
    return db === null ? `${DEAD_MARK} dBFS` : `${db} dBFS`;
  });

  /**
   * Where the comb is, or `null` when this sound has none.
   *
   * **Never a badge without its frequency**: the chip that draws this takes the
   * hertz as a required input, so the only choice left here is whether there is
   * a chip at all.
   */
  protected readonly artefact = computed(() => this.audio.artefactHz());

  /**
   * The one line under the title that says what this picture is.
   *
   * Two of the four have a caption that is their own specification, and those
   * two come from {@link lockCaption} and {@link waterfallCaption} so that the
   * wording does not depend on whether the panel is up here or down in the
   * strip. The other two are fixed descriptions of an axis that never changes.
   */
  protected readout(ranura: LiveView): string {
    switch (ranura) {
      case 'SPECTRUM':
        return `LOG ${this.axis} · FLOOR ${this.floor()}`;
      case 'HARMONICS':
        return 'n1 … n16';
      case 'SCOPE':
        return lockCaption(this.audio.scope());
      case 'WATERFALL':
        return waterfallCaption(this.audio.waterfall());
    }
  }
}

/** One half of the column: which half it is, and what it holds. */
interface Slot {
  readonly index: RanuraIndex;
  readonly holds: Ranura;
}

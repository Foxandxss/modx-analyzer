import { describe, expect, it } from 'vitest';
import { ARTEFACT_HZ, CURVE_POINTS, HARMONIC_BARS } from './constants';
import { GOLDEN_F0, GoldenName, readGolden } from './golden';
import { LiveTrama, liveTrama } from './live';
import { Partial } from './partials';

/**
 * The vista viva against the four vectores de oro.
 *
 * These are the MODX's own audio, captured in fase 0 with the chain clean, and
 * every number asserted here has a line in `fase0_RESULTS.md` §3 or §7 behind
 * it. The tolerances are wide enough for the difference between that analysis and
 * this one — a different window position, a different peak picker — and no wider:
 * they are there to catch a spectrum that stopped being a spectrum, not to let
 * one drift a decibel a session.
 *
 * **The last window of the vector is the one analysed**, which `liveTrama` does
 * by itself. The note takes a while to settle: at second 1 the sine still has an
 * envelope moving under it and the skirt of its own leakage sits 45 dB over the
 * floor, so an early window measures the attack and calls it noise.
 */

const NAMES: readonly GoldenName[] = [
  'fmx-1op-sine',
  'fmx-ratio2-modlow',
  'fmx-ratio2-modhigh',
  'fmx-ratio1414',
];

/** The eleven lines of fase 0's table for the non-integer ratio, in hertz. */
const INHARMONIC_LINES = [
  107.404, 630.93, 845.761, 1214.944, 1369.287, 1584.127, 1738.47, 1953.287, 2107.653, 2322.483,
  2476.813,
];

function analyse(name: GoldenName): LiveTrama {
  return liveTrama(readGolden(name), GOLDEN_F0);
}

function content(trama: LiveTrama): Partial[] {
  return trama.partials.filter((partial) => partial.kind === 'partial');
}

function harmonics(trama: LiveTrama): number[] {
  return content(trama)
    .map((partial) => partial.harmonic)
    .filter((harmonic): harmonic is number => harmonic !== null);
}

/** The strongest line within `toleranceHz` of a frequency, or `undefined`. */
function lineAt(trama: LiveTrama, hz: number, toleranceHz = 2): Partial | undefined {
  return trama.partials.find((partial) => Math.abs(partial.hz - hz) <= toleranceHz);
}

describe('el comb del generador', () => {
  it('sale marcado como artefacto en los cuatro vectores', () => {
    for (const name of NAMES) {
      const trama = analyse(name);

      expect(trama.artefactHz, name).not.toBeNull();
      // The chip names a comb line, never a sideband: 2 756 Hz is the number
      // that tells the sample clock apart from a harmonic.
      expect((trama.artefactHz! / ARTEFACT_HZ) % 1, name).toBeCloseTo(0, 6);
    }
  });

  it('nunca cuenta como armónico', () => {
    for (const name of NAMES) {
      const artefacts = analyse(name).partials.filter((partial) => partial.kind === 'artefact');

      expect(artefacts.length, name).toBeGreaterThan(0);
      for (const artefact of artefacts) {
        expect(artefact.harmonic, `${name} ${artefact.hz.toFixed(1)} Hz`).toBeNull();
      }
    }
  });
});

describe('fmx-1op-sine — un operador, ratio 1.0', () => {
  const trama = analyse('fmx-1op-sine');

  it('tiene el suelo de ruido que midió la fase 0', () => {
    // −105.4 dB rel. al pico, sección 3. Two decibels of room for a window that
    // is not the same window.
    expect(trama.floorDb).toBeGreaterThan(-107.5);
    expect(trama.floorDb).toBeLessThan(-103);
  });

  it('es una senoide: la fundamental y, muy abajo, el tercer armónico', () => {
    const loudest = trama.partials[0]!;
    expect(loudest.harmonic).toBe(1);
    expect(loudest.hz).toBeCloseTo(261.9, 0);

    // «El único contenido armónico real es el 3.º a −84 dB», fase 0 §3.
    const third = content(trama).find((partial) => partial.harmonic === 3);
    expect(third?.db).toBeCloseTo(-84, 0);

    const others = harmonics(trama).filter((harmonic) => harmonic !== 1);
    expect(Math.min(...others)).toBe(3);
  });

  it('deja el comb como los dos picos más altos después de la fundamental', () => {
    // The trap the whole artefact rule exists for: in this vector the two
    // loudest peaks after the note are not content at all (fase 0 §7).
    const [, second, third] = trama.partials;

    expect(second?.kind).toBe('artefact');
    expect(third?.kind).toBe('artefact');
    expect(second?.db).toBeCloseTo(-72, 0);
    expect(third?.db).toBeCloseTo(-72, 0);
    expect(second?.hz).toBeCloseTo(13519.5, -1);
    expect(third?.hz).toBeCloseTo(14043, -1);
  });
});

describe('fmx-ratio2-modlow — ratio 2:1, modulador bajo', () => {
  const trama = analyse('fmx-ratio2-modlow');

  it('sólo tiene armónicos impares', () => {
    const odd = harmonics(trama);

    expect(odd.length).toBeGreaterThan(3);
    for (const harmonic of odd) {
      expect(harmonic % 2, `armónico ${harmonic}`).toBe(1);
    }
  });

  it('reparte la energía como midió la fase 0: 1, 3, 5, 7 y nada entre medias', () => {
    expect(lineAt(trama, 261.93)?.db).toBeCloseTo(0, 0);
    expect(lineAt(trama, 785.24)?.db).toBeCloseTo(-29.5, 0);
    expect(lineAt(trama, 1308.7)?.db).toBeCloseTo(-68, 0);
    expect(lineAt(trama, 1832.1)?.db).toBeCloseTo(-82, 0);

    // Each even bar sits at least 20 dB under the odd one before it. Twenty and
    // not more because the odd ones fall away fast in this vector: the 5th is
    // already at −68 dB and the 6th cannot be 40 dB under anything.
    const bars = trama.harmonics!;
    for (const even of [2, 4, 6]) {
      expect(bars[even - 1]! + 20, `armónico ${even}`).toBeLessThan(bars[even - 2]!);
    }
  });
});

describe('fmx-ratio2-modhigh — mismo ratio, modulador alto', () => {
  const trama = analyse('fmx-ratio2-modhigh');

  it('tiene el noveno armónico como pico, no la fundamental', () => {
    expect(trama.partials[0]!.harmonic).toBe(9);

    const bars = trama.harmonics!;
    expect(bars).toHaveLength(HARMONIC_BARS);
    expect(bars.indexOf(Math.max(...bars))).toBe(8);
  });

  it('mantiene el esqueleto impar hasta el 21', () => {
    const odd = harmonics(trama);

    for (const harmonic of odd) {
      expect(harmonic % 2, `armónico ${harmonic}`).toBe(1);
    }
    expect(Math.max(...odd)).toBeGreaterThanOrEqual(21);
    expect(lineAt(trama, 5497)?.db).toBeCloseTo(-51, 0);
  });
});

describe('fmx-ratio1414 — ratio no entero', () => {
  const trama = analyse('fmx-ratio1414');

  it('dibuja las once líneas de la tabla de la fase 0', () => {
    for (const hz of INHARMONIC_LINES) {
      const line = lineAt(trama, hz);

      expect(line, `${hz} Hz`).toBeDefined();
      expect(line!.kind, `${hz} Hz`).toBe('partial');
    }
  });

  it('no las llama armónicos, porque no lo son', () => {
    // Only the carrier itself lands on the note; the other ten are `|fc ± k·fm|`
    // with fm = 369.175, and calling any of them n-something would be the lie
    // this vector exists to catch.
    const named = content(trama)
      .filter((partial) => INHARMONIC_LINES.some((hz) => Math.abs(partial.hz - hz) <= 2))
      .filter((partial) => partial.harmonic !== null);

    expect(named).toHaveLength(0);
  });
});

describe('la trama', () => {
  it('sin nota no dibuja un eje que no tiene: ni curva ni barras', () => {
    // The axis is in multiples of the note. Without one there is no 1×, and an
    // empty frame is the honest drawing — never a flat line at the floor.
    const trama = liveTrama(readGolden('fmx-ratio2-modlow'), null);

    expect(trama.curve).toBeNull();
    expect(trama.harmonics).toBeNull();
    expect(trama.partials.length).toBeGreaterThan(0);
    expect(trama.artefactHz).not.toBeNull();
  });

  it('con nota trae la curva del eje 1×–32× y las dieciséis barras', () => {
    const trama = analyse('fmx-ratio2-modhigh');

    expect(trama.curve).toHaveLength(CURVE_POINTS);
    expect(trama.harmonics).toHaveLength(HARMONIC_BARS);
    // The curve is in dB relative to the peak, so nothing on it is positive and
    // the loudest partial of this vector (the 9th, at 9× the note) is on it.
    expect(Math.max(...trama.curve!)).toBeCloseTo(0, 0);
    expect(Math.min(...trama.curve!)).toBeLessThan(-40);
  });

  it('no analiza lo que no tiene: menos de una ventana es la trama muerta', () => {
    const trama = liveTrama(new Float32Array(1024), GOLDEN_F0);

    expect(trama.curve).toBeNull();
    expect(trama.partials).toEqual([]);
  });
});

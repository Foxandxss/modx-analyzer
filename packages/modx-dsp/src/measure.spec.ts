import { describe, expect, it } from 'vitest';
import { ARTEFACT_HZ, MEASURE_WINDOW } from './constants';
import { GOLDEN_F0, GoldenName, readGolden } from './golden';
import { Medida, medida } from './measure';
import { Partial } from './partials';

/**
 * La medida against the four vectores de oro, at 65 536.
 *
 * The same vectors the vista viva is tested on, analysed through the same code
 * with the window sixteen times longer, so what these tests pin is exactly the
 * difference that matters: **0.673 Hz per bin instead of 10.77**.
 *
 * Two things move with the window and are asserted here on purpose, because
 * somebody comparing a medida with fase 0's tables will otherwise think one of
 * the two is wrong:
 *
 * - **The fundamental converges.** Fase 0 §4 measured 261.934 Hz at 4 096 and
 *   261.763 Hz at 65 536 for the same note — a bias of +1.13 cents in the low
 *   bins that goes away with the window. These tests read 261.763 Hz on all four
 *   vectors, which is the number fase 0 published, to the milli-hertz.
 * - **The noise floor does not.** «−100 a −109 dB» is a figure of the 4 096
 *   window: at 65 536 each bin holds a sixteenth of the bandwidth and the median
 *   drops with it, to −100 … −130 dB. It is the same silence measured with a
 *   finer instrument, and the two numbers must never be compared.
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

function measured(name: GoldenName): Medida {
  const taken = medida(readGolden(name), GOLDEN_F0);
  expect(taken, name).not.toBeNull();
  return taken!;
}

function content(taken: Medida): Partial[] {
  return taken.partials.filter((partial) => partial.kind === 'partial');
}

function harmonics(taken: Medida): number[] {
  return content(taken)
    .map((partial) => partial.harmonic)
    .filter((harmonic): harmonic is number => harmonic !== null);
}

/** The strongest line within `toleranceHz` of a frequency, or `undefined`. */
function lineAt(taken: Medida, hz: number, toleranceHz = 0.5): Partial | undefined {
  return taken.partials.find((partial) => Math.abs(partial.hz - hz) <= toleranceHz);
}

describe('la medida', () => {
  it('analiza 65 536 muestras y lo dice', () => {
    const taken = measured('fmx-1op-sine');

    expect(taken.window).toBe(MEASURE_WINDOW);
    expect(taken.window).toBe(65_536);
    // 0.673 Hz por bin: dieciséis veces más fino que la vista viva.
    expect(taken.binHz).toBeCloseTo(0.673, 3);
  });

  it('lee la fundamental donde la fase 0 la vio converger: 261.763 Hz', () => {
    // §4: 261.934 Hz a 4 096, 261.805 a 16 384, 261.763 a 65 536. Es el criterio
    // por el que la medida existe y no basta con mirar.
    for (const name of NAMES) {
      const note = lineAt(measured(name), GOLDEN_F0);

      expect(note, name).toBeDefined();
      expect(note!.harmonic, name).toBe(1);
      expect(note!.hz, name).toBeCloseTo(261.763, 2);
    }
  });

  it('marca el comb del generador como artefacto en los cuatro vectores', () => {
    for (const name of NAMES) {
      const taken = measured(name);

      expect(taken.artefactHz, name).not.toBeNull();
      expect((taken.artefactHz! / ARTEFACT_HZ) % 1, name).toBeCloseTo(0, 6);
      for (const artefact of taken.partials.filter((line) => line.kind === 'artefact')) {
        expect(artefact.harmonic, `${name} ${artefact.hz.toFixed(1)} Hz`).toBeNull();
      }
    }
  });

  it('mide un suelo más bajo que a 4 096, porque el bin es más estrecho', () => {
    // No es menos ruido: es el mismo silencio medido con un bin dieciséis veces
    // más estrecho. Nunca se compara con el −105.4 dB de la fase 0.
    for (const name of NAMES) {
      const taken = measured(name);

      expect(taken.floorDb, name).toBeLessThan(-99);
      expect(taken.floorDb, name).toBeGreaterThan(-135);
    }
  });

  it('devuelve nada cuando el obturador se abre sobre el silencio', () => {
    // Pulsar MEDIR entre dos notas es una respuesta de verdad, no un error: la
    // columna se queda en su estado muerto, que es donde estaba.
    expect(medida(new Float32Array(MEASURE_WINDOW), GOLDEN_F0)).toBeNull();
  });

  it('no mide una ventana que no tiene', () => {
    // Una medida sobre una ventana rellenada es una medida de algo que no pasó.
    expect(() => medida(new Float32Array(4096), GOLDEN_F0)).toThrow(/65536/);
  });
});

describe('fmx-1op-sine a 65 536', () => {
  const taken = measured('fmx-1op-sine');

  it('deja el 3.er armónico exactamente donde lo dejó la fase 0', () => {
    // «El único contenido armónico real es el 3.º a −84 dB», §3. A 65 536 la
    // línea sale a 785.286 Hz y −84.31 dB contra los −84.30 de entonces.
    const third = lineAt(taken, 785.29);

    expect(third?.harmonic).toBe(3);
    expect(third?.db).toBeCloseTo(-84.3, 1);
  });

  it('destapa el 5.º y el 7.º, que a 4 096 estaban bajo el suelo', () => {
    // Lo que compra la ventana larga: a 4 096 el suelo de esta senoide está en
    // −105 dB y estas dos líneas, a −85, quedaban dentro de la falda de fuga.
    // No contradice a la fase 0: la contesta con más resolución.
    expect(lineAt(taken, 1308.82)?.harmonic).toBe(5);
    expect(lineAt(taken, 1832.34)?.harmonic).toBe(7);
    expect(lineAt(taken, 1308.82)!.db).toBeLessThan(-80);

    // Y el 3.º sigue siendo el armónico más fuerte después de la nota.
    const loudestAfterNote = content(taken).filter((line) => line.harmonic !== null)[1];
    expect(loudestAfterNote?.harmonic).toBe(3);
  });

  it('sigue teniendo el comb como los dos picos más altos tras la fundamental', () => {
    const [, second, third] = taken.partials;

    expect(second?.kind).toBe('artefact');
    expect(third?.kind).toBe('artefact');
    expect(second?.db).toBeCloseTo(-72, 0);
    expect(third?.db).toBeCloseTo(-72, 0);
  });
});

describe('fmx-ratio2-modlow a 65 536', () => {
  const taken = measured('fmx-ratio2-modlow');

  it('sólo tiene armónicos impares, ahora hasta el 13', () => {
    const odd = harmonics(taken);

    expect(odd).toContain(13);
    for (const harmonic of odd) {
      expect(harmonic % 2, `armónico ${harmonic}`).toBe(1);
    }
  });

  it('reparte la energía como midió la fase 0: 1, 3, 5, 7', () => {
    expect(lineAt(taken, 261.763)?.db).toBeCloseTo(0, 1);
    expect(lineAt(taken, 785.29)?.db).toBeCloseTo(-30, 0);
    expect(lineAt(taken, 1308.82)?.db).toBeCloseTo(-67.5, 0);
    expect(lineAt(taken, 1832.34)?.db).toBeCloseTo(-82, 0);
  });
});

describe('fmx-ratio2-modhigh a 65 536', () => {
  const taken = measured('fmx-ratio2-modhigh');

  it('pone el 9.º armónico de pico y ordena las líneas como la fase 0', () => {
    expect(taken.partials[0]!.harmonic).toBe(9);

    // Las siete primeras de la tabla de §3, en su orden y con su nivel.
    expect(lineAt(taken, 261.763)?.db).toBeCloseTo(-2.5, 0);
    expect(lineAt(taken, 1308.82)?.db).toBeCloseTo(-4.7, 0);
    expect(lineAt(taken, 785.29)?.db).toBeCloseTo(-5.3, 0);
    expect(lineAt(taken, 3402.92)?.db).toBeCloseTo(-10.7, 0);
    expect(lineAt(taken, 2879.39)?.db).toBeCloseTo(-14, 0);
    expect(lineAt(taken, 1832.34)?.db).toBeCloseTo(-24.5, 0);
    expect(lineAt(taken, 5497.02)?.db).toBeCloseTo(-50.5, 0);
  });

  it('mantiene el esqueleto impar hasta el 21 sin un solo par', () => {
    const odd = harmonics(taken);

    for (const harmonic of odd) {
      expect(harmonic % 2, `armónico ${harmonic}`).toBe(1);
    }
    expect(Math.max(...odd)).toBeGreaterThanOrEqual(21);
  });
});

describe('fmx-ratio1414 a 65 536', () => {
  const taken = measured('fmx-ratio1414');

  it('clava las once líneas de la tabla de la fase 0 a la milésima', () => {
    // A 4 096 la tolerancia de la vista viva son dos hertzios; aquí, con el bin
    // en 0.673 Hz, las once caen a menos de 0.05 Hz de lo publicado. Eso es lo
    // que un ratio medido en cents va a necesitar.
    for (const hz of INHARMONIC_LINES) {
      const line = lineAt(taken, hz, 0.05);

      expect(line, `${hz} Hz`).toBeDefined();
      expect(line!.kind, `${hz} Hz`).toBe('partial');
    }
  });

  it('no llama armónico a ninguna de las once', () => {
    const named = content(taken)
      .filter((line) => INHARMONIC_LINES.some((hz) => Math.abs(line.hz - hz) <= 0.05))
      .filter((line) => line.harmonic !== null);

    // Las once son |fc ± k·fm| con fm = 369.175 y ninguna cae sobre un múltiplo
    // de la nota; ponerles un número de armónico sería la mentira que este
    // vector existe para cazar. La portadora sí está, y es otra línea.
    expect(named).toHaveLength(0);
    expect(lineAt(taken, 261.763)?.harmonic).toBe(1);
  });
});

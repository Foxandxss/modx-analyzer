/**
 * One radix-2 FFT, in place, and nothing else.
 *
 * It is here because the app does two transforms of very different sizes — 4 096
 * thirty-three times a second for the vista viva and 65 536 once per MEDIR — and
 * both have to run inside a worker with no dependencies to load. A textbook
 * iterative Cooley-Tukey is ~40 lines, costs 4 096·log₂4 096 ≈ 49 000 butterflies
 * per trama, and leaves nothing to a library that could change under the numbers.
 *
 * The twiddle tables are cached per size: the vista viva asks for the same 4 096
 * for ever, so they are built once and the trama pays for the butterflies only.
 */

interface Twiddles {
  readonly cos: Float64Array;
  readonly sin: Float64Array;
  readonly reversed: Uint32Array;
}

const tables = new Map<number, Twiddles>();

/** The tables for a size, built the first time and kept. */
function twiddlesFor(size: number): Twiddles {
  const cached = tables.get(size);
  if (cached !== undefined) {
    return cached;
  }

  const half = size / 2;
  const cos = new Float64Array(half);
  const sin = new Float64Array(half);
  for (let index = 0; index < half; index += 1) {
    cos[index] = Math.cos((-2 * Math.PI * index) / size);
    sin[index] = Math.sin((-2 * Math.PI * index) / size);
  }

  const bits = Math.log2(size);
  const reversed = new Uint32Array(size);
  for (let index = 0; index < size; index += 1) {
    let value = index;
    let mirror = 0;
    for (let bit = 0; bit < bits; bit += 1) {
      mirror = (mirror << 1) | (value & 1);
      value >>= 1;
    }
    reversed[index] = mirror;
  }

  const built = { cos, sin, reversed };
  tables.set(size, built);
  return built;
}

/**
 * The transform, in place. `re` and `im` are the same length and that length is a
 * power of two — an FM spectrum is not the place to discover an off-by-one, so a
 * wrong size throws instead of folding quietly.
 */
export function fft(re: Float64Array, im: Float64Array): void {
  const size = re.length;
  if (im.length !== size || size < 2 || (size & (size - 1)) !== 0) {
    throw new Error(`FFT de ${size}: hace falta una potencia de dos, y re e im iguales`);
  }

  const { cos, sin, reversed } = twiddlesFor(size);

  for (let index = 0; index < size; index += 1) {
    const mirror = reversed[index]!;
    if (mirror > index) {
      const swapRe = re[index]!;
      const swapIm = im[index]!;
      re[index] = re[mirror]!;
      im[index] = im[mirror]!;
      re[mirror] = swapRe;
      im[mirror] = swapIm;
    }
  }

  for (let span = 2; span <= size; span *= 2) {
    const half = span / 2;
    const step = size / span;
    for (let start = 0; start < size; start += span) {
      for (let offset = 0; offset < half; offset += 1) {
        const angle = offset * step;
        const wr = cos[angle]!;
        const wi = sin[angle]!;
        const here = start + offset;
        const there = here + half;
        const tr = re[there]! * wr - im[there]! * wi;
        const ti = re[there]! * wi + im[there]! * wr;
        re[there] = re[here]! - tr;
        im[there] = im[here]! - ti;
        re[here] = re[here]! + tr;
        im[here] = im[here]! + ti;
      }
    }
  }
}

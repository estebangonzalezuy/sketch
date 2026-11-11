// mulberry32: el mismo PRNG que usa Physarum Metro.
export function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function prngFor(seed: number) {
  return (salt = 0) => mulberry32((seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0);
}

/** Semilla nueva para R. Fuera de render/step, así que puede usar Math.random. */
export function newSeed(): number {
  return Math.floor(Math.random() * 9000) + 1000;
}

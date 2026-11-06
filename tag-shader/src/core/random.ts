/** PRNG chico y determinístico. */
export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash de enteros a [0, 1). Igual entrada, igual salida, sin estado. */
export function hash01(...values: number[]) {
  let h = 0x811c9dc5;
  for (const v of values) h = Math.imul(h ^ (v | 0), 0x01000193);
  return mulberry32(h)();
}

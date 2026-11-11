export type BBox = [number, number, number, number]; // x0,y0,x1,y1 en mercator 0..1

export function merc(lat: number, lon: number): [number, number] {
  const x = (lon + 180) / 360;
  const s = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
  return [x, y];
}

/** Igual que frame_for() en scripts/fetch_city.py. */
export function frameFor(bb: BBox, aspect: number, pad = 0.07): BBox {
  let w = bb[2] - bb[0], h = bb[3] - bb[1];
  const cx = (bb[0] + bb[2]) / 2, cy = (bb[1] + bb[3]) / 2;
  w *= 1 + 2 * pad; h *= 1 + 2 * pad;
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  return [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
}

export function metersPerUnit(lat: number) {
  return 40075016.686 * Math.cos((lat * Math.PI) / 180);
}

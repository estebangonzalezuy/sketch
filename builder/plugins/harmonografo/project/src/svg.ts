import { colors, simplify, type Params, type Path } from "./harmono";
import { W, H } from "./draw";
/** SVG de plotter: una sola polilínea simplificada (Douglas–Peucker), 200×250 mm, trazo en mm. */
export function toSVG(p: Params, path: Path, epsPx = 0.35): { svg: string; points: number } {
  const keep = simplify(path.xs, path.ys, path.n, epsPx);
  const c = colors(p);
  const mmPerPx = 200 / W;
  let d = "";
  // partir en tramos de 2000 puntos para plotters que no aceptan paths gigantes
  for (let k = 0; k < keep.length; k += 2000) {
    const seg = keep.slice(Math.max(0, k - 1), k + 2000);
    d += `<polyline points="${seg.map(i => `${path.xs[i].toFixed(2)},${path.ys[i].toFixed(2)}`).join(" ")}"/>\n`;
  }
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200mm" height="250mm" viewBox="0 0 ${W} ${H}">
<!-- harmonógrafo · ${p.name} · ${keep.length} puntos · trazo ${(p.penWidth * mmPerPx).toFixed(2)} mm -->
<g fill="none" stroke="${c.fg}" stroke-width="${p.penWidth}" stroke-linecap="round" stroke-linejoin="round">
${d}</g>
</svg>`;
  return { svg, points: keep.length };
}

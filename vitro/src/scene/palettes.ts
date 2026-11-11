// Pares fondo/luz. Son los únicos colores de fondo y de luz que usa la herramienta.
export const PAIRS: { bg: string; light: string; name: string }[] = [
  { bg: '#0C0C0C', light: '#FFFFFF', name: 'Negro y blanco' },
  { bg: '#0C0C0C', light: '#E4FC24', name: 'Negro y lima' },
  { bg: '#3C240C', light: '#CC84FC', name: 'Café y lila' },
  { bg: '#0C540C', light: '#F06CCC', name: 'Verde y rosa' },
]

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255) as [number, number, number]
}

const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
export const hexToLinear = (hex: string) => hexToRgb(hex).map(toLin) as [number, number, number]
const lum = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

/** Colores resueltos de la paleta, en lineal. Si al invertir la "luz" queda casi negra,
 *  las luces emiten el color de fondo aclarado: una luz negra no ilumina. */
export function resolvePalette(p: { pair: number; invert: boolean }) {
  const pair = PAIRS[((p.pair % PAIRS.length) + PAIRS.length) % PAIRS.length]
  const bgHex = p.invert ? pair.light : pair.bg
  const lightHex = p.invert ? pair.bg : pair.light
  const bg = hexToLinear(bgHex)
  let light = hexToLinear(lightHex)
  if (lum(light) < 0.05) light = bg.map((c) => c * 0.5 + 0.5) as [number, number, number]
  return { bg, light, bgHex, lightHex }
}

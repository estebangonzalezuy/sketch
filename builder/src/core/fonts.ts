// Archivo Narrow (OFL) local. Se carga con FontFace antes del primer render: el canvas no espera al CSS.
export const FAMILY = "Archivo Narrow";

const FILES: [string, string][] = [
  ["400", "ArchivoNarrow-Regular.ttf"],
  ["500", "ArchivoNarrow-Medium.ttf"],
  ["700", "ArchivoNarrow-Bold.ttf"],
];

let loading: Promise<void> | null = null;

export function loadFonts(): Promise<void> {
  if (!loading) {
    const base = import.meta.env.BASE_URL;
    loading = Promise.all(
      FILES.map(async ([weight, file]) => {
        const face = new FontFace(FAMILY, `url(${base}fonts/${file})`, { weight });
        await face.load();
        document.fonts.add(face);
      }),
    ).then(() => undefined);
  }
  return loading;
}

/** `font` para canvas: tamaño en px del canvas de salida. */
export function font(px: number, weight: 400 | 500 | 700 = 400): string {
  return `${weight} ${Math.round(px)}px "${FAMILY}"`;
}

/** Número con coma decimal y signo menos tipográfico, como en el pie de los entornos. */
export function num(v: number, digits = 2): string {
  const s = Math.abs(v).toFixed(digits).replace(".", ",");
  return v < 0 && Number(s.replace(",", ".")) !== 0 ? `−${s}` : s;
}

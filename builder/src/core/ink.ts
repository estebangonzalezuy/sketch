// Capa de tinta: dibujar muchos trazos superpuestos (en varias pasadas) sobre una capa de solo alfa y
// componerla UNA vez con el color fg. Así el antialiasing queda sobre la recta bg–fg: si se componen
// muchas pasadas directo sobre el fondo, cada una redondea cada canal y el error se acumula.
let layer: HTMLCanvasElement | null = null;

export function inkLayer(g: CanvasRenderingContext2D, color: string, paint: (ink: CanvasRenderingContext2D) => void) {
  const { width, height } = g.canvas;
  if (!layer) layer = document.createElement("canvas");
  if (layer.width !== width || layer.height !== height) {
    layer.width = width;
    layer.height = height;
  }
  const ink = layer.getContext("2d")!;
  ink.setTransform(1, 0, 0, 1, 0, 0);
  ink.globalCompositeOperation = "source-over";
  ink.clearRect(0, 0, width, height);
  ink.strokeStyle = "#ffffff";
  ink.fillStyle = "#ffffff";
  paint(ink);
  // teñir: el color entra solo donde hay alfa
  ink.globalCompositeOperation = "source-in";
  ink.fillStyle = color;
  ink.fillRect(0, 0, width, height);
  ink.globalCompositeOperation = "source-over";
  g.drawImage(layer, 0, 0);
}

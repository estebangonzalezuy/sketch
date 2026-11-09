// Dos "fotos" de ejemplo dibujadas en un canvas: así el repo no carga imágenes con derechos.
// Una vez difuminadas y llevadas a la paleta se leen como fotos desenfocadas.

const W = 1200;
const H = 1500;

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return [c, c.getContext('2d')!];
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, inner: string, outer: string, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(-rx * 0.25, -rx * 0.3, rx * 0.1, 0, 0, rx);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function portrait(): HTMLCanvasElement {
  const [c, ctx] = canvas();
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1d3ee6');
  bg.addColorStop(1, '#0f27b8');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.filter = 'blur(10px)';
  // Pelo
  blob(ctx, 600, 640, 400, 520, '#2a2a20', '#0d0f0b');
  // Saco rojo y camisa
  ctx.fillStyle = '#d42a17';
  ctx.beginPath();
  ctx.moveTo(40, H);
  ctx.bezierCurveTo(80, 1150, 300, 1080, 600, 1080);
  ctx.bezierCurveTo(900, 1080, 1120, 1150, 1160, H);
  ctx.fill();
  ctx.fillStyle = '#f1efe8';
  ctx.beginPath();
  ctx.moveTo(470, 1090);
  ctx.lineTo(600, 1430);
  ctx.lineTo(730, 1090);
  ctx.fill();
  // Cuello y cara
  blob(ctx, 600, 1040, 140, 150, '#c98552', '#9a5a30');
  blob(ctx, 600, 760, 230, 300, '#f0b47a', '#b9733f');
  // Flequillo
  blob(ctx, 560, 470, 300, 150, '#1b1b16', '#0b0c09', -0.15);
  // Ojos, mejillas y boca
  blob(ctx, 515, 730, 34, 18, '#2a1810', '#3a2216');
  blob(ctx, 690, 730, 34, 18, '#2a1810', '#3a2216');
  blob(ctx, 470, 860, 70, 50, '#f08a6a', 'rgba(240,138,106,0)');
  blob(ctx, 730, 860, 70, 50, '#f08a6a', 'rgba(240,138,106,0)');
  blob(ctx, 600, 935, 70, 26, '#d4523c', '#b13a2a');
  return c;
}

export function bloom(): HTMLCanvasElement {
  const [c, ctx] = canvas();
  const bg = ctx.createRadialGradient(W * 0.7, H * 0.25, 50, W * 0.6, H * 0.4, W);
  bg.addColorStop(0, '#ffd21a');
  bg.addColorStop(1, '#e0aa00');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.filter = 'blur(14px)';
  ctx.lineCap = 'round';
  // Tela rosa en movimiento
  const ribbon = (pts: number[], width: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    ctx.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
    ctx.stroke();
  };
  ribbon([-100, 1100, 300, 900, 700, 1300, 1300, 950], 330, '#ff2d6f');
  ribbon([500, 1600, 600, 1100, 900, 900, 1250, 700], 300, '#ff4f8a');
  ribbon([350, 700, 650, 650, 900, 800, 1050, 1000], 200, '#ff2d6f');
  // Cabeza con gorro
  blob(ctx, 470, 470, 170, 210, '#e7a37c', '#b56b48');
  blob(ctx, 430, 250, 230, 150, '#ff86bd', '#ff4f9c', -0.2);
  blob(ctx, 610, 380, 70, 110, '#ff8a4a', 'rgba(255,90,40,0)');
  blob(ctx, 330, 620, 110, 160, '#1d1410', '#3b2418');
  blob(ctx, 520, 820, 150, 120, '#f1c3a0', '#c98f6c');
  return c;
}

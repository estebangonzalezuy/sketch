import * as THREE from 'three';
import { CELL_H, CELL_W, COLS } from './atlas';

/**
 * Pasada fullscreen que dibuja el mosaico de tags. Por píxel:
 *  1. fila = floor(y / rowHeight); y local dentro de la fila
 *  2. x local de la fila = fract(x - offset de la fila)
 *  3. búsqueda binaria del bloque en la DataTexture de layout
 *  4. luminancia de la fuente en el centro del bloque (o promedio de 5 taps)
 *  5. cuantización a la paleta (2 o 3 tonos) → color de bloque + color de texto
 *  6. letra desde el atlas (alto de texto = alto de fila), con density/disolución
 */

const fragmentShader = /* glsl */ `
precision highp float;
precision highp int;

uniform sampler2D uLayout;
uniform sampler2D uAtlas;
uniform sampler2D uSource;
uniform bool uSourceLinear;

uniform vec2 uResolution;   // px de salida
uniform float uRowHeight;   // px
uniform float uRowLen;      // ancho de pantalla en unidades de fila
uniform int uRows;
uniform vec2 uAtlasSize;    // px
uniform float uPad;         // padding izquierdo del texto, en unidades de fila

uniform float uZoom;
uniform vec2 uCenter;

uniform vec3 uBlock[3];     // color de bloque por tono
uniform vec3 uText[3];      // color de texto por tono (siempre contrasta)
uniform vec3 uBg;           // fondo plano cuando density baja
uniform int uTones;
uniform float uT1;
uniform float uT2;
uniform float uContrast;
uniform float uBrightness;
uniform bool uInvert;
uniform int uSampling;      // 0 centro · 1 promedio
uniform int uColorMode;     // 0 paleta · 1 color de la fuente

uniform float uDensity;

// Estilo "Marcas": grilla de celdas iguales; cada celda es vacío / punto / línea / bloque según luminancia.
uniform float uMix;         // 0 texto · 1 marcas · intermedio: cada celda cambia en su momento
uniform float uWipe;        // orden del cambio: 0 aleatorio por celda · 1 barrido de izquierda a derecha
uniform float uCellW;       // ancho de celda, en unidades de fila (se ajusta a un entero por fila)
uniform vec3 uMarkT;        // umbrales vacío|punto · punto|línea · línea|bloque
uniform float uLine;        // grosor de línea, en unidades de fila
uniform float uDot;         // lado del punto
uniform float uGap;         // separación entre celdas
uniform float uBlockH;      // alto del bloque resaltado
uniform bool uSnap;         // las filas avanzan de a una celda (columnas siempre alineadas)

varying vec2 vUv;
layout(location = 0) out vec4 fragColor;

const float CELL_W = ${CELL_W.toFixed(1)};
const float CELL_H = ${CELL_H.toFixed(1)};
const float COLS = ${COLS.toFixed(1)};

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Cobertura antialiasada de un rectángulo con centro c y semi-lados h (aa = 1 px en las mismas unidades).
float boxA(vec2 p, vec2 c, vec2 h, float aa) {
  vec2 d = abs(p - c) - h;
  return clamp(0.5 - max(d.x, d.y) / aa, 0.0, 1.0);
}

vec3 srcColor(vec2 p) {
  vec3 c = texture2D(uSource, clamp(p, vec2(0.001), vec2(0.999))).rgb;
  if (uSourceLinear) c = pow(max(c, 0.0), vec3(1.0 / 2.2));
  return c;
}

void main() {
  // Coordenadas de "mundo" (0…1 sobre todo el poster); el modo Wall hace zoom.
  vec2 uv = (vUv - 0.5) / uZoom + uCenter;

  // --- fila ---
  float yPx = (1.0 - uv.y) * uResolution.y;      // desde arriba
  float rowF = floor(yPx / uRowHeight);
  int row = clamp(int(rowF), 0, uRows - 1);
  float ly = yPx / uRowHeight - rowF;            // 0 arriba · 1 abajo

  // --- bloque ---
  vec4 info = texelFetch(uLayout, ivec2(0, row), 0);

  // --- grilla de marcas: define también qué celdas ya cambiaron de estilo ---
  // Entero de celdas por fila: el período de la fila (1 ancho de pantalla) cierra sin costura.
  float nC = max(1.0, floor(uRowLen / uCellW + 0.5));
  float cw = uRowLen / nC;
  float off = uSnap ? floor(info.x * nC + 0.5) / nC : info.x;
  float fx = fract(uv.x - off) * nC;
  float ci = floor(fx);
  float cxW = uv.x + (ci + 0.5 - fx) / nC;                       // centro de la celda en el mundo
  float cxS = clamp((cxW - uCenter.x) * uZoom + 0.5, 0.0, 1.0);  // ... y en pantalla (para el barrido)
  float order = mix(hash12(vec2(ci + 0.25, rowF * 2.71 + 11.0)), cxS * 0.999, uWipe);

  if (order < uMix * 1.0001) {
    // --- estilo marcas ---
    vec2 p = vec2((fx - ci) * cw, ly);
    float cyW = 1.0 - (rowF + 0.5) * uRowHeight / uResolution.y;
    float l = dot(srcColor(vec2(cxW, cyW)), vec3(0.2126, 0.7152, 0.0722));
    l = clamp((l - 0.5) * uContrast + 0.5 + uBrightness, 0.0, 1.0);
    if (uInvert) l = 1.0 - l;
    int lvl = l < uMarkT.x ? 0 : (l < uMarkT.y ? 1 : (l < uMarkT.z ? 2 : 3));
    // density: las celdas se apagan en orden aleatorio (fijo a la celda, viaja con la fila).
    if (hash12(vec2(ci + 0.5, rowF * 1.37 + 5.0)) > uDensity * 1.0001) lvl = 0;

    vec3 ink = uBlock[2];   // color 3
    vec3 hi = uBlock[1];    // color 2 en 3 tonos (en 2 tonos = color 3)
    vec2 mid = vec2(cw * 0.5, 0.5);
    float aa = 1.0 / (uRowHeight * uZoom);
    vec3 col = uBg;
    if (lvl == 1) {
      col = mix(col, ink, boxA(p, mid, vec2(uDot * 0.5), aa));
    } else if (lvl == 2) {
      col = mix(col, ink, boxA(p, mid, vec2(cw * 0.5 - uGap * 0.5, uLine * 0.5), aa));
    } else if (lvl == 3) {
      col = mix(col, hi, boxA(p, mid, vec2(cw * 0.5 - uGap * 0.5, uBlockH * 0.5), aa));
      col = mix(col, uBg, boxA(p, mid, vec2(uDot * 0.5), aa));
    }
    fragColor = vec4(col, 1.0);
    return;
  }

  int count = int(info.y + 0.5);
  float lx = fract(uv.x - info.x);
  int lo = 1;
  int hi = count;
  for (int i = 0; i < 8; i++) {
    if (lo >= hi) break;
    int mid = (lo + hi + 1) / 2;
    if (texelFetch(uLayout, ivec2(mid, row), 0).x <= lx) lo = mid; else hi = mid - 1;
  }
  vec4 b = texelFetch(uLayout, ivec2(lo, row), 0);   // inicio, ancho, palabra, rand
  float wordIdx = b.z;
  float rb = b.w;
  float bx = (lx - b.x) * uRowLen;                     // x dentro del bloque, en unidades de fila

  // --- muestreo de la fuente en el bloque (en coordenadas de mundo) ---
  float startW = uv.x - (lx - b.x);
  float cy = 1.0 - (rowF + 0.5) * uRowHeight / uResolution.y;
  vec3 c;
  if (uSampling == 0) {
    c = srcColor(vec2(startW + b.y * 0.5, cy));
  } else {
    c = vec3(0.0);
    for (int k = 0; k < 5; k++) c += srcColor(vec2(startW + b.y * (float(k) + 0.5) / 5.0, cy));
    c /= 5.0;
  }

  // --- cuantización ---
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  l = clamp((l - 0.5) * uContrast + 0.5 + uBrightness, 0.0, 1.0);
  if (uInvert) l = 1.0 - l;
  int tone = l < uT1 ? 0 : ((uTones == 3 && l < uT2) ? 1 : 2);
  vec3 blockCol = uBlock[tone];
  vec3 textCol = uText[tone];
  if (uColorMode == 1) {
    vec3 cc = clamp((c - 0.5) * uContrast + 0.5 + uBrightness, 0.0, 1.0);
    blockCol = cc;
    textCol = dot(cc, vec3(0.2126, 0.7152, 0.0722)) > 0.5 ? vec3(0.0) : vec3(1.0);
  }

  // --- density ---
  // 1.0 → 0.4: los fondos de bloque se apagan en orden aleatorio.
  // 0.4 → 0.0: las letras se fragmentan (rebanadas desplazadas) y se disuelven por celdas.
  float bgAmt = smoothstep(0.4, 1.0, uDensity);
  bool bgOn = rb < bgAmt;
  float wordAmt = smoothstep(0.0, 0.4, uDensity);
  float frag = 1.0 - wordAmt;

  float slice = floor(ly * 4.0);
  float jitter = (hash12(vec2(slice + wordIdx * 7.0, rowF + rb * 31.0)) - 0.5) * frag * 1.6;
  float tx = bx - uPad + jitter;

  // --- letra desde el atlas ---
  float a = 0.0;
  if (tx >= 0.0 && tx * CELL_H < CELL_W - 8.0) {
    float col = mod(wordIdx, COLS);
    float cr = floor(wordIdx / COLS);
    vec2 apx = vec2(col * CELL_W + tx * CELL_H, (cr + ly) * CELL_H);
    vec2 auv = vec2(apx.x / uAtlasSize.x, 1.0 - apx.y / uAtlasSize.y);
    // Gradiente analítico: evita saltos de mip en los bordes de bloque.
    float g = CELL_H / (uRowHeight * uZoom);
    a = textureGrad(uAtlas, auv, vec2(g / uAtlasSize.x, 0.0), vec2(0.0, g / uAtlasSize.y)).a;
  }
  vec2 cell = floor(vec2(tx * 7.0, ly * 5.0));
  float n = hash12(cell + vec2(wordIdx * 3.1 + rb * 91.0, rowF * 1.7));
  a *= step(mix(n, rb, 0.45), wordAmt * 1.0001);

  // Fondo encendido: bloque + texto en contraste.
  // Fondo apagado: la palabra toma el color del tono, sobre el fondo plano.
  vec3 base = bgOn ? blockCol : uBg;
  vec3 ink = bgOn ? textCol : blockCol;
  fragColor = vec4(mix(base, ink, a), 1.0);
}
`;

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export function hexToVec3(hex: string): THREE.Vector3 {
  const n = parseInt(hex.replace('#', ''), 16);
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const luma = (v: THREE.Vector3) => 0.2126 * v.x + 0.7152 * v.y + 0.0722 * v.z;

export class MosaicPass {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly material: THREE.ShaderMaterial;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uLayout: { value: null },
        uAtlas: { value: null },
        uSource: { value: null },
        uSourceLinear: { value: true },
        uResolution: { value: new THREE.Vector2(1080, 1350) },
        uRowHeight: { value: 22 },
        uRowLen: { value: 1 },
        uRows: { value: 1 },
        uAtlasSize: { value: new THREE.Vector2(1, 1) },
        uPad: { value: 0.3 },
        uZoom: { value: 1 },
        uCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uBlock: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
        uText: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
        uBg: { value: new THREE.Vector3() },
        uTones: { value: 2 },
        uT1: { value: 0.5 },
        uT2: { value: 0.7 },
        uContrast: { value: 1 },
        uBrightness: { value: 0 },
        uInvert: { value: false },
        uSampling: { value: 0 },
        uColorMode: { value: 0 },
        uDensity: { value: 1 },
        uMix: { value: 0 },
        uWipe: { value: 0 },
        uCellW: { value: 1.6 },
        uMarkT: { value: new THREE.Vector3(0.12, 0.4, 0.97) },
        uLine: { value: 0.16 },
        uDot: { value: 0.22 },
        uGap: { value: 0.06 },
        uBlockH: { value: 0.9 },
        uSnap: { value: true },
      },
    });
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
  }

  get u() {
    return this.material.uniforms;
  }

  /**
   * Paleta: tono 0 = c0, tono 1 = c1 (solo 3 tonos), tono 2 = c2.
   * El texto de cada tono es el color de la paleta con mayor diferencia de luminancia.
   */
  setPalette(p: { tones: 2 | 3; c0: string; c1: string; c2: string }) {
    const cols = [hexToVec3(p.c0), hexToVec3(p.c1), hexToVec3(p.c2)];
    const used = p.tones === 3 ? [0, 1, 2] : [0, 2];
    const block = this.u.uBlock.value as THREE.Vector3[];
    const text = this.u.uText.value as THREE.Vector3[];
    for (let i = 0; i < 3; i++) {
      const src = p.tones === 2 && i === 1 ? 2 : i; // en 2 tonos el tono "medio" no se usa
      block[i].copy(cols[src]);
      let best = used[0];
      let bestD = -1;
      for (const j of used) {
        if (j === src) continue;
        const d = Math.abs(luma(cols[j]) - luma(cols[src]));
        if (d > bestD) (bestD = d), (best = j);
      }
      text[i].copy(cols[best]);
    }
    (this.u.uBg.value as THREE.Vector3).copy(cols[0]);
    this.u.uTones.value = p.tones;
  }
}

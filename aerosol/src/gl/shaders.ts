// Todos los pases dibujan un triángulo que cubre la pantalla. vUv va de 0 a 1 con y hacia arriba.

export const VERT = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const NOISE = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec3 hash32(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yxz + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x),
             mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s / 0.9375;
}`;

// --- Smear: campo de desplazamiento (en unidades de uv). Se advecta a sí mismo al arrastrar
// (empuje tipo "liquify") y se relaja hacia 0 con uDecay.
export const SMEAR_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uField;
uniform vec2 uPos;
uniform vec2 uDelta;
uniform float uRadius;
uniform float uAspect;
uniform float uDecay;
uniform float uStamp;
void main() {
  vec2 d = vUv - uPos;
  d.x *= uAspect;
  float r = length(d) / max(uRadius, 1e-4);
  float w = uStamp * exp(-r * r * 2.2);
  vec2 f = texture(uField, vUv - uDelta * w).xy + uDelta * w;
  outColor = vec4(f * uDecay, 0.0, 1.0);
}`;

// --- Composición: fuentes A y B con cover-fit, distorsiones (wave, glass, smear),
// mezcla por manchas de ruido y el alfa del texto en el canal a.
export const COMP_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uA;
uniform sampler2D uB;
uniform sampler2D uField;
uniform sampler2D uText;
uniform vec2 uCoverA;
uniform vec2 uCoverB;
uniform float uHasB;
uniform float uFade;
uniform float uTime;
uniform float uAspect;
uniform float uWave;
uniform float uHasText;
${NOISE}
vec3 cover(sampler2D t, vec2 uv, vec2 c) {
  return texture(t, clamp((uv - 0.5) * c + 0.5, 0.0, 1.0)).rgb;
}
void main() {
  vec2 uv = vUv;
  vec2 asp = vec2(uAspect, 1.0);
  if (uWave > 0.0) {
    vec2 q = uv * asp * 2.2;
    vec2 w = vec2(fbm(q + vec2(0.0, uTime * 0.13)), fbm(q + vec2(5.2, 1.3) - uTime * 0.11)) - 0.5;
    uv += w * uWave * 0.32;
  }
  vec2 suv = uv - texture(uField, uv).xy;
  vec3 col = cover(uA, suv, uCoverA);
  if (uHasB > 0.5) {
    vec3 colB = cover(uB, suv, uCoverB);
    float n = fbm(suv * asp * 1.7 + vec2(3.1, uTime * 0.04));
    n = clamp((n - 0.5) * 1.9 + 0.5, 0.0, 1.0);
    float s = 0.14;
    float m = smoothstep(-s, s, uFade * (1.0 + 2.0 * s) - s - n);
    col = mix(col, colB, m);
  }
  float ta = uHasText > 0.5 ? texture(uText, suv).a : 0.0;
  outColor = vec4(col, ta);
}`;

// --- Airbrush: gaussiano separable. rgb y alfa (texto) con sigmas distintos.
export const BLUR_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uStep;
uniform float uSigma;
uniform float uSigmaA;
const int TAPS = 20;
void main() {
  vec4 c = texture(uTex, vUv);
  vec3 rgb = c.rgb;
  float a = c.a;
  if (uSigma > 0.35) {
    float st = max(1.0, uSigma * 3.0 / float(TAPS));
    float ws = 1.0;
    for (int i = 1; i <= TAPS; i++) {
      float x = float(i) * st;
      float w = exp(-x * x / (2.0 * uSigma * uSigma));
      rgb += w * (texture(uTex, vUv + uStep * x).rgb + texture(uTex, vUv - uStep * x).rgb);
      ws += 2.0 * w;
    }
    rgb /= ws;
  }
  if (uSigmaA > 0.35) {
    float st = max(1.0, uSigmaA * 3.0 / float(TAPS));
    float ws = 1.0;
    for (int i = 1; i <= TAPS; i++) {
      float x = float(i) * st;
      float w = exp(-x * x / (2.0 * uSigmaA * uSigmaA));
      a += w * (texture(uTex, vUv + uStep * x).a + texture(uTex, vUv - uStep * x).a);
      ws += 2.0 * w;
    }
    a /= ws;
  }
  outColor = vec4(rgb, a);
}`;

// --- Final: color, texto, estilo (grano/trama) y cuantización a la paleta.
export const FINAL_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uComp;
uniform sampler2D uBlur;
uniform vec2 uRes;
uniform float uResScale;
uniform float uSigma;
uniform float uSigmaA;
uniform float uSat;
uniform float uPale;
uniform float uGrain;
uniform float uFlatten;
uniform float uBrandMix;
uniform float uTick;
uniform float uChroma;
uniform float uGlow;
uniform float uGlass;
uniform float uStrict;
uniform int uStyle;
uniform vec3 uPaper;
uniform vec3 uTextColor;
uniform vec3 uPal[16];
uniform vec3 uPalLab[16];
uniform int uPalN;
uniform vec3 uInks[3];
uniform int uInkN;
uniform vec3 uRisoPaper;
uniform vec3 uGuardA;
uniform vec3 uGuardB;
uniform sampler2D uBlue;
uniform float uMatrix;
uniform float uCell;
uniform vec4 uKnife;
uniform float uPaperSpeck;
${NOISE}

// #0000FF y #3D3DEB están retirados: ningún píxel del preview o del export puede acercarse.
vec3 guardBlue(vec3 c) {
  if (distance(c, vec3(0.0, 0.0, 1.0)) < 0.12 || distance(c, vec3(0.239, 0.239, 0.922)) < 0.12) {
    return distance(c, uGuardA) < distance(c, uGuardB) ? uGuardA : uGuardB;
  }
  return c;
}

vec4 smp(vec2 uv) {
  // textureLod 0: con Pixel o Glass las coordenadas saltan entre píxeles vecinos y el muestreo
  // implícito elegiría un mip (que solo existe cuando Glow está activo).
  vec4 s = textureLod(uComp, uv, 0.0);
  vec4 b = textureLod(uBlur, uv, 0.0);
  return vec4(mix(s.rgb, b.rgb, smoothstep(0.3, 1.2, uSigma)), mix(s.a, b.a, smoothstep(0.3, 1.2, uSigmaA)));
}

vec3 baseAt(vec2 uv) {
  vec4 s = smp(uv);
  vec3 c = s.rgb;
  float ta = s.a;
  if (uChroma > 0.0) {
    vec2 dir = (uv - 0.5) * uChroma * 0.09 + vec2(uChroma * 0.008, 0.0);
    c.r = smp(uv + dir).r;
    c.b = smp(uv - dir).b;
  }
  if (uGlow > 0.0) {
    vec3 g = textureLod(uBlur, uv, 3.5).rgb;
    g = max(g - 0.25, 0.0) / 0.75;
    c = 1.0 - (1.0 - c) * (1.0 - g * g * uGlow * 1.6);
  }
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(l), c, uSat), 0.0, 1.0);
  c = mix(c, uPaper, uPale * (0.25 + 0.75 * smoothstep(0.1, 0.85, l)));
  return mix(c, uTextColor, ta);
}

vec3 toLab(vec3 c) {
  vec3 lin = mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c));
  float l = 0.4122214708 * lin.r + 0.5363325363 * lin.g + 0.0514459929 * lin.b;
  float m = 0.2119034982 * lin.r + 0.6806995451 * lin.g + 0.1073969566 * lin.b;
  float s = 0.0883024619 * lin.r + 0.2817188376 * lin.g + 0.6299787005 * lin.b;
  vec3 lms = pow(max(vec3(l, m, s), 0.0), vec3(1.0 / 3.0));
  return vec3(
    0.2104542553 * lms.x + 0.7936177850 * lms.y - 0.0040720468 * lms.z,
    1.9779984951 * lms.x - 2.4285922050 * lms.y + 0.4505937099 * lms.z,
    0.0259040371 * lms.x + 0.7827717662 * lms.y - 0.8086757660 * lms.z);
}

vec3 nearest(vec3 c) {
  if (uPalN == 0) return c;
  vec3 L = toLab(clamp(c, 0.0, 1.0));
  float bd = 1e9;
  vec3 best = c;
  for (int i = 0; i < 16; i++) {
    if (i >= uPalN) break;
    vec3 d = L - uPalLab[i];
    float dd = dot(d, d);
    if (dd < bd) { bd = dd; best = uPal[i]; }
  }
  return best;
}

// off: perturbación del grano/trama. La posterización recibe una fracción del paso, así las
// zonas planas quedan limpias y el grano se concentra en las transiciones.
vec3 quant(vec3 c, vec3 off) {
  float n = max(uFlatten, 2.0) - 1.0;
  vec3 post = floor(clamp(c + off * min(1.0, 1.2 / n), 0.0, 1.0) * n + 0.5) / n;
  return mix(post, nearest(c + off), uBrandMix);
}

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

float bayer8(vec2 p) {
  ivec2 q = ivec2(mod(p, 8.0));
  int x = q.x;
  int xy = q.x ^ q.y;
  int v = ((xy & 1) << 5) | ((x & 1) << 4) | ((xy & 2) << 2) | ((x & 2) << 1) | ((xy & 4) >> 1) | ((x & 4) >> 2);
  return (float(v) + 0.5) / 64.0;
}

vec3 tri(vec2 p) {
  return hash32(p) + hash32(p + 91.7) - 1.0; // ruido triangular en [-1, 1]
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = vUv;
  float A = uGrain / 100.0;
  float rib = 0.0;
  if (uGlass > 0.0) {
    // Vidrio acanalado: cada estría muestra la imagen comprimida e invertida, después del blur.
    float n = floor(16.0 * uRes.x / uRes.y) + 4.0;
    float c = fract(uv.x * n);
    uv.x += (0.5 - c) * uGlass * 0.95 / n;
    uv.y += (sin(c * 3.14159) - 0.64) * uGlass * 0.01;
    rib = (c - 0.5) * uGlass;
  }
  vec2 seed = vec2(uTick * 17.31, uTick * 7.17);
  vec3 col;

  if (uStyle == 0) {
    // Spray: ruido independiente por canal antes de cuantizar.
    float cell = max(1.0, floor(uResScale + 0.5));
    vec3 c = baseAt(uv);
    col = quant(c, tri(floor(fc / cell) + seed) * A * 1.9);
  } else if (uStyle == 1) {
    // Halftone: tramas rotadas por canal (15°, 75°, 45°).
    float P = (6.0 + uGrain * 0.45) * uResScale;
    vec2 j = (hash32(seed).xy - 0.5) * 0.25 * step(0.5, uTick);
    vec3 c = baseAt(uv);
    vec3 d;
    d.r = length(fract(rot(0.2618) * fc / P + j) - 0.5);
    d.g = length(fract(rot(1.309) * fc / P + j) - 0.5);
    d.b = length(fract(rot(0.7854) * fc / P + j) - 0.5);
    d *= 1.4142;
    col = quant(c, (d - 0.5) * (0.9 + A));
  } else if (uStyle == 2) {
    // Riso: cada tinta es una capa. Una capa se imprime donde su tinta es la más cercana
    // (entre papel y tintas) al color con grano. Las capas se multiplican con el registro corrido.
    vec3 labs[4];
    labs[0] = toLab(uRisoPaper);
    for (int i = 0; i < 3; i++) labs[i + 1] = toLab(uInks[min(i, max(uInkN - 1, 0))]);
    vec3 o = uRisoPaper;
    vec2 offs[3] = vec2[3](vec2(0.0), vec2(3.0, -2.0), vec2(-2.5, 2.5));
    for (int i = 0; i < 3; i++) {
      if (i >= uInkN) break;
      vec2 off = offs[i] * uResScale * (1.0 + A * 2.0);
      vec3 c = baseAt(uv + off / uRes);
      vec3 L = toLab(clamp(c + tri(fc + seed + float(i) * 37.0) * A * 1.6, 0.0, 1.0));
      int best = 0;
      float bd = 1e9;
      for (int k = 0; k < 4; k++) {
        if (k > uInkN) break;
        vec3 d = L - labs[k];
        float dd = dot(d, d);
        if (dd < bd) { bd = dd; best = k; }
      }
      if (best == i + 1) o *= uInks[i] / max(uRisoPaper, vec3(0.05));
    }
    col = uStrict > 0.5 ? o : o * (1.0 - 0.06 * hash12(fc * 0.5 + 3.0));
  } else if (uStyle == 3) {
    // Pixel: mosaico y dither ordenado (Bayer 8×8).
    float B = (2.0 + uGrain * 0.3) * uResScale;
    vec2 cell = floor(fc / B);
    vec3 c = baseAt((cell + 0.5) * B / uRes);
    vec2 sh = floor(hash32(seed).xy * 8.0) * step(0.5, uTick);
    col = quant(c, vec3(bayer8(cell + sh) - 0.5) * (0.25 + A * 0.9));
  } else if (uStyle == 5) {
    // Stipple: dither de 1 bit entre las dos primeras tintas (campo, figura). La densidad de puntos
    // es el valor: Bayer 8×8 o blue noise 64×64, en celdas de uCell px.
    float cell = max(1.0, floor(uCell * uResScale + 0.5));
    vec2 cc = floor(fc / cell);
    vec3 c = baseAt((cc + 0.5) * cell / uRes);
    vec2 sh = floor(hash32(seed).xy * 64.0) * step(0.5, uTick);
    float m = uMatrix < 0.5 ? bayer8(cc + sh) : (texelFetch(uBlue, ivec2(mod(cc + sh, 64.0)), 0).r * 255.0 + 0.5) / 256.0;
    vec3 ab = uPal[1] - uPal[0];
    float p0 = clamp(dot(c - uPal[0], ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0);
    // Grain mueve el umbral solo donde la densidad es parcial: los campos planos quedan limpios.
    float pp = p0 + (hash12(cc + seed) - 0.5) * A * 2.4 * p0 * (1.0 - p0);
    col = pp > m ? uPal[1] : uPal[0];
  } else {
    // Lines: trama de líneas con ondulación, tipo grabado.
    float P = (4.0 + uGrain * 0.3) * uResScale;
    vec2 r = rot(0.61) * fc;
    vec3 c = baseAt(uv);
    float ph = r.y / P + 0.7 * sin(r.x / (P * 11.0) + uTick * 0.37);
    float t = 0.5 + 0.5 * cos(6.28318 * ph);
    col = quant(c, vec3(t - 0.5) * (0.55 + A) + tri(fc + seed).x * A * 0.3);
  }
  // Brillo y sombra sutiles en los bordes de cada estría (solo con la paleta completa: con 2
  // tintas sumaría colores intermedios).
  if (uStrict < 0.5) col += rib * 0.05;
  // Grano de papel: motas fijas de la tinta de figura sobre el campo vacío, a densidad baja.
  if (uPaperSpeck > 0.0 && distance(col, uGuardA) < 0.02) {
    float cellP = max(1.0, floor(uResScale * 1.5 + 0.5));
    if (hash12(floor(fc / cellP) + 9.31) < uPaperSpeck) col = uGuardB;
  }
  // Cuchilla: un plano (ángulo + fase) evaluado después del blur, así el canto es duro. Del otro
  // lado figura y fondo se invierten: con 2 tintas, campo + figura − color.
  if (uKnife.w >= 0.0) {
    vec2 q = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    float sd = dot(q, uKnife.xy) - uKnife.z;
    sd += (hash12(fc + seed * 3.0) - 0.5) * uKnife.w * 0.12;
    if (sd > 0.0) col = uGuardA + uGuardB - col;
  }
  outColor = vec4(guardBlue(clamp(col, 0.0, 1.0)), 1.0);
}`;

// --- Composición de un modo Moodboard: la figura viene de un canvas 2D (densidad en r) y la capa
// nítida (type chico, órbitas) de otro. Sale la mezcla de las 2 tintas, más la capa nítida en a.
export const MODE_COMP_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uFig;
uniform sampler2D uCrisp;
uniform sampler2D uField;
uniform sampler2D uA;
uniform vec2 uCoverA;
uniform float uHasA;
uniform vec3 uBg;
uniform vec3 uFg;
uniform float uProgress;
uniform float uFill;
uniform float uPhoto;
uniform float uReveal;
uniform float uGain;
uniform float uTime;
uniform float uAspect;
uniform float uWave;
${NOISE}
void main() {
  vec2 uv = vUv;
  vec2 asp = vec2(uAspect, 1.0);
  if (uWave > 0.0) {
    vec2 q = uv * asp * 2.2;
    vec2 w = vec2(fbm(q + vec2(0.0, uTime * 0.13)), fbm(q + vec2(5.2, 1.3) - uTime * 0.11)) - 0.5;
    uv += w * uWave * 0.32;
  }
  vec2 suv = uv - texture(uField, uv).xy;
  float f = texture(uFig, suv).r;
  // Revelado: por manchas de spray (cada zona se llena cuando el avance pasa su umbral de ruido)
  // o por un barrido de izquierda a derecha.
  float rev;
  if (uReveal < 0.5) {
    float n = fbm(suv * asp * 3.0 + 7.1);
    rev = smoothstep(n - 0.12, n + 0.12, uProgress * 1.24 - 0.12);
  } else {
    rev = smoothstep(uProgress - 0.02, uProgress + 0.02, 1.0 - suv.x) ;
    rev = 1.0 - rev;
  }
  float d;
  if (uFill < 0.5) d = f * rev;
  else if (uFill < 1.5) d = (1.0 - f) * rev;
  else d = max(f, (1.0 - f) * 0.3) * rev;
  d *= uGain;
  if (uHasA > 0.5 && uPhoto > 0.0) {
    vec3 ph = texture(uA, clamp((suv - 0.5) * uCoverA + 0.5, 0.0, 1.0)).rgb;
    float l = dot(ph, vec3(0.2126, 0.7152, 0.0722));
    // Figura y foto en XOR: el type se lee sobre las dos tintas de la foto.
    d = abs(d - (1.0 - l) * uPhoto * rev);
  }
  outColor = vec4(mix(uBg, uFg, clamp(d, 0.0, 1.0)), texture(uCrisp, suv).r);
}`;


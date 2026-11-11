// Shaders del motor. Un solo fragment shader resuelve la escena (SDF) en dos modos:
// uMode 0 = preview determinista en tiempo real, uMode 1 = path tracing progresivo.

export const MAX_OBJ = 12
export const MAX_LIGHT = 6
export const TEXT_ROWS = 4
export const TEXT_AT = 5.3333 // ancho/alto de cada fila del atlas de texto
export const TEXT_SPREAD = 0.16 // rango de distancia codificado, en alturas de fila

export const VERT = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const HEAD = /* glsl */ `
precision highp float; precision highp int; precision highp sampler2D;
#define PI 3.14159265359
in vec2 vUv;
`

export const TRACE_FRAG = /* glsl */ `${HEAD}
#define MAX_OBJ ${MAX_OBJ}
#define MAX_LIGHT ${MAX_LIGHT}
#define TEXT_AT ${TEXT_AT.toFixed(4)}
#define TEXT_SPREAD ${TEXT_SPREAD.toFixed(4)}
#define TEXT_ROWS ${TEXT_ROWS.toFixed(1)}
#define FLOOR_ID 100

layout(location=0) out vec4 oColor;
layout(location=1) out vec4 oGuide;

uniform int uMode;
uniform sampler2D uPrevColor, uPrevGuide, uEnv, uTextSdf;
uniform float uSampleIdx, uFrameSeed;
uniform vec2 uRes;
uniform int uBounces, uSteps;

uniform int uObjCount;
uniform vec4 uObjPos[MAX_OBJ];   // xyz, tipo
uniform mat3 uObjRot[MAX_OBJ];   // mundo -> local
uniform vec4 uObjP1[MAX_OBJ];
uniform vec4 uObjP2[MAX_OBJ];    // escala, merge k, radio envolvente, seed
uniform vec4 uObjP3[MAX_OBJ];
uniform vec4 uMat0[MAX_OBJ];     // color, metal
uniform vec4 uMat1[MAX_OBJ];     // rough, trans, ior, dispersión
uniform vec4 uMat2[MAX_OBJ];     // iridiscencia, film nm, emisión, densidad
uniform vec4 uMat3[MAX_OBJ];     // rayones
uniform vec4 uBound;             // esfera envolvente de la escena

uniform vec4 uFloor;             // activo, y, rough, metal
uniform vec3 uFloorColor;
uniform vec3 uBgColor;
uniform float uBgVisible;        // 1 = el HDRI se ve de fondo
uniform float uEnvInt, uEnvRot;

uniform int uLightCount;
uniform vec4 uLPos[MAX_LIGHT];   // xyz, tipo (0 rect, 1 disco)
uniform vec4 uLU[MAX_LIGHT];     // eje u, medio ancho
uniform vec4 uLV[MAX_LIGHT];     // eje v, medio alto
uniform vec4 uLN[MAX_LIGHT];     // normal, área
uniform vec4 uLCol[MAX_LIGHT];   // radiancia, visible a cámara
uniform vec4 uLCone[MAX_LIGHT];  // cos externo, cos interno

uniform vec3 uCamPos, uCamR, uCamU, uCamF;
uniform float uTanFov, uLensR, uFocus;

// ---------- azar ----------
uint gSeed;
float rnd(){ gSeed = gSeed * 747796405u + 2891336453u; uint w = ((gSeed >> ((gSeed >> 28u) + 4u)) ^ gSeed) * 277803737u; w = (w >> 22u) ^ w; return float(w) / 4294967296.0; }
vec3 hash3(float n){ return fract(sin(vec3(n, n + 1.31, n + 2.77)) * vec3(43758.5453, 22578.1459, 19642.3490)); }
float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// ---------- SDF ----------
float smin(float a, float b, float k){ float h = max(k - abs(a - b), 0.0) / max(k, 1e-5); return min(a, b) - h * h * k * 0.25; }
float smax(float a, float b, float k){ return -smin(-a, -b, k); }
float sdCyl(vec3 p, float r, float h, float rd){ vec2 d = vec2(length(p.xz) - r + rd, abs(p.y) - h + rd); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - rd; }

float sdBlob(vec3 p, vec4 a, vec4 e){
  float d = 1e5; int n = int(a.y + 0.5); float ph = a.w * 6.2831853;
  for(int j = 0; j < 8; j++){
    if(j >= n) break;
    vec3 h = hash3(float(j) * 7.31 + e.y * 13.7 + 0.5);
    vec3 k = floor(h * 2.99) + 1.0; // frecuencias enteras: morph 0..1 cierra el loop
    vec3 c = a.z * vec3(sin(ph * k.x + h.y * 6.283), 0.8 * sin(ph * k.y + h.z * 6.283), cos(ph * k.z + h.x * 6.283)) * (0.45 + 0.55 * h.zxy);
    float r = a.x * (0.5 + 0.5 * fract(h.x * 5.3 + h.y));
    if(j == 0){ c *= 0.25; r = a.x; }
    d = smin(d, length(p - c) - r, e.x);
  }
  return d;
}

float sdText(vec3 p, vec4 a, vec4 e){
  float H = 2.0 * a.y; vec2 q = p.xy / H;
  vec2 b = abs(q) - vec2(TEXT_AT * 0.5, 0.5); float db = max(b.x, b.y);
  vec2 uv = vec2(clamp(q.x / TEXT_AT + 0.5, 0.002, 0.998), (clamp(q.y + 0.5, 0.01, 0.99) + a.x) / TEXT_ROWS);
  float d2 = (0.5 - textureLod(uTextSdf, uv, 0.0).r) * 2.0 * TEXT_SPREAD * H;
  if(db > 0.0) d2 = max(d2, db * H + TEXT_SPREAD * H * 0.8);
  vec2 w = vec2(d2, abs(p.z) - a.z) + e.x;
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0)) - e.x;
}

float sdDish(vec3 p, vec4 a){
  float o = sdCyl(p, a.x, a.y, a.w);
  if(a.z >= a.x || o > a.w) return o;
  float inn = sdCyl(p - vec3(0.0, a.z, 0.0), a.x - a.z, a.y, a.w * 0.6);
  return smax(o, -inn, a.w * 0.6);
}

float sdObj(int i, vec3 pw){
  vec4 pt = uObjPos[i]; vec4 a = uObjP1[i]; float s = uObjP2[i].x;
  vec3 p = uObjRot[i] * (pw - pt.xyz) / s;
  int ty = int(pt.w + 0.5); float d;
  if(ty == 0) d = length(p) - a.x;
  else if(ty == 1) d = length(vec2(length(p.xz) - a.x, p.y)) - a.y;
  else if(ty == 2){ p.y -= clamp(p.y, -a.y * 0.5, a.y * 0.5); d = length(p) - a.x; }
  else if(ty == 3) d = sdBlob(p, a, uObjP3[i]);
  else if(ty == 4) d = sdText(p, a, uObjP3[i]) * 0.85;
  else if(ty == 5) d = sdDish(p, a);
  else { vec3 q = abs(p) - a.xyz + a.w; d = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - a.w; }
  return d * s;
}

float map(vec3 p, out int id){
  float d = 1e5; id = -1; float dm = 1e5; float dmRaw = 1e5; int idm = -1;
  for(int i = 0; i < MAX_OBJ; i++){
    if(i >= uObjCount) break;
    vec4 q = uObjP2[i];
    float db = length(p - uObjPos[i].xyz) - q.z;
    if(q.y > 0.0){
      if(db > dm + q.y) continue;
      float di = sdObj(i, p);
      if(di < dmRaw){ dmRaw = di; idm = i; }
      dm = smin(dm, di, q.y);
    } else {
      if(db > d) continue;
      float di = sdObj(i, p);
      if(di < d){ d = di; id = i; }
    }
  }
  if(dm < d){ d = dm; id = idm; }
  return d;
}

vec3 calcNormal(vec3 p, float e){
  int t; vec2 k = vec2(1.0, -1.0) * e;
  return normalize(k.xyy * map(p + k.xyy, t) + k.yyx * map(p + k.yyx, t) + k.yxy * map(p + k.yxy, t) + k.xxx * map(p + k.xxx, t));
}

bool march(vec3 ro, vec3 rd, float tmax, out float t, out int id, out float side){
  int tmp; side = map(ro, tmp) < 0.0 ? -1.0 : 1.0; id = -1; t = 0.0;
  // recorte contra la esfera envolvente de la escena
  vec3 oc = ro - uBound.xyz; float b = dot(oc, rd); float c = dot(oc, oc) - uBound.w * uBound.w;
  float h = b * b - c; if(h < 0.0) return false;
  h = sqrt(h); float t0 = -b - h, t1 = -b + h; if(t1 < 0.0) return false;
  t = max(t0, 0.0); tmax = min(tmax, t1);
  for(int i = 0; i < uSteps; i++){
    float d = map(ro + rd * t, id) * side;
    if(d < 4e-4 * (1.0 + t)) return true;
    t += d;
    if(t > tmax) break;
  }
  id = -1; return false;
}

// ---------- materiales ----------
struct Mat { vec3 color; float metal; float rough; float trans; float ior; float disp; float iri; float film; float emis; float dens; float bump; };
Mat getMat(int id){
  Mat m;
  if(id == FLOOR_ID){ m.color = uFloorColor; m.metal = uFloor.w; m.rough = uFloor.z; m.trans = 0.0; m.ior = 1.5; m.disp = 0.0; m.iri = 0.0; m.film = 400.0; m.emis = 0.0; m.dens = 0.0; m.bump = 0.0; return m; }
  vec4 a = uMat0[id], b = uMat1[id], c = uMat2[id];
  m.color = a.rgb; m.metal = a.a; m.rough = b.x; m.trans = b.y; m.ior = b.z; m.disp = b.w; m.iri = c.x; m.film = c.y; m.emis = c.z; m.dens = c.w; m.bump = uMat3[id].x;
  return m;
}

vec3 thinFilm(float cosT, float thick){
  float c2 = sqrt(max(1.0 - (1.0 - cosT * cosT) / 1.96, 0.0));
  return 0.5 + 0.5 * cos(4.0 * PI * 1.4 * thick * c2 / vec3(640.0, 535.0, 455.0));
}

float fresnelD(float ci, float eta){ // eta = n_i / n_t
  float s2 = eta * eta * (1.0 - ci * ci); if(s2 >= 1.0) return 1.0;
  float ct = sqrt(1.0 - s2);
  float rs = (eta * ci - ct) / (eta * ci + ct); float rp = (eta * ct - ci) / (eta * ct + ci);
  return 0.5 * (rs * rs + rp * rp);
}

// rayones finos en espacio del objeto: desvían la normal
vec3 scratches(int id, vec3 pw){
  vec3 p = uObjRot[id] * (pw - uObjPos[id].xyz) / uObjP2[id].x;
  vec3 g = vec3(0.0);
  for(int k = 0; k < 4; k++){
    float an = float(k) * 1.37 + 0.4; vec3 dir = normalize(vec3(cos(an), 0.35 * sin(an * 2.1), sin(an)));
    vec3 per = normalize(cross(dir, vec3(0.3, 1.0, 0.2)));
    float u = dot(p, per) * (70.0 + 40.0 * float(k)); float v = dot(p, dir) * 1.6 + dot(p, cross(dir, per)) * 9.0;
    vec2 cell = floor(vec2(u, v)); float h = hash2(cell + float(k) * 17.0);
    if(h > 0.86){ float f = fract(u) - 0.5; g += per * sign(f) * smoothstep(0.16, 0.02, abs(f)) * (h - 0.86) * 7.0; }
  }
  return g;
}

vec3 envC(vec3 d){
  float a = atan(d.z, d.x) + uEnvRot;
  vec2 uv = vec2(a / (2.0 * PI) + 0.5, acos(clamp(d.y, -1.0, 1.0)) / PI);
  return textureLod(uEnv, uv, 0.0).rgb * uEnvInt;
}
vec3 envLod(vec3 d, float lod){
  float a = atan(d.z, d.x) + uEnvRot;
  vec2 uv = vec2(a / (2.0 * PI) + 0.5, acos(clamp(d.y, -1.0, 1.0)) / PI);
  return textureLod(uEnv, uv, lod).rgb * uEnvInt;
}

float hitLights(vec3 ro, vec3 rd, float tmax, bool cam, out int li){
  float best = tmax; li = -1;
  for(int i = 0; i < MAX_LIGHT; i++){
    if(i >= uLightCount) break;
    if(cam && uLCol[i].w < 0.5) continue;
    vec3 n = uLN[i].xyz; float dn = dot(rd, n); if(dn > -1e-4) continue;
    float t = dot(uLPos[i].xyz - ro, n) / dn; if(t < 1e-3 || t >= best) continue;
    vec3 q = ro + rd * t - uLPos[i].xyz; float u = dot(q, uLU[i].xyz), v = dot(q, uLV[i].xyz);
    bool inside = uLPos[i].w < 0.5 ? (abs(u) < uLU[i].w && abs(v) < uLV[i].w) : (u * u + v * v < uLU[i].w * uLU[i].w);
    if(inside){ best = t; li = i; }
  }
  return li >= 0 ? best : -1.0;
}
vec3 lightLe(int i, vec3 rd){
  float c = dot(-rd, uLN[i].xyz);
  return uLCol[i].rgb * smoothstep(uLCone[i].x, uLCone[i].y, c);
}

void onb(vec3 n, out vec3 t, out vec3 b){ float s = n.z >= 0.0 ? 1.0 : -1.0; float a = -1.0 / (s + n.z); float c = n.x * n.y * a; t = vec3(1.0 + s * n.x * n.x * a, s * c, -s * n.x); b = vec3(c, s + n.y * n.y * a, -n.y); }
vec3 sampleGGX(vec3 n, float a){
  float u1 = rnd(), u2 = rnd(); float ct = sqrt((1.0 - u1) / (1.0 + (a * a - 1.0) * u1)); float st = sqrt(max(1.0 - ct * ct, 0.0)); float ph = 2.0 * PI * u2;
  vec3 t, b; onb(n, t, b); return normalize(t * (st * cos(ph)) + b * (st * sin(ph)) + n * ct);
}
vec3 sampleCos(vec3 n){
  float u1 = rnd(), u2 = rnd(); float r = sqrt(u1), ph = 2.0 * PI * u2;
  vec3 t, b; onb(n, t, b); return normalize(t * (r * cos(ph)) + b * (r * sin(ph)) + n * sqrt(max(1.0 - u1, 0.0)));
}
float smithG1(float nx, float a){ float a2 = a * a; return 2.0 * nx / (nx + sqrt(a2 + (1.0 - a2) * nx * nx)); }
vec3 wlWeight(float u){ // peso espectral con media 1 por canal
  vec3 w = clamp(1.5 - abs(4.0 * u - vec3(3.0, 2.0, 1.0)), 0.0, 1.0);
  return w / vec3(0.46875, 0.5, 0.46875);
}
float max3(vec3 v){ return max(v.x, max(v.y, v.z)); }
// el piso infinito se funde con el color de fondo lejos de la escena: no hay línea de horizonte
float floorFade(vec3 p){ return smoothstep(uBound.w * 1.5 + 2.0, uBound.w * 3.5 + 9.0, length(p.xz - uBound.xz)); }

bool sceneHit(vec3 ro, vec3 rd, out float t, out int id, out float side){
  bool hit = march(ro, rd, 1e3, t, id, side);
  if(uFloor.x > 0.5 && rd.y < -1e-5){
    float tf = (uFloor.y - ro.y) / rd.y;
    if(tf > 1e-4 && (!hit || tf < t)){ hit = true; t = tf; id = FLOOR_ID; side = 1.0; }
  }
  return hit;
}

vec3 surfNormal(int id, vec3 p, float t, float side, Mat m){
  if(id == FLOOR_ID) return vec3(0.0, 1.0, 0.0);
  vec3 n = calcNormal(p, 6e-4 * (1.0 + t));
  if(m.bump > 0.0) n = normalize(n + scratches(id, p) * m.bump * 0.12);
  return n * side;
}

// ---------- path tracing ----------
vec3 trace(vec3 ro, vec3 rd, out vec4 guide){
  vec3 thr = vec3(1.0), L = vec3(0.0); bool spec = true, cam = true; float pdfB = 0.0, wl = -1.0;
  guide = vec4(0.0, 0.0, 0.0, 60.0);
  for(int b = 0; b <= uBounces; b++){
    float t, side; int id, li;
    bool hit = sceneHit(ro, rd, t, id, side);
    float tl = hitLights(ro, rd, hit ? t : 1e9, cam, li);
    if(tl > 0.0){
      float w = 1.0;
      if(!spec){ float cl = max(dot(-rd, uLN[li].xyz), 1e-4); float pl = tl * tl / (cl * uLN[li].w * float(uLightCount)); w = pdfB / (pdfB + pl); }
      L += thr * lightLe(li, rd) * w;
      if(b == 0) guide = vec4(-rd, tl);
      break;
    }
    if(!hit){ L += thr * ((cam && uBgVisible < 0.5) ? uBgColor : envC(rd)); break; }
    vec3 p = ro + rd * t; Mat m = getMat(id);
    if(id == FLOOR_ID){ float ff = floorFade(p); if(ff > 0.0 && rnd() < ff){ L += thr * uBgColor; if(b == 0) guide = vec4(0.0, 1.0, 0.0, t); break; } }
    vec3 n = surfNormal(id, p, t, side, m);
    if(side < 0.0 && m.dens > 0.0) thr *= exp(log(max(m.color, vec3(1e-3))) * m.dens * t);
    if(b == 0) guide = vec4(n, t);
    if(side > 0.0 && m.emis > 0.0) L += thr * m.color * m.emis;
    vec3 v = -rd; float a = max(m.rough * m.rough, 1e-3);
    vec3 h = sampleGGX(n, a); float vh = dot(v, h); if(vh <= 0.0){ h = n; vh = max(dot(v, n), 1e-4); }
    float eps = 2e-3 * (1.0 + t);
    float nv = max(dot(n, v), 1e-4), nh = max(dot(n, h), 1e-4);
    if(rnd() < m.metal){
      vec3 r = reflect(rd, h); float nl = dot(r, n); if(nl <= 0.0) break;
      vec3 F = m.color + (1.0 - m.color) * pow(1.0 - vh, 5.0);
      if(m.iri > 0.0) F = mix(F, F * (0.25 + 1.5 * thinFilm(vh, m.film)), m.iri);
      float G = smithG1(nv, a) * smithG1(nl, a);
      thr *= F * clamp(G * vh / (nv * nh), 0.0, 2.0);
      ro = p + n * eps; rd = r; spec = true; cam = false;
    } else {
      if(m.disp > 0.0 && m.trans > 0.0 && wl < 0.0){ wl = rnd(); thr *= wlWeight(wl); }
      float ior = m.ior + (wl >= 0.0 ? m.disp * 0.14 * (0.5 - wl) : 0.0);
      float eta = side > 0.0 ? 1.0 / ior : ior;
      float F = fresnelD(vh, eta);
      vec3 R = vec3(F);
      if(m.iri > 0.0 && side > 0.0) R = mix(R, clamp(F + thinFilm(vh, m.film) * (1.0 - F) * 0.9, 0.0, 1.0), m.iri);
      float pR = clamp((R.r + R.g + R.b) / 3.0, 0.0, 1.0);
      if(rnd() < pR){
        vec3 r = reflect(rd, h); if(dot(r, n) <= 0.0) break;
        thr *= R / pR; ro = p + n * eps; rd = r; spec = true; cam = false;
      } else {
        thr *= (1.0 - R) / max(1.0 - pR, 1e-4);
        if(rnd() < m.trans){
          vec3 r = refract(rd, h, eta); if(dot(r, r) < 0.5 || dot(r, n) >= 0.0) break;
          ro = p - n * eps; rd = r; spec = true; if(m.rough > 0.3) cam = false;
        } else {
          thr *= m.color; ro = p + n * eps;
          if(uLightCount > 0){
            int k = min(int(rnd() * float(uLightCount)), uLightCount - 1);
            float r1 = rnd(), r2 = rnd(); vec3 x;
            if(uLPos[k].w < 0.5) x = uLPos[k].xyz + uLU[k].xyz * ((2.0 * r1 - 1.0) * uLU[k].w) + uLV[k].xyz * ((2.0 * r2 - 1.0) * uLV[k].w);
            else { float rr = sqrt(r1) * uLU[k].w, ph = 2.0 * PI * r2; x = uLPos[k].xyz + uLU[k].xyz * (rr * cos(ph)) + uLV[k].xyz * (rr * sin(ph)); }
            vec3 wi = x - ro; float d2 = dot(wi, wi); float dist = sqrt(d2); wi /= dist;
            float cl = dot(-wi, uLN[k].xyz), nl = dot(n, wi);
            if(cl > 1e-4 && nl > 0.0){
              float ts, ss; int ids;
              bool blocked = march(ro, wi, dist - 1e-3, ts, ids, ss) && ts < dist - 1e-3;
              if(!blocked){
                float pl = d2 / (cl * uLN[k].w * float(uLightCount)); float pb = nl / PI;
                L += thr * lightLe(k, wi) * (nl / PI) / pl * (pl / (pl + pb));
              }
            }
          }
          rd = sampleCos(n); pdfB = max(dot(n, rd), 1e-4) / PI; spec = false; cam = false;
        }
      }
    }
    if(b > 3){ float q = clamp(max3(thr), 0.05, 1.0); if(rnd() > q) break; thr /= q; }
  }
  return L;
}

// ---------- preview en tiempo real ----------
vec3 lookup(vec3 ro, vec3 rd, float rough, bool cam){
  int li; float tl = hitLights(ro, rd, 1e9, cam, li);
  if(tl > 0.0) return lightLe(li, rd) * (1.0 - 0.6 * smoothstep(0.2, 0.8, rough));
  if(cam && uBgVisible < 0.5) return uBgColor;
  return envLod(rd, rough * 7.0);
}
vec3 directDiffuse(vec3 p, vec3 n){
  vec3 E = envLod(n, 6.5);
  for(int i = 0; i < MAX_LIGHT; i++){
    if(i >= uLightCount) break;
    vec3 wi = uLPos[i].xyz - p; float d2 = dot(wi, wi); float dist = sqrt(d2); wi /= dist;
    float nl = dot(n, wi), cl = dot(-wi, uLN[i].xyz); if(nl <= 0.0 || cl <= 0.0) continue;
    float sh = 1.0, t = 0.03; int tmp;
    for(int s = 0; s < 14; s++){ float d = map(p + wi * t, tmp); sh = min(sh, 6.0 * d / t); t += clamp(d, 0.02, 0.5); if(sh < 0.01 || t > dist) break; }
    E += lightLe(i, wi) * nl * cl * uLN[i].w / (PI * (d2 + uLN[i].w)) * clamp(sh, 0.0, 1.0);
  }
  return E;
}
vec3 preview(vec3 ro, vec3 rd, out vec4 guide){
  vec3 thr = vec3(1.0), col = vec3(0.0); bool cam = true; guide = vec4(0.0, 0.0, 0.0, 60.0);
  for(int b = 0; b < 7; b++){
    float t, side; int id;
    if(!sceneHit(ro, rd, t, id, side)){ col += thr * lookup(ro, rd, 0.0, cam); return col; }
    int li; float tl = hitLights(ro, rd, t, cam, li);
    if(tl > 0.0){ col += thr * lightLe(li, rd); return col; }
    vec3 p = ro + rd * t; Mat m = getMat(id); vec3 n = surfNormal(id, p, t, side, m);
    if(b == 0) guide = vec4(n, t);
    if(id == FLOOR_ID){ float ff = floorFade(p); col += thr * ff * uBgColor; thr *= 1.0 - ff; }
    if(side < 0.0 && m.dens > 0.0) thr *= exp(log(max(m.color, vec3(1e-3))) * m.dens * t);
    float nv = max(dot(n, -rd), 1e-4); float eta = side > 0.0 ? 1.0 / m.ior : m.ior; float eps = 2e-3 * (1.0 + t);
    vec3 r = reflect(rd, n);
    if(m.metal > 0.5){
      vec3 F = m.color + (1.0 - m.color) * pow(1.0 - nv, 5.0);
      if(m.iri > 0.0) F = mix(F, F * (0.25 + 1.5 * thinFilm(nv, m.film)), m.iri);
      col += thr * F * lookup(p + n * eps, r, m.rough, false); return col;
    }
    float F = fresnelD(nv, eta); vec3 R = vec3(F);
    if(m.iri > 0.0 && side > 0.0) R = mix(R, clamp(F + thinFilm(nv, m.film) * (1.0 - F) * 0.9, 0.0, 1.0), m.iri);
    if(side > 0.0){
      col += thr * m.color * m.emis;
      col += thr * R * lookup(p + n * eps, r, m.rough, false);
      if(m.trans < 0.999) col += thr * (1.0 - R) * (1.0 - m.trans) * m.color * directDiffuse(p + n * eps, n);
    }
    if(m.trans < 0.01) return col;
    if(F >= 1.0){ ro = p + n * eps; rd = r; continue; }
    thr *= (1.0 - R) * m.trans; rd = refract(rd, n, eta); ro = p - n * eps;
    if(max3(thr) < 0.02) return col;
  }
  return col + thr * envLod(rd, 3.0) * 0.5;
}

void main(){
  ivec2 px = ivec2(gl_FragCoord.xy);
  gSeed = uint(px.x) * 1973u + uint(px.y) * 9277u + uint(uFrameSeed) * 26699u + 1u; rnd();
  vec2 jit = vec2(rnd(), rnd());
  vec2 ndc = ((gl_FragCoord.xy - 0.5 + jit) / uRes) * 2.0 - 1.0;
  vec3 rd = normalize(uCamF + uCamR * (ndc.x * uTanFov * uRes.x / uRes.y) + uCamU * (ndc.y * uTanFov));
  vec3 ro = uCamPos;
  vec4 guide; vec3 col;
  if(uMode == 1){
    if(uLensR > 0.0){
      vec3 fp = ro + rd * (uFocus / dot(rd, uCamF));
      float a = 2.0 * PI * rnd(), r = uLensR * sqrt(rnd());
      ro += uCamR * (r * cos(a)) + uCamU * (r * sin(a)); rd = normalize(fp - ro);
    }
    col = trace(ro, rd, guide);
    if(any(isnan(col)) || any(isinf(col))) col = vec3(0.0);
    col = min(col, vec3(24.0));
  } else {
    col = preview(ro, rd, guide);
    if(any(isnan(col))) col = vec3(0.0);
  }
  float w = 1.0 / (uSampleIdx + 1.0);
  oColor = mix(texelFetch(uPrevColor, px, 0), vec4(col, 1.0), w);
  oGuide = mix(texelFetch(uPrevGuide, px, 0), guide, w);
}
`

// Denoiser à-trous guiado por normal, profundidad y color.
export const DENOISE_FRAG = /* glsl */ `${HEAD}
out vec4 oColor;
uniform sampler2D uColor, uGuide;
uniform float uStep, uSigma;
void main(){
  ivec2 px = ivec2(gl_FragCoord.xy); ivec2 sz = textureSize(uColor, 0);
  vec4 c0 = texelFetch(uColor, px, 0); vec4 g0 = texelFetch(uGuide, px, 0);
  float l0 = dot(c0.rgb, vec3(0.3, 0.5, 0.2));
  vec3 sum = vec3(0.0); float ws = 0.0;
  const float k[3] = float[3](0.375, 0.25, 0.0625);
  for(int y = -2; y <= 2; y++) for(int x = -2; x <= 2; x++){
    ivec2 q = clamp(px + ivec2(x, y) * int(uStep), ivec2(0), sz - 1);
    vec4 c = texelFetch(uColor, q, 0); vec4 g = texelFetch(uGuide, q, 0);
    float wn = pow(max(dot(g.xyz, g0.xyz), 0.0), 48.0);
    if(dot(g0.xyz, g0.xyz) < 0.25) wn = dot(g.xyz, g.xyz) < 0.25 ? 1.0 : 0.0;
    float wz = exp(-abs(g.w - g0.w) / (0.02 * (1.0 + g0.w)));
    float dl = dot(c.rgb, vec3(0.3, 0.5, 0.2)) - l0;
    float wc = exp(-dl * dl / (uSigma * uSigma * (0.02 + l0 * l0)));
    float w = k[abs(x)] * k[abs(y)] * wn * wz * wc;
    sum += c.rgb * w; ws += w;
  }
  oColor = vec4(sum / max(ws, 1e-5), 1.0);
}
`

export const DOWN_FRAG = /* glsl */ `${HEAD}
out vec4 oColor;
uniform sampler2D uTex; uniform vec2 uTexel; uniform float uFirst;
void main(){
  vec3 c = texture(uTex, vUv).rgb * 4.0;
  c += texture(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb + texture(uTex, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  c += texture(uTex, vUv + uTexel * vec2(-1.0, 1.0)).rgb + texture(uTex, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c /= 8.0;
  if(uFirst > 0.5){ float l = max(c.r, max(c.g, c.b)); c *= smoothstep(0.6, 1.6, l); c = min(c, vec3(12.0)); }
  oColor = vec4(c, 1.0);
}
`

export const UP_FRAG = /* glsl */ `${HEAD}
out vec4 oColor;
uniform sampler2D uTex, uAdd; uniform vec2 uTexel; uniform float uRadius;
void main(){
  vec2 d = uTexel * uRadius;
  vec3 c = texture(uTex, vUv).rgb * 4.0;
  c += (texture(uTex, vUv + vec2(d.x, 0.0)).rgb + texture(uTex, vUv - vec2(d.x, 0.0)).rgb + texture(uTex, vUv + vec2(0.0, d.y)).rgb + texture(uTex, vUv - vec2(0.0, d.y)).rgb) * 2.0;
  c += texture(uTex, vUv + d).rgb + texture(uTex, vUv - d).rgb + texture(uTex, vUv + vec2(d.x, -d.y)).rgb + texture(uTex, vUv + vec2(-d.x, d.y)).rgb;
  oColor = vec4(c / 16.0 + texture(uAdd, vUv).rgb, 1.0);
}
`

export const FINAL_FRAG = /* glsl */ `${HEAD}
out vec4 oColor;
uniform sampler2D uColor, uBloomTex;
uniform float uExposure, uBloom, uGrain, uVignette, uSeed;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uSeed) * 43758.5453); }
void main(){
  vec3 c = texture(uColor, vUv).rgb + texture(uBloomTex, vUv).rgb * uBloom;
  c *= uExposure;
  vec2 q = vUv - 0.5; c *= 1.0 - uVignette * dot(q, q) * 1.6;
  // tonemap que conserva el tono: ACES sobre la luminancia máxima, mezclado con por-canal
  float m = max(c.r, max(c.g, c.b)); vec3 a = aces(c); vec3 b = m > 1e-5 ? c * (aces(vec3(m)).r / m) : c;
  c = mix(a, b, 0.55);
  c = pow(c, vec3(1.0 / 2.2));
  c += (h(gl_FragCoord.xy) - 0.5) * (uGrain * 0.12 + 1.0 / 255.0);
  oColor = vec4(c, 1.0);
}
`

// <city-scene> — a downtown in Utah Valley under the Wasatch Front, procedural.
//
// Built once on load (GPU):
//   terrain   eroded heightmap -> normals -> baked sun/moon shadow, AO, curvature
//   city      blocks on a 160 m grid: towers with setbacks and lit crowns,
//             mid-rise perimeter blocks, houses, rooftop plant; ~10k cars on
//             the streets; lamps, aviation beacons, aircraft
//   shadows   one orthographic depth render of the buildings from the sun
// Per frame: sky dome, terrain (streets, parks, lamp pools), buildings
// (window grids, curtain-wall reflections, interiors), traffic, light sprites.
// Light/dark is one uniform (uNight) animated over ~2.4s, so toggling the
// theme plays dusk: alpenglow, then windows and streets switching on.
// Units: 1 = 1 km. -z is east (toward the range), -x is north.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

const DOM = { x0: -40, z0: -46, w: 80, h: 58 };   // heightmap extent
const CITY = { x0: -17, z0: -10.5, w: 32, h: 13 }; // street grid origin + ground texture extent
const CAM = new THREE.Vector3(10.2, 0.24, 0.8);    // ~240 m up, a high balcony on the west side
const AIM = new THREE.Vector3(3.6, 0.5, -10.7);
const SUN = new THREE.Vector3(0.53, 0.36, -0.76).normalize();   // early October morning: ~21° up in the south-east, over the range
const MOON = new THREE.Vector3(-0.458, 0.148, -0.876).normalize(); // rising over the range, clear of the nav

// ------------------------------------------------------------------ GLSL
const COMMON = /* glsl */ `
#define PI 3.14159265359
uniform vec4 uDom;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy) * 2.0 - 1.0; }
float hash13(vec3 p3){ p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
// gradient noise with analytic derivatives: (value, d/dx, d/dy)
vec3 noised(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0), du = 30.0*f*f*(f*(f-2.0)+1.0);
  vec2 ga = hash22(i), gb = hash22(i+vec2(1,0)), gc = hash22(i+vec2(0,1)), gd = hash22(i+vec2(1,1));
  float va = dot(ga, f), vb = dot(gb, f-vec2(1,0)), vc = dot(gc, f-vec2(0,1)), vd = dot(gd, f-vec2(1,1));
  return vec3(va + u.x*(vb-va) + u.y*(vc-va) + u.x*u.y*(va-vb-vc+vd),
              ga + u.x*(gb-ga) + u.y*(gc-ga) + u.x*u.y*(ga-gb-gc+gd) + du*(u.yx*(va-vb-vc+vd) + vec2(vb,vc) - va));
}
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), f.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p, int oct){ float s = 0.0, a = 0.5; for (int i = 0; i < 8; i++){ if (i >= oct) break; s += a*vnoise(p); p = mat2(1.6,1.2,-1.2,1.6)*p + 11.7; a *= 0.5; } return s; }
`;

const HEIGHT_FRAG = /* glsl */ `
${COMMON}
varying vec2 vUv;
float G(float x, float c, float w){ float t = (x-c)/w; return exp(-t*t); }
// Wasatch fault: the range front, wandering a little north to south
float frontZ(float x){ return -8.6 + 0.9*sin(x*0.083+0.7) + 0.45*sin(x*0.21+2.0) + 0.18*sin(x*0.57+1.0); }
// ridged multifractal: sharp crests and spurs at every scale, smooth valleys
float ridged(vec2 p){
  float s = 0.0, a = 0.5, w = 1.0;
  for (int i = 0; i < 6; i++){
    float n = 1.0 - abs(noised(p).x*1.7);
    n = n*n*w; w = clamp(n*2.0, 0.0, 1.0);
    s += n*a; a *= 0.42; p = mat2(1.62, 1.18, -1.18, 1.62)*p + 5.3;   // fast falloff: big ridges, little lumpiness
  }
  return s;
}
float baseH(vec2 p){
  float x = p.x, z = p.y;
  float d = frontZ(x) - z;                       // km behind the fault
  float bench = 0.42*smoothstep(1.0, 8.0, z);     // West Mountain side, under the camera
  // which parts of the crest stand tall: a big massif right of centre, a second summit left
  float C = clamp(0.35 + 0.75*G(x, 6.0, 3.3) + 0.45*G(x, -5.4, 2.4) + 0.3*G(x, 13.5, 3.0) - 0.3*G(x, -1.5, 1.6) - 0.25*G(x, -11.5, 3.0), 0.0, 1.0);
  float E = smoothstep(-0.3, 2.6, d);            // fault scarp
  float back = mix(1.0, 0.55, smoothstep(5.5, 11.0, d));
  float E2 = smoothstep(0.4, 4.0, d)*back;
  // spurs run down toward the valley, so stretch the noise along z; warp it so ridgelines bend
  vec2 q = vec2(p.x/3.0, p.y/5.2);
  q += 0.38*vec2(noised(q*0.8 + 11.0).x, noised(q*0.8 + 23.0).x);
  float R = ridged(q + vec2(3.1, 7.7));
  float H = E*(0.45 + 0.55*C)*back + E2*R*(0.85 + 1.05*C);
  H += 0.8*smoothstep(13.0, 22.0, d)*(0.6 + 0.6*R);  // farther ranges, haze only
  // canyons through the front: Provo Canyon (big), Rock Canyon, Hobble Creek
  float cut = smoothstep(-0.6, 1.2, d)*(1.0 - smoothstep(5.5, 10.0, d));
  H *= 1.0 - 0.78*G(x, -1.5, 0.42)*cut - 0.45*G(x, -4.1, 0.28)*cut - 0.4*G(x, 10.8, 0.32)*cut;
  // alluvial fans and Bonneville benches at the foot of the scarp
  H += 0.07*smoothstep(-2.0, 0.0, d)*(1.0 - smoothstep(0.0, 1.5, d));
  return H + bench;
}
// erosion filter (after Clay John): a cosine stroke field per cell, oriented
// along the local slope so gullies run downhill and branch as octaves add up
vec3 erosion(vec2 p, vec2 dir){
  vec2 ip = floor(p), fp = fract(p);
  vec3 va = vec3(0.0); float wt = 0.0;
  for (int i = -2; i <= 1; i++) for (int j = -2; j <= 1; j++){
    vec2 o = vec2(i, j);
    vec2 pp = fp + o - hash22(ip - o)*0.5;
    float w = exp(-dot(pp, pp)*2.0);
    float m = dot(pp, dir)*2.0*PI;
    va += vec3(cos(m), -sin(m)*dir)*w; wt += w;
  }
  return va/wt;
}
void main(){
  vec2 p = uDom.xy + vUv*uDom.zw;
  const float e = 0.025;
  float h0 = baseH(p);
  vec2 g0 = vec2(baseH(p+vec2(e,0)) - baseH(p-vec2(e,0)), baseH(p+vec2(0,e)) - baseH(p-vec2(0,e)))/(2.0*e);
  float mtn = smoothstep(0.08, 0.6, h0 - 0.42*smoothstep(1.0, 8.0, p.y));
  // erosion octaves, ~1 km gullies down to ~60 m; strength varies face to face
  vec2 dir = vec2(g0.y, -g0.x)*3.0;
  vec3 h = vec3(0.0); float a = 0.5, f = 1.0;
  for (int i = 0; i < 6; i++){
    h += erosion(p*1.05*f, dir + h.zy*vec2(1.0, -1.0)*0.5)*a*vec3(1.0, f, f);
    a *= 0.5; f *= 2.0;
  }
  float slope = length(g0);
  float vary = 0.45 + 0.9*vnoise(p*0.35 + 2.0);
  float str = 0.24*vary*smoothstep(0.08, 0.5, slope)*(0.3 + 0.7*mtn);   // deep drainages cut the faces
  float ex = h.x > 0.0 ? h.x*0.35 : h.x;     // erosion carves channels; it barely raises ground, so crests don't turn to needles
  float H = h0 + ex*str;
  H += 0.004*vnoise(p*9.0);
  gl_FragColor = vec4(H, h.x*0.5 + 0.5, mtn, 1.0);
}`;

// bilinear height from the (possibly non-filterable) float texture
const HFETCH = /* glsl */ `
uniform sampler2D uH; uniform vec2 uHRes;
vec4 Hraw(vec2 xz){
  vec2 t = (xz - uDom.xy)/uDom.zw*uHRes - 0.5;
  vec2 i = floor(t), f = t - i;
  ivec2 a = ivec2(clamp(i, vec2(0.0), uHRes - 1.0)), b = ivec2(clamp(i + 1.0, vec2(0.0), uHRes - 1.0));
  vec4 h00 = texelFetch(uH, ivec2(a.x, a.y), 0), h10 = texelFetch(uH, ivec2(b.x, a.y), 0);
  vec4 h01 = texelFetch(uH, ivec2(a.x, b.y), 0), h11 = texelFetch(uH, ivec2(b.x, b.y), 0);
  return mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y);
}
float H(vec2 xz){ return Hraw(xz).r; }
`;

const NORMAL_FRAG = /* glsl */ `
${COMMON}
${HFETCH}
varying vec2 vUv;
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy);
  ivec2 m = ivec2(uHRes) - 1;
  float l = texelFetch(uH, clamp(c - ivec2(1,0), ivec2(0), m), 0).r, r = texelFetch(uH, clamp(c + ivec2(1,0), ivec2(0), m), 0).r;
  float d = texelFetch(uH, clamp(c - ivec2(0,1), ivec2(0), m), 0).r, u = texelFetch(uH, clamp(c + ivec2(0,1), ivec2(0), m), 0).r;
  vec2 cell = uDom.zw/uHRes;
  vec3 n = normalize(vec3(-(r - l)/(2.0*cell.x), 1.0, -(u - d)/(2.0*cell.y)));
  vec4 s = texelFetch(uH, c, 0);
  gl_FragColor = vec4(n*0.5 + 0.5, s.g);
}`;

const BAKE_FRAG = /* glsl */ `
${COMMON}
${HFETCH}
varying vec2 vUv;
uniform vec3 uSun, uMoon;
float shadow(vec3 ro, vec3 L, float k){
  float res = 1.0, t = 0.02;
  for (int i = 0; i < 110; i++){
    vec3 p = ro + L*t;
    if (p.y > 3.6 || p.x < uDom.x || p.z < uDom.y || p.x > uDom.x + uDom.z || p.z > uDom.y + uDom.w) break;
    float d = p.y - H(p.xz);
    res = min(res, k*d/t);
    if (res < -0.2) break;
    t += clamp(0.012 + t*0.035, 0.012, 0.5);
  }
  res = clamp(res, 0.0, 1.0);
  return res*res*(3.0 - 2.0*res);
}
void main(){
  vec2 p = uDom.xy + vUv*uDom.zw;
  float h = H(p);
  vec3 ro = vec3(p.x, h + 0.004, p.y);
  float sS = shadow(ro, uSun, 14.0), sM = shadow(ro, uMoon, 10.0);
  // horizon-ish AO: how far nearby terrain rises above this point
  float occ = 0.0, cav = 0.0;
  for (int k = 0; k < 3; k++){
    float r = 0.06*pow(3.2, float(k));
    float acc = 0.0;
    for (int i = 0; i < 10; i++){
      float a = (float(i) + 0.5*float(k))*PI*0.2;
      float dh = H(p + r*vec2(cos(a), sin(a))) - h;
      acc += clamp(atan(dh/r)/(0.5*PI), 0.0, 1.0);
      if (k == 0) cav += dh;
    }
    occ += acc/10.0*(k == 0 ? 0.5 : 0.25);
  }
  float ao = clamp(1.0 - occ*1.6, 0.0, 1.0);
  cav = clamp(0.5 - cav/10.0*7.0, 0.0, 1.0); // >0.5 ridge, <0.5 gully
  gl_FragColor = vec4(sS, sM, ao, cav);
}`;

const SKY = /* glsl */ `
uniform float uNight, uTime;
uniform vec3 uSun, uMoon;
vec3 skyDay(vec3 rd){
  float y = max(rd.y, 0.0);
  vec3 zen = vec3(0.025, 0.10, 0.36), hor = vec3(0.42, 0.53, 0.68);
  vec3 c = mix(hor, zen, pow(y, 0.42));
  float sd = max(dot(rd, uSun), 0.0);
  c += vec3(1.0, 0.72, 0.45)*(0.16*pow(sd, 6.0) + 0.08*pow(sd, 2.0)*(1.0 - y));
  // morning: the whole eastern horizon warms, strongest toward the sunrise
  float az = max(dot(normalize(rd.xz + 1e-4), normalize(uSun.xz)), 0.0);
  c += vec3(1.0, 0.64, 0.42)*0.20*pow(az, 2.5)*exp(-y*5.0);
  c = mix(c, vec3(0.80, 0.76, 0.72), 0.32*exp(-y*16.0)); // pale band at the horizon
  return c;
}
vec3 skyNight(vec3 rd){
  float y = max(rd.y, 0.0);
  vec3 c = mix(vec3(0.012, 0.019, 0.036), vec3(0.0012, 0.0025, 0.0065), pow(y, 0.45));
  float md = max(dot(rd, uMoon), 0.0);
  c += vec3(0.30, 0.38, 0.55)*(0.05*pow(md, 10.0) + 0.012*pow(md, 2.0));
  float az = clamp(1.0 - abs(rd.x + 0.35)*0.9, 0.0, 1.0);
  c += vec3(0.30, 0.15, 0.06)*0.11*exp(-y*9.0)*(0.5 + 0.5*az); // city skyglow
  return c;
}
vec3 skyCol(vec3 rd){
  vec3 c = mix(skyDay(rd), skyNight(rd), uNight);
  // passing through dusk: Earth's shadow low on the eastern horizon, the pink Belt of Venus above it
  float dusk = 4.0*uNight*(1.0 - uNight); dusk *= dusk;
  float y = max(rd.y, 0.0);
  c = mix(c, vec3(0.10, 0.12, 0.20), dusk*0.55*exp(-y*30.0));
  c += vec3(0.55, 0.26, 0.28)*0.28*dusk*exp(-pow((y - 0.07)/0.06, 2.0));
  return c;
}
`;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){ vDir = position; vec4 p = projectionMatrix*viewMatrix*vec4(position + cameraPosition, 1.0); gl_Position = p.xyww; }`;

const SKY_FRAG = /* glsl */ `
${COMMON}
${SKY}
varying vec3 vDir;
vec3 aces(vec3 x){ return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0); }
void main(){
  vec3 rd = normalize(vDir);
  vec3 c = skyCol(rd);
  float y = max(rd.y, 0.001);
  // a few high, thin clouds drifting from the west; most of the sky stays clear
  vec2 uv = rd.xz/(y + 0.1)*1.2 + vec2(-uTime*0.0035, uTime*0.0012);
  float warp = fbm(uv*0.6 + 2.0, 3);
  float n = fbm(uv*vec2(0.5, 1.1) + warp*1.8, 6);
  float cover = smoothstep(0.35, 0.7, fbm(uv*0.12 + 4.0, 3));       // large clear gaps
  float cl = smoothstep(0.55, 0.85, n)*cover*smoothstep(0.03, 0.22, y)*(1.0 - smoothstep(0.5, 0.9, y));
  float sd = max(dot(rd, uSun), 0.0);
  vec3 cDay = mix(vec3(0.62, 0.66, 0.72), vec3(1.0, 0.95, 0.88), smoothstep(0.6, 0.85, n) + 0.3*sd);
  vec3 cNight = vec3(0.010, 0.013, 0.022) + vec3(0.10, 0.11, 0.14)*pow(max(dot(rd, uMoon), 0.0), 6.0)*0.8;
  c = mix(c, mix(cDay, cNight, uNight), cl*mix(0.7, 0.3, uNight));
  // stars: jittered grid on the sphere, hidden by cloud and the horizon glow
  if (uNight > 0.01){
    vec3 sp = rd*320.0; vec3 id = floor(sp); vec3 fr = fract(sp) - 0.5;
    float hs = hash13(id);
    vec3 off = vec3(hash13(id + 1.7), hash13(id + 3.1), hash13(id + 5.3)) - 0.5;
    float star = smoothstep(0.09, 0.0, length(fr - off*0.6))*step(0.99, hs); // city sky: fewer stars
    float tw = 0.7 + 0.3*sin(uTime*(1.5 + hs*3.0) + hs*40.0);
    float mag = pow(hash13(id + 9.0), 5.0)*4.0 + 0.35;
    vec3 sc = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.85, 0.7), hash13(id + 4.0));
    c += sc*star*mag*tw*uNight*smoothstep(0.03, 0.25, rd.y)*(1.0 - cl)*0.9;
    // moon: limb-darkened disc with faint maria, plus a halo
    float md = dot(rd, uMoon);
    float r = acos(clamp(md, -1.0, 1.0));
    float disc = smoothstep(0.0072, 0.0064, r);
    vec3 t1 = normalize(cross(uMoon, vec3(0, 1, 0))), t2 = cross(t1, uMoon);
    vec2 mp = vec2(dot(rd, t1), dot(rd, t2))/0.0068;
    float maria = fbm(mp*1.8 + 3.0, 4);
    float limb = sqrt(max(0.0, 1.0 - dot(mp, mp)));
    vec3 moonC = vec3(1.0, 0.97, 0.90)*(0.72 + 0.28*limb)*(0.82 + 0.25*smoothstep(0.55, 0.4, maria))*2.2;
    c = mix(c, moonC, disc*uNight*(1.0 - cl*0.6));
    c += vec3(0.5, 0.58, 0.75)*(0.05*exp(-r*30.0) + 0.04*exp(-r*160.0))*uNight;
  }
  // grade: fuller colour by day, a touch less at night; gentle S-curve
  { float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = max(mix(vec3(l), c, mix(1.15, 1.12, uNight)), 0.0); }
  c = aces(c*mix(0.78, 1.45, uNight));
  c = pow(c, vec3(1.0/2.2));
  c = mix(c, c*c*(3.0 - 2.0*c), mix(0.12, 0.18, uNight));
  c += (hash12(gl_FragCoord.xy) - 0.5)*0.012;   // static dither: no frame-to-frame shimmer
  gl_FragColor = vec4(c, 1.0);
}`;

const TERRAIN_VERT = /* glsl */ `
${COMMON}
${HFETCH}
varying vec3 vPos; varying vec2 vUv;
void main(){
  vec3 p = position; p.y = H(p.xz);
  vPos = p; vUv = (p.xz - uDom.xy)/uDom.zw;
  gl_Position = projectionMatrix*viewMatrix*vec4(p, 1.0);
}`;

// shared: atmosphere, sun shadows, tonemap
const ATMOS = /* glsl */ `
uniform sampler2D uCity; uniform vec4 uCityDom;
vec4 cityAt(vec2 p, float bias){
  vec2 cuv = (p - uCityDom.xy)/uCityDom.zw;
  return (cuv.x > 0.0 && cuv.y > 0.0 && cuv.x < 1.0 && cuv.y < 1.0) ? texture2D(uCity, cuv, bias) : vec4(0.0);
}
vec3 atmos(vec3 col, vec3 P){
  vec3 ro = cameraPosition; vec3 rv = P - ro; float dist = length(rv); vec3 rd = rv/dist;
  float night = uNight, h = P.y;
  float dens = mix(0.025, 0.020, night), fall = 0.55;
  float kf = rd.y/fall;
  float fogA = dens*exp(-ro.y/fall)*(abs(kf) > 1e-4 ? (1.0 - exp(-dist*kf))/kf : dist);
  fogA += mix(0.0034, 0.002, night)*dist;
  float T = exp(-fogA);
  vec3 fogC = skyCol(normalize(vec3(rd.x, max(rd.y, 0.0)*0.4 + 0.02, rd.z)));
  float azs = max(dot(normalize(rd.xz + 1e-4), normalize(uSun.xz)), 0.0);
  fogC += mix(vec3(1.0, 0.78, 0.55)*(0.25*pow(max(dot(rd, uSun), 0.0), 4.0) + 0.10*pow(azs, 2.0)), vec3(0.0), night);
  // low urban haze: milky by day, lit from below by the streets at night
  float inv = exp(-max(h, 0.0)*mix(5.5, 7.0, night))*smoothstep(1.5, 12.0, dist)*mix(0.46, 0.32, night);   // morning mist lies in the valley
  fogC = mix(fogC, mix(vec3(0.70, 0.71, 0.72), vec3(0.07, 0.05, 0.035), night), inv*0.5);
  float glow = cityAt(P.xz, 5.0).r;
  fogC += vec3(1.0, 0.50, 0.20)*0.12*glow*night*exp(-max(h, 0.0)*2.2);
  return mix(fogC, col, T*(1.0 - inv*0.35));
}
`;
const SHADOW = /* glsl */ `
uniform sampler2D uShadow; uniform mat4 uShadowMat; uniform float uShadowRes;
float sunShadow(vec3 P){
  vec3 q = (uShadowMat*vec4(P, 1.0)).xyz*0.5 + 0.5;
  vec2 e = min(q.xy, 1.0 - q.xy);
  if (e.x <= 0.0 || e.y <= 0.0 || q.z >= 1.0) return 1.0;
  const vec2 pd[16] = vec2[16](vec2(-0.94, -0.40), vec2(0.95, -0.77), vec2(-0.09, -0.93), vec2(0.34, 0.29), vec2(-0.92, 0.46), vec2(-0.24, 0.48),
    vec2(0.53, -0.29), vec2(0.16, -0.56), vec2(-0.81, -0.88), vec2(0.70, 0.66), vec2(-0.56, -0.12), vec2(0.14, 0.95), vec2(0.97, 0.18), vec2(-0.43, 0.88), vec2(0.45, -0.98), vec2(-0.25, -0.12));
  float a = hash12(gl_FragCoord.xy)*6.2832; mat2 rot = mat2(cos(a), sin(a), -sin(a), cos(a));
  float s = 0.0;
  for (int i = 0; i < 16; i++) s += q.z - 0.00025 <= texture2D(uShadow, q.xy + rot*pd[i]*3.0/uShadowRes).r ? 1.0 : 0.0;
  s /= 16.0;
  return mix(1.0, 0.12 + 0.88*s, smoothstep(0.0, 0.04, min(e.x, e.y)));   // a little skylight reaches into every shadow
}
`;
const FINISH = /* glsl */ `
vec3 aces(vec3 x){ return clamp((x*(2.51*x + 0.03))/(x*(2.43*x + 0.59) + 0.14), 0.0, 1.0); }
vec4 finish(vec3 c){
  // grade: fuller colour by day, a touch less at night; gentle S-curve
  { float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); c = max(mix(vec3(l), c, mix(1.15, 1.12, uNight)), 0.0); }
  c = aces(c*mix(0.78, 1.45, uNight));
  c = pow(c, vec3(1.0/2.2));
  c = mix(c, c*c*(3.0 - 2.0*c), mix(0.12, 0.18, uNight));
  c += (hash12(gl_FragCoord.xy) - 0.5)*0.012;   // static dither: no frame-to-frame shimmer
  return vec4(c, 1.0);
}
`;

const TERRAIN_FRAG = /* glsl */ `
${COMMON}
${SKY}
${ATMOS}
${SHADOW}
${FINISH}
varying vec3 vPos; varying vec2 vUv;
uniform sampler2D uN, uB; uniform float uGenR; uniform vec3 uCam0;
#define FWY_J 62.0
#define FWY_HW 0.032
void main(){
  vec4 nt = texture2D(uN, vUv);
  vec4 bk = texture2D(uB, vUv);
  vec3 N = normalize(nt.xyz*2.0 - 1.0);
  float gully = nt.w, ridge = bk.a;
  vec3 P = vPos; vec2 p = P.xz;
  vec3 rv = P - cameraPosition; float dist = length(rv); vec3 rd = rv/dist;
  float h = P.y;
  float near = 1.0 - smoothstep(1.2, 4.5, dist);
  if (near > 0.0){
    vec3 d1 = noised(p*38.0), d2 = noised(p*110.0);
    N = normalize(N + near*vec3(-(d1.y*0.22 + d2.y*0.08), 0.0, -(d1.z*0.22 + d2.z*0.08)));
  }
  float slope = 1.0 - N.y;

  // ---- mountain materials (linear albedo) ----------------------------
  float n1 = fbm(p*1.3, 4), n2 = fbm(p*6.0 + 3.0, 3);
  float n3 = mix(0.5, vnoise(p*40.0), 1.0 - smoothstep(3.0, 10.0, dist));
  float bands = fbm(vec2(h*11.0 + p.x*0.18 + n1*1.6, 0.5), 3);
  vec3 rock = mix(vec3(0.13, 0.12, 0.11), vec3(0.32, 0.30, 0.28), smoothstep(0.3, 0.7, bands))*(0.8 + 0.35*n2);
  vec3 grass = mix(vec3(0.115, 0.105, 0.08), vec3(0.19, 0.165, 0.12), n2);
  vec3 oak = mix(vec3(0.10, 0.050, 0.030), vec3(0.17, 0.085, 0.040), n3);
  vec3 aspen = vec3(0.33, 0.24, 0.06);
  vec3 fir = vec3(0.020, 0.030, 0.024)*(0.75 + 0.5*n3);
  vec3 snow = vec3(0.70, 0.72, 0.76);
  float steep = smoothstep(0.42, 0.66, slope);
  float mtn = smoothstep(0.12, 0.5, h - 0.42*smoothstep(1.0, 8.0, P.z));
  float chan = clamp((0.5 - gully)*2.5, -1.0, 1.0), conc = clamp((0.5 - ridge)*3.0, -1.0, 1.0);
  float wet = 0.55*chan + 0.45*conc + 0.25*(-N.x) + 0.25*(n2 - 0.5);
  float treeLine = 1.9 + 0.2*(n1 - 0.5);
  float forest = smoothstep(-0.25, 0.1, wet + 0.35*(n3 - 0.5) + 0.2*(n1 - 0.5))*smoothstep(treeLine, treeLine - 0.25, h)*smoothstep(0.5, 0.85, h);
  float oakZ = smoothstep(-0.35, 0.05, wet + 0.5*(n3 - 0.5))*smoothstep(1.3, 0.9, h)*smoothstep(0.1, 0.3, h);
  float aspenZ = smoothstep(0.62, 0.7, fbm(p*4.0 + 9.0, 3))*smoothstep(0.0, 0.2, wet)*smoothstep(1.0, 1.25, h)*smoothstep(1.85, 1.55, h);
  vec3 alb = grass;
  alb = mix(alb, oak, oakZ*0.75);
  alb = mix(alb, fir, forest*0.95);
  alb = mix(alb, aspen, aspenZ*0.7);
  alb = mix(alb, rock, max(steep, smoothstep(1.95, 2.35, h)*0.8));

  // ---- valley floor: streets, lots, parks -----------------------------
  vec4 city = cityAt(p, 0.0);              // r: built-up, g: inside the city limits, b: variation
  float flat0 = (1.0 - mtn)*(1.0 - smoothstep(0.03, 0.12, slope));
  float px = dist*0.0011;                  // ~ one pixel, for AA
  float far = smoothstep(2.5, 6.5, dist);
  // parks inside the city: lawn and tree canopy
  float tree = smoothstep(0.35, 0.6, mix(vnoise(p*90.0), 0.5, far)*0.6 + vnoise(p*14.0)*0.6);
  vec3 leaf = mix(mix(vec3(0.035, 0.07, 0.02), vec3(0.30, 0.13, 0.03), smoothstep(0.35, 0.65, vnoise(p*55.0 + 3.0))), vec3(0.38, 0.27, 0.04), smoothstep(0.6, 0.85, vnoise(p*70.0 + 9.0)));
  leaf = mix(leaf, vec3(0.10, 0.08, 0.03), far*0.5);                 // October: green, rust and gold
  vec3 park = mix(vec3(0.06, 0.10, 0.03), leaf, tree);
  alb = mix(alb, park, city.g*(1.0 - city.r)*flat0);
  // streets on the 160 m grid; every fifth street is a wide arterial
  vec2 cq = (p - uCityDom.xy)/0.16;
  vec2 li = floor(cq + 0.5);
  vec2 off = abs(cq - li)*0.16;
  vec2 art = vec2(mod(li.x, 5.0) < 0.5 ? 1.0 : 0.0, mod(li.y, 5.0) < 0.5 ? 1.0 : 0.0);
  vec2 hw = mix(vec2(0.010), vec2(0.016), art);
  bool fwy = abs(li.y - FWY_J) < 0.5;
  if (fwy) hw.y = FWY_HW;
  vec2 rdx = 1.0 - smoothstep(hw, hw + px, off);
  vec2 swk = 1.0 - smoothstep(hw + 0.004, hw + 0.004 + px, off);
  float road = max(rdx.x, rdx.y);
  float walk = clamp(max(swk.x, swk.y) - road, 0.0, 1.0);
  // centre line on arterials
  vec2 cl = (1.0 - smoothstep(0.00025, 0.00025 + px, off))*art*step(0.5, fract(vec2(p.y, p.x)/0.008));
  float fm = 0.0, fl = 0.0;
  if (fwy){
    // concrete median and dashed lane lines
    cl.y = 0.0;
    fm = 1.0 - smoothstep(0.0015, 0.0015 + px, off.y);
    fl = (1.0 - smoothstep(0.0002, 0.0002 + px, abs(mod(off.y + 0.0035, 0.007) - 0.0035)))*step(0.004, off.y)*step(off.y, 0.024)*step(0.6, fract(p.x/0.012));
    rdx.y = max(rdx.y, 1.0 - smoothstep(FWY_HW, FWY_HW + px, off.y));
  }
  float lotH = hash12(floor(cq) + 3.0);
  vec3 lot = lotH < 0.3 ? vec3(0.085, 0.085, 0.082) : lotH < 0.45 ? vec3(0.05, 0.07, 0.035) : vec3(0.15, 0.145, 0.135);
  // low-density blocks are mostly yards under tree canopy
  float leafy = 1.0 - smoothstep(0.45, 0.8, city.r);
  float canopy = smoothstep(0.42, 0.62, mix(vnoise(p*160.0), 0.5, far)*0.7 + vnoise(p*20.0)*0.5);
  lot = mix(lot, mix(vec3(0.06, 0.09, 0.035), leaf*0.8, canopy), leafy*0.85);
  vec3 g = mix(lot, vec3(0.040, 0.040, 0.043), road);
  g = mix(g, vec3(0.19, 0.185, 0.175), walk);
  // street trees along the sidewalks, every ~12 m
  vec2 ta = abs(fract(vec2(p.y, p.x)/0.012) - 0.5)*0.012;          // along the road to the nearest tree
  vec2 tc = abs(off - hw - 0.0035);                                 // across, from the planting strip
  vec2 tdst = sqrt(ta*ta + tc*tc);
  vec2 tr = 1.0 - smoothstep(0.0028, 0.0028 + px, tdst);
  g = mix(g, leaf, max(tr.x, tr.y)*(1.0 - far)*0.9);
  g = mix(g, vec3(0.32, 0.27, 0.12), max(cl.x, cl.y)*0.6*(1.0 - far));
  g = mix(g, vec3(0.20, 0.195, 0.19), fm*(1.0 - far));
  g = mix(g, vec3(0.34, 0.34, 0.33), fl*0.7*(1.0 - far));
  g = mix(g, vec3(0.075, 0.075, 0.072), far);   // streets and lots average out at distance
  // beyond the modelled blocks the town is canopy and rooftops
  vec3 town = mix(vec3(0.05, 0.06, 0.045), vec3(0.17, 0.165, 0.155), smoothstep(0.35, 0.8, city.b));
  g = mix(g, town, smoothstep(uGenR - 1.5, uGenR, length(p - uCam0.xz)));
  float urb = city.r*flat0;
  alb = mix(alb, g, urb);
  // farmland outside the city
  vec2 fq = p + vec2(0.13, 0.07) + 0.04*vec2(vnoise(p*3.0), vnoise(p*3.0 + 7.0));
  vec2 fsz = vec2(0.40, 0.20)*(hash12(floor(fq/0.8)) > 0.5 ? vec2(1.0) : vec2(0.5, 2.0));
  float fh = hash12(floor(fq/fsz));
  vec3 field = fh < 0.35 ? vec3(0.20, 0.18, 0.12) : fh < 0.6 ? vec3(0.16, 0.14, 0.10) : fh < 0.85 ? vec3(0.14, 0.15, 0.09) : vec3(0.18, 0.17, 0.12);
  alb = mix(alb, field*(0.85 + 0.3*n2), flat0*(1.0 - city.g)*0.75);

  // snow
  float snowLine = 1.78 + 0.35*(n1 - 0.5) - 0.22*clamp(wet, 0.0, 1.0) - 0.12*clamp(-N.x, 0.0, 1.0) + 0.12*steep;
  float sn = smoothstep(snowLine, snowLine + 0.14, h)*(1.0 - smoothstep(0.48, 0.7, slope));
  sn = max(sn, smoothstep(2.2, 2.45, h)*(1.0 - smoothstep(0.62, 0.85, slope))*0.9);
  sn *= smoothstep(0.3, 0.6, n2 + 0.3 + 0.3*clamp(wet, 0.0, 1.0));
  sn *= 1.0 - smoothstep(0.55, 0.85, n3)*smoothstep(snowLine + 0.3, snowLine, h)*0.8;
  // snow fills the gullies and couloirs on steep faces, and blows off the ridges
  float coul = clamp((0.5 - gully)*5.0, 0.0, 1.0)*smoothstep(snowLine - 0.4, snowLine - 0.05, h)*smoothstep(0.3, 0.55, slope);
  sn = max(sn, coul*0.9);
  sn *= 1.0 - 0.65*smoothstep(0.55, 0.75, ridge)*steep;
  alb = mix(alb, snow, sn);
  alb *= 0.9 + 0.2*(ridge - 0.5)*2.0*(1.0 - sn)*(1.0 - urb);

  // ---- lighting ------------------------------------------------------
  float night = uNight, nmix = smoothstep(0.35, 0.65, night);
  vec3 L = normalize(mix(uSun, uMoon, nmix));
  float sh = mix(bk.r*sunShadow(P + N*0.004 + vec3(0.0, 0.0015, 0.0)), bk.g, nmix);
  float cs = smoothstep(0.42, 0.7, fbm(p*0.22 + vec2(-uTime*0.012, uTime*0.004), 4));
  sh *= 1.0 - cs*0.6*(1.0 - night);
  float ndl = max(dot(N, L), 0.0), wrap = max((dot(N, L) + 0.25)/1.25, 0.0);
  vec3 sunC = mix(vec3(1.0, 0.78, 0.58)*2.45, vec3(0.55, 0.66, 0.95)*0.30, night);
  vec3 skyA = mix(vec3(0.38, 0.49, 0.72)*0.66, vec3(0.05, 0.075, 0.13)*0.75, night);
  float ao = bk.b*bk.b;
  vec3 col = alb*sunC*mix(ndl, wrap, sn*0.6)*sh;
  col += alb*skyA*(0.55 + 0.45*N.y)*ao;
  col += alb*vec3(0.30, 0.24, 0.17)*0.12*(1.0 - N.y)*(1.0 - night)*ao;
  vec3 Hh = normalize(L - rd);
  col += sunC*sn*0.12*pow(max(dot(N, Hh), 0.0), 60.0)*sh;
  float dusk = 4.0*night*(1.0 - night); dusk *= dusk;
  col += alb*vec3(1.0, 0.50, 0.40)*0.45*dusk*smoothstep(1.5, 2.4, h)*(0.4 + 0.6*clamp(dot(N, normalize(vec3(0.6, 0.25, 0.75))), 0.0, 1.0));
  // night: pools of light under the street lamps, a general glow off the lots
  if (night > 0.01){
    vec2 la = abs(fract(vec2(p.y, p.x)/0.042) - 0.5)*0.042;          // distance along each road to its nearest lamp
    vec2 pool = rdx*exp(-(la*la)/(0.009*0.009))*(1.0 - far);
    float lit = max(pool.x, pool.y);
    col += vec3(1.0, 0.68, 0.40)*(0.65*lit + 0.025*(0.5 + road))*night*urb;
    col += vec3(1.0, 0.55, 0.25)*0.012*urb*night*far;
  }
  gl_FragColor = finish(atmos(col, P));
}`;

// ---- buildings ---------------------------------------------------------------
// one unit box, instanced: iPos (x, base above ground, z), iSize (w, h, d),
// iStyle (style, seed, occupancy, crown). Styles: 0 glass curtain wall,
// 1 concrete with punched windows, 2 ribbon-window office, 3 brick, 4 house, 5 rooftop plant
const BUILD_VERT = /* glsl */ `
${COMMON}
${HFETCH}
attribute vec3 iPos, iSize; attribute vec4 iStyle;
varying vec3 vP, vN; varying vec4 vS; varying float vG, vTop; varying vec4 vBox;
void main(){
  float g = H(iPos.xz) - 0.002;
  vec3 p = vec3(iPos.x, g + iPos.y, iPos.z) + position*iSize;
  vP = p; vN = normalize(normal/iSize); vS = iStyle; vG = g; vTop = (iPos.y + iSize.y + 0.002)*1000.0;   // inverse-scale normals
  vBox = vec4(iPos.x, iPos.z, iSize.x, iSize.z);
  gl_Position = projectionMatrix*viewMatrix*vec4(p, 1.0);
}`;
const DEPTH_VERT = /* glsl */ `
${COMMON}
${HFETCH}
attribute vec3 iPos, iSize;
void main(){
  float g = H(iPos.xz) - 0.002;
  gl_Position = projectionMatrix*viewMatrix*vec4(vec3(iPos.x, g + iPos.y, iPos.z) + position*iSize, 1.0);
}`;
const DEPTH_FRAG = /* glsl */ `void main(){ gl_FragColor = vec4(1.0); }`;

const BUILD_FRAG = /* glsl */ `
${COMMON}
${SKY}
${ATMOS}
${SHADOW}
${FINISH}
uniform sampler2D uB;
uniform highp sampler2DArray uFacE, uFacD; uniform float uFacSize;
varying vec3 vP, vN; varying vec4 vS; varying float vG, vTop; varying vec4 vBox;
// ---- architectural relief, in metres: q = (metres along the face from its centre, metres above the street)
// returns depth (+ out of the wall). Features are metres wide, so they still read when the windows don't.
float sstep(float a, float b, float x){ return smoothstep(a, b, x); }
float pulse(float x, float c, float w, float e){ return sstep(c - w - e, c - w + e, x) - sstep(c + w - e, c + w + e, x); }
float relief(vec2 q, float style, float faceW, float top, float fh, float bw, float h1, float h2, float e){
  float eu = faceW*0.5 - abs(q.x);                    // metres to the nearest corner
  float dTop = top - q.y;
  float r = 0.0;
  if (style < 0.5){                                   // curtain wall: fins every few bays, recessed plant floors
    float sp = bw*(3.0 + floor(h1*4.0));
    float fu = mod(q.x + faceW*0.5, sp);
    r += 0.45*pulse(fu, 0.0, 0.22, e) + 0.45*pulse(fu, sp, 0.22, e);
    float fl = (q.y - 5.0)/fh, every = 10.0 + floor(h2*10.0);
    r -= 0.35*pulse(mod(fl, every), every - 0.5, 0.5, e/fh);
    if (h1 > 0.45) r += 0.25*sstep(1.3 + e, 1.3 - e, eu);          // solid corners
    r += 0.35*sstep(2.2 + e, 2.2 - e, dTop);                        // parapet
  } else if (style < 1.5){                            // concrete: columns every two bays, cornice, heavy base
    float sp = bw*2.0, fu = mod(q.x + faceW*0.5, sp);
    r += 0.35*(pulse(fu, 0.0, 0.45, e) + pulse(fu, sp, 0.45, e));
    r += 0.35*sstep(1.8 + e, 1.8 - e, eu);
    r += 0.10*pulse(fract((q.y - 5.0)/fh), 0.03, 0.06, e/fh);    // slab edge
    r += 0.60*pulse(dTop, 1.4, 0.6, e) + 0.25*sstep(0.6 + e, 0.6 - e, dTop);
    r += 0.15*sstep(8.5 + e, 8.5 - e, q.y);
  } else if (style < 2.5){                            // ribbon windows: projecting spandrel bands
    float fv = fract((q.y - 5.0)/fh);
    r += 0.30*(1.0 - pulse(fv, 0.56, 0.24, e/fh));
    r += 0.30*sstep(2.0 + e, 2.0 - e, eu);
    r += 0.40*sstep(1.5 + e, 1.5 - e, dTop);
  } else if (style < 3.5){                            // brick: pilasters, cornice, string course
    float sp = bw*3.0, fu = mod(q.x + faceW*0.5, sp);
    r += 0.15*(pulse(fu, 0.0, 0.3, e) + pulse(fu, sp, 0.3, e));
    r += 0.50*pulse(dTop, 0.9, 0.5, e) + 0.12*pulse(q.y, 5.2, 0.25, e);
  } else if (style < 4.5){
    r += 0.25*pulse(dTop, 0.25, 0.25, e);             // eaves
  }
  return r;
}
float band(float x, float a, float b, float w){ return smoothstep(a - w, a + w, x) - smoothstep(b - w, b + w, x); }
float aaL(float pxm){ return smoothstep(0.15, 0.4, pxm); }   // louvres and fine stripes below a pixel
void main(){
  vec3 N = normalize(vN), P = vP;
  vec3 rv = P - cameraPosition; float dist = length(rv); vec3 rd = rv/dist;
  float sRaw = vS.x, seed = vS.y;
  bool trim = sRaw > 9.5;                                // cornices, balconies: parent's material, no windows
  float style = trim ? sRaw - 10.0 : sRaw;
  float crown = mod(vS.w, 2.0);                          // w: 1 lit crown, +2 chamfered plan
  bool chamf = vS.w > 1.5;
  float night = uNight, nmix = smoothstep(0.35, 0.65, night);
  float hA = (P.y - vG)*1000.0;                       // metres above the street
  bool roof = N.y > 0.5;
  bool plant = style > 4.5 && style < 5.5;
  bool diag = !roof && abs(N.x) > 0.25 && abs(N.z) > 0.25;   // angled faces: chamfers, crowns
  vec2 Td = normalize(vec2(-N.z, N.x) + 1e-5);
  float u = diag ? dot(P.xz, Td)*1000.0 : (abs(N.x) > 0.5 ? P.z : P.x)*1000.0;      // metres along the facade
  vec3 T = diag ? vec3(Td.x, 0.0, Td.y) : (abs(N.x) > 0.5 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0));
  float face = diag ? 4.0 + step(0.0, N.x) + 2.0*step(0.0, N.z) : (abs(N.x) > 0.5 ? (N.x > 0.0 ? 0.0 : 1.0) : (N.z > 0.0 ? 2.0 : 3.0));
  float h1 = hash12(vec2(seed, 1.7)), h2 = hash12(vec2(seed, 5.3)), h3 = hash12(vec2(seed, 9.1));

  // ---- facade texture: floor height and bay width per type -------------
  float fh = style < 0.5 ? 3.8 : style < 1.5 ? 3.4 : style < 2.5 ? 3.9 : style < 3.5 ? 3.1 : 2.9;
  float bw = style < 0.5 ? 1.6 : style < 1.5 ? 2.6 : style < 2.5 ? 1.8 : style < 3.5 ? 2.4 : 3.6;
  bool shop = style < 3.5 && hA < 5.0 && !roof && !trim;       // street-level storefronts
  vec2 base = vec2(u/bw, (hA - (style < 3.5 ? 5.0 : 0.0))/fh);
  vec2 off = floor((hash22(vec2(seed*17.0 + face, face*3.1 + seed))*0.5 + 0.5)*32.0);  // each face its own patch
  vec2 cu = (base + off)/32.0;
  vec2 dx = dFdx(cu), dy = dFdy(cu);
  // every 32 floors slide the pattern sideways so tall towers never repeat visibly
  vec2 uv = cu + vec2(floor(hash12(vec2(floor(cu.y), seed + face))*32.0)/32.0, 0.0);
  float layer = min(style, 4.0);
  vec4 FE = textureGrad(uFacE, vec3(uv, layer), dx, dy);
  vec4 FD = textureGrad(uFacD, vec3(uv, layer), dx, dy);
  bool flatW = roof || plant || shop || style > 5.5 || trim;
  float glassM = flatW ? 0.0 : FD.g;
  float frameM = flatW ? 0.0 : FD.b;
  float wallMul = flatW ? 1.0 : clamp(FD.r*2.0, 0.4, 1.6);
  float blinds = FE.a, reveal = FD.a;

  // ---- macro relief: bumped normal, self-shadowing, material masks ----
  bool sideX = abs(N.x) > 0.5;
  float faceW = diag ? 1e4 : (sideX ? vBox.w : vBox.z)*1000.0*(chamf ? 0.6 : 1.0);
  float along = diag ? dot(P.xz - vBox.xy, Td)*1000.0 : ((sideX ? P.z - vBox.y : P.x - vBox.x))*1000.0;
  vec2 q = vec2(along, hA);
  float pxm = max(length(fwidth(P))*1000.0, 0.02);               // metres per pixel
  float e = max(0.12, pxm*0.6);                                   // bevel/prefilter width
  float rel = 0.0, relShadow = 1.0;
  vec3 Nb = N;
  if (!roof && !trim && style < 4.5){
    rel = relief(q, style, faceW, vTop, fh, bw, h1, h2, e);
    float ru = relief(q + vec2(e, 0.0), style, faceW, vTop, fh, bw, h1, h2, e) - relief(q - vec2(e, 0.0), style, faceW, vTop, fh, bw, h1, h2, e);
    float rv = relief(q + vec2(0.0, e), style, faceW, vTop, fh, bw, h1, h2, e) - relief(q - vec2(0.0, e), style, faceW, vTop, fh, bw, h1, h2, e);
    vec2 gr = clamp(vec2(ru, rv)/(2.0*e), -2.5, 2.5);
    Nb = normalize(N - T*gr.x - vec3(0.0, gr.y, 0.0));
    // features cast shadows on the wall: march a little toward the sun across the facade
    vec3 Ls = normalize(mix(uSun, uMoon, nmix));
    float ln = max(dot(Ls, N), 0.04);
    vec2 lt = vec2(dot(Ls, T), Ls.y);
    vec2 dir = lt/max(length(lt), 1e-3);
    float rise = ln/max(length(lt), 1e-3);                         // metres the ray climbs per metre travelled
    for (int k = 1; k <= 3; k++){
      float t = 0.35*float(k);
      float occ = relief(q + dir*t, style, faceW, vTop, fh, bw, h1, h2, e) - (rel + t*rise);
      relShadow = min(relShadow, 1.0 - 0.75*sstep(0.0, 0.25, occ));
    }
  }
  bool solid = rel > 0.08 || rel < -0.08;                         // fins, columns, bands, plant floors
  glassM *= solid ? 0.0 : 1.0;
  frameM *= solid ? 0.0 : 1.0;

  // wall albedo
  vec3 wall;
  if (style < 0.5) wall = h1 < 0.3 ? vec3(0.03, 0.04, 0.05) : h1 < 0.55 ? vec3(0.26, 0.25, 0.23) : h1 < 0.75 ? vec3(0.07, 0.05, 0.035) : vec3(0.40, 0.40, 0.38);
  else if (style < 1.5) wall = h1 < 0.16 ? vec3(0.44, 0.33, 0.20) : h1 < 0.3 ? vec3(0.50, 0.46, 0.36) : h1 < 0.44 ? vec3(0.34, 0.20, 0.13) : h1 < 0.58 ? vec3(0.55, 0.54, 0.50) : h1 < 0.72 ? vec3(0.17, 0.19, 0.21) : h1 < 0.86 ? vec3(0.36, 0.30, 0.22) : vec3(0.26, 0.30, 0.27);
  else if (style < 2.5) wall = h1 < 0.3 ? vec3(0.42, 0.38, 0.30) : h1 < 0.55 ? vec3(0.08, 0.08, 0.09) : h1 < 0.8 ? vec3(0.26, 0.17, 0.12) : vec3(0.50, 0.50, 0.47);
  else if (style < 3.5) wall = h1 < 0.45 ? mix(vec3(0.24, 0.10, 0.065), vec3(0.30, 0.14, 0.09), h2) : h1 < 0.75 ? vec3(0.22, 0.12, 0.08) : vec3(0.46, 0.36, 0.20);
  else if (style < 4.5) wall = (h1 < 0.3 ? vec3(0.52, 0.47, 0.36) : h1 < 0.5 ? vec3(0.34, 0.40, 0.33) : h1 < 0.65 ? vec3(0.36, 0.42, 0.48) : h1 < 0.8 ? vec3(0.42, 0.30, 0.22) : vec3(0.58, 0.57, 0.54))*0.78;
  else wall = vec3(0.17, 0.17, 0.165);
  if (roof) wall = style > 3.5 && style < 4.5 ? (h3 < 0.45 ? vec3(0.20, 0.08, 0.05) : h3 < 0.75 ? vec3(0.08, 0.075, 0.07) : vec3(0.15, 0.14, 0.12)) : h2 < 0.18 ? vec3(0.24, 0.24, 0.235)*mix(1.0, 0.35, night) : h2 < 0.26 ? vec3(0.05, 0.075, 0.035) : vec3(0.09, 0.09, 0.085)*(0.8 + 0.4*h3);
  if (shop) wall = vec3(0.12, 0.115, 0.11);
  if (trim) wall *= 1.1;                                // trim catches a little more light
  if (!roof && !trim && style < 4.5){
    if (rel > 0.08) wall *= style < 0.5 ? 1.0 : 1.12;
    if (rel > 0.08 && style < 0.5) wall = mix(vec3(0.30, 0.30, 0.29), vec3(0.08, 0.08, 0.085), step(0.5, h3));  // fins and parapet: metal
    if (rel < -0.08) wall = vec3(0.06, 0.062, 0.066)*(0.75 + 0.5*step(0.5, fract(q.x/0.5)))*(1.0 - aaL(pxm)) + vec3(0.075)*aaL(pxm);
    // rain streaks under sills and from the cornice down
    float streak = vnoise(vec2(q.x*0.9 + seed*50.0, q.y*0.025)) * vnoise(vec2(q.x*0.23, q.y*0.01 + seed*9.0));
    wall *= 1.0 - (style > 0.5 ? 0.22 : 0.08)*streak;
  }
  if (plant){
    float lou = mix(0.65 + 0.7*step(0.5, fract(q.x/0.45)), 1.0, aaL(pxm));
    wall = vec3(0.16, 0.16, 0.155)*lou;
  }
  if (style > 5.5) wall = h2 < 0.5 ? vec3(0.42, 0.43, 0.45) : vec3(0.10, 0.10, 0.11);   // spires and masts
  wall *= wallMul;
  vec3 frameC = style > 3.5 ? vec3(0.55, 0.54, 0.50) : (style > 0.5 && style < 1.5 && h2 > 0.5) ? vec3(0.42, 0.41, 0.39) : vec3(0.035, 0.037, 0.04);

  // ---- light ---------------------------------------------------------
  vec3 L = normalize(mix(uSun, uMoon, nmix));
  vec2 buv = (P.xz - uDom.xy)/uDom.zw;
  float sh = mix(sunShadow(P + N*0.003)*texture2D(uB, buv).r, 1.0, nmix);
  float cs = smoothstep(0.42, 0.7, fbm(P.xz*0.22 + vec2(-uTime*0.012, uTime*0.004), 4));
  sh *= 1.0 - cs*0.6*(1.0 - night);
  vec3 sunC = mix(vec3(1.0, 0.78, 0.58)*2.45, vec3(0.55, 0.66, 0.95)*0.22, night);
  vec3 skyA = mix(vec3(0.38, 0.49, 0.72)*0.66, vec3(0.05, 0.075, 0.13)*0.45, night);
  float ndl = max(dot(Nb, L), 0.0);
  float ao = roof ? 1.0 : mix(0.42, 1.0, smoothstep(0.0, 30.0, hA));   // canyon streets stay dim
  ao *= 1.0 - 0.35*clamp(-rel*3.0, 0.0, 1.0);                          // recesses hold shade
  float sunSide = 0.55 + 0.45*max(dot(normalize(Nb.xz + 1e-4), normalize(L.xz)), 0.0);
  vec3 lightW = sunC*ndl*sh*relShadow + skyA*(0.62 + 0.38*Nb.y)*ao
              + (vec3(0.62, 0.62, 0.60)*0.22*sunSide + vec3(0.34, 0.27, 0.20)*0.2)*(1.0 - abs(Nb.y))*(1.0 - night)*ao;
  // street lamps wash the lower floors, brighter under each lamp (~42 m apart)
  float lampW = 0.6 + 0.4*smoothstep(0.55, 1.0, cos(u/42.0*6.2832 + seed*20.0));
  lightW += vec3(1.0, 0.62, 0.32)*0.22*night*exp(-hA/14.0)*lampW + vec3(1.0, 0.6, 0.3)*0.02*night;
  vec3 col = wall*lightW;

  // ---- glass ---------------------------------------------------------
  // panels sit a fraction off true so reflections ripple like real curtain walls (faded out once sub-pixel)
  float jf = 1.0 - smoothstep(0.15, 0.5, max(length(fwidth(base)), 0.0));
  vec2 jit = hash22(floor(base) + seed*7.0)*0.02*jf;
  vec3 Ng = normalize(N + T*jit.x + vec3(0.0, jit.y, 0.0));
  vec3 R = reflect(rd, Ng);
  vec3 env = R.y > 0.0 ? skyCol(R) : mix(vec3(0.05)*(1.0 - night) + vec3(0.09, 0.05, 0.02)*night, skyCol(vec3(R.x, 0.02, R.z)), exp(R.y*12.0)); // glass mirrors the lit city below
  float F0 = style < 0.5 ? 0.12 + 0.22*h2 : 0.045;
  float fres = F0 + (1.0 - F0)*pow(1.0 - max(dot(-rd, Ng), 0.0), 5.0);
  // by day: a dark room, or blinds and curtains catching skylight behind the glass
  vec3 room = mix(vec3(0.010, 0.011, 0.013), vec3(0.50, 0.48, 0.44)*(skyA*0.7 + sunC*ndl*sh*0.1), blinds);
  room *= 1.0 - 0.5*reveal*(1.0 - night);
  vec3 tint = style < 0.5 ? (h3 < 0.35 ? vec3(0.02, 0.05, 0.10) : h3 < 0.6 ? vec3(0.02, 0.075, 0.07) : h3 < 0.8 ? vec3(0.09, 0.055, 0.025) : vec3(0.05, 0.055, 0.06)) : vec3(0.02, 0.022, 0.025);
  vec3 coat = style < 0.5 ? mix(vec3(1.0), normalize(tint + 1e-3)*1.7, 0.45) : vec3(1.0);   // coated glass tints what it reflects
  float patchw = mix(0.86 + 0.28*hash12(floor(vec2(base.x/2.0, base.y/3.0)) + seed*3.3), 1.0, smoothstep(0.5, 1.5, pxm/(bw*2.0)));
  vec3 glass = room*(1.0 - fres) + tint*skyA*0.6 + env*coat*fres*patchw*mix(1.0, 0.85 + 0.3*hash12(floor(base) + seed), jf);
  glass += sunC*(pow(max(dot(R, L), 0.0), 90.0)*0.45 + pow(max(dot(R, L), 0.0), 900.0)*0.6)*sh*(1.0 - night);
  // by night: the painted interiors, switching on in patches through dusk; some buildings mostly dark
  float t0 = 0.38 + 0.35*hash12(vec2(seed + face, floor(base.y/8.0)) + floor(base.x/12.0)*0.37);
  float on = smoothstep(t0, t0 + 0.12, night);
  float bScale = 0.35 + 1.15*pow(h3, 1.3);
  vec3 emis = pow(FE.rgb, vec3(2.2))*2.3*bScale*on;
  glass += emis*(1.0 - fres*0.6);
  // light from lit rooms spills onto the surrounding wall: a blurred read of the same interiors
  float lod0 = log2(max(max(length(dx), length(dy))*uFacSize, 1e-4));
  vec3 spill = pow(textureLod(uFacE, vec3(uv, layer), max(lod0, log2(uFacSize/32.0*1.6))).rgb, vec3(2.2))*2.3*bScale*on;
  col += wall*spill*0.45*(1.0 - glassM);
  col = mix(col, glass, glassM);
  col = mix(col, frameC*lightW, frameM);

  // storefronts: individual shops, some shut, in a mix of warm and white light
  if (shop){
    vec2 g = vec2(u/(6.0 + 4.0*h1), hA/5.0);
    vec2 cell = floor(g), f = fract(g);
    vec2 ew = fwidth(g)*0.8 + 0.01;
    float aa = smoothstep(0.3, 0.8, max(ew.x, ew.y));
    float win = mix(band(f.x, 0.08, 0.92, ew.x)*band(f.y, 0.06, 0.70, ew.y), 0.54, aa);
    float k = hash12(cell + seed*3.3);
    float open = step(0.5, k);
    vec3 lc = k < 0.6 ? vec3(1.0, 0.78, 0.5) : k < 0.85 ? vec3(1.0, 0.9, 0.78) : vec3(0.85, 0.92, 1.0);
    vec3 shopLit = lc*mix(open*(0.18 + 0.3*hash12(cell + 7.0)), 0.12, aa)*smoothstep(0.4, 0.6, night);
    vec3 sg = room*0.6*(1.0 - fres) + env*fres + shopLit;
    col = mix(col, sg, win);
    // signs: a third of shops carry a lit sign above the window
    float ks = hash12(cell + seed*5.1);
    vec3 neon = ks < 0.2 ? vec3(1.0, 0.12, 0.08) : ks < 0.4 ? vec3(0.1, 0.85, 0.75) : ks < 0.55 ? vec3(1.0, 0.25, 0.65) : ks < 0.7 ? vec3(1.0, 0.62, 0.12) : ks < 0.85 ? vec3(0.3, 0.5, 1.0) : vec3(0.95, 0.95, 1.0);
    float sign = band(f.x, 0.2, 0.8, ew.x)*band(f.y, 0.76, 0.9, ew.y)*step(0.66, hash12(cell + seed*9.3));
    sign = mix(sign, 0.06, aa);
    col += neon*1.6*sign*smoothstep(0.45, 0.65, night);
    col += neon*0.25*sign*(1.0 - night);
  }

  // lit crowns on a few tall towers
  if (crown > 0.5 && !roof && !trim){
    float cb = smoothstep(vTop - 10.0, vTop - 8.0, hA)*step(hA, vTop - 1.0)*smoothstep(0.35, 0.6, abs(fract(u/2.4) - 0.5)*2.0); // light between vertical fins
    vec3 cc = h2 < 0.45 ? vec3(1.0, 0.86, 0.66) : h2 < 0.85 ? vec3(1.0, 0.68, 0.38) : vec3(0.75, 0.85, 1.0);
    col += cc*0.8*cb*smoothstep(0.5, 0.7, night);
  }
  gl_FragColor = finish(atmos(col, P));
}`;

// ---- traffic -----------------------------------------------------------------
// cMove: axis (0 along x, 1 along z), signed speed (km/s), span start, span end
// cInfo: lane coordinate, start position, colour seed
const CAR_VERT = /* glsl */ `
${COMMON}
${HFETCH}
uniform float uTime;
attribute vec4 cMove; attribute vec3 cInfo;
varying vec3 vP, vN; varying float vFwd, vSeed;
void main(){
  float span = cMove.w - cMove.z;
  float s = cMove.z + mod(cInfo.y - cMove.z + uTime*cMove.y, span);
  vec2 xz = cMove.x < 0.5 ? vec2(s, cInfo.x) : vec2(cInfo.x, s);
  vec3 sz = cMove.x < 0.5 ? vec3(0.0046, 0.0015, 0.0019) : vec3(0.0019, 0.0015, 0.0046);
  vec3 p = vec3(xz.x, H(xz), xz.y) + position*sz;
  vFwd = (cMove.x < 0.5 ? position.x : position.z)*sign(cMove.y);
  vP = p; vN = normal; vSeed = cInfo.z;
  gl_Position = projectionMatrix*viewMatrix*vec4(p, 1.0);
}`;
const CAR_FRAG = /* glsl */ `
${COMMON}
${SKY}
${ATMOS}
${SHADOW}
${FINISH}
varying vec3 vP, vN; varying float vFwd, vSeed;
void main(){
  vec3 N = normalize(vN);
  float k = vSeed;
  vec3 paint = k < 0.22 ? vec3(0.62, 0.62, 0.60) : k < 0.38 ? vec3(0.025) : k < 0.52 ? vec3(0.32, 0.33, 0.34) : k < 0.62 ? vec3(0.12) : k < 0.74 ? vec3(0.40, 0.03, 0.02) : k < 0.84 ? vec3(0.03, 0.10, 0.32) : k < 0.9 ? vec3(0.55, 0.38, 0.02) : k < 0.95 ? vec3(0.05, 0.20, 0.10) : vec3(0.45, 0.45, 0.48);
  float night = uNight, nmix = smoothstep(0.35, 0.65, night);
  float sh = mix(sunShadow(vP + vec3(0.0, 0.003, 0.0)), 1.0, nmix);
  vec3 sunC = mix(vec3(1.0, 0.78, 0.58)*2.45, vec3(0.55, 0.66, 0.95)*0.2, night);
  vec3 skyA = mix(vec3(0.38, 0.49, 0.72)*0.66, vec3(0.05, 0.075, 0.13)*0.6, night);
  vec3 col = paint*(sunC*max(dot(N, uSun), 0.0)*sh + skyA*(0.6 + 0.4*N.y));
  float on = smoothstep(0.3, 0.5, night);
  col += vec3(1.0, 0.95, 0.85)*4.0*step(0.42, vFwd)*on + vec3(1.0, 0.06, 0.03)*2.0*step(vFwd, -0.42)*on;
  gl_FragColor = finish(atmos(col, vP));
}`;

// ---- point lights: lamps, car glow, aviation beacons, aircraft -------------------
// kind: 0 sodium lamp, 1 LED lamp, 3 headlights, 4 tail-lights, 5 aviation beacon,
// 6 aircraft strobe, 7 aircraft red; position.y is height above the ground
const LIGHTS_VERT = /* glsl */ `
${COMMON}
${HFETCH}
uniform float uNight, uTime, uPx;
attribute vec3 aInfo; attribute vec4 aMove;
varying vec3 vCol; varying float vA;
void main(){
  float kind = aInfo.y, seed = aInfo.x;
  vec3 p = position;
  float on = smoothstep(0.45 + seed*0.35, 0.5 + seed*0.35, uNight);
  if (kind > 2.5 && kind < 4.5){
    float span = aMove.w - aMove.z;
    float s = aMove.z + mod(position.z - aMove.z + uTime*aMove.y, span) + (kind < 3.5 ? 0.0024 : -0.0024)*sign(aMove.y);
    p = aMove.x < 0.5 ? vec3(s, 0.0008, position.x) : vec3(position.x, 0.0008, s);
    on = smoothstep(0.3, 0.5, uNight);
  }
  if (kind > 5.5){
    p = position + vec3(aMove.x, 0.0, aMove.y)*mod(uTime + seed*900.0, aMove.z);
    on = smoothstep(0.4, 0.6, uNight)*(kind < 6.5 ? step(0.93, fract(uTime*0.8 + seed)) : 1.0);
  } else {
    p.y += Hraw(p.xz).r;
    if (kind > 4.5 && kind < 5.5) on = smoothstep(0.4, 0.6, uNight)*(0.25 + 0.75*smoothstep(0.0, 0.15, sin(uTime*3.1 + seed*0.0)));
  }
  vec4 mv = viewMatrix*vec4(p, 1.0);
  float d = -mv.z;
  vec3 c = kind < 0.5 ? vec3(1.0, 0.55, 0.20) : kind < 1.5 ? vec3(0.92, 0.95, 1.0) : kind < 3.5 ? vec3(1.0, 0.95, 0.85) : kind < 4.5 ? vec3(1.0, 0.10, 0.04) : kind < 5.5 ? vec3(1.0, 0.08, 0.04) : kind < 6.5 ? vec3(1.0) : vec3(1.0, 0.1, 0.05);
  float T = exp(-0.026*d - 0.0034*d);
  vCol = c*aInfo.z*T*1.35;
  vA = on;
  gl_PointSize = uPx*clamp((1.8 + aInfo.z*2.2)/(0.5 + d*0.09), 1.6, 7.0);
  gl_Position = projectionMatrix*mv;
}`;
const LIGHTS_FRAG = /* glsl */ `
varying vec3 vCol; varying float vA;
void main(){
  vec2 q = gl_PointCoord - 0.5; float r = length(q)*2.0;
  float core = exp(-r*r*30.0), halo = exp(-r*4.5)*0.22;
  float a = (core*1.6 + halo)*vA;
  if (a < 0.004) discard;
  gl_FragColor = vec4(pow(vCol, vec3(1.0/2.2))*a, 1.0);
}`;

const QUAD_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// ---------------------------------------------------------- CPU helpers
const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const vhash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = vhash(ix, iy), b = vhash(ix + 1, iy), c = vhash(ix, iy + 1), d = vhash(ix + 1, iy + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
const fbm2 = (x, y) => vnoise(x, y) * 0.5 + vnoise(x * 2.1 + 5, y * 2.1 + 3) * 0.3 + vnoise(x * 4.3 + 9, y * 4.3 + 1) * 0.2;
// ------------------------------------------------------------ city layout
const BLOCK = 0.16;
const FWY_J = 62, FWY_HW = 0.032;                  // a freeway along one north-south street line, ~1.4 km out
const isArt = (k) => ((k % 5) + 5) % 5 === 0;
const roadHW = (k) => (isArt(k) ? 0.016 : 0.010);
const roadHWz = (j) => (j === FWY_J ? FWY_HW : roadHW(j)); // lines of constant z
const frontJS = (x) => -8.6 + 0.9 * Math.sin(x * 0.083 + 0.7) + 0.45 * Math.sin(x * 0.21 + 2.0) + 0.18 * Math.sin(x * 0.57 + 1.0);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
// downtown cores: [x, z, radius, weight]; the main one sits right of the hero text
const CORES = [[9.15, -1.8, 0.85, 1.0], [7.11, -4.34, 0.8, 0.7], [8.74, -6.05, 0.7, 0.5], [7.63, -2.26, 0.6, 0.4]];
const core = (x, z) => CORES.reduce((s, [cx, cz, r, w]) => s + w * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r)), 0);
const inValley = (x, z) => clamp01((z - frontJS(x) - 0.5) / 0.8) * clamp01((2.6 - z) / 1.2);
const urban = (x, z) => inValley(x, z) * (0.5 + 0.6 * fbm2(x * 0.4, z * 0.4) + 0.6 * core(x, z));
const isPark = (x, z) => fbm2(x * 1.6 + 7, z * 1.6 + 2) < 0.24 && core(x, z) < 0.3;

// ------------------------------------------------------------ facade textures
// One painted tile per building type (glass curtain wall, punched concrete,
// ribbon office, brick, house), 32 bays x 32 floors, mipmapped and sampled
// with anisotropic filtering so windows average correctly at any distance.
//   E: rgb night emission (sRGB), a blinds/curtains seen by day
//   D: r wall detail (0.5 = 1x), g glass coverage, b frame/mullion, a reveal shadow
const FAC_CELLS = 32;
const FAC_GLASS = [[0.035, 1.0, 0.27, 1.0], [0.22, 0.78, 0.30, 0.86], [0.02, 1.0, 0.34, 0.80], [0.30, 0.70, 0.30, 0.80], [0.34, 0.66, 0.34, 0.76]];
function buildFacades(S) {
  const C = FAC_CELLS, cp = S / C, L = FAC_GLASS.length;
  const E = new Uint8Array(S * S * 4 * L), D = new Uint8Array(S * S * 4 * L);
  const ctx = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c.getContext('2d'); };
  const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`;
  for (let l = 0; l < L; l++) {
    const R = rng(911 + l * 131);
    const ge = ctx(), gd = ctx(), gx = ctx();
    ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
    gd.fillStyle = rgb(128, 0, 0); gd.fillRect(0, 0, S, S);
    gx.fillStyle = '#000'; gx.fillRect(0, 0, S, S);
    const [x0, x1, y0, y1] = FAC_GLASS[l];
    const office = l < 3, recessed = l === 1 || l === 3 || l === 4;
    // canvas row = v (bottom of floor at row j*cp), so no flipping is needed
    const rect = (g, i, j, a, b, c, d, style) => { g.fillStyle = style; g.fillRect(i * cp + a * cp, j * cp + c * cp, (b - a) * cp, (d - c) * cp); };
    for (let j = 0; j < C; j++) {
      const occ = office ? (R() < 0.1 ? 0.9 : Math.pow(R(), 1.7) * 0.7) : 0.12 + R() * 0.42;
      const floorBlind = 0.2 + R() * 0.6, floorTone = 115 + R() * 26;
      let i = 0;
      while (i < C) {
        const run = office ? 1 + Math.floor(R() * 4) : 1 + Math.floor(R() * 2.5);   // rooms span several bays
        const lit = R() < occ;
        const k = R();
        const col = office ? (k < 0.45 ? [222, 234, 255] : k < 0.85 ? [255, 228, 188] : [255, 200, 140])
                           : (k < 0.12 ? [210, 225, 255] : k < 0.55 ? [255, 196, 122] : k < 0.9 ? [255, 214, 160] : [255, 168, 88]);
        const inten = lit ? (R() < 0.15 ? 0.35 : 0.6 + R() * 0.4) : 0;
        const tv = !office && !lit && R() < 0.06;
        for (let q = 0; q < run && i < C; q++, i++) {
          // ---- wall detail (D.r)
          if (l === 0) { rect(gd, i, j, 0, 1, 0, 1, rgb(floorTone, 0, 0)); rect(gd, i, j, 0, 1, 0.23, 0.27, rgb(70, 0, 0)); }
          else if (l === 1) { rect(gd, i, j, 0, 1, 0, 1, rgb(122 + R() * 14, 0, 0)); rect(gd, i, j, 0, 0.03, 0, 1, rgb(96, 0, 0)); rect(gd, i, j, 0, 1, 0, 0.03, rgb(96, 0, 0)); }
          else if (l === 2) { rect(gd, i, j, 0, 1, 0, 1, rgb(floorTone + 10, 0, 0)); }
          else if (l === 3) { for (let b = 0; b < 8; b++) rect(gd, i, j, 0, 1, b / 8, (b + 1) / 8, rgb(108 + R() * 36, 0, 0)); }
          else { for (let b = 0; b < 8; b++) rect(gd, i, j, 0, 1, b / 8, (b + 1) / 8, rgb(b % 2 ? 122 : 138, 0, 0)); }
          const hasWin = !(l === 4 && R() < 0.35);
          if (!hasWin) continue;
          // sills and lintels on punched, brick and house walls
          if (recessed) { rect(gd, i, j, x0 - 0.04, x1 + 0.04, y0 - 0.045, y0, rgb(178, 0, 0)); if (l === 3) rect(gd, i, j, x0 - 0.05, x1 + 0.05, y1, y1 + 0.05, rgb(170, 0, 0)); }
          // frame then glass (D.b, D.g)
          const fw = l === 0 ? 0.0 : 0.05;
          if (fw) rect(gd, i, j, x0 - fw, x1 + fw, y0 - fw, y1 + fw * 0.6, rgb(128, 0, 255));
          rect(gd, i, j, x0, x1, y0, y1, rgb(128, 255, 0));
          if (l === 0) { rect(gd, i, j, 0, 0.035, 0.27, 1, rgb(128, 0, 255)); rect(gd, i, j, 0, 1, 0.27, 0.29, rgb(128, 0, 255)); }
          if (l === 2) rect(gd, i, j, 0, 0.02, y0, y1, rgb(128, 0, 255));
          if (l === 1 || l === 3) rect(gd, i, j, (x0 + x1) / 2 - 0.02, (x0 + x1) / 2 + 0.02, y0, y1, rgb(128, 0, 255)); // casement split
          // ---- blinds / curtains by day (X.r) and reveal shadow (X.g)
          const gh = y1 - y0, gw = x1 - x0;
          const bmode = R();
          let bTop = 0, curtain = 0;
          if (office) { if (bmode < 0.55) bTop = floorBlind + (R() - 0.5) * 0.15; }
          else if (bmode < 0.3) curtain = 0.18 + R() * 0.12; else if (bmode < 0.55) bTop = 0.2 + R() * 0.7;
          gx.globalCompositeOperation = 'source-over';
          if (bTop > 0) rect(gx, i, j, x0, x1, y1 - gh * bTop, y1, rgb(office ? 215 : 190, 0, 0));
          if (curtain) { rect(gx, i, j, x0, x0 + gw * curtain, y0, y1, rgb(170, 0, 0)); rect(gx, i, j, x1 - gw * curtain, x1, y0, y1, rgb(170, 0, 0)); }
          if (recessed || l === 2) {
            gx.globalCompositeOperation = 'lighter';
            rect(gx, i, j, x0, x1, y1 - gh * 0.14, y1, rgb(0, 255, 0));
            rect(gx, i, j, x0, x0 + gw * 0.1, y0, y1, rgb(0, 120, 0));
          }
          // ---- night: the room behind the glass (E.rgb)
          if (lit) {
            const [r, g, b] = col.map((v) => v * inten);
            const px0 = i * cp + x0 * cp, py0 = j * cp + y0 * cp, pw = gw * cp, ph = gh * cp;
            const grd = ge.createLinearGradient(0, py0 + ph, 0, py0);   // ceiling lights: brighter at the head of the window
            grd.addColorStop(0, rgb(r, g, b)); grd.addColorStop(1, rgb(r * (office ? 0.62 : 0.75), g * (office ? 0.62 : 0.72), b * (office ? 0.62 : 0.68)));
            ge.fillStyle = grd; ge.fillRect(px0, py0, pw, ph);
            if (bTop > 0) rect(ge, i, j, x0, x1, y1 - gh * bTop, y1, rgb(r * 0.55, g * 0.52, b * 0.48));   // blinds glow through
            if (curtain) { rect(ge, i, j, x0, x0 + gw * curtain, y0, y1, rgb(r * 0.5, g * 0.42, b * 0.32)); rect(ge, i, j, x1 - gw * curtain, x1, y0, y1, rgb(r * 0.5, g * 0.42, b * 0.32)); }
            if (R() < 0.35) { const fx = x0 + gw * R() * 0.5; rect(ge, i, j, fx, Math.min(x1, fx + gw * (0.25 + R() * 0.35)), y0, y0 + gh * (0.12 + R() * 0.22), rgb(r * 0.18, g * 0.16, b * 0.14)); } // furniture
            if (office && R() < 0.5) rect(ge, i, j, x0, x1, y1 - gh * 0.06, y1, rgb(Math.min(255, r * 1.15), Math.min(255, g * 1.15), Math.min(255, b * 1.15))); // light fitting
          } else if (tv) {
            rect(ge, i, j, x0, x1, y0, y1, rgb(26, 34, 60));
          }
        }
      }
    }
    const e = ge.getImageData(0, 0, S, S).data, d = gd.getImageData(0, 0, S, S).data, x = gx.getImageData(0, 0, S, S).data;
    const o = l * S * S * 4;
    for (let p = 0; p < S * S * 4; p += 4) {
      E[o + p] = e[p]; E[o + p + 1] = e[p + 1]; E[o + p + 2] = e[p + 2]; E[o + p + 3] = x[p];
      D[o + p] = d[p]; D[o + p + 1] = d[p + 1]; D[o + p + 2] = d[p + 2]; D[o + p + 3] = x[p + 1];
    }
  }
  const tex = (data) => { const t = new THREE.DataArrayTexture(data, S, S, L); t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true; return t; };
  return { E: tex(E), D: tex(D) };
}

function buildCity(small) {
  const yaw = Math.atan2(AIM.x - CAM.x, -(AIM.z - CAM.z));
  const RMAX = small ? 6.5 : 9.5, AMAX = 0.85;
  const view = (x, z) => { const dx = x - CAM.x, dz = z - CAM.z, r = Math.hypot(dx, dz); const a = Math.atan2(dx, -dz) - yaw; return r > 0.3 && r < RMAX && Math.abs(a) < AMAX ? r : 0; };

  // ground texture: R built-up, G inside the city, B variation
  const SW = 512, SH = Math.round(SW * CITY.h / CITY.w);
  const cv = document.createElement('canvas'); cv.width = SW; cv.height = SH;
  const cg = cv.getContext('2d'); const img = cg.createImageData(SW, SH);
  for (let j = 0; j < SH; j++) for (let i = 0; i < SW; i++) {
    const x = CITY.x0 + (i + 0.5) / SW * CITY.w, z = CITY.z0 + (j + 0.5) / SH * CITY.h, k = (j * SW + i) * 4;
    const u = urban(x, z), inside = inValley(x, z) > 0.5;
    img.data[k] = inside && !isPark(x, z) ? Math.min(255, u * 255) : 0;
    img.data[k + 1] = inside ? 255 : 0;
    img.data[k + 2] = vhash(i, j) * 255; img.data[k + 3] = 255;
  }
  cg.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace; tex.flipY = false; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;

  // ---- buildings
  const bp = [], bs = [], bt = [];
  let maxH = 0;
  const box = (x, z, w, d, y0, h, style, seed, occ, crown = 0) => { bp.push(x, y0, z); bs.push(w, h, d); bt.push(style, seed, occ, crown); if (y0 + h > maxH) maxH = y0 + h; };
  // other shapes share the building material: chamfered octagonal prisms and tapered crowns
  const op = [], os = [], ot = [], fp = [], fs = [], ft = [];
  const oct = (x, z, w, d, y0, h, style, seed, occ, crown = 0) => { op.push(x, y0, z); os.push(w, h, d); ot.push(style, seed, occ, crown + 2); };
  const frus = (x, z, w, d, y0, h, style, seed) => { fp.push(x, y0, z); fs.push(w, h, d); ft.push(style, seed, 0.3, 0); };
  const trim = (x, z, w, d, y0, h, style, seed) => box(x, z, w, d, y0, h, 10 + style, seed, 0);
  // the faces this building shows the camera
  const facing = (x, z) => ({ px: CAM.x > x, pz: CAM.z > z });
  // structural dressing: a cornice that overhangs the roofline, projecting bays, stacked balconies
  const dress = (R, x, z, w, d, h, style, seed, r) => {
    if (r > 5.5 || h < 0.009) return;
    if (style === 1 || style === 3 || style === 2) trim(x, z, w + 0.0018, d + 0.0018, h - 0.0011, 0.0015, style, seed);   // cornice: top sits proud of the roof, so no shared faces
    if (r > 3.6 || h < 0.014) return;
    const f = facing(x, z);
    const faces = [[f.pz ? 1 : -1, 'z'], [f.px ? 1 : -1, 'x']];
    for (const [sgn, ax] of faces) {
      const len = ax === 'z' ? w : d;
      if (len < 0.016) continue;
      const kind = R();
      if ((style === 3 || style === 4 || style === 1) && kind < 0.45 && r < 2.6) {
        // stacked balconies: solid parapets in vertical columns, one per floor
        const cols = Math.max(1, Math.floor(len / 0.009));
        for (let k = 0; k < cols; k++) {
          if (R() < 0.35) continue;
          const t = (k + 0.5) / cols - 0.5;
          for (let y = 0.0062; y < h - 0.003; y += 0.0031) {
            const bx = ax === 'z' ? x + t * len : x + sgn * (w / 2 + 0.0007), bz = ax === 'z' ? z + sgn * (d / 2 + 0.0007) : z + t * len;
            trim(bx, bz, ax === 'z' ? 0.0045 : 0.0014, ax === 'z' ? 0.0014 : 0.0045, y, 0.0011, style, seed);
          }
        }
      } else if (kind < 0.8) {
        // projecting bays running up the facade, with their own windows
        const n = Math.max(1, Math.floor(len / 0.014));
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n - 0.5, bw = 0.0035 + R() * 0.002, bd = 0.0011 + R() * 0.0005;
          const bx = ax === 'z' ? x + t * len : x + sgn * (w / 2 + bd / 2), bz = ax === 'z' ? z + sgn * (d / 2 + bd / 2) : z + t * len;
          box(bx, bz, ax === 'z' ? bw : bd, ax === 'z' ? bd : bw, 0.005, h - 0.0075, style, seed, 0.4);
        }
      }
    }
  };
  // pitched roofs (gable prisms), ridge along whichever side is longer
  const rxp = [], rxs = [], rxt = [], rzp = [], rzs = [], rzt = [];
  const gable = (x, z, w, d, y0, rise, style, seed) => {
    if (w >= d) { rxp.push(x, y0, z); rxs.push(w, rise, d); rxt.push(style, seed, 0.4, 0); }
    else { rzp.push(x, y0, z); rzs.push(w, rise, d); rzt.push(style, seed, 0.4, 0); }
  };
  // tower tops: plant penthouse, then a stepped crown or a spire on landmarks, masts on some
  const towerTop = (R, x, z, w, d, top, style, seed, landmark, plan) => {
    // some towers finish in a tapered crown instead of a flat roof
    if (!landmark && plan !== 'oct' && top > 0.1 && R() < 0.35) {
      const th = 0.012 + R() * 0.022;
      frus(x, z, w * 0.98, d * 0.98, top, th, style, seed);
      if (R() < 0.5) box(x, z, 0.002, 0.002, top + th, 0.01 + R() * 0.015, 6, 0.8, 0);
      return;
    }
    const pw = w * (0.5 + R() * 0.25), pd = d * (0.5 + R() * 0.25), ph = 0.006 + R() * 0.006;
    box(x + (R() - 0.5) * (w - pw) * 0.4, z + (R() - 0.5) * (d - pd) * 0.4, pw, pd, top, ph, 5, seed + 0.7, 0);
    let y = top + ph, cw = pw, cd = pd;
    if (landmark) {
      if (R() < 0.5) {
        const sh = 0.025 + R() * 0.035; box(x, z, 0.0028, 0.0028, y, sh, 6, R() < 0.7 ? 0.2 : 0.8, 0); beacons.push(x, y + sh + 0.001, z);
      } else {
        for (let k = 0; k < 3; k++) { cw *= 0.62; cd *= 0.62; const ch = 0.005 + R() * 0.004; box(x, z, cw, cd, y, ch, style, seed, 0.3); y += ch; }
        beacons.push(x, y + 0.001, z);
      }
    } else if (top > 0.12 && R() < 0.4) {
      for (let k = 0, n = 1 + Math.floor(R() * 2); k < n; k++) { const mh = 0.008 + R() * 0.017; box(x + (R() - 0.5) * pw * 0.6, z + (R() - 0.5) * pd * 0.6, 0.002, 0.002, y, mh, 6, 0.8, 0); }
    }
  };
  const beacons = [];
  const roofPlant = (R, x, z, w, d, top, r) => {
    if (r > 4 || top < 0.015) return;
    const n = 1 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      const uw = 0.003 + R() * Math.min(0.012, w * 0.3), ud = 0.003 + R() * Math.min(0.012, d * 0.3);
      box(x + (R() - 0.5) * (w - uw) * 0.8, z + (R() - 0.5) * (d - ud) * 0.8, uw * 0.8, ud * 0.8, top, 0.0015 + R() * 0.003, 5, R(), 0);
    }
  };
  const nI = Math.floor(CITY.w / BLOCK), nJ = Math.floor(CITY.h / BLOCK);
  for (let i = 0; i < nI; i++) for (let j = 0; j < nJ; j++) {
    const xa = CITY.x0 + i * BLOCK + roadHW(i) + 0.004, xb = CITY.x0 + (i + 1) * BLOCK - roadHW(i + 1) - 0.004;
    const za = CITY.z0 + j * BLOCK + roadHWz(j) + 0.004, zb = CITY.z0 + (j + 1) * BLOCK - roadHWz(j + 1) - 0.004;
    const cx = (xa + xb) / 2, cz = (za + zb) / 2;
    const r = view(cx, cz);
    if (!r) continue;
    const u = urban(cx, cz);
    if (u < 0.3 || inValley(cx, cz) < 0.5 || isPark(cx, cz)) continue;
    const R = rng(i * 73856093 ^ j * 19349663);
    const c = core(cx, cz);
    if (c > 0.22) {
      // downtown: one, two or four lots, mostly towers
      const split = R(), lots = [];
      if (split < 0.35) lots.push([xa, xb, za, zb]);
      else if (split < 0.75) { const m = (za + zb) / 2; lots.push([xa, xb, za, m - 0.003], [xa, xb, m + 0.003, zb]); }
      else { const mx = (xa + xb) / 2, mz = (za + zb) / 2; lots.push([xa, mx - 0.003, za, mz - 0.003], [mx + 0.003, xb, za, mz - 0.003], [xa, mx - 0.003, mz + 0.003, zb], [mx + 0.003, xb, mz + 0.003, zb]); }
      for (const [x0, x1, z0, z1] of lots) {
        const lw = x1 - x0, ld = z1 - z0, lx = (x0 + x1) / 2, lz = (z0 + z1) / 2, seed = R();
        if (r > 0.9 && R() < Math.min(0.9, c * 1.15)) {
          // a few landmark towers near the core centres stand well clear of the rest
          const landmark = c > 0.8 && R() < 0.22;
          const Ht = landmark ? 0.36 + R() * 0.12 : Math.min(0.34, 0.06 + c * 0.26 * (0.25 + Math.pow(R(), 1.8) * 1.2));
          const style = R() < 0.55 ? 0 : R() < 0.65 ? 1 : 2, occ = 0.3 + R() * 0.35;
          let base = 0;
          if (R() < 0.6) { base = 0.010 + R() * 0.02; box(lx, lz, lw, ld, 0, base, 1, seed + 0.5, 0.45); }
          let sw = lw * (0.55 + R() * 0.35), sd = ld * (0.55 + R() * 0.35);
          if (R() < 0.3) { const t = sw; sw = Math.min(lw * 0.9, sd * 1.4); sd = t * 0.6; }  // slab towers
          const sx = lx + (R() - 0.5) * (lw - sw) * 0.6, sz = lz + (R() - 0.5) * (ld - sd) * 0.6;
          // 1-3 tiers, each set back from the one below
          const tiers = Ht > 0.14 ? 1 + Math.floor(R() * (landmark ? 3 : 2.4)) : 1;
          let y = base, w = sw, d = sd;
          // plan: plain, chamfered (cut corners), or a cross with notched corners
          const plan = Ht > 0.09 ? (R() < 0.34 ? 'oct' : R() < 0.3 ? 'cross' : 'box') : 'box';
          for (let k = 0; k < tiers; k++) {
            const top = k === tiers - 1 ? Ht : y + (Ht - y) * (0.5 + R() * 0.25);
            const cr = k === tiers - 1 && Ht > 0.2 && R() < 0.3 ? 1 : 0;
            if (plan === 'oct') oct(sx, sz, w, d, y, top - y, style, seed, occ, cr);
            else if (plan === 'cross') { box(sx, sz, w, d * 0.62, y, top - y, style, seed, occ, cr); box(sx, sz, w * 0.62, d, y, top - y - 0.0006, style, seed, occ); }
            else box(sx, sz, w, d, y, top - y, style, seed, occ, cr);
            if (style !== 0 && plan === 'box') trim(sx, sz, w + 0.0022, d + 0.0022, top - 0.0012, 0.0016, style, seed);   // cornice at each setback
            y = top; if (k < tiers - 1) { w *= 0.68 + R() * 0.12; d *= 0.68 + R() * 0.12; }
          }
          if (base > 0) trim(lx, lz, lw + 0.0016, ld + 0.0016, base - 0.0009, 0.0013, 1, seed + 0.5);   // podium cornice
          // paired-box plan: a second, lower wing offset to one side
          if (R() < 0.3 && Ht > 0.1) {
            const ww = sw * 0.6, dd = sd * 0.8, ox = (R() < 0.5 ? -1 : 1) * ((sw - ww) * 0.5 + 0.0025);   // stand proud of the shaft: never flush, never z-fighting
            box(sx + ox, sz + (R() < 0.5 ? -1 : 1) * sd * 0.35, ww, dd, base, Ht * (0.55 + R() * 0.25) - base, style === 0 ? 1 : 0, seed + 0.3, occ);
          }
          towerTop(R, sx, sz, w, d, Ht, style, seed, landmark, plan);
          if (Ht > 0.15 && !landmark) beacons.push(sx, Ht + 0.012, sz);
        } else {
          const h = 0.015 + Math.pow(R(), 1.5) * 0.06 * (0.4 + c), style = [1, 1, 2, 3][Math.floor(R() * 4)];
          box(lx, lz, lw * 0.95, ld * 0.95, 0, h, style, seed, 0.3 + R() * 0.3);
          dress(R, lx, lz, lw * 0.95, ld * 0.95, h, style, seed, r);
          roofPlant(R, lx, lz, lw, ld, h, r);
        }
      }
    } else if (c > 0.1 || (u > 0.95 && r < 5)) {
      // perimeter blocks: rows of mid-rise along the north and south streets, open courtyard
      for (const edge of [0, 1]) {
        const dz = 0.025 + R() * 0.02, zc = edge ? zb - dz / 2 : za + dz / 2;
        let x = xa;
        while (x < xb - 0.01) {
          const w = Math.min(xb - x, 0.02 + R() * 0.04), h = 0.008 + Math.pow(R(), 1.6) * 0.04;
          const st = [1, 1, 3, 2, 4][Math.floor(R() * 5)], sd = R();
          box(x + w / 2, zc, w - 0.002, dz, 0, h, st, sd, 0.3 + R() * 0.35);
          if ((st === 3 || st === 4) && h < 0.025 && R() < 0.5) gable(x + w / 2, zc, w - 0.002, dz, h, 0.003 + R() * 0.003, 4, sd);
          else { dress(R, x + w / 2, zc, w - 0.002, dz, h, st, sd, r); roofPlant(R, x + w / 2, zc, w, dz, h, r); }
          x += w;
        }
      }
    } else if (r < 3.8) {
      // houses
      for (let a = 0; a < 5; a++) for (let b = 0; b < 4; b++) {
        if (R() < 0.15) continue;
        const w = 0.010 + R() * 0.005, d = 0.009 + R() * 0.004, hx = 0.0045 + R() * 0.003, sd = R();
        const hxp = xa + (a + 0.5) * (xb - xa) / 5 + (R() - 0.5) * 0.004, hzp = za + (b + 0.5) * (zb - za) / 4 + (R() - 0.5) * 0.004;
        box(hxp, hzp, w, d, 0, hx, 4, sd, 0.35 + R() * 0.3);
        gable(hxp, hzp, w + 0.0012, d + 0.0012, hx, 0.0025 + R() * 0.002, 4, sd);
      }
    } else {
      // far suburbs: rows of houses as one mass each
      for (const t of [0.25, 0.75]) { const hh = 0.005 + R() * 0.004, sd = R(); box(cx, za + (zb - za) * t, (xb - xa) * 0.9, 0.022, 0, hh, 4, sd, 0.4); gable(cx, za + (zb - za) * t, (xb - xa) * 0.9, 0.024, hh, 0.004, 4, sd); }
    }
  }

  // ---- traffic, street lamps
  const cm = [], ci = [];                         // car instances
  const lp = [], li = [], lm = [];                // point lights
  const light = (x, y, z, kind, b, move = [0, 0, 0, 1], seed = Math.random()) => { lp.push(x, y, z); li.push(seed, kind, b); lm.push(...move); };
  const R = rng(4242);
  const lane = (axis, k) => {
    const fixed = (axis === 0 ? CITY.z0 : CITY.x0) + k * BLOCK;
    const lo = axis === 0 ? CITY.x0 : CITY.z0, hi = lo + (axis === 0 ? CITY.w : CITY.h);
    let sMin = Infinity, sMax = -Infinity;
    for (let s = lo; s < hi; s += 0.08) {
      const x = axis === 0 ? s : fixed, z = axis === 0 ? fixed : s;
      if (view(x, z) && inValley(x, z) > 0.5) { sMin = Math.min(sMin, s); sMax = Math.max(sMax, s); }
    }
    if (!(sMax - sMin > 0.2)) return;
    const art = isArt(k), span = sMax - sMin;
    if (axis === 0 && k === FWY_J) {
      // freeway: lamps both shoulders and the median, three lanes each way, heavy traffic
      for (let s = sMin; s < sMax; s += 0.05) for (const side of [-FWY_HW - 0.002, 0, FWY_HW + 0.002]) light(s, 0.012, fixed + side, side ? 0 : 1, 0.9 + R() * 0.3);
      for (const dir of [1, -1]) for (const ln of [0.007, 0.014, 0.021]) {
        const n = Math.floor(span * (small ? 30 : 70) * (0.8 + 0.4 * R()));
        for (let q = 0; q < n; q++) {
          const mv = [0, (0.024 + R() * 0.008 - ln * 0.2) * dir, sMin, sMax], s0 = sMin + R() * span, laneC = fixed + dir * ln;
          cm.push(...mv); ci.push(laneC, s0, R());
          light(laneC, 0.0008, s0, 3, 0.55 + R() * 0.3, mv); light(laneC, 0.0008, s0, 4, 0.45 + R() * 0.2, mv);
        }
      }
      return;
    }
    // lamps along both curbs
    for (let s = sMin; s < sMax; s += 0.042 * (0.85 + R() * 0.3)) {
      if (R() < 0.08) continue;
      const side = (R() < 0.5 ? -1 : 1) * (roadHW(k) + 0.002);
      const x = axis === 0 ? s : fixed + side, z = axis === 0 ? fixed + side : s;
      const led = vnoise(x * 0.7 + 30, z * 0.7) > 0.52;
      light(x, 0.009, z, led ? 1 : 0, art ? 0.8 + R() * 0.4 : 0.35 + R() * 0.35);
    }
    // cars, both directions
    const dens = (art ? 38 : 7) * (small ? 0.45 : 1);
    for (const dir of [1, -1]) {
      const n = Math.floor(span * dens * (0.6 + 0.4 * R()));
      const laneC = fixed + dir * (art ? 0.006 : 0.0035);
      for (let q = 0; q < n; q++) {
        const sp = (art ? 0.012 + R() * 0.007 : 0.007 + R() * 0.005) * dir, s0 = sMin + R() * span, seed = R();
        const mv = [axis, sp, sMin, sMax];
        cm.push(...mv); ci.push(laneC, s0, seed);
        light(laneC, 0.0008, s0, 3, 0.45 + R() * 0.3, mv); light(laneC, 0.0008, s0, 4, 0.35 + R() * 0.2, mv);
      }
    }
  };
  for (let j = 0; j <= nJ; j++) lane(0, j);
  for (let i = 0; i <= nI; i++) lane(1, i);
  for (let k = 0; k < beacons.length; k += 3) light(beacons[k], beacons[k + 1], beacons[k + 2], 5, 1.1);
  // two aircraft on approach far out over the valley (night only)
  light(24, 1.25, -15, 6, 1.4, [-0.075, 0.012, 640, 0], 0.1); light(24, 1.25, -15, 7, 0.9, [-0.075, 0.012, 640, 0], 0.1);
  light(-22, 1.6, -21, 6, 1.2, [0.06, 0.004, 760, 0], 0.55); light(-22, 1.6, -21, 7, 0.8, [0.06, 0.004, 760, 0], 0.55);
  // canyon road climbing out of the city
  for (let t = 0; t < 1; t += 0.006) { if (R() < 0.55) light(-1.5 + 0.18 * Math.sin(t * 9.0) + 0.1 * t, 0.009, -6.0 - t * 5.5, 0, 0.8); }

  const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const inst = (attrs) => { const g = new THREE.InstancedBufferGeometry(); g.index = unit.index; g.setAttribute('position', unit.attributes.position); g.setAttribute('normal', unit.attributes.normal);
    let n = 0; for (const [name, arr, size] of attrs) { g.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(arr), size)); n = arr.length / size; } g.instanceCount = n; return g; };
  const buildings = inst([['iPos', bp, 3], ['iSize', bs, 3], ['iStyle', bt, 4]]);
  // unit gable prism: base y 0..1, ridge along x at z = 0
  const prism = new THREE.BufferGeometry();
  const P = [[-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 1, 0], [-0.5, 1, 0], [-0.5, 0, -0.5], [0.5, 0, -0.5]];
  const tri = [[0, 1, 2], [0, 2, 3], [5, 4, 3], [5, 3, 2], [1, 5, 2], [4, 0, 3]];
  prism.setAttribute('position', new THREE.Float32BufferAttribute(tri.flat().flatMap((i) => P[i]), 3));
  prism.computeVertexNormals();
  const prismZ = prism.clone().rotateY(Math.PI / 2);
  const instG = (geo, attrs) => { const g = new THREE.InstancedBufferGeometry(); g.setAttribute('position', geo.attributes.position); g.setAttribute('normal', geo.attributes.normal);
    let n = 0; for (const [name, arr, size] of attrs) { g.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(arr), size)); n = arr.length / size; } g.instanceCount = n; return g; };
  const roofsX = instG(prism, [['iPos', rxp, 3], ['iSize', rxs, 3], ['iStyle', rxt, 4]]);
  const roofsZ = instG(prismZ, [['iPos', rzp, 3], ['iSize', rzs, 3], ['iStyle', rzt, 4]]);
  // convex solids from triangles, every face wound outward from the centre
  const solid = (tris) => {
    const pos = [];
    for (const [a, b, c] of tris) {
      const n = new THREE.Vector3().subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a)).cross(new THREE.Vector3().subVectors(new THREE.Vector3(...c), new THREE.Vector3(...a)));
      const m = new THREE.Vector3(...a).add(new THREE.Vector3(...b)).add(new THREE.Vector3(...c)).multiplyScalar(1 / 3).sub(new THREE.Vector3(0, 0.5, 0));
      pos.push(...(n.dot(m) >= 0 ? [a, b, c] : [a, c, b]).flat());
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
  };
  const ring = (c, y, s = 1) => [[-0.5 + c, -0.5], [0.5 - c, -0.5], [0.5, -0.5 + c], [0.5, 0.5 - c], [0.5 - c, 0.5], [-0.5 + c, 0.5], [-0.5, 0.5 - c], [-0.5, -0.5 + c]].map(([x, z]) => [x * s, y, z * s]);
  const prismOf = (lo, hi) => { const t = []; for (let i = 0; i < lo.length; i++) { const j = (i + 1) % lo.length; t.push([lo[i], lo[j], hi[j]], [lo[i], hi[j], hi[i]]); } for (let i = 1; i < hi.length - 1; i++) t.push([hi[0], hi[i], hi[i + 1]]); return solid(t); };
  const octG = prismOf(ring(0.2, 0), ring(0.2, 1));
  const sq = (y, s) => [[-0.5 * s, y, -0.5 * s], [0.5 * s, y, -0.5 * s], [0.5 * s, y, 0.5 * s], [-0.5 * s, y, 0.5 * s]];
  const frusG = prismOf(sq(0, 1), sq(1, 0.45));
  const octs = instG(octG, [['iPos', op, 3], ['iSize', os, 3], ['iStyle', ot, 4]]);
  const crowns = instG(frusG, [['iPos', fp, 3], ['iSize', fs, 3], ['iStyle', ft, 4]]);
  const cars = inst([['cMove', cm, 4], ['cInfo', ci, 3]]);
  const lights = new THREE.BufferGeometry();
  lights.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
  lights.setAttribute('aInfo', new THREE.Float32BufferAttribute(li, 3));
  lights.setAttribute('aMove', new THREE.Float32BufferAttribute(lm, 4));
  return { tex, buildings, roofsX, roofsZ, octs, crowns, cars, lights, counts: { buildings: bp.length / 3, octs: op.length / 3, crowns: fp.length / 3, roofs: (rxp.length + rzp.length) / 3, cars: cm.length / 4, lights: lp.length / 3 } };
}

// grid laid out in polar coords around the camera: rows packed tight where
// the range is (8–26 km), loose in the foreground and the far haze
function buildFan(cols, density) {
  const yaw = Math.atan2(AIM.x - CAM.x, -(AIM.z - CAM.z));
  const rs = []; let r = 0.25;
  while (r < 90) { rs.push(r); const k = r > 7 && r < 28 ? 0.0055 : r < 7 ? 0.016 : 0.02; r *= 1 + k / density; }
  const A = 1.05, rows = rs.length;
  const pos = new Float32Array(cols * rows * 3);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = yaw - A + (2 * A * i) / (cols - 1), k = (j * cols + i) * 3;
    pos[k] = CAM.x + Math.sin(a) * rs[j]; pos[k + 1] = 0; pos[k + 2] = CAM.z - Math.cos(a) * rs[j];
  }
  const idx = new Uint32Array((cols - 1) * (rows - 1) * 6); let q = 0;
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
    const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
    idx[q++] = a; idx[q++] = b; idx[q++] = c; idx[q++] = b; idx[q++] = d; idx[q++] = c;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(CAM.clone(), 200);
  return geo;
}

class CityScene extends HTMLElement {
  connectedCallback() {
    if (this.started) return; this.started = true;
    this.style.cssText += ';display:block;width:100%;height:100%;min-height:100%';
    this.mouse = { x: 0, y: 0 }; this.target = { x: 0, y: 0 };
    this.onMove = (e) => { this.target.x = e.clientX / innerWidth - 0.5; this.target.y = e.clientY / innerHeight - 0.5; };
    window.addEventListener('pointermove', this.onMove, { passive: true });
    this.night = this.getAttribute('dark') === '1' ? 1 : 0;
    this.buildTimer = setTimeout(() => {
      if (this.dead) return;
      try { this.build(); } catch (e) { console.error('city-scene build failed', e); this.setAttribute('data-rendered', '1'); }
    }, 0);
  }
  disconnectedCallback() {
    this.dead = true;
    clearTimeout(this.buildTimer);
    window.removeEventListener('pointermove', this.onMove);
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.ro) this.ro.disconnect();
    if (this.io) this.io.disconnect();
    if (this.disposables) this.disposables.forEach((d) => d.dispose());
    if (this.renderer) { this.renderer.dispose(); this.renderer.forceContextLoss(); }
  }
  static get observedAttributes() { return ['dark']; }
  attributeChangedCallback() {
    // first value snaps; later changes play dusk or dawn
    const want = this.getAttribute('dark') === '1' ? 1 : 0;
    if (!this.U) { this.night = want; return; }
    this.fade = { from: this.night, to: want, t0: performance.now() };
  }
  build() {
    const small = Math.min(innerWidth, innerHeight) < 600 || matchMedia('(pointer: coarse)').matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // shaders tonemap + encode themselves
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
    this.appendChild(renderer.domElement);
    this.renderer = renderer;
    const gl = renderer.getContext();
    const floatRT = !!gl.getExtension('EXT_color_buffer_float');
    const disposables = (this.disposables = []);

    const U = (this.U = {
      uDom: { value: new THREE.Vector4(DOM.x0, DOM.z0, DOM.w, DOM.h) },
      uSun: { value: SUN.clone() }, uMoon: { value: MOON.clone() },
      uNight: { value: this.night }, uTime: { value: 0 },
    });

    // ---- one-time GPU bakes: terrain height, normals, light ----------------
    const HW = small ? 1024 : 2048, HH = Math.round(HW * DOM.h / DOM.w);
    const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false; quadScene.add(quad);
    // strips with a flush between them, so no single draw trips a driver watchdog
    const pass = (frag, target, extra = {}) => {
      const m = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: frag, uniforms: { ...U, ...extra }, depthTest: false, depthWrite: false });
      quad.material = m; target.scissorTest = true;
      for (let y = 0; y < target.height; y += 128) {
        target.scissor.set(0, y, target.width, Math.min(128, target.height - y));
        renderer.setRenderTarget(target); renderer.render(quadScene, quadCam); gl.flush();
      }
      target.scissorTest = false; renderer.setRenderTarget(null); m.dispose();
    };
    const rtOpts = (type, filter, mips) => ({ type, format: THREE.RGBAFormat, minFilter: mips ? THREE.LinearMipmapLinearFilter : filter, magFilter: filter, depthBuffer: false, generateMipmaps: !!mips, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, anisotropy: mips ? 8 : 1 });
    const hRT = new THREE.WebGLRenderTarget(HW, HH, rtOpts(floatRT ? THREE.FloatType : THREE.HalfFloatType, THREE.NearestFilter));
    const nRT = new THREE.WebGLRenderTarget(HW, HH, rtOpts(THREE.HalfFloatType, THREE.LinearFilter, true));
    const bRT = new THREE.WebGLRenderTarget(HW, HH, rtOpts(THREE.UnsignedByteType, THREE.LinearFilter, true));
    disposables.push(hRT, nRT, bRT);
    const hU = { uH: { value: hRT.texture }, uHRes: { value: new THREE.Vector2(HW, HH) } };
    pass(HEIGHT_FRAG, hRT);
    pass(NORMAL_FRAG, nRT, hU);
    pass(BAKE_FRAG, bRT, hU);

    // ---- city ----------------------------------------------------------
    const city = buildCity(small);
    this.counts = city.counts;
    disposables.push(city.tex, city.buildings, city.roofsX, city.roofsZ, city.octs, city.crowns, city.cars, city.lights);
    const cU = { uCity: { value: city.tex }, uCityDom: { value: new THREE.Vector4(CITY.x0, CITY.z0, CITY.w, CITY.h) } };

    // sun shadows from the buildings: one orthographic depth render, kept for good
    const SR = small ? 2048 : 4096, SE = 5.5;
    const sRT = new THREE.WebGLRenderTarget(SR, SR, { depthBuffer: true });
    sRT.depthTexture = new THREE.DepthTexture(SR, SR); sRT.depthTexture.type = THREE.UnsignedIntType;
    disposables.push(sRT);
    const yaw = Math.atan2(AIM.x - CAM.x, -(AIM.z - CAM.z));
    const sc = new THREE.Vector3(CAM.x + Math.sin(yaw) * 3.6, 0, CAM.z - Math.cos(yaw) * 3.6);
    const sCam = new THREE.OrthographicCamera(-SE, SE, SE, -SE, 0.1, 30);
    sCam.position.copy(sc).addScaledVector(SUN, 14); sCam.lookAt(sc); sCam.updateMatrixWorld(); sCam.updateProjectionMatrix();
    const S = {
      uShadow: { value: sRT.depthTexture }, uShadowRes: { value: SR },
      uShadowMat: { value: new THREE.Matrix4().multiplyMatrices(sCam.projectionMatrix, sCam.matrixWorldInverse) },
    };
    {
      const sScene = new THREE.Scene();
      const dm = new THREE.ShaderMaterial({ vertexShader: DEPTH_VERT, fragmentShader: DEPTH_FRAG, uniforms: { ...U, ...hU } });
      for (const g of [city.buildings, city.roofsX, city.roofsZ, city.octs, city.crowns]) { const sm = new THREE.Mesh(g, dm); sm.frustumCulled = false; sScene.add(sm); }
      renderer.setRenderTarget(sRT); renderer.clear(); renderer.render(sScene, sCam); renderer.setRenderTarget(null);
      dm.dispose();
    }

    // ---- scene -------------------------------------------------------------
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 1500);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: U, side: THREE.BackSide, depthWrite: false }));
    sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);

    const genR = small ? 6.5 : 9.5;
    const fan = buildFan(small ? 360 : 720, small ? 0.5 : 1);
    const terrain = new THREE.Mesh(fan, new THREE.ShaderMaterial({
      vertexShader: TERRAIN_VERT, fragmentShader: TERRAIN_FRAG,
      uniforms: { ...U, ...hU, ...cU, ...S, uN: { value: nRT.texture }, uB: { value: bRT.texture }, uGenR: { value: genR }, uCam0: { value: CAM.clone() } },
    }));
    terrain.frustumCulled = false; scene.add(terrain);

    const fac = buildFacades(small ? 256 : 512);
    const aniso = renderer.capabilities.getMaxAnisotropy();
    fac.E.anisotropy = fac.D.anisotropy = Math.min(8, aniso);
    disposables.push(fac.E, fac.D);
    const buildings = new THREE.Mesh(city.buildings, new THREE.ShaderMaterial({ vertexShader: BUILD_VERT, fragmentShader: BUILD_FRAG, uniforms: { ...U, ...hU, ...cU, ...S, uB: { value: bRT.texture }, uFacE: { value: fac.E }, uFacD: { value: fac.D }, uFacSize: { value: small ? 256 : 512 } } }));
    buildings.frustumCulled = false; scene.add(buildings);
    for (const g of [city.roofsX, city.roofsZ, city.octs, city.crowns]) { const m = new THREE.Mesh(g, buildings.material); m.frustumCulled = false; scene.add(m); }
    const cars = new THREE.Mesh(city.cars, new THREE.ShaderMaterial({ vertexShader: CAR_VERT, fragmentShader: CAR_FRAG, uniforms: { ...U, ...hU, ...cU, ...S } }));
    cars.frustumCulled = false; scene.add(cars);
    const px = { value: 1.6 };
    const lights = new THREE.Points(city.lights, new THREE.ShaderMaterial({
      vertexShader: LIGHTS_VERT, fragmentShader: LIGHTS_FRAG,
      uniforms: { ...U, ...hU, uPx: px }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    lights.frustumCulled = false; scene.add(lights);
    disposables.push(sky.geometry, sky.material, fan, terrain.material, buildings.material, cars.material, lights.material);

    // bloom: lights halo into the haze; strong at night, a whisper by day
    const crt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, crt);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.2, 0.55, 0.8);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    disposables.push(composer, crt);

    // ---- sizing, camera, loop ---------------------------------------------
    let cw = 1, ch = 1, quality = 1;
    const resize = () => {
      cw = this.clientWidth || 1; ch = this.clientHeight || 1;
      const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.5);
      const k = Math.min(dpr, (small ? 1100 : 2000) / cw) * quality;
      renderer.setSize(Math.round(cw * k), Math.round(ch * k), false);
      composer.setSize(Math.round(cw * k), Math.round(ch * k));
      px.value = 1.6 * k;
      camera.aspect = cw / ch; camera.updateProjectionMatrix();
    };
    this.ro = new ResizeObserver(resize); this.ro.observe(this); resize();
    let visible = true;
    this.io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }); this.io.observe(this);

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const look = new THREE.Vector3();
    let last = 0, slow = 33, frames = 0;
    const t0 = performance.now();
    const tick = (t) => {
      if (this.dead) return;
      this.raf = requestAnimationFrame(tick);
      if (document.hidden || !visible || t - last < 33) return;
      // if the GPU can't hold ~25fps, render fewer pixels (down to half)
      if (last && t - last < 500) { slow = slow * 0.95 + (t - last) * 0.05; frames++; }
      if (frames > 45 && slow > 48 && quality > 0.55) { quality *= 0.8; frames = 0; slow = 33; resize(); }
      last = t;
      const s = (t - t0) / 1000;
      if (this.fade) {
        const p = Math.min(1, (t - this.fade.t0) / (reduce ? 1 : 2400));
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        this.night = this.fade.from + (this.fade.to - this.fade.from) * e;
        if (p >= 1) this.fade = null;
      }
      U.uNight.value = this.night;
      U.uTime.value = reduce ? 40 : s + 40;   // with reduced motion, traffic and clouds hold still
      this.mouse.x += (this.target.x - this.mouse.x) * 0.04; this.mouse.y += (this.target.y - this.mouse.y) * 0.04;
      const drift = reduce ? 0 : Math.sin(s * 0.05) * 0.05;
      camera.position.set(CAM.x + this.mouse.x * 0.12 + drift, CAM.y - this.mouse.y * 0.03, CAM.z);
      look.copy(AIM); look.x += this.mouse.x * 0.5;
      camera.lookAt(look);
      camera.setViewOffset(cw, ch, cw > 860 ? -cw * 0.04 : 0, ch * 0.02, cw, ch);
      bloom.strength = 0.05 + 0.5 * this.night; bloom.threshold = 0.92 - 0.3 * this.night; bloom.radius = 0.3 + 0.15 * this.night;
      composer.render();
      if (!this.hasAttribute('data-rendered')) { this.setAttribute('data-rendered', '1'); this.dispatchEvent(new Event('scene-rendered')); }
    };
    const start = () => { if (!this.dead) this.raf = requestAnimationFrame(tick); };
    if (renderer.compileAsync) renderer.compileAsync(scene, camera).then(start, start);
    else start();
  }
}
if (typeof window !== 'undefined' && !customElements.get('city-scene')) customElements.define('city-scene', CityScene);

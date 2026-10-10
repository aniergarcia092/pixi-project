// Generación procedural del mapa: altura (ruido + cráteres + borde), tipo de terreno y recursos.
// No depende de Pixi: se puede probar en Node.

import { T, TILE_INFO } from '../nucleo/config.js';
import { mulberry32, hash2, fbm, clamp, lerp, smooth } from '../nucleo/noise.js';

export function generateMap({ seed = 1, w = 128, h = 128 } = {}) {
  const rnd = mulberry32(seed);
  const height = new Float32Array(w * h);
  const type = new Uint8Array(w * h);
  const spawn = { x: w >> 1, y: h >> 1 };             // zona de aterrizaje / base

  // 1) altura base con ruido, normalizada a [0,1] para que todas las semillas se parezcan en proporciones
  let lo = 1, hi = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = fbm(x / 34, y / 34, seed, 5); height[y * w + x] = v; if (v < lo) lo = v; if (v > hi) hi = v;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = (height[y * w + x] - lo) / (hi - lo || 1);
    v = clamp((v - .5) * 1.35 + .52, 0, 1);
    const e = Math.min(x, y, w - 1 - x, h - 1 - y);   // distancia al borde: el contorno se hunde en un cañón
    v -= (1 - smooth(clamp(e / 7, 0, 1))) * .5;
    height[y * w + x] = v;
  }

  // 2) cráteres: cuenco hundido con borde elevado
  const craters = 14 + Math.floor(rnd() * 8);
  for (let c = 0; c < craters; c++) {
    const cx = 8 + rnd() * (w - 16), cy = 8 + rnd() * (h - 16), r = 3 + rnd() * 6;
    if (Math.hypot(cx - spawn.x, cy - spawn.y) < r + 12) continue;     // ninguno sobre la base
    for (let y = Math.max(0, Math.floor(cy - r - 2)); y < Math.min(h, Math.ceil(cy + r + 2)); y++)
      for (let x = Math.max(0, Math.floor(cx - r - 2)); x < Math.min(w, Math.ceil(cx + r + 2)); x++) {
        const t = Math.hypot(x - cx, y - cy) / r;
        if (t < 1) height[y * w + x] -= (1 - t * t) * .2;
        else if (t < 1.25) height[y * w + x] += (1 - (t - 1) / .25) * .07;
      }
  }

  // 3) explanada plana alrededor de la base
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.hypot(x - spawn.x, y - spawn.y), k = smooth(clamp(1 - d / 10, 0, 1));
    if (k > 0) height[y * w + x] = lerp(height[y * w + x], .5, k);
  }

  // 4) tipo de terreno según altura y humedad (hielo en las zonas húmedas medias)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, hh = height[i], m = fbm(x / 16, y / 16, seed + 777, 4);
    let t = T.DUST;
    if (hh < .15) t = T.CANYON;
    else if (hh > .72) t = T.MESA;
    else if (hh > .62) t = T.ROCK;
    else if (hh > .3 && m > .64 && Math.hypot(x - spawn.x, y - spawn.y) > 7) t = T.ICE;
    type[i] = t;
  }

  // 5) garantiza hielo cerca de la base (para el pozo de agua)
  let nearIce = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (type[y * w + x] === T.ICE && Math.hypot(x - spawn.x, y - spawn.y) < 30) nearIce++;
  if (nearIce < 14) {
    const ix = spawn.x + 16, iy = spawn.y - 11;
    for (let y = iy - 4; y <= iy + 4; y++) for (let x = ix - 4; x <= ix + 4; x++)
      if (Math.hypot(x - ix, y - iy) <= 3.6 + hash2(x, y, seed) * .8) { type[y * w + x] = T.ICE; height[y * w + x] = .5; }
  }

  // 6) recursos: depósitos de hielo (agua) y de mineral
  const resources = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = type[y * w + x], j = hash2(x, y, seed + 5), far = Math.hypot(x - spawn.x, y - spawn.y);
    if (t === T.ICE && j < .06) resources.push({ kind: 'ice', x, y, amount: 400 + Math.floor(j * 8000) });
    else if ((t === T.ROCK || t === T.MESA) && far > 9 && j < .03) resources.push({ kind: 'ore', x, y, amount: 600 + Math.floor(j * 15000) });
  }

  return { seed, w, h, height, type, spawn, resources };
}

// --- consultas ---
export const inBounds = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
export const typeAt = (m, x, y) => inBounds(m, x, y) ? m.type[y * m.w + x] : T.CANYON;
export const isBuildable = (m, x, y) => inBounds(m, x, y) && TILE_INFO[m.type[y * m.w + x]].buildable;
export const isWalkable = (m, x, y) => inBounds(m, x, y) && TILE_INFO[m.type[y * m.w + x]].walkable;

// Ruido de valor con semilla (sin dependencias) y utilidades numéricas.

export function mulberry32(a) {                       // generador pseudoaleatorio con semilla
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const hash2 = (x, y, s) => {                   // hash determinista de una casilla -> [0,1)
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => t * t * (3 - 2 * t);

export function valueNoise(x, y, s) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = smooth(x - x0), fy = smooth(y - y0);
  const a = hash2(x0, y0, s), b = hash2(x0 + 1, y0, s), c = hash2(x0, y0 + 1, s), d = hash2(x0 + 1, y0 + 1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export function fbm(x, y, s, oct = 5) {               // varias capas de ruido: relieve natural
  let v = 0, amp = .5, f = 1, sum = 0;
  for (let i = 0; i < oct; i++) { v += valueNoise(x * f, y * f, s + i * 31) * amp; sum += amp; amp *= .5; f *= 2; }
  return v / sum;
}

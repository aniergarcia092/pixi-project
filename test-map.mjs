import { generateMap } from './src/mapgen.js';
const ch = ['#', '.', 'r', 'M', '~'];
for (const seed of [1, 7, 42, 2026]) {
  const m = generateMap({ seed });
  const c = [0, 0, 0, 0, 0]; m.type.forEach(t => c[t]++);
  const n = m.w * m.h;
  console.log('seed', seed, c.map(v => (v / n * 100).toFixed(0) + '%').join(' '), 'recursos', m.resources.length, 'hielo:', m.resources.filter(r => r.kind == 'ice').length);
  if (seed === 42) for (let y = 0; y < m.h; y += 3) console.log([...Array(m.w / 2)].map((_, x) => (x * 2 === m.spawn.x - m.spawn.x % 2 && y <= m.spawn.y && y + 3 > m.spawn.y) ? 'X' : ch[m.type[y * m.w + x * 2]]).join(''));
}

// Dibujo del mapa con PixiJS: el terreno se pinta una sola vez en bloques (chunks) y solo se muestran los que están en pantalla.

import { Container, Graphics } from 'pixi.js';
import { TILE, CHUNK, T, TILE_INFO } from '../nucleo/config.js';
import { hash2 } from '../nucleo/noise.js';
import { inBounds } from './mapgen.js';

const shade = (c, k) => {                                   // oscurece (k<1) o aclara (k>1) un color 0xRRGGBB
  const r = Math.min(255, ((c >> 16) & 255) * k) | 0, g = Math.min(255, ((c >> 8) & 255) * k) | 0, b = Math.min(255, (c & 255) * k) | 0;
  return (r << 16) | (g << 8) | b;
};

export class MapView {
  constructor(map) {
    this.map = map;
    this.container = new Container();
    this.terrain = new Container();
    this.resLayer = new Container();
    this.grid = new Graphics();
    this.hl = new Graphics();
    this.container.addChild(this.terrain, this.grid, this.resLayer, this.hl);
    this.chunks = [];
    this.resGfx = [];
    this.buildChunks();
    this.buildResources();
    this.buildGrid();
    this.grid.visible = false;
  }

  // ---- terreno ----
  buildChunks() {
    const { w, h } = this.map;
    for (let cy = 0; cy < Math.ceil(h / CHUNK); cy++) for (let cx = 0; cx < Math.ceil(w / CHUNK); cx++) {
      const x0 = cx * CHUNK, y0 = cy * CHUNK, x1 = Math.min(w, x0 + CHUNK), y1 = Math.min(h, y0 + CHUNK);
      const g = new Graphics();
      this.drawChunk(g, x0, y0, x1, y1);
      this.terrain.addChild(g);
      this.chunks.push({ g, x: x0 * TILE, y: y0 * TILE, w: (x1 - x0) * TILE, h: (y1 - y0) * TILE });
    }
  }

  drawChunk(g, x0, y0, x1, y1) {
    const { w, h, type, height, seed } = this.map;
    const isType = (x, y, t) => !inBounds(this.map, x, y) ? t === T.CANYON : type[y * w + x] === t;
    const edge = (px, py, tx, ty, test, size, color, alpha) => {    // franja en cada lado cuyo vecino cumple "test"
      if (test(tx, ty - 1)) g.rect(px, py, TILE, size).fill({ color, alpha });
      if (test(tx, ty + 1)) g.rect(px, py + TILE - size, TILE, size).fill({ color, alpha });
      if (test(tx - 1, ty)) g.rect(px, py, size, TILE).fill({ color, alpha });
      if (test(tx + 1, ty)) g.rect(px + TILE - size, py, size, TILE).fill({ color, alpha });
    };
    // 1) color de cada casilla (según tipo, altura y un poco de variación)
    for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) {
      const i = ty * w + tx, t = type[i], j = hash2(tx, ty, seed + 3);
      const k = .86 + height[i] * .24 + (j - .5) * .07;
      g.rect(tx * TILE, ty * TILE, TILE + 1, TILE + 1).fill(shade(TILE_INFO[t].color, k));
    }
    // 2) bordes y decoración
    for (let ty = y0; ty < y1; ty++) for (let tx = x0; tx < x1; tx++) {
      const i = ty * w + tx, t = type[i], px = tx * TILE, py = ty * TILE, base = TILE_INFO[t].color, j = hash2(tx, ty, seed + 9);
      if (t !== T.CANYON) edge(px, py, tx, ty, (x, y) => isType(x, y, T.CANYON), 7, 0x000000, .4);       // sombra junto al cañón
      if (t === T.ICE) edge(px, py, tx, ty, (x, y) => !isType(x, y, T.ICE), 3, 0xffffff, .4);              // brillo en el borde del hielo
      if ((t === T.DUST || t === T.ROCK) && j < .1) {                                                      // piedras sueltas
        const rx = px + 10 + hash2(tx, ty, 11) * 44, ry = py + 10 + hash2(tx, ty, 13) * 44, r = 3 + hash2(tx, ty, 17) * 5;
        g.circle(rx + 1.5, ry + 2.5, r).fill({ color: 0x000000, alpha: .25 });
        g.circle(rx, ry, r).fill(shade(base, .62));
        g.circle(rx - r * .3, ry - r * .3, r * .45).fill({ color: 0xffffff, alpha: .12 });
      }
    }
  }

  // ---- recursos (hielo y mineral) ----
  buildResources() {
    for (const r of this.map.resources) {
      const g = new Graphics(), cx = (r.x + .5) * TILE, cy = (r.y + .5) * TILE;
      if (r.kind === 'ice') {
        g.poly([cx - 12, cy + 12, cx - 4, cy - 14, cx + 3, cy + 12]).fill(0xcdf1ff).stroke({ width: 2, color: 0x3f9fd0 });
        g.poly([cx - 2, cy + 14, cx + 8, cy - 20, cx + 17, cy + 14]).fill(0xeaf9ff).stroke({ width: 2, color: 0x3f9fd0 });
        g.poly([cx + 10, cy + 14, cx + 16, cy - 2, cx + 22, cy + 14]).fill(0xb4e6fb).stroke({ width: 2, color: 0x3f9fd0 });
      } else {
        const hex = []; for (let a = 0; a < 6; a++) hex.push(cx + Math.cos(a * 1.0472 + .5) * 19, cy + Math.sin(a * 1.0472 + .5) * 17);
        g.poly(hex).fill(0x353a45).stroke({ width: 3, color: 0x14171c });
        g.circle(cx - 6, cy - 4, 3.2).fill(0xffc83a); g.circle(cx + 6, cy + 2, 2.6).fill(0xffe28a); g.circle(cx - 2, cy + 8, 2.2).fill(0xffc83a);
      }
      this.resLayer.addChild(g);
      this.resGfx.push({ g, x: cx, y: cy });
    }
  }

  // ---- cuadrícula (se activa con G) ----
  buildGrid() {
    const { w, h } = this.map, g = this.grid;
    for (let x = 0; x <= w; x++) g.moveTo(x * TILE, 0).lineTo(x * TILE, h * TILE);
    for (let y = 0; y <= h; y++) g.moveTo(0, y * TILE).lineTo(w * TILE, y * TILE);
    g.stroke({ width: 1, color: 0xffffff, alpha: .12, pixelLine: true });
  }

  setHover(tx, ty) {                                          // resalta la casilla bajo el cursor
    this.hl.clear();
    if (!inBounds(this.map, tx, ty)) return;
    this.hl.rect(tx * TILE, ty * TILE, TILE, TILE).fill({ color: 0xffffff, alpha: .12 }).stroke({ width: 3, color: 0xffffff, alpha: .9 });
  }

  cull(v) {                                                   // v = {left, top, right, bottom} en coordenadas del mundo
    for (const c of this.chunks) c.g.visible = !(c.x > v.right || c.x + c.w < v.left || c.y > v.bottom || c.y + c.h < v.top);
    for (const r of this.resGfx) r.g.visible = !(r.x - 40 > v.right || r.x + 40 < v.left || r.y - 40 > v.bottom || r.y + 40 < v.top);
  }

  destroy() { this.container.destroy({ children: true }); }
}

// Niebla de guerra: las zonas no exploradas están en sombra. El rover ilumina a su alrededor al moverse y cada edificio
// ilumina su zona (con una onda de luz que crece) cuando termina de construirse. Lo explorado queda iluminado.

import { Sprite, Texture } from 'pixi.js';
import { TILE } from '../nucleo/config.js';
import { clamp, smooth } from '../nucleo/noise.js';

const OSCURIDAD = .82;                // opacidad de la sombra en lo no explorado
const VISION_ROVER = 7;               // casillas que ilumina el rover
const VISION_BASE = 5;                // casillas que ilumina un edificio
const VISION = { radar: 14, torreta: 8 };   // edificios que ven más lejos
const T_LUZ = 1.2;                    // segundos que tarda en expandirse la luz de un edificio nuevo

export class Niebla {
  constructor(map) {
    this.w = map.w; this.h = map.h;
    this.luz = new Float32Array(this.w * this.h);                 // 0 = oscuro · 1 = iluminado (por casilla)
    this.canvas = document.createElement('canvas');               // 1 píxel por casilla; Pixi lo estira suavizando los bordes
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(this.w, this.h);
    for (let i = 0; i < this.w * this.h; i++) { this.img.data[i * 4] = 8; this.img.data[i * 4 + 1] = 5; this.img.data[i * 4 + 2] = 14; }
    this.texture = Texture.from(this.canvas);
    this.sprite = new Sprite(this.texture);
    this.sprite.width = this.w * TILE; this.sprite.height = this.h * TILE;
    this.sprite.eventMode = 'none';
    this.reveals = [];                                            // ondas de luz en expansión
    this.dirty = true;
    this.revelar(map.spawn.x + .5, map.spawn.y + .5, 10);         // la zona de aterrizaje empieza iluminada
    this.redibujar();
  }

  revelar(cx, cy, r) {                                            // ilumina un círculo (cx, cy, r en casillas) con borde suave
    const x0 = Math.max(0, Math.floor(cx - r - 3)), x1 = Math.min(this.w - 1, Math.ceil(cx + r + 3));
    const y0 = Math.max(0, Math.floor(cy - r - 3)), y1 = Math.min(this.h - 1, Math.ceil(cy + r + 3));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const v = smooth(clamp((r - Math.hypot(x + .5 - cx, y + .5 - cy)) / 2.5, 0, 1)), i = y * this.w + x;
      if (v > this.luz[i]) { this.luz[i] = v; this.dirty = true; }
    }
  }

  redibujar() {
    const d = this.img.data;
    for (let i = 0; i < this.luz.length; i++) d[i * 4 + 3] = Math.round((1 - this.luz[i]) * OSCURIDAD * 255);
    this.ctx.putImageData(this.img, 0, 0);
    this.texture.source.update();
    this.dirty = false;
  }

  update(dtMs, rover, edificios) {
    const dt = Math.min(dtMs, 100) / 1000;
    if (rover) this.revelar(rover.x / TILE, rover.y / TILE, VISION_ROVER);
    for (const e of edificios) if (!(e.construccion > 0) && !e.luminado) {     // recién terminado: lanza su onda de luz
      e.luminado = true;
      this.reveals.push({ cx: e.x + e.def.w / 2, cy: e.y + e.def.h / 2, r: (VISION[e.def.id] || VISION_BASE) + e.def.w / 2, t: 0 });
    }
    for (const v of this.reveals) {
      v.t += dt;
      const k = Math.min(1, v.t / T_LUZ);
      this.revelar(v.cx, v.cy, v.r * (1 - Math.pow(1 - k, 3)));
    }
    this.reveals = this.reveals.filter(v => v.t < T_LUZ);
    if (this.dirty) this.redibujar();
  }

  destroy() { this.sprite.destroy({ texture: true, textureSource: true }); }
}

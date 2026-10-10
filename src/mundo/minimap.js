// Minimapa en un <canvas> normal del DOM: muestra el terreno, los recursos y el rectángulo de la cámara. Click/arrastre para saltar. M = mostrar / ocultar.

import { TILE_INFO } from '../nucleo/config.js';

const hex = c => '#' + c.toString(16).padStart(6, '0');

export class Minimap {
  constructor(onJump) {
    this.el = document.createElement('canvas'); this.el.id = 'minimap';
    Object.assign(this.el.style, { border: '2px solid #6b4a3a', borderRadius: '10px', boxShadow: '0 4px 16px rgba(0,0,0,.6)', background: '#120a0b' });
    document.body.appendChild(this.el);
    this.ctx = this.el.getContext('2d');
    this.base = document.createElement('canvas');
    const jump = e => { if (!(e.buttons & 1)) return; const r = this.el.getBoundingClientRect(); onJump((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); };
    this.el.addEventListener('pointerdown', jump); this.el.addEventListener('pointermove', jump);
    this.visible = true;
    window.addEventListener('keydown', e => { if (e.code === 'KeyM' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) this.alternar(); });   // M = mostrar / ocultar
  }

  alternar() { this.visible = !this.visible; this.el.style.display = this.visible ? 'block' : 'none'; }

  setMap(map) {
    const S = 2, b = this.base, c = b.getContext('2d');
    b.width = this.el.width = map.w * S; b.height = this.el.height = map.h * S;
    this.el.style.width = map.w * S + 'px'; this.el.style.height = map.h * S + 'px';
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const i = y * map.w + x; c.fillStyle = hex(TILE_INFO[map.type[i]].color); c.fillRect(x * S, y * S, S, S);
    }
    for (const r of map.resources) { c.fillStyle = r.kind === 'ice' ? '#ffffff' : '#ffc83a'; c.fillRect(r.x * S, r.y * S, S, S); }
    c.strokeStyle = '#00ff88'; c.lineWidth = 2; c.strokeRect(map.spawn.x * S - 4, map.spawn.y * S - 4, 8, 8);   // zona de aterrizaje
  }

  draw(v, mapPx, niebla) {                            // v = rectángulo visible de la cámara; mapPx = tamaño del mapa en píxeles del mundo
    if (!this.visible) return;
    const W = this.el.width, H = this.el.height, ctx = this.ctx;
    ctx.drawImage(this.base, 0, 0);
    if (niebla) ctx.drawImage(niebla.canvas, 0, 0, W, H);   // lo no explorado también se ve oscuro en el minimapa
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.strokeRect(v.left / mapPx.w * W, v.top / mapPx.h * H, (v.right - v.left) / mapPx.w * W, (v.bottom - v.top) / mapPx.h * H);
  }
}

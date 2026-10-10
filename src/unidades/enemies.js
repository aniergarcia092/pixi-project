// Enemigos: aparecen por los bordes del mapa y van a atacar lo más cercano: edificios, tanques o mechas.
// Las torretas les disparan y las bahías de reparación curan los edificios cercanos.

import { Container, Graphics } from 'pixi.js';
import { TILE } from '../nucleo/config.js';
import { mult } from '../edificios/economia.js';
import { sfx } from '../audio/sonido.js';

const PRIMERA_OLA = 45;        // segundos hasta que aparece el primero
const CADA = 25;               // segundos entre enemigos
const MAX = 8;                 // enemigos a la vez
const VIDA_ENEMIGO = 60;
const VEL = 45;                // píxeles por segundo
const DANO_ENEMIGO = 10;       // daño por segundo a un edificio
const DANO_A_UNIDADES = 14;    // daño por segundo a un tanque o un mecha
const RADIO_UNIDAD = 16;       // tamaño aproximado de una unidad (para saber cuándo la alcanza)
const VIDA_EDIFICIO = 100;
const ALCANCE_TORRETA = 6 * TILE, DANO_TORRETA = 40;
const GIRO_TORRETA = 6;      // radianes por segundo que gira la cabeza de la torreta
const ALCANCE_REPARA = 6 * TILE, CURA = 8;

const vidaMax = e => e.def.vida || VIDA_EDIFICIO;
const centro = e => ({ x: (e.x + e.def.w / 2) * TILE, y: (e.y + e.def.h / 2) * TILE });

export class Enemigos {
  constructor({ map, builder }) {
    this.map = map; this.builder = builder;
    this.lista = [];
    this.t = PRIMERA_OLA;
    this.container = new Container();
    this.g = new Graphics();
    this.container.addChild(this.g);
  }

  aparecer() {
    const W = this.map.w * TILE, H = this.map.h * TILE, lado = Math.floor(Math.random() * 4), a = Math.random();
    const x = lado === 0 ? a * W : lado === 1 ? W : lado === 2 ? a * W : 0;
    const y = lado === 0 ? 0 : lado === 1 ? a * H : lado === 2 ? H : a * H;
    sfx.play('alarma');
    this.lista.push({ x, y, vida: VIDA_ENEMIGO, fase: Math.random() * 6 });
  }

  update(dtMs) {
    const dt = Math.min(dtMs, 100) / 1000, es = this.builder.edificios, g = this.g.clear();
    for (const e of es) if (e.vida === undefined) e.vida = vidaMax(e);

    if (es.length) {                                  // sin edificios no hay nada que atacar: no aparecen
      this.t -= dt;
      if (this.t <= 0) { this.t = CADA; if (this.lista.length < MAX) this.aparecer(); }
    }

    // reparación
    for (const r of es) if (r.def.id === 'reparacion' && !r.construccion) {
      const c = centro(r);
      for (const e of es) {
        if (e.vida >= vidaMax(e)) continue;
        const p = centro(e);
        if (Math.hypot(p.x - c.x, p.y - c.y) <= ALCANCE_REPARA) {
          e.vida = Math.min(vidaMax(e), e.vida + CURA * mult(r) * dt);
          g.moveTo(c.x, c.y).lineTo(p.x, p.y).stroke({ width: 2, color: 0x5dff8a, alpha: .6 });
        }
      }
    }

    // torretas: la cabeza gira hacia el enemigo más cercano (y barre despacio cuando no hay ninguno)
    for (const t of es) if (t.def.id === 'torreta' && !t.construccion) {
      const c = centro(t); let mejor = null, md = ALCANCE_TORRETA;
      for (const en of this.lista) { const d = Math.hypot(en.x - c.x, en.y - c.y); if (d <= md) { md = d; mejor = en; } }
      if (t.ang === undefined) t.ang = Math.PI / 2;
      const cb = t.dib.cabeza;
      let retroceso = 0;
      if (mejor) {
        const obj = Math.atan2(mejor.y - c.y, mejor.x - c.x), d = Math.atan2(Math.sin(obj - t.ang), Math.cos(obj - t.ang));
        t.ang += Math.max(-GIRO_TORRETA * dt, Math.min(GIRO_TORRETA * dt, d));
        if (Math.abs(d) < .25) {                        // ya apunta: dispara
          mejor.vida -= DANO_TORRETA * mult(t) * dt; sfx.play('laser');
          const mx = c.x + Math.cos(t.ang) * 37, my = c.y + Math.sin(t.ang) * 37;
          g.moveTo(mx, my).lineTo(mejor.x, mejor.y).stroke({ width: 3, color: 0xffe36b, alpha: .9 });
          g.circle(mx, my, 6 + 3 * Math.random()).fill({ color: 0xfff3b0, alpha: .9 });
          retroceso = 1.6 * Math.abs(Math.sin(performance.now() / 45));
        }
      } else t.ang += .6 * dt;
      if (cb) { cb.rotation = t.ang; cb.position.set(32 - Math.cos(t.ang) * retroceso, 32 - Math.sin(t.ang) * retroceso); }
    }
    const antes = this.lista.length;
    this.lista = this.lista.filter(en => en.vida > 0);
    if (this.lista.length < antes) sfx.play('muerte');

    // movimiento y ataque: cada enemigo va a por lo más cercano, sea un edificio o una unidad (tanque / mecha)
    const unidades = [...(this.tanques ? this.tanques.lista : []), ...(this.mechas ? this.mechas.lista : [])].filter(u => u.vida > 0 && !u.saliendo);
    for (const en of this.lista) {
      let obj = null, p = null, r = 0, md = Infinity, mejor = Infinity, esUnidad = false;   // mejor = distancia al borde del objetivo
      for (const e of es) { const c = centro(e), d = Math.hypot(c.x - en.x, c.y - en.y), rr = e.def.w * TILE / 2; if (d - rr < mejor) { mejor = d - rr; md = d; obj = e; p = c; r = rr; esUnidad = false; } }
      for (const u of unidades) { const d = Math.hypot(u.x - en.x, u.y - en.y); if (d - RADIO_UNIDAD < mejor) { mejor = d - RADIO_UNIDAD; md = d; obj = u; p = u; r = RADIO_UNIDAD; esUnidad = true; } }
      if (!obj) continue;
      const cerca = r + 14;
      if (md > cerca) { en.x += (p.x - en.x) / md * VEL * dt; en.y += (p.y - en.y) / md * VEL * dt; }
      else {
        sfx.play('golpe');
        g.moveTo(en.x, en.y).lineTo(p.x, p.y).stroke({ width: 2, color: 0xff4a5a, alpha: .8 });
        if (esUnidad) {
          if (obj.tipo) this.tanques.recibir(obj, DANO_A_UNIDADES * dt);     // los tanques tienen escudo: lo gasta primero
          else this.mechas.recibir(obj, DANO_A_UNIDADES * dt);
        } else {
          obj.vida -= DANO_ENEMIGO * dt;
          if (obj.vida <= 0) this.builder.quitar(obj);
        }
      }
    }

    // dibujo
    for (const en of this.lista) {
      en.fase += dt * 8;
      for (let i = 0; i < 6; i++) {                   // patas
        const a = i * Math.PI / 3 + Math.sin(en.fase + i) * .2;
        g.moveTo(en.x, en.y).lineTo(en.x + Math.cos(a) * 18, en.y + Math.sin(a) * 18).stroke({ width: 3, color: 0x14171c });
      }
      g.circle(en.x, en.y, 11).fill(0xb03040).stroke({ width: 2.5, color: 0x14171c });
      g.circle(en.x - 3, en.y - 3, 3).fill(0xffc83a);
      g.rect(en.x - 12, en.y - 20, 24, 4).fill(0x14171c);
      g.rect(en.x - 12, en.y - 20, 24 * en.vida / VIDA_ENEMIGO, 4).fill(0xff6b6b);
    }
    for (const e of this.builder.edificios) if (e.vida < vidaMax(e)) {   // barra de vida de edificios dañados
      const x = e.x * TILE, y = e.y * TILE - 8, w = e.def.w * TILE;
      g.rect(x, y, w, 5).fill(0x14171c);
      g.rect(x, y, w * Math.max(0, e.vida) / vidaMax(e), 5).fill(e.vida / vidaMax(e) > .4 ? 0x5dff8a : 0xff6b6b);
    }
  }

  destroy() { this.container.destroy({ children: true }); }
}

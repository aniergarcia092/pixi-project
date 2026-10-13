// El constructor: muestra un "fantasma" del edificio bajo el cursor (verde = se puede, rojo = no) y lo coloca al hacer clic.
//   Clic izquierdo = construir · Clic derecho o Esc = cancelar (arrastrar sigue moviendo la cámara)

import { Container, Graphics } from 'pixi.js';
import { TILE, TILE_INFO } from '../nucleo/config.js';
import { inBounds } from '../mundo/mapgen.js';
import { clamp } from '../nucleo/noise.js';
import { EDIFICIOS, crearDibujo } from './buildings.js';
import { sfx } from '../audio/sonido.js';

// ¿el rectángulo toca el círculo c = {x, y, r}? (se busca el punto del rectángulo más cercano al centro del círculo)
const rectTocaCirculo = (rx, ry, rw, rh, c) => {
  const nx = clamp(c.x, rx, rx + rw), ny = clamp(c.y, ry, ry + rh);
  return Math.hypot(c.x - nx, c.y - ny) < c.r;
};

export class Builder {
  constructor({ map, camera, canvas, naveCirculos, economia, getRover, mensaje, alCancelar }) {
    this.map = map; this.camera = camera; this.canvas = canvas;
    this.naveCirculos = naveCirculos;                 // círculos de la nave (no se construye encima)
    this.economia = economia;                         // para cobrar y registrar los edificios
    this.getRover = getRover;                         // función que devuelve el rover (o null)
    this.mensaje = mensaje;                           // función para mostrar un texto en el menú
    this.alCancelar = alCancelar;                     // se llama al cancelar con clic derecho / Esc
    this.resAt = new Map(map.resources.map(r => [r.y * map.w + r.x, r]));

    this.container = new Container();                 // aquí viven los edificios ya construidos
    this.ghost = new Container();                     // el fantasma va encima de todo
    this.ghost.visible = false;
    this.overlay = new Graphics();                    // el recuadro verde / rojo
    this.cables = new Graphics();                     // los cables van por debajo de los edificios
    this.obras = new Graphics();                      // barras de progreso de construcción
    this.selG = new Graphics();                       // recuadro del edificio seleccionado
    this.zona = new Graphics();                       // zona de construcción 3x3 alrededor del rover
    this.container.addChild(this.cables, this.ghost, this.obras, this.selG, this.zona);
    this.sel = null;                                  // edificio seleccionado (para el panel de información)

    this.def = null;                                  // edificio elegido (null = ninguno)
    this.edificios = [];                              // los ya construidos: { def, x, y }
    this.ocup = new Set();                            // casillas ocupadas por edificios
    this.sx = -1; this.sy = -1;                       // última posición del cursor en pantalla
    this.down = null;
    this.ultimoMsg = null;

    this.onMove = e => { this.sx = e.clientX; this.sy = e.clientY; };
    this.onDown = e => { this.down = { x: e.clientX, y: e.clientY }; };
    this.onUp = e => {                                // solo cuenta como "clic" si el ratón casi no se movió (si no, era un arrastre)
      const d = this.down; this.down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
      if (this.def) { if (e.button === 0) this.colocar(); else if (e.button === 2) this.alCancelar(); }
      else if (e.button === 0) { this.sel = this.edificioEn(e.clientX, e.clientY); if (this.sel) sfx.play('click'); }   // clic en un edificio = seleccionarlo (o nada = soltar)
      else if (e.button === 2) this.sel = null;
    };
    this.onKey = e => { if (e.code === 'Escape') { if (this.def) this.alCancelar(); else this.sel = null; } };
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerup', this.onUp);
    window.addEventListener('keydown', this.onKey);
  }

  edificioEn(sx, sy) {                                // el edificio bajo un punto de la pantalla (o null)
    const p = this.camera.screenToWorld(sx, sy), tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    return this.edificios.find(e => tx >= e.x && tx < e.x + e.def.w && ty >= e.y && ty < e.y + e.def.h) || null;
  }

  zona3() {                                           // casilla de arriba a la izquierda de la zona 3x3 centrada en el rover
    const rv = this.getRover();
    return { x: Math.floor(rv.x / TILE) - 1, y: Math.floor(rv.y / TILE) - 1 };
  }

  dibujarZona() {
    const g = this.zona.clear(), rv = this.getRover();
    if (!rv || rv.state !== 'libre') return;
    const z = this.zona3(), a = this.def ? 1 : .45, px = z.x * TILE, py = z.y * TILE;
    g.rect(px, py, 3 * TILE, 3 * TILE).fill({ color: 0xffc83a, alpha: .08 * a });
    for (let i = 1; i < 3; i++) g.moveTo(px + i * TILE, py).lineTo(px + i * TILE, py + 3 * TILE).moveTo(px, py + i * TILE).lineTo(px + 3 * TILE, py + i * TILE);
    g.stroke({ width: 1.5, color: 0xffc83a, alpha: .3 * a });
    g.rect(px, py, 3 * TILE, 3 * TILE).stroke({ width: 3, color: 0xffc83a, alpha: (.55 + .3 * Math.sin(performance.now() / 300)) * a });
  }

  ocupado(tx, ty) { return this.ocup.has(ty * this.map.w + tx); }

  quitar(e) {                                         // destruye un edificio (lo llaman los enemigos)
    sfx.play('destruido');
    if (this.sel === e) this.sel = null;
    this.edificios = this.edificios.filter(o => o !== e);
    for (let ty = e.y; ty < e.y + e.def.h; ty++) for (let tx = e.x; tx < e.x + e.def.w; tx++) this.ocup.delete(ty * this.map.w + tx);
    e.dib.destroy({ children: true });
    this.economia.quitar(e);
  }

  seleccionar(id) {                                   // elige qué edificio construir (null = ninguno)
    const antes = this.def;
    this.def = id ? EDIFICIOS[id] : null;
    if (id) { this.sel = null; sfx.play('click'); } else if (antes) sfx.play('cancelar');
    for (const c of this.ghost.removeChildren()) c.destroy();
    if (this.def) {
      const dib = crearDibujo(this.def);
      dib.alpha = .7;
      this.overlay = new Graphics();
      this.ghost.addChild(dib, this.overlay);
    } else this.decir('');
  }

  decir(txt) { if (txt !== this.ultimoMsg) { this.ultimoMsg = txt; this.mensaje(txt); } }

  // Devuelve por qué NO se puede construir en (x0, y0), o null si se puede.
  motivoInvalido(def, x0, y0) {
    const rv0 = this.getRover();
    if (!rv0 || rv0.state !== 'libre') return 'Espera a que el rover salga de la nave';
    const z = this.zona3();                           // el edificio debe tocar la zona 3x3 (un 2x2 puede quedar en el borde)
    if (!(x0 < z.x + 3 && x0 + def.w > z.x && y0 < z.y + 3 && y0 + def.h > z.y)) return 'Fuera de la zona de construcción del rover';
    for (let ty = y0; ty < y0 + def.h; ty++) for (let tx = x0; tx < x0 + def.w; tx++) {
      if (!inBounds(this.map, tx, ty)) return 'Fuera del mapa';
      if (!TILE_INFO[this.map.type[ty * this.map.w + tx]].buildable) return 'Aquí no se puede construir';
      if (this.ocupado(tx, ty)) return 'Ya hay un edificio';
      const r = this.resAt.get(ty * this.map.w + tx);
      if (def.sobre === 'ore') { if (!r || r.kind !== 'ore') return 'El minero va sobre un depósito de mineral'; }
      else if (def.sobre === 'ice') { if (!r || r.kind !== 'ice') return 'El pozo de agua va sobre un depósito de hielo'; }
      else if (r) return 'Hay un depósito de recursos aquí';
      for (const c of this.naveCirculos) if (rectTocaCirculo(tx * TILE, ty * TILE, TILE, TILE, c)) return 'Demasiado cerca de la nave';
    }
    const rv = this.getRover();
    if (rv && rectTocaCirculo(x0 * TILE, y0 * TILE, def.w * TILE, def.h * TILE, { x: rv.x, y: rv.y, r: 32 })) return 'El rover está en medio';
    if (!this.economia.puedePagar(def)) return `Faltan ${Math.ceil(def.costo - this.economia.mineral)} de mineral`;
    return null;
  }

  // Casilla de arriba a la izquierda que corresponde al cursor (el edificio queda centrado bajo el cursor)
  esquina() {
    const p = this.camera.screenToWorld(this.sx, this.sy);
    return { x0: Math.round(p.x / TILE - this.def.w / 2), y0: Math.round(p.y / TILE - this.def.h / 2) };
  }

colocar() {
    if (this.sx < 0) return;
    const { x0, y0 } = this.esquina();
    if (this.motivoInvalido(this.def, x0, y0)) { sfx.play('error'); return; }
    sfx.play('construir');
    const dib = crearDibujo(this.def);
    dib.position.set(x0 * TILE, y0 * TILE);
    this.container.addChildAt(dib, 1);                // encima de los cables, debajo del fantasma
    this.economia.pagar(this.def);
    const e = { def: this.def, x: x0, y: y0, dib, res: this.resAt.get(y0 * this.map.w + x0), construccion: this.def.tiempo || 0, owner: 'player' };
    dib.alpha = .45;                                  // semitransparente mientras se construye
    this.edificios.push(e);                           // entra en la economía al terminar (ver avanzarObras)
    for (let ty = y0; ty < y0 + this.def.h; ty++) for (let tx = x0; tx < x0 + this.def.w; tx++) this.ocup.add(ty * this.map.w + tx);
  }

  avanzarObras(dtMs) {                                // los edificios en construcción avanzan; al terminar entran en la economía
    const dt = Math.min(dtMs, 100) / 1000, g = this.obras.clear();
    for (const e of this.edificios) {
      if (!(e.construccion > 0)) continue;
      e.construccion -= dt;
      const x = e.x * TILE, y = (e.y + e.def.h) * TILE - 8, w = e.def.w * TILE;
      if (e.construccion <= 0) {
        e.construccion = 0; e.dib.alpha = 1; sfx.play('terminado');
        this.economia.anadir(e);
        this.economia.recalcular();                   // ahora sí se tienden los cables solos
      } else {
        g.rect(x, y, w, 6).fill(0x14171c);
        g.rect(x, y, w * (1 - e.construccion / e.def.tiempo), 6).fill(0xffc83a);
      }
    }
    for (const e of this.edificios) if (e.sinEnergia && !(e.construccion > 0)) {   // rayo rojo parpadeante: extractor sin energía
      const cx = (e.x + e.def.w / 2) * TILE, cy = (e.y + e.def.h / 2) * TILE, a = .6 + .4 * Math.sin(performance.now() / 250);
      g.circle(cx, cy, 12).fill({ color: 0x14171c, alpha: .7 * a });
      g.poly([cx + 3, cy - 9, cx - 5, cy + 1, cx - 1, cy + 1, cx - 3, cy + 9, cx + 5, cy - 1, cx + 1, cy - 1]).fill({ color: 0xff4a5a, alpha: a });
    }
  }

  update(dtMs) {                                          // se llama en cada fotograma: mueve y colorea el fantasma
    this.avanzarObras(dtMs);
    this.dibujarCables();
    this.dibujarZona();
    const sg = this.selG.clear();
    if (this.sel) sg.rect(this.sel.x * TILE, this.sel.y * TILE, this.sel.def.w * TILE, this.sel.def.h * TILE).stroke({ width: 3, color: 0xffc83a, alpha: .6 + .4 * Math.sin(performance.now() / 200) });
    if (!this.def || this.sx < 0) { this.ghost.visible = false; return; }
    const { x0, y0 } = this.esquina(), motivo = this.motivoInvalido(this.def, x0, y0), c = motivo ? 0xff4455 : 0x44ff88;
    this.ghost.visible = true;
    this.ghost.position.set(x0 * TILE, y0 * TILE);
    this.overlay.clear().rect(0, 0, this.def.w * TILE, this.def.h * TILE).fill({ color: c, alpha: .28 }).stroke({ width: 3, color: c, alpha: .9 });
    this.decir(motivo || 'Clic: construir · Clic derecho / Esc: cancelar');
  }

  dibujarCables() {                                   // cables en "L" entre los centros; amarillos con energía, grises sin ella
    const g = this.cables.clear(), lista = this.economia.cables;
    if (!lista.length) return;
    const trazar = sel => {
      let n = 0;
      for (const c of lista) if (sel(c)) {
        const ax = (c.a.x + c.a.def.w / 2) * TILE, ay = (c.a.y + c.a.def.h / 2) * TILE;
        const bx = (c.b.x + c.b.def.w / 2) * TILE, by = (c.b.y + c.b.def.h / 2) * TILE;
        g.moveTo(ax, ay).lineTo(bx, ay).lineTo(bx, by); n++;
      }
      return n;
    };
    const est = { cap: 'round', join: 'round' };
    if (trazar(() => true)) g.stroke({ width: 10, color: 0x14171c, ...est });
    if (trazar(c => !c.red.activa)) g.stroke({ width: 5, color: 0x6b7684, ...est });
    if (trazar(c => c.red.activa)) g.stroke({ width: 5, color: 0xffc83a, ...est });
  }

  destroy() {
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    this.container.destroy({ children: true });
  }
}

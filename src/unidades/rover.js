// El rover: se dibuja desde arriba con Graphics. Sale por la escotilla de la nave y después se maneja con WASD / flechas. Choca con el cañón, la nave y los recursos.

import { Container, Graphics } from 'pixi.js';
import { TILE } from '../nucleo/config.js';
import { isWalkable } from '../mundo/mapgen.js';
import { clamp } from '../nucleo/noise.js';
import { sfx } from '../audio/sonido.js';

// Secuencia de salida (milisegundos, una fase detrás de otra)
const T_ESCOTILLA = 700;                      // 1) se abre la escotilla
const T_RAMPA = 500;                          // 2) se extiende la rampa
const T_SUBIDA = 600;                         // 3) el rover sube desde dentro de la nave
const T_SALIDA = 1500;                        // 4) baja por la rampa y se aleja
const T_CIERRE = 800;                         // 5) ya libre, la rampa se guarda y la escotilla se cierra
const SALIDA_PX = 150;                        // cuánto se aleja de la nave al salir

const VEL = 260;                              // velocidad normal (píxeles del mundo por segundo)
const VEL_RAPIDA = 480;                       // velocidad con Shift
const GIRO = 8;                               // lo rápido que gira hacia donde va (radianes por segundo)
const RADIO = 24;                             // "tamaño" del rover para chocar con el terreno (cañón)
const MULT_RUEDAS = 1.5;                      // la mejora de ruedas grandes multiplica la velocidad
const RADIO_OBJ = 28;                         // "tamaño" del rover para chocar con la nave y los recursos (círculos)

export class Rover {
  constructor(x, y, map, ship, obstaculos = [], ocupado = () => false) {
    this.ocupado = ocupado;                    // (tx, ty) → ¿hay un edificio en esa casilla?              // (x, y) = centro de la nave; map = el mapa; ship = la nave (para abrir su escotilla)
    this.map = map; this.ship = ship;
    this.obstaculos = obstaculos;             // lista de círculos {x, y, r} que no se pueden atravesar
    this.x = x; this.y = y;
    this.a = Math.PI / 2;                     // hacia dónde mira: 0 = derecha, PI/2 = abajo, PI = izquierda, -PI/2 = arriba
    this.state = 'saliendo';                  // 'saliendo' → 'libre'
    this.t = 0; this.cierre = 0; this.snd = {}; this.paso = 0;
    this.trasera = 'normal'; this.kGrande = 0;   // ruedas de atrás: 'normal' (pequeñas) → 'ninguna' (soltadas) → 'grande'
    this.ruedasGrandes = false; this.inst = null; this.restos = [];
    const hx = x + (ship ? ship.hx : 0), hy = y + (ship ? ship.hy : 0);   // sale por la escotilla (abajo a la derecha de la nave)
    this.x = hx; this.y = hy;
    this.from = { x: hx, y: hy }; this.to = { x: hx, y: hy + SALIDA_PX };

    this.container = new Container();
    this.container.addChild(this.draw());
    this.container.visible = false;           // al principio está dentro de la nave, no se ve
    this.sync();

    // Teclado: guardamos qué teclas están pulsadas ahora mismo
    this.keys = new Set();
    this.onKeyDown = e => this.keys.add(e.code);
    this.onKeyUp = e => this.keys.delete(e.code);
    this.onBlur = () => this.keys.clear();    // si la ventana pierde el foco, soltamos todas las teclas
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  draw() {                                    // dibujado mirando hacia ARRIBA; luego se rota con this.a
    const c = new Container(), g = new Graphics(), L = 0x14171c;
    this.ruedasG = new Graphics();             // las 6 ruedas se repintan al rodar (ver pintarRuedas)
    this.rodado = 0; this.px = this.x; this.py = this.y;
    this.pintarRuedas();

    g.roundRect(-18, -30, 36, 60, 9).fill(0xdfe6ee).stroke({ width: 3, color: L });     // carrocería
    g.roundRect(-14, -27, 28, 14, 5).fill(0xb9c3cf);                                    // capó
    g.roundRect(-14, -32, 8, 4, 2).fill(0xfff1a0).stroke({ width: 1.5, color: L });     // faros
    g.roundRect(6, -32, 8, 4, 2).fill(0xfff1a0).stroke({ width: 1.5, color: L });
    g.rect(-18, 2, 36, 4).fill(0xff9a2e);                                               // franja naranja
    g.circle(0, -8, 11).fill(0x3d8fd1).stroke({ width: 2.5, color: L });                // cúpula
    g.circle(-3, -11, 3.5).fill({ color: 0xffffff, alpha: .55 });                       // brillo de la cúpula
    g.roundRect(-13, 10, 26, 15, 3).fill(0x1f4f9a).stroke({ width: 2, color: L });      // panel solar trasero
    g.moveTo(-4.3, 10).lineTo(-4.3, 25).moveTo(4.3, 10).lineTo(4.3, 25).moveTo(-13, 17.5).lineTo(13, 17.5).stroke({ width: 1, color: 0x0e2a55 });
    g.rect(-16, 27, 6, 2.5).fill(0xff4a5a); g.rect(10, 27, 6, 2.5).fill(0xff4a5a);      // luces traseras
    g.circle(13, -16, 2.5).fill(0x59616d).stroke({ width: 1.5, color: L });             // antena
    g.moveTo(13, -16).lineTo(16, -25).stroke({ width: 1.5, color: L });
    g.circle(16, -25, 1.8).fill(0xff4a5a);
    c.addChild(this.ruedasG, g);
    return c;
  }

  pintarRuedas() {                            // 3 ruedas por lado: las bandas del dibujo avanzan con la distancia recorrida, así se ve que giran
    const w = this.ruedasG.clear(), L = 0x14171c, off = (this.rodado % 20 + 20) % 20;
    for (const cx of [-23, 23]) for (const cy of [-23, 0, 23]) {
      if (cy === 23 && this.trasera !== 'normal') continue;     // las ruedas traseras pequeñas se han soltado
      w.roundRect(cx - 6, cy - 10, 12, 20, 4).fill(0x20262e).stroke({ width: 2, color: L });
      for (let k = 0; k < 4; k++) {
        const y = -10 + ((k * 5 + off) % 20);
        if (y >= -9 && y <= 7) w.rect(cx - 5, cy + y, 10, 2.2).fill(0x5a6370);
      }
      w.rect(cx - 1, cy - 8, 2, 16).fill({ color: 0xffffff, alpha: .08 });
    }
    if (this.trasera === 'grande') {                 // 2 ruedas grandes atrás: entran deslizándose desde los lados
      const kk = this.kGrande, offG = (this.rodado % 28 + 28) % 28;
      for (const sx of [-1, 1]) {
        const cx = sx * (25 + 16 * (1 - kk)), cy = 24;
        w.rect(sx * 17 - 1, cy - 3, 2, 6).fill(0x59616d);                       // eje
        w.roundRect(cx - 8, cy - 14, 16, 28, 5).fill(0x20262e).stroke({ width: 2.5, color: L });
        for (let j = 0; j < 4; j++) {
          const y = -14 + ((j * 7 + offG) % 28);
          if (y >= -13 && y <= 9.5) w.rect(cx - 7, cy + y, 14, 3.5).fill(0x6a7482);
        }
        w.rect(cx - 2, cy - 12, 4, 24).fill({ color: 0xff9a2e, alpha: .55 });
      }
    }
  }

  instalarRuedas() {                               // se sueltan las 2 ruedas traseras pequeñas y se acoplan las 2 grandes
    if (this.inst || this.ruedasGrandes) return;
    this.inst = { t: 0, acople: false };
    this.trasera = 'ninguna'; this.kGrande = 0;
    sfx.play('desacople');
    const par = this.container.parent, r = this.container.rotation, c = Math.cos(r), s = Math.sin(r);
    if (par) for (const sx of [-1, 1]) {             // las ruedas viejas ruedan por el suelo y se desvanecen
      const g = new Graphics();
      g.roundRect(-6, -10, 12, 20, 4).fill(0x20262e).stroke({ width: 2, color: 0x14171c });
      for (let y = -8; y < 6; y += 5) g.rect(-5, y, 10, 2.2).fill(0x5a6370);
      const lx = sx * 23, ly = 23;
      g.position.set(this.x + lx * c - ly * s, this.y + lx * s + ly * c); g.rotation = r;
      const v = 70 + Math.random() * 30;
      par.addChild(g);
      this.restos.push({ g, vx: (sx * c + .5 * -s) * v, vy: (sx * s + .5 * c) * v, w: sx * (2 + Math.random() * 2), t: 0 });
    }
    this.pintarRuedas();
  }

  animarInstalacion(dt) {
    const i = this.inst; if (!i) return;
    i.t += dt;
    if (i.t >= .5 && !i.acople) { i.acople = true; this.trasera = 'grande'; sfx.play('acople'); }
    this.kGrande = clamp((i.t - .5) / .8, 0, 1);
    if (i.t >= 1.4) { this.inst = null; this.ruedasGrandes = true; this.kGrande = 1; sfx.play('mejora'); }
    this.pintarRuedas();
  }

  animarRestos(dt) {
    for (const q of this.restos) {
      q.t += dt; q.g.x += q.vx * dt; q.g.y += q.vy * dt; q.g.rotation += q.w * dt;
      const f = Math.exp(-dt * 1.5); q.vx *= f; q.vy *= f; q.w *= f;
      q.g.alpha = 1 - clamp((q.t - 1.5) / 1.5, 0, 1);
    }
    for (const q of this.restos) if (q.t >= 3) q.g.destroy();
    this.restos = this.restos.filter(q => q.t < 3);
  }

  sync() {                                    // pasa los datos al dibujo de Pixi
    this.container.position.set(this.x, this.y);
    this.container.rotation = this.a + Math.PI / 2;     // el dibujo mira hacia arriba, por eso se suma PI/2
  }

  // ¿Puede el rover estar con su centro en (x, y)? Miramos las 4 esquinas de su "caja" de tamaño RADIO.
  libreEn(x, y) {
    for (const [dx, dy] of [[-RADIO, -RADIO], [RADIO, -RADIO], [-RADIO, RADIO], [RADIO, RADIO]])
    {
      const tx = Math.floor((x + dx) / TILE), ty = Math.floor((y + dy) / TILE);
      if (!isWalkable(this.map, tx, ty) || this.ocupado(tx, ty)) return false;
    }
    for (const o of this.obstaculos)                       // ¿choca con la nave o con un recurso? (distancia entre centros < suma de radios)
      if (Math.hypot(x - o.x, y - o.y) < o.r + RADIO_OBJ) return false;
    return true;
  }

  // Gira el ángulo this.a hacia "objetivo" por el camino más corto, como máximo "paso" radianes
  girarHacia(objetivo, paso) {
    let d = objetivo - this.a;
    d = Math.atan2(Math.sin(d), Math.cos(d));           // lleva la diferencia al rango -PI..PI (el camino corto)
    this.a += clamp(d, -paso, paso);
  }

  conducir(dtMs) {
    const k = this.keys;
    let dx = 0, dy = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) dx--;
    if (k.has('KeyD') || k.has('ArrowRight')) dx++;
    if (k.has('KeyW') || k.has('ArrowUp')) dy--;
    if (k.has('KeyS') || k.has('ArrowDown')) dy++;
    if (!dx && !dy) return;                              // sin teclas: se queda quieto

    const dt = Math.min(dtMs, 50) / 1000;                // segundos (con tope por si el juego se traba un momento)
    const n = Math.hypot(dx, dy);                        // para que ir en diagonal no sea más rápido
    dx /= n; dy /= n;

    this.girarHacia(Math.atan2(dy, dx), GIRO * dt);      // gira poco a poco hacia donde quiere ir

    const vel = ((k.has('ShiftLeft') || k.has('ShiftRight')) ? VEL_RAPIDA : VEL) * (this.ruedasGrandes ? MULT_RUEDAS : 1);
    const nx = this.x + dx * vel * dt, ny = this.y + dy * vel * dt;
    // Probamos cada eje por separado: así, si choca con un cañón, se desliza por el borde en vez de pararse en seco.
    if (this.libreEn(nx, this.y)) this.x = nx;
    if (this.libreEn(this.x, ny)) this.y = ny;
  }

  una(k) { if (!this.snd[k]) { this.snd[k] = true; sfx.play(k); } }        // suena una sola vez

  update(dtMs) {
    const ease = p => 1 - Math.pow(1 - p, 2);                           // arranca rápido y frena al final
    if (this.state === 'saliendo') {
      this.t += dtMs;
      const t = this.t;
      const t1 = T_ESCOTILLA + T_RAMPA, t2 = t1 + T_SUBIDA;             // instantes donde empiezan las fases 3 y 4
      const abierta = clamp(t / T_ESCOTILLA, 0, 1);
      const rampa = clamp((t - T_ESCOTILLA) / T_RAMPA, 0, 1);
      const subida = clamp((t - t1) / T_SUBIDA, 0, 1);
      const salida = clamp((t - t2) / T_SALIDA, 0, 1), e = ease(salida);
      if (this.ship) this.ship.setHatch(abierta, rampa);
      this.una('escotilla');
      if (t >= T_ESCOTILLA) this.una('rampa');
      if (t >= t1) this.una('rover_arranca');
      if (t >= t2 && salida < 1) { this.paso += dtMs; if (this.paso > 220) { this.paso = 0; sfx.play('orugas'); } }   // las orugas ruedan por la rampa

      this.container.visible = t >= t1;                                 // aparece cuando la escotilla y la rampa ya están abiertas
      this.container.alpha = Math.min(1, subida * 3);
      this.container.scale.set(.5 + .4 * ease(subida) + .1 * e);        // sube del hueco: pequeño → casi normal → normal
      this.x = this.from.x + (this.to.x - this.from.x) * e;             // en la fase 4 baja por la rampa
      this.y = this.from.y + (this.to.y - this.from.y) * e;
      if (t >= t2 + T_SALIDA) this.state = 'libre';
    } else if (this.state === 'libre') {
      this.conducir(dtMs);                                              // ya se puede manejar
      if (this.ship && this.cierre < T_CIERRE) {                        // mientras tanto la nave se cierra sola
        this.cierre += dtMs;
        const k = clamp(this.cierre / T_CIERRE, 0, 1);
        this.una('rampa_guarda'); if (k >= .5) this.una('escotilla_cierra');
        this.ship.setHatch(1 - clamp(k * 2 - 1, 0, 1), 1 - clamp(k * 2, 0, 1));   // 1ª mitad: rampa; 2ª mitad: escotilla
      }
    }
    const mv = Math.hypot(this.x - this.px, this.y - this.py);       // las ruedas giran según lo que avanza
    this.px = this.x; this.py = this.y;
    if (mv > .01) { this.rodado += mv; this.pintarRuedas(); }
    this.animarInstalacion(Math.min(dtMs, 100) / 1000);
    this.animarRestos(Math.min(dtMs, 100) / 1000);
    this.sync();
  }

  destroy() {
    for (const q of this.restos) q.g.destroy();
    window.removeEventListener('keydown', this.onKeyDown);              // importante: quitar los oyentes al borrar el rover
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.container.destroy({ children: true });
  }
}

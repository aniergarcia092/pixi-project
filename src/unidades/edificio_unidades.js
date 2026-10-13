// Edificios de unidades y las unidades que fabrican, todo junto:
//   · Cuartel → fabrica tanques espaciales (Comet, Plasma Sniper, Artillería Pesada) desde su panel de información.
//   · Fábrica de mechas → fabrica mechas cangrejo solos (hasta 4).
//   · Clases Tanques y Mechas: mueven, apuntan y disparan a los enemigos. main.js las crea y las actualiza cada fotograma.

import { Container, Graphics } from 'pixi.js';
import { TILE } from '../nucleo/config.js';
import { isWalkable } from '../mundo/mapgen.js';
import { sfx } from '../audio/sonido.js';

const L = 0x14171c;                                   // color de los contornos
const RADIO_PATRULLA = 3 * TILE;                      // las unidades patrullan a esta distancia de su edificio
const RADIO_DEFENSA = 10 * TILE;                      // y persiguen enemigos a esta distancia de él

// ================= EDIFICIOS (dibujo y definición; buildings.js los importa) =================

function crearCuartel() {                             // 2x2 · cuartel · con puerta de garaje y luces animadas (las mueve Tanques.animarCuartel)
  const c = new Container(), g = new Graphics();
  g.roundRect(6, 6, 116, 116, 10).fill(0x59616d).stroke({ width: 3, color: L });    // base
  g.roundRect(16, 16, 96, 72, 6).fill(0x7a4a3a).stroke({ width: 3, color: L });     // tejado
  for (const y of [28, 40, 52, 64, 76]) g.moveTo(18, y).lineTo(110, y);             // tejas
  g.stroke({ width: 1.5, color: 0x5a3426, alpha: .8 });
  g.rect(16, 16, 96, 5).fill(0xffc83a);                                             // franja amarilla
  for (let x = 20; x < 108; x += 16) g.poly([x, 16, x + 8, 16, x + 4, 21]).fill(L); // dientes de la franja
  g.circle(64, 42, 12).fill(0xffc83a).stroke({ width: 2.5, color: L });             // emblema
  g.circle(64, 42, 5).fill(0x7a4a3a).stroke({ width: 1.5, color: L });
  for (const x of [24, 90]) {                                                       // respiraderos del tejado
    g.roundRect(x, 62, 14, 12, 2).fill(0x2b3440).stroke({ width: 2, color: L });
    g.moveTo(x + 3, 66).lineTo(x + 11, 66).moveTo(x + 3, 70).lineTo(x + 11, 70).stroke({ width: 1.5, color: 0x59616d });
  }
  g.rect(16, 88, 96, 28).fill(0x474f5b).stroke({ width: 2.5, color: L });          // fachada
  for (const x of [18, 98]) g.roundRect(x, 92, 12, 8, 2).fill(0x3d8fd1).stroke({ width: 2, color: L });   // ventanas
  g.rect(40, 90, 48, 28).fill(0x2b3440).stroke({ width: 2.5, color: L });          // marco del garaje
  g.rect(43, 93, 42, 22).fill(0x0c0e11);                                           // interior oscuro
  g.moveTo(52, 115).lineTo(52, 100).moveTo(76, 115).lineTo(76, 100).stroke({ width: 1.5, color: 0x3a414b });   // guías del suelo
  g.rect(34, 118, 60, 4).fill(0xffc83a);                                           // rampa
  for (let x = 36; x < 92; x += 12) g.poly([x, 118, x + 6, 118, x + 3, 122, x - 3, 122]).fill(L);
  const puerta = new Graphics();                                                    // persiana que sube y baja
  const luz = new Graphics();                                                       // luces a los lados de la puerta
  c.addChild(g, puerta, luz);
  c.puerta = puerta; c.luz = luz;
  return c;
}

function dibujarMecha(g) {                            // 2x2 · fábrica de mechas
  g.roundRect(6, 6, 116, 116, 12).fill(0x59616d).stroke({ width: 3, color: L });    // base
  g.rect(16, 14, 96, 6).fill(0xff4a5a); g.rect(16, 108, 96, 6).fill(0xff4a5a);      // franjas rojas
  g.roundRect(18, 28, 92, 72, 8).fill(0x3a414b).stroke({ width: 3, color: L });     // nave
  g.rect(40, 74, 48, 26).fill(0x2b3440).stroke({ width: 2.5, color: L });           // portón
  g.circle(64, 50, 14).fill(0x8d99a8).stroke({ width: 3, color: L });               // engranaje
  g.circle(64, 50, 6).fill(0xffc83a).stroke({ width: 2, color: L });
  g.circle(28, 40, 4).fill(0x5dff8a); g.circle(100, 40, 4).fill(0x5dff8a);          // luces
}

export const DEF_CUARTEL = { id: 'cuartel', nombre: 'Cuartel', cat: 'base', icono: '🏠', tecla: '5', code: 'Digit5', costo: 200, tiempo: 20, w: 2, h: 2, crear: crearCuartel,
  descripcion: 'Aloja y organiza a las unidades. Selecciónalo para fabricar tanques: Comet, Plasma Sniper y Artillería Pesada (hasta 8). Admite una cola de hasta 5 pedidos.' };

export const DEF_MECHA = { id: 'mecha', nombre: 'Fábrica de mechas', cat: 'defensa', icono: '🤖', tecla: 'C', code: 'KeyC', costo: 500, tiempo: 35, w: 2, h: 2, dibujar: dibujarMecha,
  descripcion: 'Fabrica un mecha cangrejo cada 30 s (cuesta 80 de mineral, hasta 4). Patrullan alrededor de la fábrica y atacan a los enemigos a menos de 10 casillas. No consume energía.' };

// ================= MECHAS =================

const CADA = 30;                   // segundos por mecha
const MAX_MECHAS = 4;                     // mechas por fábrica
const COSTE = 80;                  // mineral por mecha
const VIDA_MECHA = 150;            // vida de cada mecha
const VEL = 70;                    // píxeles por segundo
const ALCANCE = 70, DANO = 30;     // alcance del disparo y daño por segundo

export class Mechas {
  constructor({ builder, economia, enemigos, baseEnemiga }) {
    this.builder = builder; this.economia = economia; this.enemigos = enemigos;
    this.baseEnemiga = baseEnemiga;
    this.lista = [];               // { x, y, dest, owner }
    this.container = new Container();
    this.g = new Graphics();
    this.container.addChild(this.g);
  }

  update(dtMs) {
    const dt = Math.min(dtMs, 100) / 1000, g = this.g.clear(), es = this.builder.edificios;
    this.lista = this.lista.filter(m => {                            // si la fábrica cae o el mecha muere, desaparece
      if (m.vida <= 0) { sfx.play('destruido'); return false; }
      return es.includes(m.owner);
    });
    for (const f of es) if (f.def.id === 'mecha' && !f.construccion) {
      const n = this.lista.filter(m => m.owner === f).length;
      f.t = f.t === undefined ? CADA : f.t;
      if (n < MAX_MECHAS && this.economia.mineral >= COSTE) {
        f.t -= dt;
        if (f.t <= 0) {
          f.t = CADA; this.economia.mineral -= COSTE; sfx.play('mecha');
          this.lista.push({ x: (f.x + f.def.w / 2) * TILE, y: (f.y + f.def.h + .5) * TILE, dest: null, owner: f, fase: 0, vida: VIDA_MECHA, golpe: 0 });
        }
      }
    }
    for (const m of this.lista) {
      const f = m.owner, fx = (f.x + f.def.w / 2) * TILE, fy = (f.y + f.def.h / 2) * TILE;
      let objetivo = null, md = Infinity;
      for (const en of this.enemigos.lista) {
        if (Math.hypot(en.x - fx, en.y - fy) > RADIO_DEFENSA) continue;
        const d = Math.hypot(en.x - m.x, en.y - m.y); if (d < md) { md = d; objetivo = en; }
      }
      // También considerar el núcleo de la base enemiga
      if (this.baseEnemiga && this.baseEnemiga.nucleo && this.baseEnemiga.nucleo.vida > 0) {
        const core = this.baseEnemiga.nucleo;
        const d = Math.hypot(core.x * TILE - m.x, core.y * TILE - m.y);
        if (d <= RADIO_DEFENSA && d < md) {
          md = d;
          objetivo = { x: core.x * TILE, y: core.y * TILE, vida: core.vida, esNucleo: true };
        }
      }
      let tx, ty;
      if (objetivo) { tx = objetivo.x; ty = objetivo.y; }
      else {
        if (!m.dest || Math.hypot(m.dest.x - m.x, m.dest.y - m.y) < 8) {
          const a = Math.random() * 6.283, r = RADIO_PATRULLA * (.5 + Math.random() * .5);
          m.dest = { x: fx + Math.cos(a) * r, y: fy + Math.sin(a) * r };
        }
        tx = m.dest.x; ty = m.dest.y;
      }
      const d = Math.hypot(tx - m.x, ty - m.y);
      m.ang = d > 1 ? Math.atan2(ty - m.y, tx - m.x) : (m.ang || 0);
      if (objetivo && d <= ALCANCE) {
        if (objetivo.esNucleo && this.baseEnemiga && this.baseEnemiga.nucleo) {
          this.baseEnemiga.recibirDanoNucleo(DANO * dt);
        } else {
          objetivo.vida -= DANO * dt;
        }
        sfx.play('laser2');
        g.moveTo(m.x, m.y).lineTo(objetivo.x, objetivo.y).stroke({ width: 3, color: 0x5fd0ff, alpha: .9 });
      } else if (d > 4) { m.x += (tx - m.x) / d * VEL * dt; m.y += (ty - m.y) / d * VEL * dt; m.fase += dt * 10; }
    }
    for (const m of this.lista) {                    // dibujo: cangrejo con pinzas
      m.golpe = Math.max(0, m.golpe - dt);
      const c = Math.cos(m.ang || 0), s = Math.sin(m.ang || 0), pat = Math.sin(m.fase) * 3;
      for (const k of [-1, 1]) {
        g.moveTo(m.x, m.y).lineTo(m.x + c * 12 - s * 14 * k, m.y + s * 12 + c * 14 * k + pat).stroke({ width: 3, color: 0x14171c });
        g.circle(m.x + c * 14 - s * 14 * k, m.y + s * 14 + c * 14 * k, 4).fill(0xff9a2e).stroke({ width: 1.5, color: 0x14171c });
      }
      g.roundRect(m.x - 11, m.y - 11, 22, 22, 6).fill(m.golpe > 0 ? 0xff9a9a : 0x8d99a8).stroke({ width: 2.5, color: 0x14171c });
      g.circle(m.x + c * 5, m.y + s * 5, 4).fill(0xffc83a).stroke({ width: 1.5, color: 0x14171c });
      if (m.vida < VIDA_MECHA) {                     // barra de vida si está dañado
        g.rect(m.x - 14, m.y - 26, 28, 4).fill(0x14171c);
        g.rect(m.x - 14, m.y - 26, 28 * Math.max(0, m.vida) / VIDA_MECHA, 4).fill(0x5dff8a);
      }
    }
  }

  recibir(m, dano) { m.vida -= dano; m.golpe = .15; }   // lo llaman los enemigos

  destroy() { this.container.destroy({ children: true }); }
}

// ================= TANQUES =================

// vel = multiplicador de velocidad · dano = daño por disparo · cd = segundos entre disparos · rango en píxeles del mundo
// escudoEspera = segundos sin recibir daño antes de recargar el escudo · escudoRecarga = escudo que recupera por segundo
// retro = retroceso del cañón al disparar · barra = altura de la barra de vida · tiro = duración del trazo (s) · pista = [medio largo, y, alto] de las orugas
export const TIPOS = {
  comet:  { nombre: 'Comet', vida: 435, escudo: 0, vel: 1, dano: 50, cd: 1, rango: 150, coste: 100, tiempo: 20,
            largo: 30, cuerpo: 0x8d99a8, acento: 0xffc83a, color: 0xffe36b, sonido: 'canon', retro: 4, barra: 26, tiro: .1, pista: [18, 9, 8] },
  pesada: { nombre: 'Artillería Pesada', vida: 700, escudo: 0, vel: .69, dano: 155, cd: 2.01, rango: 320, coste: 300, tiempo: 40,
            largo: 56, cuerpo: 0x7b8594, acento: 0xff9a2e, color: 0xff9a2e, sonido: 'canon', retro: 9, barra: 34, tiro: .2, pista: [24, 12, 10] },
  sniper: { nombre: 'Plasma Sniper', vida: 450, escudo: 120, vel: .8, dano: 55, cd: 2.15, rango: 300, coste: 180, tiempo: 30,
            largo: 42, cuerpo: 0x9a8fd0, acento: 0x5fd0ff, color: 0x5fd0ff, sonido: 'laser2', retro: 5, barra: 28, tiro: .16, pista: [20, 9, 8], escudoEspera: 4, escudoRecarga: 30 },
};

const VEL_BASE = 90;               // píxeles por segundo con vel = 1
export const MAX_TANQUES = 8;      // tanques a la vez (contando los que están en producción o en cola)
export const MAX_COLA = 5;         // pedidos que caben en la cola de cada cuartel
const GIRO_CASCO = 4, GIRO_TORRE = 7;   // radianes por segundo

const girar = (a, objetivo, paso) => {                  // gira el ángulo a hacia objetivo por el camino corto, como mucho "paso"
  const d = Math.atan2(Math.sin(objetivo - a), Math.cos(objetivo - a));
  return a + Math.max(-paso, Math.min(paso, d));
};

function dibujarTanque(id) {                             // devuelve las piezas: orugas (se redibujan al moverse), casco, torre (gira), cañón (retrocede) y bobina (solo el sniper)
  const T = TIPOS[id], c = new Container(), orugas = new Graphics(), casco = new Graphics(), torre = new Container();
  const canon = new Graphics(), tapa = new Graphics(), bobina = new Graphics();
  if (id === 'comet') {                                  // ligero y rápido: casco en cuña
    casco.poly([-16, -9, 9, -9, 18, -4, 18, 4, 9, 9, -16, 9]).fill(T.cuerpo).stroke({ width: 3, color: L });
    casco.rect(-14, -2.5, 16, 5).fill(T.acento);
    casco.rect(-17, -6, 3, 12).fill(0x2a2f38);                                             // motor
    casco.circle(16, -3, 1.8).fill(0xffffff); casco.circle(16, 3, 1.8).fill(0xffffff);      // faros
    canon.rect(5, -2, T.largo - 7, 4).fill(0x3a414b).stroke({ width: 2, color: L });
    canon.rect(T.largo - 5, -3.2, 5, 6.4).fill(0x14171c);
    tapa.circle(0, 0, 8.5).fill(0xcfd6df).stroke({ width: 2.5, color: L });
    tapa.circle(0, 0, 3.5).fill(T.acento);
  } else if (id === 'pesada') {                          // pesado: casco ancho, torreta hexagonal y cañón con freno de boca
    casco.roundRect(-23, -14, 46, 28, 4).fill(T.cuerpo).stroke({ width: 3, color: L });
    casco.rect(-23, -14, 11, 28).fill(0x5d6674);
    for (const y of [-8, -3, 2, 7]) casco.moveTo(-21, y).lineTo(-14, y);
    casco.stroke({ width: 1.5, color: 0x2a2f38 });                                          // rejilla del motor
    casco.rect(14, -11, 6, 22).fill(T.acento);                                              // blindaje delantero
    canon.rect(8, -4, T.largo - 18, 8).fill(0x3a414b).stroke({ width: 2, color: L });
    canon.rect(T.largo - 12, -6, 12, 12).fill(0x2a2f38).stroke({ width: 2, color: L });     // freno de boca
    canon.rect(T.largo - 9, -6, 2, 12).fill(0x14171c); canon.rect(T.largo - 5, -6, 2, 12).fill(0x14171c);
    canon.rect(26, -5, 3, 10).fill(T.acento);
    const hex = []; for (let k = 0; k < 6; k++) hex.push(Math.cos(k * Math.PI / 3) * 13, Math.sin(k * Math.PI / 3) * 13);
    tapa.poly(hex).fill(0xcfd6df).stroke({ width: 2.5, color: L });
    tapa.circle(0, 0, 5).fill(T.acento).stroke({ width: 1.5, color: L });
  } else {                                               // sniper: casco aerodinámico, cañón largo con bobinas de plasma
    casco.poly([-19, -10, 8, -10, 19, -5, 19, 5, 8, 10, -19, 10]).fill(T.cuerpo).stroke({ width: 3, color: L });
    casco.rect(-13, -8, 20, 2).fill(T.acento); casco.rect(-13, 6, 20, 2).fill(T.acento);   // franjas de energía
    casco.roundRect(-17, -4, 8, 8, 2).fill(0x2a2f38);
    canon.rect(4, -1.8, T.largo - 6, 3.6).fill(0x3a414b).stroke({ width: 2, color: L });
    for (const x of [14, 22, 30]) canon.rect(x, -4.5, 3, 9).fill(T.acento).stroke({ width: 1.5, color: L });
    canon.circle(T.largo, 0, 3).fill(T.acento).stroke({ width: 1.5, color: L });
    tapa.roundRect(-9, -7, 18, 14, 5).fill(0xcfd6df).stroke({ width: 2.5, color: L });
    tapa.circle(0, 0, 3.5).fill(T.acento);
  }
  torre.addChild(canon, bobina, tapa);
  c.addChild(orugas, casco, torre);
  return { c, torre, canon, casco, orugas, bobina };
}

// ================= RUTAS (A*) =================

// Camino por casillas desde (x0, y0) hasta (x1, y1) esquivando edificios y terreno no transitable.
// Devuelve una lista de puntos {x, y} en píxeles (vacía si ya está allí) o null si no hay camino. suave = false deja el camino casilla a casilla.
function buscarRuta(tq, x0, y0, x1, y1, suave = true) {
  const map = tq.map, W = map.w, H = map.h;
  const libre = (tx, ty) => tx >= 0 && ty >= 0 && tx < W && ty < H && isWalkable(map, tx, ty) && !tq.builder.ocupado(tx, ty);
  const sx = Math.floor(x0 / TILE), sy = Math.floor(y0 / TILE);
  let gx = Math.floor(x1 / TILE), gy = Math.floor(y1 / TILE);
  if (!libre(gx, gy)) {                                   // destino bloqueado: se usa la casilla libre más cercana
    let mejor = null, md = Infinity;
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
      if (!libre(gx + dx, gy + dy)) continue;
      const d = dx * dx + dy * dy; if (d < md) { md = d; mejor = [gx + dx, gy + dy]; }
    }
    if (!mejor) return null;
    gx = mejor[0]; gy = mejor[1]; x1 = (gx + .5) * TILE; y1 = (gy + .5) * TILE;
  }
  const N = W * H, g = new Float32Array(N).fill(Infinity), padre = new Int32Array(N).fill(-1), cerrado = new Uint8Array(N);
  const abierto = [];                                     // montón binario de [prioridad, casilla]
  const meter = (f, i) => {
    abierto.push([f, i]); let k = abierto.length - 1;
    while (k > 0) { const p = (k - 1) >> 1; if (abierto[p][0] <= abierto[k][0]) break; [abierto[p], abierto[k]] = [abierto[k], abierto[p]]; k = p; }
  };
  const sacar = () => {
    const top = abierto[0], ult = abierto.pop();
    if (abierto.length) {
      abierto[0] = ult; let k = 0;
      for (;;) {
        const l = 2 * k + 1, r = l + 1; let m = k;
        if (l < abierto.length && abierto[l][0] < abierto[m][0]) m = l;
        if (r < abierto.length && abierto[r][0] < abierto[m][0]) m = r;
        if (m === k) break;
        [abierto[m], abierto[k]] = [abierto[k], abierto[m]]; k = m;
      }
    }
    return top;
  };
  const h = (tx, ty) => { const dx = Math.abs(tx - gx), dy = Math.abs(ty - gy); return Math.max(dx, dy) + .414 * Math.min(dx, dy); };
  const ini = sy * W + sx, meta = gy * W + gx;
  g[ini] = 0; meter(h(sx, sy), ini);
  let hallado = false;
  while (abierto.length) {
    const i = sacar()[1];
    if (cerrado[i]) continue;
    cerrado[i] = 1;
    if (i === meta) { hallado = true; break; }
    const cx = i % W, cy = (i / W) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (!libre(nx, ny)) continue;
      if (dx && dy && (!libre(cx + dx, cy) || !libre(cx, cy + dy))) continue;   // las diagonales no cortan esquinas
      const j = ny * W + nx; if (cerrado[j]) continue;
      const ng = g[i] + (dx && dy ? 1.414 : 1);
      if (ng < g[j]) { g[j] = ng; padre[j] = i; meter(ng + h(nx, ny), j); }
    }
  }
  if (!hallado) return null;
  const casillas = [];
  for (let i = meta; i !== -1; i = padre[i]) casillas.push({ x: ((i % W) + .5) * TILE, y: (((i / W) | 0) + .5) * TILE });
  casillas.reverse();
  casillas[casillas.length - 1] = { x: x1, y: y1 };       // el último punto es el destino exacto
  const pts = [{ x: x0, y: y0 }, ...casillas.slice(1)];
  if (casillas.length === 1) pts.push({ x: x1, y: y1 });
  if (!suave) return pts.slice(1);
  const visible = (a, b) => {                             // ¿se puede ir en línea recta de a a b?
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 16);
    for (let k = 1; k < n; k++) { const t = k / n; if (!libre(Math.floor((a.x + (b.x - a.x) * t) / TILE), Math.floor((a.y + (b.y - a.y) * t) / TILE))) return false; }
    return true;
  };
  const ruta = []; let i = 0;
  while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !visible(pts[i], pts[j])) j--; ruta.push(pts[j]); i = j; }
  return ruta;
}

export class Tanques {
  constructor({ map, builder, economia, enemigos, camera, canvas, baseEnemiga }) {
    this.map = map; this.builder = builder; this.economia = economia; this.enemigos = enemigos;
    this.baseEnemiga = baseEnemiga;
    this.lista = [];
    this.container = new Container();
    this.suelo = new Graphics();                         // polvo y humo (por debajo de los tanques)
    this.g = new Graphics();                             // disparos, escudos y barras de vida (por encima)
    this.container.addChild(this.suelo, this.g);

    // Selección y órdenes (como en Dota 2): clic izquierdo = seleccionar · Shift+clic = añadir/quitar · Shift+arrastrar = caja · clic derecho = mover o atacar
    this.camera = camera; this.canvas = canvas;
    this.sel = new Set();                                // tanques seleccionados
    this.pings = [];                                     // aros que se ven al dar una orden
    this.down = null; this.cur = null; this.defAlPulsar = false;
    this.onDown = e => { this.defAlPulsar = !!this.builder.def; this.down = { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey }; this.cur = { x: e.clientX, y: e.clientY }; };   // si estabas construyendo, el clic no cuenta
    this.onMove = e => { this.cur = { x: e.clientX, y: e.clientY }; };
    this.onUp = e => {
      const d = this.down; this.down = null;
      if (!d || this.defAlPulsar) return;
      const mov = Math.hypot(e.clientX - d.x, e.clientY - d.y);
      if (d.b === 0 && d.shift && mov > 6) this.seleccionarCaja(d.x, d.y, e.clientX, e.clientY);
      else if (mov <= 6 && d.b === 0) this.clic(e.clientX, e.clientY, d.shift);
      else if (mov <= 6 && d.b === 2) this.ordenar(e.clientX, e.clientY);
    };
    this.onKey = e => { if (e.code === 'Escape') this.sel.clear(); };
    if (canvas) {
      canvas.addEventListener('pointerdown', this.onDown);
      canvas.addEventListener('pointermove', this.onMove);
      canvas.addEventListener('pointerup', this.onUp);
    }
    window.addEventListener('keydown', this.onKey);
  }

  pendientes() {                                         // tanques que aún se están fabricando o esperan en cola
    let n = 0;
    for (const e of this.builder.edificios) { if (e.fab) n++; n += (e.cola || []).length; }
    return n;
  }

  puedeFabricar(tipo, cu) { return this.economia.mineral >= TIPOS[tipo].coste && this.lista.length + this.pendientes() < MAX_TANQUES && (!cu || (cu.cola || []).length < MAX_COLA); }

  fabricar(cu, tipo) {                                   // lo llama el botón del cuartel
    if (cu.construccion > 0) return;
    if (!this.puedeFabricar(tipo, cu)) { sfx.play('error'); return; }
    this.economia.mineral -= TIPOS[tipo].coste;           // se paga al hacer el pedido
    if (cu.fab) (cu.cola = cu.cola || []).push(tipo);     // si ya está fabricando, el pedido espera en la cola
    else cu.fab = { tipo, t: TIPOS[tipo].tiempo };
    sfx.play('click');
  }

  cancelar(cu) {                                         // quita el último pedido de la cola (o la fabricación en curso) y devuelve el mineral
    cu.cola = cu.cola || [];
    let tipo = null;
    if (cu.cola.length) tipo = cu.cola.pop();
    else if (cu.fab) { tipo = cu.fab.tipo; cu.fab = null; }
    if (tipo) { this.economia.mineral += TIPOS[tipo].coste; sfx.play('cancelar'); }
  }

  crear(cu, tipo, owner = 'player') {                                      // el tanque nace dentro del garaje y sale por la puerta (ver salir)
    const x = (cu.x + cu.def.w / 2) * TILE, yIni = (cu.y + cu.def.h) * TILE - 24, yFin = (cu.y + cu.def.h + .5) * TILE, d = dibujarTanque(tipo);
    d.c.alpha = 0;
    this.container.addChildAt(d.c, 1);                   // entre el suelo y los disparos
    const m = {
      tipo, x, y: yIni, vida: TIPOS[tipo].vida, escudo: TIPOS[tipo].escudo, ang: Math.PI / 2, torre: Math.PI / 2, cd: 0,
      home: { x: (cu.x + cu.def.w / 2) * TILE, y: (cu.y + cu.def.h / 2) * TILE }, dest: null, atasco: 0, tiro: null, c: d.c, gTorre: d.torre, casco: d.casco, canon: d.canon, orugas: d.orugas, bobina: d.bobina,
      fase: 0, retro: 0, golpe: 0, sinGolpe: 99, recargando: false, tpolvo: 0, polvo: [],
      ruta: null, destino: null, objetivo: null, quieto: false, reruta: 0,
      saliendo: cu, yIni, yFin,
      owner, // 'player' o 'enemigo'
    };
    cu.salida = m;                                       // mientras sale, la puerta se queda abierta
    this.lista.push(m);
  }

  salir(m, dt) {                                         // avanza hacia fuera sin chocar con el cuartel, apareciendo poco a poco
    const cu = m.saliendo;
    m.y = Math.min(m.yFin, m.y + 45 * dt);
    const p = (m.y - m.yIni) / (m.yFin - m.yIni);
    m.fase = (m.fase + 45 * dt) % 6; this.pintarOrugas(m);
    m.c.alpha = Math.min(1, p * 3); m.c.scale.set(.85 + .15 * Math.min(1, p * 2));
    m.c.position.set(m.x, m.y); m.c.rotation = m.ang; m.gTorre.rotation = m.torre - m.ang;
    if (p >= 1) { m.saliendo = null; cu.salida = null; m.c.alpha = 1; m.c.scale.set(1); }
  }

  animarCuartel(cu, dt) {                                // persiana y luces del cuartel
    const d = cu.dib; if (!d.puerta) return;
    const abrir = (cu.fab && cu.fab.t < 1.4) || cu.salida;                                 // se abre 1,4 s antes de que salga el tanque
    cu.puertaP = Math.max(0, Math.min(1, (cu.puertaP || 0) + (abrir ? 1 : -1) * dt / .6));   // tarda 0,6 s
    const h = 22 * (1 - cu.puertaP), p = d.puerta.clear();
    if (h > .5) {
      p.rect(43, 93, 42, h).fill(0x59616d);
      for (let y = 98; y < 93 + h; y += 5) p.moveTo(43, y).lineTo(85, y);
      p.stroke({ width: 1.2, color: 0x3a414b });
      p.rect(43, 93 + h - 3, 42, 3).fill(0xffc83a);
    }
    const t = performance.now();
    let col = 0x3a7d4c, a = .8;                                                            // verde = libre
    if (abrir) { col = 0xff4a5a; a = Math.sin(t / 110) > 0 ? 1 : .25; }                    // rojo parpadeante = puerta en movimiento
    else if (cu.fab) { col = 0xffc83a; a = .6 + .4 * Math.sin(t / 300); }                  // ámbar = fabricando
    const l = d.luz.clear();
    for (const x of [35, 93]) {
      l.circle(x, 106, 7).fill({ color: col, alpha: a * .25 });
      l.circle(x, 106, 3.5).fill({ color: col, alpha: a }).stroke({ width: 1.5, color: L });
    }
  }

  clic(sx, sy, shift) {                                  // clic izquierdo: selecciona el tanque bajo el cursor
    const p = this.camera.screenToWorld(sx, sy);
    let mejor = null, md = 28;
    for (const m of this.lista) { if (m.saliendo) continue; const d = Math.hypot(m.x - p.x, m.y - p.y); if (d < md) { md = d; mejor = m; } }
    if (mejor) {
      this.builder.sel = null;                           // se suelta el edificio seleccionado
      if (shift) { if (this.sel.has(mejor)) this.sel.delete(mejor); else this.sel.add(mejor); }
      else { this.sel.clear(); this.sel.add(mejor); }
      sfx.play('click');
    } else if (!shift) this.sel.clear();
  }

  seleccionarCaja(x0, y0, x1, y1) {                      // Shift + arrastrar: selecciona todos los tanques dentro de la caja
    const a = this.camera.screenToWorld(Math.min(x0, x1), Math.min(y0, y1)), b = this.camera.screenToWorld(Math.max(x0, x1), Math.max(y0, y1));
    this.sel.clear();
    for (const m of this.lista) if (!m.saliendo && m.x >= a.x && m.x <= b.x && m.y >= a.y && m.y <= b.y) this.sel.add(m);
    if (this.sel.size) { this.builder.sel = null; sfx.play('click'); }
  }

  ordenar(sx, sy) {                                      // clic derecho: los tanques seleccionados atacan al enemigo o van al punto
    if (!this.sel.size) return;
    const p = this.camera.screenToWorld(sx, sy), grupo = [...this.sel];
    let enemigo = null, md = 24;
    for (const en of this.enemigos.lista) { const d = Math.hypot(en.x - p.x, en.y - p.y); if (d < md) { md = d; enemigo = en; } }
    if (enemigo) {                                       // clic sobre un enemigo = atacarlo
      for (const m of grupo) { this.parar(m); m.objetivo = enemigo; m.quieto = false; }
      this.pings.push({ x: enemigo.x, y: enemigo.y, t: .6, color: 0xff4a5a });
      sfx.play('click'); return;
    }
    const n = grupo.length, cols = Math.ceil(Math.sqrt(n)), filas = Math.ceil(n / cols), sep = 46;   // formación en cuadrícula alrededor del punto
    let ok = 0;
    grupo.forEach((m, i) => {
      const x = p.x + ((i % cols) - (cols - 1) / 2) * sep, y = p.y + (Math.floor(i / cols) - (filas - 1) / 2) * sep;
      if (this.irA(m, x, y)) ok++;
    });
    this.pings.push({ x: p.x, y: p.y, t: .6, color: ok ? 0x5dff8a : 0xff4a5a });
    sfx.play(ok ? 'click' : 'error');
  }

  parar(m) { m.ruta = null; m.destino = null; m.objetivo = null; }

  llegar(m) {                                            // llegó (o no puede seguir): se queda quieto defendiendo ese sitio
    m.ruta = null; m.destino = null; m.home = { x: m.x, y: m.y }; m.quieto = true; m.dest = null;
  }

  irA(m, x, y) {
    this.parar(m);
    const ruta = buscarRuta(this, m.x, m.y, x, y);
    if (!ruta) return false;                             // no hay camino
    m.reruta = 0; m.quieto = false; m.dest = null;
    if (!ruta.length) { this.llegar(m); return true; }
    m.ruta = ruta; m.destino = ruta[ruta.length - 1];
    return true;
  }

  repetirRuta(m) {                                       // se atascó: busca otro camino casilla a casilla (máximo 3 veces) y si no, se rinde
    m.reruta = (m.reruta || 0) + 1;
    const d = m.destino, ruta = m.reruta <= 3 && d ? buscarRuta(this, m.x, m.y, d.x, d.y, false) : null;
    if (ruta && ruta.length) m.ruta = ruta; else this.llegar(m);
  }

  recibir(m, dano) {                                     // el escudo absorbe primero (para cuando los enemigos ataquen a los tanques)
    const e = Math.min(m.escudo, dano); m.escudo -= e; m.vida -= dano - e; m.golpe = .15; m.sinGolpe = 0;
  }

  pintarOrugas(m) {                                      // las marcas de las orugas avanzan con el tanque
    const [hl, y0, h] = TIPOS[m.tipo].pista, o = m.orugas.clear();
    for (const sy of [-(y0 + h), y0]) {
      o.roundRect(-hl, sy, hl * 2, h, 3).fill(0x2a2f38).stroke({ width: 2, color: L });
      for (let x = -hl + 3 + m.fase; x < hl - 2; x += 6) o.moveTo(x, sy + 1.5).lineTo(x, sy + h - 1.5);
    }
    o.stroke({ width: 1.5, color: 0x5a6472 });
  }

  mover(m, dx, dy) {                                     // avanza si la casilla es transitable y no hay edificio (cada eje por separado: se desliza)
    const ok = (x, y) => { const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE); return isWalkable(this.map, tx, ty) && !this.builder.ocupado(tx, ty); };
    let hecho = 0;
    if (ok(m.x + dx, m.y)) { m.x += dx; hecho += Math.abs(dx); }
    if (ok(m.x, m.y + dy)) { m.y += dy; hecho += Math.abs(dy); }
    return hecho;
  }

  update(dtMs) {
    const dt = Math.min(dtMs, 100) / 1000, g = this.g.clear(), sg = this.suelo.clear();
    for (const cu of this.builder.edificios) if (cu.fab) {          // producción en los cuarteles
      cu.fab.t -= dt;
      if (cu.fab.t <= 0) {
        this.crear(cu, cu.fab.tipo, cu.owner || 'player'); sfx.play('mecha');
        const sig = cu.cola && cu.cola.length ? cu.cola.shift() : null;      // pasa al siguiente pedido de la cola
        cu.fab = sig ? { tipo: sig, t: TIPOS[sig].tiempo } : null;
      }
    }
    const vivos = [];                                              // los tanques sin vida desaparecen
    for (const m of this.lista) {
      if (m.vida > 0) { vivos.push(m); continue; }
      if (m.saliendo) m.saliendo.salida = null;
      this.sel.delete(m);
      m.c.destroy({ children: true }); sfx.play('destruido');
    }
    this.lista = vivos;
    for (const cu of this.builder.edificios) if (cu.def.id === 'cuartel') this.animarCuartel(cu, dt);
    for (const m of this.lista) {
      if (m.saliendo) { this.salir(m, dt); continue; }              // saliendo del cuartel: aún no patrulla ni dispara
      const T = TIPOS[m.tipo];

      // IA para tanques enemigos: atacan la base del jugador
      if (m.owner === 'enemigo') {
        // No son seleccionables por el jugador
        this.sel.delete(m);
        
        // Si no tiene órdenes, ir hacia la base del jugador (spawn)
        if (!m.ruta && !m.objetivo && !m.quieto) {
          const playerBaseX = this.map.spawn.x * TILE;
          const playerBaseY = this.map.spawn.y * TILE;
          const distToPlayerBase = Math.hypot(playerBaseX - m.x, playerBaseY - m.y);
          
          // Si está lejos, moverse hacia la base del jugador
          if (distToPlayerBase > 300) {
            this.irA(m, playerBaseX, playerBaseY);
          } else {
            // Cerca de la base del jugador: buscar edificios para atacar
            let buildingTarget = null, md = Infinity;
            for (const e of this.builder.edificios) {
              if (e.owner === 'enemigo') continue; // no atacar edificios propios
              const c = { x: (e.x + e.def.w / 2) * TILE, y: (e.y + e.def.h / 2) * TILE };
              const d = Math.hypot(c.x - m.x, c.y - m.y);
              if (d < md) { md = d; buildingTarget = e; }
            }
            if (buildingTarget && md <= T.rango) {
              m.objetivo = { 
                x: (buildingTarget.x + buildingTarget.def.w / 2) * TILE, 
                y: (buildingTarget.y + buildingTarget.def.h / 2) * TILE, 
                vida: buildingTarget.vida, 
                esEdificio: true,
                buildingRef: buildingTarget
              };
            } else if (buildingTarget) {
              // Moverse hacia el edificio
              this.irA(m, (buildingTarget.x + buildingTarget.def.w / 2) * TILE, (buildingTarget.y + buildingTarget.def.h / 2) * TILE);
            }
          }
        }
      }
      // Validar objetivo: si es un enemigo que murió, o un edificio que fue destruido, o el núcleo destruido
      if (m.objetivo) {
        let objetivoValido = true;
        if (m.objetivo.esNucleo) {
          objetivoValido = this.baseEnemiga && this.baseEnemiga.nucleo && this.baseEnemiga.nucleo.vida > 0;
        } else if (m.objetivo.esEdificio) {
          objetivoValido = m.objetivo.buildingRef && m.objetivo.buildingRef.vida > 0;
        } else {
          objetivoValido = m.objetivo.vida > 0 && this.enemigos.lista.includes(m.objetivo);
        }
        if (!objetivoValido) { m.objetivo = null; this.llegar(m); }
      }
      let obj = null, md = Infinity;
      if (m.objetivo) { obj = m.objetivo; md = Math.hypot(obj.x - m.x, obj.y - m.y); }
      else {
        for (const en of this.enemigos.lista) {                  // enemigo más cercano: en marcha, solo dentro del alcance; si no, dentro de la zona de defensa
          if (m.ruta ? Math.hypot(en.x - m.x, en.y - m.y) > T.rango : Math.hypot(en.x - m.home.x, en.y - m.home.y) > RADIO_DEFENSA) continue;
          const d = Math.hypot(en.x - m.x, en.y - m.y); if (d < md) { md = d; obj = en; }
        }
        // También considerar el núcleo de la base enemiga como objetivo
        if (this.baseEnemiga && this.baseEnemiga.nucleo && this.baseEnemiga.nucleo.vida > 0) {
          const core = this.baseEnemiga.nucleo;
          const d = Math.hypot(core.x * TILE - m.x, core.y * TILE - m.y);
          if (m.ruta ? d <= T.rango : d <= RADIO_DEFENSA) {
            if (d < md) { md = d; obj = { x: core.x * TILE, y: core.y * TILE, vida: core.vida, esNucleo: true }; }
          }
        }
      }
      if (m.ruta) {                                                 // orden de movimiento: avanza punto a punto por la ruta
        while (m.ruta.length && Math.hypot(m.ruta[0].x - m.x, m.ruta[0].y - m.y) < (m.ruta.length > 1 ? 28 : 20)) m.ruta.shift();
        if (!m.ruta.length) this.llegar(m);
      }
      let tx, ty, avanzar = true, f = 1;
      if (m.ruta) {                                                 // en marcha dispara si hay enemigos al alcance, pero no se detiene
        tx = m.ruta[0].x; ty = m.ruta[0].y;
        const dif = Math.atan2(ty - m.y, tx - m.x) - m.ang, err = Math.abs(Math.atan2(Math.sin(dif), Math.cos(dif)));
        f = Math.max(0, 1 - err / 1.2);                             // si mira lejos del destino, gira casi en el sitio antes de avanzar
      } else if (obj) { tx = obj.x; ty = obj.y; if (md <= T.rango * .9) avanzar = false; }
      else if (m.quieto) { tx = m.home.x; ty = m.home.y; if (Math.hypot(tx - m.x, ty - m.y) < 20) avanzar = false; }   // tras una orden se queda en su sitio
      else {
        if (!m.dest || Math.hypot(m.dest.x - m.x, m.dest.y - m.y) < 10) {
          const a = Math.random() * 6.283, r = RADIO_PATRULLA * (.4 + Math.random() * .6);
          m.dest = { x: m.home.x + Math.cos(a) * r, y: m.home.y + Math.sin(a) * r };
        }
        tx = m.dest.x; ty = m.dest.y;
      }
      if (avanzar) {
        m.ang = girar(m.ang, Math.atan2(ty - m.y, tx - m.x), GIRO_CASCO * dt);
        const v = VEL_BASE * T.vel * dt * f, hecho = this.mover(m, Math.cos(m.ang) * v, Math.sin(m.ang) * v);
        m.fase = (m.fase + hecho) % 6;
        if (hecho > 0) {                                            // polvo detrás del tanque
          m.tpolvo -= dt;
          if (m.tpolvo <= 0) { m.tpolvo = .12; m.polvo.push({ x: m.x - Math.cos(m.ang) * T.pista[0], y: m.y - Math.sin(m.ang) * T.pista[0], t: .5, max: .5, r: 3, c: 0xc9a27a }); }
        }
        m.atasco = hecho < v * .3 ? m.atasco + dt : 0;              // si lleva un rato sin avanzar, busca otro camino o elige otro destino
        if (m.atasco > .6) { m.atasco = 0; if (m.ruta) this.repetirRuta(m); else m.dest = null; }
      }

      const objTorre = obj ? Math.atan2(obj.y - m.y, obj.x - m.x) : m.ang;   // el cañón apunta al enemigo (o hacia delante)
      m.torre = girar(m.torre, objTorre, GIRO_TORRE * dt);
      m.cd = Math.max(0, m.cd - dt);
      const alineado = Math.abs(Math.atan2(Math.sin(objTorre - m.torre), Math.cos(objTorre - m.torre))) < .12;
      if (obj && md <= T.rango && alineado && m.cd <= 0) {
        if (obj.esNucleo && this.baseEnemiga && this.baseEnemiga.nucleo) {
          this.baseEnemiga.recibirDanoNucleo(T.dano);
        } else if (obj.esEdificio && obj.buildingRef) {
          obj.buildingRef.vida -= T.dano;
          if (obj.buildingRef.vida <= 0) {
            this.builder.quitar(obj.buildingRef);
          }
        } else {
          obj.vida -= T.dano;
        }
        m.cd = T.cd; m.retro = 1; m.tiro = { x: obj.x, y: obj.y, t: T.tiro, max: T.tiro }; sfx.play(T.sonido);
        if (m.tipo === 'pesada') m.polvo.push({ x: m.x + Math.cos(m.torre) * T.largo, y: m.y + Math.sin(m.torre) * T.largo, t: .6, max: .6, r: 8, c: 0x8a8f99 });   // humo de la boca
      }

      m.golpe = Math.max(0, m.golpe - dt); m.retro = Math.max(0, m.retro - dt * 5);
      if (T.escudo) {                                              // el escudo se recarga solo tras unos segundos sin recibir daño
        m.sinGolpe += dt; m.recargando = false;
        if (m.escudo < T.escudo && m.sinGolpe >= T.escudoEspera) { m.escudo = Math.min(T.escudo, m.escudo + T.escudoRecarga * dt); m.recargando = true; }
      }
      this.pintarOrugas(m);
      m.c.position.set(m.x, m.y); m.c.rotation = m.ang;           // el casco gira hacia donde va
      m.gTorre.rotation = m.torre - m.ang;                         // el cañón gira por su cuenta
      m.canon.x = -m.retro * T.retro; m.casco.x = -m.retro * T.retro * .25;   // retroceso al disparar
      m.casco.tint = m.golpe > 0 ? 0xff9a9a : 0xffffff;            // parpadea en rojo al recibir daño
      if (m.tipo === 'sniper') {                                   // la bobina se carga de energía entre disparos
        const carga = 1 - m.cd / T.cd;
        m.bobina.clear().circle(T.largo, 0, 3 + 4 * carga).fill({ color: T.acento, alpha: .2 + .6 * carga });
        m.bobina.x = m.canon.x;
      }
      for (const p of m.polvo) {                                   // polvo y humo
        p.t -= dt; const k = Math.max(0, p.t / p.max);
        sg.circle(p.x, p.y, p.r * (1 + (1 - k) * 1.5)).fill({ color: p.c, alpha: .3 * k });
      }
      m.polvo = m.polvo.filter(p => p.t > 0);
      if (m.tiro) {                                                // fogonazo y trazo del disparo (cada tanque el suyo)
        const k = Math.max(0, m.tiro.t / m.tiro.max), bx = m.x + Math.cos(m.torre) * T.largo, by = m.y + Math.sin(m.torre) * T.largo, tx = m.tiro.x, ty = m.tiro.y;
        if (m.tipo === 'sniper') {
          g.moveTo(bx, by).lineTo(tx, ty).stroke({ width: 6, color: T.color, alpha: .3 * k });
          g.moveTo(bx, by).lineTo(tx, ty).stroke({ width: 2, color: 0xffffff, alpha: k });
          g.circle(tx, ty, 4 + (1 - k) * 10).stroke({ width: 2, color: T.color, alpha: k });
          g.circle(bx, by, 5).fill({ color: 0xffffff, alpha: k });
        } else if (m.tipo === 'pesada') {
          g.moveTo(bx, by).lineTo(tx, ty).stroke({ width: 6, color: T.color, alpha: .9 * k });
          g.circle(bx, by, 12).fill({ color: 0xfff3b0, alpha: .9 * k });
          g.circle(tx, ty, 8 + (1 - k) * 22).fill({ color: 0xff9a2e, alpha: .45 * k }).stroke({ width: 3, color: 0xffe36b, alpha: k });
        } else {
          g.moveTo(bx, by).lineTo(tx, ty).stroke({ width: 4, color: T.color, alpha: .95 * k });
          g.circle(bx, by, 7).fill({ color: 0xfff3b0, alpha: .9 * k });
        }
        m.tiro.t -= dt; if (m.tiro.t <= 0) m.tiro = null;
      }
      if (T.escudo && m.escudo > 0) {                              // burbuja de escudo: se ilumina al recibir un golpe
        const pct = m.escudo / T.escudo, pul = .5 + .5 * Math.sin(performance.now() / 250), gol = m.golpe > 0;
        g.circle(m.x, m.y, 27).fill({ color: T.acento, alpha: .05 + .06 * pct + (gol ? .2 : 0) }).stroke({ width: 2, color: T.acento, alpha: .15 + .25 * pct * pul + (gol ? .5 : 0) + (m.recargando ? .25 : 0) });
      }
      if (this.sel.has(m)) {                                       // anillo de selección, ruta y destino
        const pul = .5 + .5 * Math.sin(performance.now() / 200);
        sg.circle(m.x, m.y, T.pista[0] + 10).fill({ color: 0x5dff8a, alpha: .08 }).stroke({ width: 2.5, color: 0x5dff8a, alpha: .5 + .4 * pul });
        if (m.ruta && m.ruta.length) {
          sg.moveTo(m.x, m.y); for (const p of m.ruta) sg.lineTo(p.x, p.y);
          sg.stroke({ width: 1.5, color: 0x5dff8a, alpha: .35 });
          const d = m.ruta[m.ruta.length - 1]; sg.circle(d.x, d.y, 5).stroke({ width: 2, color: 0x5dff8a, alpha: .8 });
        } else if (m.objetivo) sg.moveTo(m.x, m.y).lineTo(m.objetivo.x, m.objetivo.y).stroke({ width: 1.5, color: 0xff4a5a, alpha: .45 });
      }
      if (T.escudo && (m.escudo < T.escudo || this.sel.has(m))) {                       // barra de escudo (azul)
        g.rect(m.x - 16, m.y - T.barra - 6, 32, 4).fill(0x14171c);
        g.rect(m.x - 16, m.y - T.barra - 6, 32 * Math.max(0, m.escudo) / T.escudo, 4).fill(0x5fd0ff);
      }
      if (m.vida < T.vida || this.sel.has(m)) {                    // barra de vida si está dañado o seleccionado
        g.rect(m.x - 16, m.y - T.barra, 32, 4).fill(0x14171c);
        g.rect(m.x - 16, m.y - T.barra, 32 * Math.max(0, m.vida) / T.vida, 4).fill(0x5dff8a);
      }
    }
    for (const p of this.pings) {                                  // aros que marcan dónde diste la orden
      p.t -= dt; const k = Math.max(0, p.t / .6);
      sg.circle(p.x, p.y, 8 + (1 - k) * 26).stroke({ width: 3, color: p.color, alpha: k });
      sg.circle(p.x, p.y, 4).fill({ color: p.color, alpha: k });
    }
    this.pings = this.pings.filter(p => p.t > 0);
    const d = this.down;                                           // caja de selección (Shift + arrastrar)
    if (d && d.b === 0 && d.shift && !this.defAlPulsar && this.cur && Math.hypot(this.cur.x - d.x, this.cur.y - d.y) > 6) {
      const a = this.camera.screenToWorld(Math.min(d.x, this.cur.x), Math.min(d.y, this.cur.y)), b = this.camera.screenToWorld(Math.max(d.x, this.cur.x), Math.max(d.y, this.cur.y));
      g.rect(a.x, a.y, b.x - a.x, b.y - a.y).fill({ color: 0x5dff8a, alpha: .1 }).stroke({ width: 1.5, color: 0x5dff8a, alpha: .8 });
    }
  }

  destroy() {
    if (this.canvas) {
      this.canvas.removeEventListener('pointerdown', this.onDown);
      this.canvas.removeEventListener('pointermove', this.onMove);
      this.canvas.removeEventListener('pointerup', this.onUp);
    }
    window.removeEventListener('keydown', this.onKey);
    this.container.destroy({ children: true });
  }
}

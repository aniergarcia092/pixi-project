// La economía. Los edificios se unen solos con cables formando redes:
//   · batería ↔ batería más cercana  · panel → batería (si no hay, al minero más cercano)  · minero → batería (si no hay, al panel más cercano)
// En cada red: los paneles producen, los mineros gastan y las baterías guardan el sobrante / cubren la falta.

import { Graphics } from 'pixi.js';
import { clamp } from '../nucleo/noise.js';
import { mejorarDibujo } from './buildings.js';
import { sfx } from '../audio/sonido.js';
import { ciclo } from '../mundo/ciclo.js';

export const T_TUBOS = 5;              // segundos que tardan los tubos en conectar el generador de oxígeno con el laboratorio
export const BONO_COMBO = 1.02;       // +2% de energía en los paneles de un combo solar
export const PROD_PANEL = 3;          // energía por segundo de un panel solar
export const CONS_MINERO = 2;         // energía por segundo que gasta un minero
export const CAP_BATERIA = 100;       // energía que guarda una batería
export const VEL_MINADO = 1.5;        // mineral por segundo de un minero con energía
export const PROD_HELICE = 5;         // energía por segundo de una hélice eólica
export const VEL_AGUA = 0.5;           // agua por segundo de un pozo de agua con energía
export const CAP_AGUA_BASE = 20;       // agua que guarda la colonia sin almacenes
export const CAP_AGUA_ALMACEN = 20;    // agua extra por cada almacén de agua
export const CONS_OXIGENO = 3;        // energía por segundo de un generador de oxígeno
export const CONS_LAB = 4;             // energía por segundo de un laboratorio
export const OXI_AGUA = 0.33;          // agua por segundo que gasta un generador de oxígeno
export const PROD_LAB = 2;             // mineral por segundo de un laboratorio con oxígeno
export const ALCANCE_LASER = 30;      // distancia máxima de un receptor láser (en casillas)
export const COSTE_RUEDAS = 200;      // mineral que cuesta fabricar las ruedas todoterreno del rover (en el laboratorio)
export const T_RUEDAS = 20;           // segundos que tarda en fabricarlas
export const ALCANCE_CABLE = 12;      // distancia máxima de un cable (en casillas)

const MULT2 = { panel: 5 / 3, minero: 5 / 3, pozoagua: 2, bateria: 2, torreta: 1.75, reparacion: 2 };   // lo que mejora el nivel 2
export const mult = e => e.nivel === 2 ? (MULT2[e.def.id] || 1) : 1;
export const capBat = b => CAP_BATERIA * mult(b);

function hasta(pts, f) {                          // la parte de una línea quebrada que cubre la fracción f de su largo
  const ls = []; let rest = 0;
  for (let i = 1; i < pts.length; i++) { ls.push(Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); rest += ls[i - 1]; }
  rest *= f; const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const l = ls[i - 1];
    if (rest >= l) { out.push(pts[i]); rest -= l; continue; }
    const u = l ? rest / l : 0;
    out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u]);
    break;
  }
  return out;
}

export class Economia {
  constructor() {
    this.mineral = 120;
    this.agua = 0; this.capAgua = CAP_AGUA_BASE;                // mineral inicial para poder construir lo primero
    this.ruedas = 'no'; this.fabT = 0; this.fabLab = null;        // mejora del rover: 'no' → 'fab' (fabricando) → 'lista' → 'hecha'
    this.energia = 0; this.prod = 0; this.cons = 0; this.cap = 0;   // totales (para el HUD)
    this.edificios = [];              // { def, x, y, dib, res, energia }
    this.cables = [];                 // { a, b, red }
    this.redes = [];                  // grupos de edificios conectados
    this.enlaces = [];                // { o, l, t }: tubos de un generador de oxígeno a un laboratorio (t = segundos de conexión)
    this.tubos = new Graphics();      // dibujo de los tubos (el builder lo mete en su contenedor)
  }

  puedePagar(def) { return this.mineral >= (def.costo || 0); }
  pagar(def) { this.mineral -= def.costo || 0; }
  mejorar(e) {                                       // sube un edificio a nivel 2 (si tiene mejora y alcanza el mineral)
    const m = e.def.mejora;
    if (!m || e.nivel === 2 || e.construccion > 0 || this.mineral < m.costo) return false;
    this.mineral -= m.costo; e.nivel = 2;
    sfx.play('mejora');
    mejorarDibujo(e);                                 // cambia el sprite a su versión de nivel 2
    this.recalcular();
    return true;
  }
  fabricarRuedas(lab) {                              // el laboratorio empieza a fabricar las ruedas grandes del rover
    if (this.ruedas !== 'no' || lab.construccion > 0 || this.mineral < COSTE_RUEDAS) return false;
    this.mineral -= COSTE_RUEDAS; this.ruedas = 'fab'; this.fabT = T_RUEDAS; this.fabLab = lab;
    sfx.play('construir');
    return true;
  }
  quitar(e) {
    if (this.ruedas === 'fab' && e === this.fabLab) { this.ruedas = 'no'; this.mineral += COSTE_RUEDAS; this.fabLab = null; }   // si destruyen el laboratorio se devuelve el mineral
    this.edificios = this.edificios.filter(o => o !== e); this.recalcular(); }
  anadir(e) { e.energia = 0; this.edificios.push(e); }

  // Vuelve a calcular qué cables hay y qué edificios forman cada red (se llama al construir)
  recalcular() {
    const es = this.edificios;
    es.forEach((e, i) => { e.i = i; });
    for (const e of es) { e.comboAntes = !!e.combo; e.combo = false; }
    for (const b of es) if (b.def.id === 'bateria') {         // combo solar: batería con un panel pegado en cada lado (+ de 4 paneles)
      const ps = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => es.find(o => o.def.id === 'panel' && o.x === b.x + dx && o.y === b.y + dy));
      if (ps.every(Boolean)) { b.combo = true; ps.forEach(p => { p.combo = true; }); }
    }
    for (const b of es) if (b.combo && !b.comboAntes && b.def.id === 'bateria') { b.dib.estallido = 0; sfx.play('combo'); }   // arranca la animación de activación
    const padre = es.map((_, i) => i);
    const raiz = i => { while (padre[i] !== i) i = padre[i] = padre[padre[i]]; return i; };
    const centro = e => ({ x: e.x + e.def.w / 2, y: e.y + e.def.h / 2 });
    const rango = e => e.def.alcance || ALCANCE_CABLE;       // alcance de cable de cada edificio
    const cerca = (e, lista, laser = false) => {             // el más cercano dentro del alcance (o null)
      const c = centro(e); let mejor = null, md = Infinity;
      for (const o of lista) {
        if (o === e) continue;
        const p = centro(o), d = Math.hypot(p.x - c.x, p.y - c.y);
        const lim = laser ? ALCANCE_LASER : Math.min(rango(e), rango(o));   // un cable llega hasta el menor de los dos alcances
        if (d <= lim && d < md) { md = d; mejor = o; }
      }
      return mejor;
    };
    const vistos = new Set(), cables = [];
    const unir = (a, b) => {
      const k = Math.min(a.i, b.i) + '-' + Math.max(a.i, b.i);
      if (vistos.has(k)) return;
      vistos.add(k); cables.push({ a, b, red: null });
      padre[raiz(a.i)] = raiz(b.i);
    };
    const gen = e => e.def.id === 'panel' || e.def.id === 'helice', cons = e => ['minero', 'pozoagua', 'oxigeno', 'laboratorio'].includes(e.def.id);
    const bs = es.filter(e => e.def.id === 'bateria'), ps = es.filter(gen), ms = es.filter(cons), ls = es.filter(e => e.def.id === 'laser');
    bs.forEach((b, k) => { const t = cerca(b, bs.slice(0, k)); if (t) unir(b, t); });   // las baterías se encadenan entre sí
    for (const p of ps) { const t = cerca(p, bs) || cerca(p, ms) || cerca(p, ls, true); if (t) unir(p, t); }  // la batería tiene prioridad
    for (const m of ms) { const t = cerca(m, bs) || cerca(m, ps) || cerca(m, ls, true); if (t) unir(m, t); }
    ls.forEach((l, k) => { const t = cerca(l, ls.slice(0, k), true); if (t) unir(l, t); });   // los láseres se encadenan entre sí
    for (const l of ls) { const t = cerca(l, bs, true) || cerca(l, ps, true); if (t) unir(l, t); }   // y se enlazan a una batería o a un panel

    const grupos = new Map();
    for (const e of es) {
      const r = raiz(e.i);
      if (!grupos.has(r)) grupos.set(r, { fija: 0, paneles: [], baterias: [], mineros: [], activa: false });
      const g = grupos.get(r);
      if (e.def.id === 'panel') g.paneles.push(e);
      else if (e.def.id === 'helice') g.fija += PROD_HELICE;
      else if (e.def.id === 'bateria') g.baterias.push(e);
      else if (cons(e)) g.mineros.push(e);
    }
    for (const g of grupos.values()) g.activa = g.fija > 0 || g.paneles.length > 0;
    for (const c of cables) c.red = grupos.get(raiz(c.a.i));
    this.cables = cables;
    this.redes = [...grupos.values()];
  }

  prodRed(red) {                                     // energía/s de una red ahora mismo: los paneles solo producen con luz de día
    let p = red.fija, s = 0;
    for (const e of red.paneles) s += PROD_PANEL * mult(e) * (e.combo ? BONO_COMBO : 1);
    return p + s * ciclo.sol;
  }

  pegados(a, b) {                                    // ¿están pegados (o a una casilla de distancia)?
    const dx = Math.max(a.x - (b.x + b.def.w), b.x - (a.x + a.def.w)), dy = Math.max(a.y - (b.y + b.def.h), b.y - (a.y + a.def.h));
    return dx <= 1 && dy <= 1;
  }

  funciona(m) {                                      // ¿puede trabajar este consumidor (sin contar la energía)?
    switch (m.def.id) {
      case 'minero': return !!(m.res && m.res.amount > 0);
      case 'pozoagua': return !!(m.res && m.res.amount > 0 && this.agua < this.capAgua - 0.05);
      case 'oxigeno': return this.agua > 0.01;
      case 'laboratorio': return this.enlaces.some(k => k.l === m && k.t >= T_TUBOS && k.o.on);   // los tubos deben estar conectados
    }
    return false;
  }

  actualizarTubos(dt) {                              // crea los enlaces oxígeno ↔ laboratorio pegados y los hace avanzar
    const os = this.edificios.filter(e => e.def.id === 'oxigeno'), ls = this.edificios.filter(e => e.def.id === 'laboratorio');
    for (const l of ls) for (const o of os) if (this.pegados(l, o) && !this.enlaces.some(k => k.l === l && k.o === o)) this.enlaces.push({ o, l, t: 0 });
    this.enlaces = this.enlaces.filter(k => this.edificios.includes(k.o) && this.edificios.includes(k.l) && this.pegados(k.l, k.o));
    const g = this.tubos.clear(), T = 64, ahora = performance.now() / 1000;
    for (const k of this.enlaces) {
      k.t = Math.min(T_TUBOS, k.t + dt);
      const ax = (k.o.x + .5) * T, ay = (k.o.y + .5) * T, l = k.l;
      const bx = clamp(ax, l.x * T, (l.x + l.def.w) * T), by = clamp(ay, l.y * T, (l.y + l.def.h) * T);   // punto del laboratorio más cercano
      const p = k.t / T_TUBOS, tubos = [-5, 5].map(d => hasta([[ax, ay + d], [bx + d, ay + d], [bx + d, by]], p));
      for (const [ancho, color, alfa] of [[10, 0x14171c, 1], [6, 0x8d99a8, 1], [2, 0xdfe6ee, .7]])
        for (const pts of tubos) { g.moveTo(pts[0][0], pts[0][1]); for (const q of pts.slice(1)) g.lineTo(q[0], q[1]); g.stroke({ width: ancho, color, alpha: alfa, cap: 'round', join: 'round' }); }
      if (p < 1) {                                   // soldando: chispas en la punta de cada tubo
        for (const pts of tubos) {
          const h = pts[pts.length - 1], r = 4 + Math.random() * 3;
          g.circle(h[0], h[1], r + 3).fill({ color: 0xff9a2e, alpha: .35 });
          g.circle(h[0], h[1], r).fill(0xffe28a); g.circle(h[0], h[1], r * .45).fill(0xffffff);
          for (let i = 0; i < 3; i++) { const a = Math.random() * 6.283, d = 6 + Math.random() * 10; g.moveTo(h[0], h[1]).lineTo(h[0] + Math.cos(a) * d, h[1] + Math.sin(a) * d).stroke({ width: 1.5, color: 0xffc83a }); }
        }
      } else if (k.o.on) {                           // conectado y con oxígeno: burbujas que viajan por los tubos
        for (const d of [-5, 5]) for (let i = 0; i < 3; i++) {
          const pts = hasta([[ax, ay + d], [bx + d, ay + d], [bx + d, by]], ((ahora * .5) + i / 3) % 1);
          const h = pts[pts.length - 1]; g.circle(h[0], h[1], 1.8).fill({ color: 0x9fe8ff, alpha: .9 });
        }
      }
    }
  }

  update(dtMs) {
    const dt = Math.min(dtMs, 100) / 1000;
    this.actualizarTubos(dt);
    if (this.ruedas === 'fab') { this.fabT -= dt; if (this.fabT <= 0) { this.fabT = 0; this.ruedas = 'lista'; sfx.play('terminado'); } }
    this.prod = this.cons = this.cap = this.energia = 0;
    this.capAgua = CAP_AGUA_BASE + CAP_AGUA_ALMACEN * this.edificios.filter(e => e.def.id === 'almacenagua').length;
    this.agua = Math.min(this.agua, this.capAgua);
    for (const red of this.redes) {
      const activos = red.mineros.filter(m => this.funciona(m));
      const gasto = { minero: CONS_MINERO, pozoagua: CONS_MINERO, oxigeno: CONS_OXIGENO, laboratorio: CONS_LAB };
      const prod = this.prodRed(red), cons = activos.reduce((n, m) => n + gasto[m.def.id], 0), cap = red.baterias.reduce((n, b) => n + capBat(b), 0);
      let guardada = 0; for (const b of red.baterias) guardada += b.energia;

      const disponible = guardada + prod * dt, necesita = cons * dt;
      let factor = 1;                                 // 1 = energía de sobra · menos = apagón parcial
      if (disponible >= necesita) guardada = Math.min(cap, disponible - necesita);
      else { factor = necesita > 0 ? disponible / necesita : 0; guardada = 0; }
      for (const b of red.baterias) {                 // la carga se reparte entre las baterías de la red
        b.energia = guardada * capBat(b) / cap;
        const nivel = b.energia / capBat(b);
        const cargando = prod * dt > necesita && nivel < .99;     // hay sobrante y aún cabe más
        b.dib.pulso += dt * (cargando ? 7 : 2);
        b.dib.halo.alpha = nivel > .01 && !b.combo ? (cargando ? .35 + .35 * Math.sin(b.dib.pulso) : .12 + .08 * Math.sin(b.dib.pulso)) : 0;
        b.dib.haloCombo.alpha = b.combo ? .55 + .35 * Math.sin(b.dib.pulso * 1.5) : 0;
        b.dib.rayo.visible = !!b.combo;
        const fx = b.dib.fx.clear();
        if (b.combo) {                                // chispas cian que viajan de cada panel a la batería
          b.dib.chispas = (b.dib.chispas || 0) + dt * .9;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (let i = 0; i < 2; i++) {
            const k = (b.dib.chispas + i * .5) % 1;
            fx.circle(32 + dx * 64 * (1 - k), 32 + dy * 64 * (1 - k), 3).fill({ color: 0x4fe3ff, alpha: k > .85 ? (1 - k) / .15 : 1 });
          }
        }
        if (b.dib.estallido < 1) {                    // onda expansiva al activarse el combo
          const k = b.dib.estallido = Math.min(1, b.dib.estallido + dt * 1.1);
          fx.circle(32, 32, 10 + k * 120).stroke({ width: 6 * (1 - k) + 1, color: 0xffffff, alpha: 1 - k });
          fx.circle(32, 32, 6 + k * 80).stroke({ width: 4 * (1 - k) + 1, color: 0x4fe3ff, alpha: 1 - k });
        }
        b.dib.celdas.forEach((c, i) => { c.visible = nivel > i / 3 && nivel > 0.01; });
      }
      red.activa = prod > 0 || guardada > 0.01;
      if (factor <= .05) factor = 0;                  // sin energía (o casi): no trabaja nada

      for (const m of activos) {
        const id = m.def.id;
        if (id === 'oxigeno') { this.agua = Math.max(0, this.agua - OXI_AGUA * dt * factor); continue; }
        if (id === 'laboratorio') { this.mineral += PROD_LAB * dt * factor; continue; }
        const pozo = id === 'pozoagua';
        const sacado = Math.min(m.res.amount, (pozo ? VEL_AGUA : VEL_MINADO) * mult(m) * dt * factor);
        m.res.amount -= sacado;
        if (pozo) this.agua = Math.min(this.capAgua, this.agua + sacado);
        else this.mineral += sacado;
      }
      for (const m of red.mineros) {                  // animación: la broca gira mientras trabaja
        m.agotado = (m.def.id === 'minero' || m.def.id === 'pozoagua') && !(m.res && m.res.amount > 0);
        m.lleno = m.def.id === 'pozoagua' && !m.agotado && this.agua >= this.capAgua - 0.05;
        m.sinEnergia = activos.includes(m) && factor === 0 && (m.def.id === 'minero' || m.def.id === 'pozoagua');   // el builder dibuja un aviso
        const trabaja = activos.includes(m) && factor > .05 && red.activa;
        m.on = trabaja && factor > .5;                // lo usa el laboratorio para saber si hay oxígeno
        if (m.dib.ondas) this.animarPozo(m, trabaja && factor > .3, dt);
        if (!m.dib.broca) { m.dib.alpha = trabaja ? 1 : .55; continue; }   // solo el minero tiene broca
        if (trabaja) {
          m.dib.broca.rotation += dt * 9 * factor;
          m.dib.broca.position.set(32 + (Math.random() - .5) * 1.4, 32 + (Math.random() - .5) * 1.4);   // vibración
        } else m.dib.broca.position.set(32, 32);
        m.dib.alpha = trabaja ? 1 : .55;
      }
      this.prod += prod; this.cons += cons; this.cap += cap; this.energia += guardada;
    }
    for (const p of this.edificios) if (p.def.id === 'panel') this.animarPanel(p, dt);
    for (const h of this.edificios) if (h.def.id === 'helice' && h.dib.rotor) {   // el rotor gira según el viento (que sube y baja solo)
      h.viento = (h.viento === undefined ? Math.random() * 6 : h.viento) + dt * .35;
      const v = 2.4 + 1.8 * Math.sin(h.viento) + .6 * Math.sin(h.viento * 2.7);
      h.dib.rotor.rotation += v * dt; h.dib.sombra.rotation = h.dib.rotor.rotation;
    }
  }

  animarPozo(m, bombea, dt) {                        // 2 anillos azules que se expanden y se desvanecen mientras bombea
    const d = m.dib, g = d.ondas.clear();
    if (!bombea) return;
    d.fase = (d.fase + dt * .8) % 1;
    for (const o of [0, .5]) {
      const k = (d.fase + o) % 1;
      g.circle(0, 0, 4 + k * 14).stroke({ width: 2, color: 0xbfe9ff, alpha: .8 * (1 - k) });
    }
  }

  animarPanel(p, dt) {                               // cada 8-18 s la placa elige un nuevo ángulo y se mueve suave hacia él
    p.tm = (p.tm === undefined ? 1 + Math.random() * 4 : p.tm) - dt;
    if (p.tm <= 0) { p.tm = 8 + Math.random() * 10; p.tg = (Math.random() - .5) * .6; p.tt = .8 + Math.random() * .2; }
    const tg = p.tg || 0, tt = p.tt === undefined ? 1 : p.tt;
    p.ra = (p.ra || 0) + (tg - (p.ra || 0)) * Math.min(1, dt * 1.1);                  // giro
    p.tl = (p.tl === undefined ? 1 : p.tl) + (tt - (p.tl === undefined ? 1 : p.tl)) * Math.min(1, dt * 1.1);   // inclinación
    const mueve = Math.abs(tg - p.ra) > .025 || Math.abs(tt - p.tl) > .012;
    p.dib.placa.rotation = p.ra; p.dib.placa.scale.y = p.tl;
    p.tb = (p.tb || Math.random() * 6) + dt * 1.4;                                  // destello de sol: parpadea suave
    const s = Math.max(0, Math.sin(p.tb)) ** 3;
    p.dib.brillo.alpha = s; p.dib.brillo.scale.set(.5 + s * .7); p.dib.brillo.rotation = p.tb * .5;
    p.dib.aro.visible = mueve || !!p.combo;           // con combo solar los arcos cian giran despacio todo el tiempo
    if (mueve || p.combo) p.dib.aro.rotation += dt * (mueve ? 5 : 1.5);
  }

  resumen() {
    const neto = this.prod - this.cons;
    return `Energía ${Math.floor(this.energia)}/${this.cap} (${neto >= 0 ? '+' : ''}${neto.toFixed(1)}/s) · Mineral ${Math.floor(this.mineral)} · Agua ${Math.floor(this.agua)}/${this.capAgua} · ${ciclo.texto()}`;
  }
}

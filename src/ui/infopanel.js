// Panel de información: sale al hacer clic en un edificio ya construido. Muestra su estado y, si tiene mejora, el botón para subirlo a nivel 2.

import { mult, capBat, BONO_COMBO, PROD_PANEL, PROD_HELICE, VEL_MINADO, VEL_AGUA, COSTE_RUEDAS, T_RUEDAS } from '../edificios/economia.js';
import { ciclo } from '../mundo/ciclo.js';
import { TIPOS, MAX_COLA } from '../unidades/edificio_unidades.js';

const NARANJA = '#ff9a2e', AMARILLO = '#ffc83a', BORDE = '#6b4a3a';
const el = (tag, css, txt) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; };
const f1 = n => (Math.round(n * 10) / 10).toString().replace('.', ',');

export class InfoPanel {
  constructor(getBuilder, getEconomia, getTanques) {
    this.getBuilder = getBuilder; this.getEconomia = getEconomia; this.getTanques = getTanques;
    this.el = el('div', `position:fixed;left:12px;top:50%;transform:translateY(-50%);width:250px;box-sizing:border-box;padding:10px 12px;display:none;flex-direction:column;gap:5px;font:13px monospace;color:#fff;user-select:none;z-index:10;background:rgba(20,12,14,.93);border:2px solid ${BORDE};border-radius:12px;`);
    this.tit = el('div', `color:${NARANJA};font-weight:bold;font-size:15px;`);
    this.est = el('div', 'font-size:12px;color:#e8d8d0;white-space:pre-line;line-height:1.4;');
    this.desc = el('div', 'font-size:12px;color:#b9a79c;line-height:1.35;');
    this.btn = el('button', ''); this.btn.tabIndex = -1;
    this.btn.addEventListener('mousedown', e => e.preventDefault());
    this.btn.addEventListener('click', () => { const b = this.getBuilder(); if (b && b.sel) { const eco = this.getEconomia(); if (b.sel.def.id === 'laboratorio') eco.fabricarRuedas(b.sel); else if (b.sel.def.id === 'cuartel') this.getTanques().fabricar(b.sel, 'comet'); else eco.mejorar(b.sel); } });
    this.btnsT = {};                                   // un botón de fabricación por cada tipo de tanque
    for (const id of Object.keys(TIPOS)) {
      const b = el('button', ''); b.tabIndex = -1;
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', () => { const bl = this.getBuilder(); if (bl && bl.sel && bl.sel.def.id === 'cuartel') this.getTanques().fabricar(bl.sel, id); });
      this.btnsT[id] = b;
    }
    this.btnCancel = el('button', ''); this.btnCancel.tabIndex = -1;           // quita el último pedido de la cola
    this.btnCancel.addEventListener('mousedown', e => e.preventDefault());
    this.btnCancel.addEventListener('click', () => { const bl = this.getBuilder(); if (bl && bl.sel && bl.sel.def.id === 'cuartel') this.getTanques().cancelar(bl.sel); });
    this.el.append(this.tit, this.est, this.desc, this.btn, ...Object.values(this.btnsT), this.btnCancel);
    document.body.appendChild(this.el);
    this.ultimo = '';
  }

  estado(e, eco) {                                    // texto con los datos del edificio
    const id = e.def.id, lin = [];
    const vmax = e.def.vida || 100;
    lin.push(`Vida ${Math.ceil(e.vida === undefined ? vmax : e.vida)}/${vmax}`);
    if (e.construccion > 0) { lin.push(`Construyendo… ${Math.ceil(e.construccion)} s`); return lin.join('\n'); }
    if (id === 'panel') { lin.push(`Produce ${f1(PROD_PANEL * mult(e) * (e.combo ? BONO_COMBO : 1) * ciclo.sol)} energía/s`); if (ciclo.sol < .05) lin.push('🌙 Sin luz solar'); }
    else if (id === 'helice') lin.push(`Produce ${f1(PROD_HELICE)} energía/s (día y noche)`);
    else if (id === 'torreta') lin.push(`Daño ${Math.round(40 * mult(e))}/s · alcance 6 casillas`);
    else if (id === 'reparacion') lin.push(`Repara ${8 * mult(e)} vida/s · radio 6 casillas`);
    else if (id === 'bateria') lin.push(`Carga ${Math.floor(e.energia || 0)}/${capBat(e)}`);
    else if (id === 'minero' || id === 'pozoagua') {
      const v = (id === 'minero' ? VEL_MINADO : VEL_AGUA) * mult(e);
      lin.push(`${id === 'minero' ? 'Minado' : 'Bombeo'} ${f1(v)}/s`);
      lin.push(`Depósito: ${Math.floor(e.res ? e.res.amount : 0)} restante`);
      lin.push(e.agotado ? '✖ Depósito agotado' : e.lleno ? '◌ Almacén de agua lleno' : e.sinEnergia ? '⚠ Sin energía' : e.on ? '● Trabajando' : '○ Parado');
    }
    else if (id === 'cuartel') {
      lin.push(e.fab ? `🔧 Fabricando ${TIPOS[e.fab.tipo].nombre}… ${Math.ceil(e.fab.t)} s` : 'Sin fabricar nada');
      const cola = e.cola || [];
      if (cola.length) lin.push(`Cola ${cola.length}/${MAX_COLA}: ${cola.map(t => TIPOS[t].nombre).join(', ')}`);
    }
    if (e.combo) lin.push('⚡ Combo solar: +2% energía');
    return lin.join('\n');
  }

  pintarTanques(cu, tb) {
    for (const [id, b] of Object.entries(this.btnsT)) {
      if (!cu) { b.style.display = 'none'; continue; }
      const x = tb[id];
      b.textContent = x.txt; b.disabled = !x.puede;
      b.style.cssText = `display:block;font:inherit;font-size:12px;white-space:pre-line;color:#fff;padding:7px 8px;border-radius:8px;border:2px solid ${x.puede ? AMARILLO : BORDE};background:${x.puede ? 'rgba(110,60,30,.95)' : 'rgba(20,12,14,.85)'};cursor:${x.puede ? 'pointer' : 'default'};opacity:${x.puede ? 1 : .6};`;
    }
  }

  update() {
    const b = this.getBuilder(), e = b && b.sel, eco = this.getEconomia();
    if (!e) { this.el.style.display = 'none'; this.ultimo = ''; return; }
    const m = e.def.mejora, niv = e.nivel === 2 ? 2 : 1, lab = e.def.id === 'laboratorio' && !(e.construccion > 0), cu = e.def.id === 'cuartel' && !(e.construccion > 0);
    let mostrar = !!m, puede = false, hecho = false, txtBtn = '';
    if (lab) {                                         // el laboratorio fabrica las ruedas todoterreno del rover
      const s = eco.ruedas;
      mostrar = true; hecho = s === 'hecha';
      puede = s === 'no' && eco.mineral >= COSTE_RUEDAS;
      txtBtn = s === 'no' ? `🛞 Ruedas todoterreno · ◆ ${COSTE_RUEDAS}\nRover +50% de velocidad · ${T_RUEDAS} s`
        : s === 'fab' ? `Fabricando ruedas… ${Math.ceil(eco.fabT)} s` : s === 'lista' ? 'Instalando en el rover…' : '★ Ruedas instaladas';
    } else if (cu) {                                   // el cuartel tiene un botón por cada tanque (ver pintarTanques)
      mostrar = false;
    } else if (m) {
      puede = niv === 1 && !(e.construccion > 0) && eco.mineral >= m.costo; hecho = niv === 2;
      txtBtn = niv === 2 ? '★ Nivel máximo' : `⬆ Mejorar a nivel 2 · ◆ ${m.costo}\n${m.texto}`;
    }
    const tb = {};
    if (cu) for (const [id, T] of Object.entries(TIPOS)) {
      const p = this.getTanques().puedeFabricar(id, e);
      tb[id] = { puede: p, txt: `${e.fab ? '➕ Añadir a la cola:' : '🚀 Fabricar'} ${T.nombre} · ◆ ${T.coste}\nVida ${T.vida}${T.escudo ? ` + escudo ${T.escudo}` : ''} · ataque ${T.dano}/${T.cd} s · rango ${T.rango} · ${T.tiempo} s` };
    }
    let txtCancel = '';
    if (cu && (e.fab || (e.cola && e.cola.length))) {
      const hayCola = !!(e.cola && e.cola.length), tipo = hayCola ? e.cola[e.cola.length - 1] : e.fab.tipo;
      txtCancel = `${hayCola ? '✖ Quitar el último de la cola' : '✖ Cancelar fabricación'} · +◆ ${TIPOS[tipo].coste}`;
    }
    const clave = [e.def.id, niv, this.estado(e, eco), puede, txtBtn, JSON.stringify(tb), txtCancel].join('|');
    if (clave === this.ultimo) return;
    this.ultimo = clave;
    this.pintarTanques(cu, tb);
    this.btnCancel.textContent = txtCancel;
    this.btnCancel.style.cssText = `display:${txtCancel ? 'block' : 'none'};font:inherit;font-size:12px;color:#fff;padding:6px 8px;border-radius:8px;border:2px solid #a04a4a;background:rgba(60,20,20,.9);cursor:pointer;`;
    this.el.style.display = 'flex';
    this.tit.textContent = `${e.def.nombre}${m ? ` · Nivel ${niv}` : ''}`;
    this.est.textContent = this.estado(e, eco);
    this.desc.textContent = e.def.descripcion;
    this.btn.textContent = txtBtn; this.btn.disabled = !puede;
    this.btn.style.cssText = `display:${mostrar ? 'block' : 'none'};font:inherit;font-size:12px;white-space:pre-line;color:#fff;padding:7px 8px;border-radius:8px;border:2px solid ${puede ? AMARILLO : BORDE};background:${puede ? 'rgba(110,60,30,.95)' : 'rgba(20,12,14,.85)'};cursor:${puede ? 'pointer' : 'default'};opacity:${puede || hecho ? 1 : .6};`;
  }
}

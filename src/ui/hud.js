// Interfaz superior: barra con mineral, energía, agua y día/noche (HTML), info de la casilla bajo el cursor y panel de ayuda (H).

import { DIA, NOCHE } from '../mundo/ciclo.js';

const NARANJA = '#ff9a2e', AMARILLO = '#ffc83a', BORDE = '#6b4a3a';
const el = (tag, css, txt) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; };
const PANEL = `background:rgba(20,12,14,.9);border:2px solid ${BORDE};border-radius:10px;box-shadow:0 3px 12px rgba(0,0,0,.45);`;

const AYUDA = [
  ['WASD / flechas', 'Conducir el rover (Shift: rápido)'], ['Arrastrar', 'Mover la cámara'], ['Espacio', 'Volver a seguir al rover'], ['Rueda', 'Zoom'],
  ['B', 'Abrir / cerrar el menú de construcción'], ['1-9, 0, Z, X, V, N, M', 'Elegir edificio'], ['Clic en edificio', 'Ver su información'],
  ['G', 'Cuadrícula'], ['R', 'Mapa nuevo'], ['U / I', 'Sonido / música'], ['H', 'Esta ayuda'],
];

export class Hud {
  constructor() {
    this.cache = {};
    this.raiz = el('div', 'position:fixed;left:12px;top:10px;display:flex;flex-direction:column;align-items:flex-start;gap:6px;font:13px monospace;color:#fff;user-select:none;z-index:10;pointer-events:none;');
    const fila = el('div', 'display:flex;gap:8px;flex-wrap:wrap;');

    const chip = (icono, etiqueta, conBarra, colorBarra) => {                // una "ficha" de recurso
      const c = el('div', `${PANEL}padding:6px 10px;min-width:96px;display:flex;flex-direction:column;gap:3px;`);
      const cab = el('div', 'display:flex;align-items:center;gap:6px;');
      const ic = el('span', 'font-size:15px;', icono);
      const et = el('span', 'font-size:10px;color:#9a8678;letter-spacing:1px;text-transform:uppercase;', etiqueta);
      const val = el('span', 'margin-left:auto;font-weight:bold;font-size:14px;');
      cab.append(ic, et, val);
      const sub = el('div', 'font-size:11px;color:#b9a79c;min-height:14px;');
      c.append(cab);
      let barra = null;
      if (conBarra) {
        const fondo = el('div', 'height:6px;border-radius:3px;background:#2a1a1c;overflow:hidden;');
        barra = el('div', `height:100%;width:0%;background:${colorBarra};border-radius:3px;transition:width .25s;`);
        fondo.appendChild(barra); c.append(fondo);
      }
      c.append(sub);
      fila.appendChild(c);
      return { c, ic, val, sub, barra };
    };
    this.mineral = chip('◆', 'Mineral', false);
    this.energia = chip('⚡', 'Energía', true, '#ffc83a');
    this.agua = chip('💧', 'Agua', true, '#5fd0ff');
    this.tiempo = chip('☀', 'Día', true, '#ffc83a');
    this.mineral.val.style.color = AMARILLO;

    this.info = el('div', 'font-size:11px;color:#d8c8bf;text-shadow:0 0 3px #000,0 0 3px #000;');
    this.btnAyuda = el('button', `${PANEL}pointer-events:auto;font:inherit;font-size:11px;color:#d8c8bf;cursor:pointer;padding:3px 10px;border-radius:12px;`, '❔ Ayuda (H)');
    this.btnAyuda.tabIndex = -1;
    this.btnAyuda.addEventListener('mousedown', e => e.preventDefault());
    this.btnAyuda.addEventListener('click', () => this.alternarAyuda());
    this.ayuda = el('div', `${PANEL}display:none;padding:10px 12px;grid-template-columns:auto 1fr;gap:4px 14px;font-size:12px;max-width:420px;`);
    for (const [k, v] of AYUDA) this.ayuda.append(el('span', `color:${NARANJA};font-weight:bold;`, k), el('span', 'color:#e8d8d0;', v));

    this.celda = el('div', `${PANEL}position:fixed;left:12px;bottom:12px;padding:5px 12px;border-radius:14px;font:12px monospace;color:#e8d8d0;display:none;pointer-events:none;z-index:10;`);

    this.raiz.append(fila, this.info, this.btnAyuda, this.ayuda);
    document.body.append(this.raiz, this.celda);
    window.addEventListener('keydown', e => { if (e.code === 'KeyH') this.alternarAyuda(); });
  }

  alternarAyuda() { this.ayuda.style.display = this.ayuda.style.display === 'none' ? 'grid' : 'none'; }

  set(clave, valor, fn) { if (this.cache[clave] !== valor) { this.cache[clave] = valor; fn(valor); } }   // solo toca el DOM si cambia

  update({ economia: eco, ciclo, seed, zoom, fps, celda }) {
    this.set('min', Math.floor(eco.mineral), v => { this.mineral.val.textContent = v; });

    const neto = eco.prod - eco.cons, cap = eco.cap, apagon = neto < 0 && eco.energia < .5 && eco.cons > 0;
    this.set('en', `${Math.floor(eco.energia)}|${cap}`, () => { this.energia.val.textContent = `${Math.floor(eco.energia)}/${cap}`; });
    this.set('enb', cap ? Math.round(100 * eco.energia / cap) : 0, v => { this.energia.barra.style.width = v + '%'; });
    this.set('ens', `${neto.toFixed(1)}|${apagon}`, () => {
      this.energia.sub.textContent = apagon ? '⚠ Sin energía' : `${neto >= 0 ? '+' : ''}${neto.toFixed(1)}/s`;
      this.energia.sub.style.color = apagon || neto < 0 ? '#ff6b6b' : '#7dff9e';
      this.energia.barra.style.background = apagon ? '#ff6b6b' : '#ffc83a';
    });

    this.set('ag', `${Math.floor(eco.agua)}|${eco.capAgua}`, () => { this.agua.val.textContent = `${Math.floor(eco.agua)}/${eco.capAgua}`; });
    this.set('agb', Math.round(100 * eco.agua / (eco.capAgua || 1)), v => { this.agua.barra.style.width = v + '%'; });

    const dia = ciclo.esDia, frac = dia ? ciclo.t / DIA : (ciclo.t - DIA) / NOCHE, s = Math.ceil(ciclo.restante());
    this.set('ti', `${dia}|${s}`, () => {
      this.tiempo.ic.textContent = dia ? '☀' : '🌙';
      this.tiempo.val.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      this.tiempo.sub.textContent = dia ? 'Día' : 'Noche · paneles apagados';
      this.tiempo.barra.style.background = dia ? '#ffc83a' : '#7a8cff';
    });
    this.set('tib', Math.round(100 * (1 - frac)), v => { this.tiempo.barra.style.width = v + '%'; });

    this.set('inf', `semilla ${seed} · zoom ${zoom.toFixed(2)} · ${fps} fps`, t => { this.info.textContent = t; });
    this.set('cel', celda, t => { this.celda.textContent = t; this.celda.style.display = t ? 'block' : 'none'; });
  }
}

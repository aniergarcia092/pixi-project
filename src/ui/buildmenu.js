// Menú de construcción: panel a la derecha con descripción, pestañas por categoría y tarjetas de edificios.
// Teclas 1-9, 0, Z, X, V, N, M = elegir edificio (otra vez la misma = quitarlo) · Esc = cancelar · B = abrir / cerrar el menú.

import { EDIFICIOS, CATEGORIAS } from '../edificios/buildings.js';

const NARANJA = '#ff9a2e', AMARILLO = '#ffc83a', BORDE = '#6b4a3a';
const el = (tag, css, txt) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; };
const boton = txt => {                                 // botón que no se queda con el foco (si no, la barra espaciadora lo "pulsaría")
  const b = el('button', '', txt); b.tabIndex = -1;
  b.addEventListener('mousedown', e => e.preventDefault());
  return b;
};

export class BuildMenu {
  constructor(alElegir) {                              // alElegir(id) se llama cada vez que cambia la elección (id o null)
    this.alElegir = alElegir;
    this.actual = null;                                // edificio elegido
    this.hover = null;                                 // tarjeta bajo el ratón
    this.tab = 'recursos';
    this.abierto = true;
    this.lock = false;                                 // true = no se puede construir todavía (el rover no ha salido)
    this.mineral = Infinity;                           // para atenuar lo que no se puede pagar
    this.cards = {};

    this.el = el('div', 'position:fixed;right:12px;top:12px;width:min(380px,calc(100vw - 24px));max-height:calc(100vh - 24px);display:flex;flex-direction:column;align-items:stretch;gap:8px;font:13px monospace;color:#fff;user-select:none;z-index:10;pointer-events:none;');
    this.el.id = 'menu-construir';

    this.msg = el('div', `display:none;align-self:flex-end;max-width:100%;box-sizing:border-box;padding:5px 14px;border-radius:14px;background:rgba(20,12,14,.9);border:2px solid ${BORDE};pointer-events:none;`);   // motivo por el que no se puede construir

    this.panel = el('div', `width:100%;box-sizing:border-box;padding:10px;display:flex;flex-direction:column;gap:8px;overflow-y:auto;background:rgba(20,12,14,.93);border:2px solid ${BORDE};border-radius:12px;pointer-events:auto;`);

    this.info = el('div', `padding:8px 12px;min-height:56px;border:2px solid ${BORDE};border-radius:8px;background:rgba(40,22,18,.9);`);
    this.infoTit = el('div', `color:${NARANJA};font-weight:bold;font-size:15px;`);
    this.infoMeta = el('div', `color:${AMARILLO};font-size:12px;margin:2px 0 4px;`);
    this.infoTxt = el('div', 'line-height:1.35;color:#e8d8d0;');
    this.info.append(this.infoTit, this.infoMeta, this.infoTxt);

    const barra = el('div', 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;');
    this.tabs = {};
    for (const cat of CATEGORIAS) {
      const b = boton(cat.nombre);
      b.addEventListener('click', () => this.cambiarTab(cat.id));
      barra.appendChild(b); this.tabs[cat.id] = b;
    }
    barra.appendChild(el('div', 'flex:1;'));
    this.btnCerrar = boton('✕ Cerrar (B)');
    this.btnCerrar.addEventListener('click', () => this.alternar());
    barra.appendChild(this.btnCerrar);

    this.fila = el('div', 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;min-height:104px;');
    this.panel.append(this.info, barra, this.fila);

    this.btnAbrir = boton('🔨 Construir (B)');
    this.btnAbrir.style.cssText = `display:none;align-self:flex-end;pointer-events:auto;font:inherit;color:#fff;cursor:pointer;padding:8px 14px;border-radius:8px;border:2px solid ${BORDE};background:rgba(20,12,14,.9);`;
    this.btnAbrir.addEventListener('click', () => this.alternar());

    this.el.append(this.msg, this.panel, this.btnAbrir);
    document.body.appendChild(this.el);
    this.renderTarjetas();
    this.pintar();
    this.mostrar(false);                               // empieza cerrado (B lo abre)

    window.addEventListener('keydown', e => {
      if (e.code === 'Escape') this.elegir(null);
      if (e.code === 'KeyB') this.alternar();
      for (const def of Object.values(EDIFICIOS))
        if (e.code === def.code) {
          if (!this.abierto) this.mostrar(true);
          this.elegir(this.actual === def.id ? null : def.id);
        }
    });
  }

  alternar() { this.mostrar(!this.abierto); }

  mostrar(abrir) {
    this.abierto = abrir;
    if (!abrir) this.elegir(null);                     // al cerrar el menú se suelta el edificio
    this.panel.style.display = abrir ? 'flex' : 'none';
    this.btnAbrir.style.display = abrir ? 'none' : 'block';
  }

  cambiarTab(id) { this.tab = id; this.renderTarjetas(); this.pintar(); }

  setBloqueo(b) {
    if (b === this.lock) return;
    this.lock = b;
    if (b) this.elegir(null);
    this.setMensaje(b ? 'Construcción bloqueada: espera a que el rover salga de la nave' : '');
    this.pintar();
  }

  elegir(id) {
    if (id && this.lock) return;
    this.actual = id;
    if (id && this.tab !== EDIFICIOS[id].cat) { this.tab = EDIFICIOS[id].cat; this.renderTarjetas(); }   // salta a la pestaña del edificio
    this.pintar();
    this.alElegir(id);
  }

  setMensaje(txt) { this.msg.textContent = txt; this.msg.style.display = txt ? 'block' : 'none'; }

  setMineral(n) {                                      // lo llama el juego cada fotograma; solo repinta si cambia el número
    n = Math.floor(n);
    if (n !== this.mineral) { this.mineral = n; this.pintar(); }
  }

  renderTarjetas() {
    this.fila.replaceChildren(); this.cards = {};
    const lista = Object.values(EDIFICIOS).filter(d => d.cat === this.tab);
    if (!lista.length) { this.fila.appendChild(el('div', 'color:#9a8678;padding:38px 10px;', 'Próximamente…')); return; }
    for (const def of lista) {
      const c = boton('');
      const coste = el('div', 'margin-top:auto;padding-top:4px;font-size:12px;', `◆ ${def.costo}`);
      c.append(
        el('div', `position:absolute;left:6px;top:6px;width:16px;height:16px;line-height:14px;text-align:center;border:2px solid ${NARANJA};border-radius:4px;color:${NARANJA};font-size:10px;`, def.tecla),
        el('div', 'position:absolute;right:6px;top:6px;width:18px;height:18px;line-height:18px;text-align:center;border-radius:50%;background:#2d8fd5;color:#fff;font-size:11px;font-weight:bold;', 'i'),
        el('div', 'font-size:30px;margin-top:16px;line-height:36px;', def.icono),
        el('div', 'font-size:12px;min-height:30px;display:flex;align-items:center;justify-content:center;text-align:center;', def.nombre),
        coste);
      c.coste = coste;
      c.addEventListener('click', () => this.elegir(this.actual === def.id ? null : def.id));
      c.addEventListener('mouseenter', () => { this.hover = def.id; this.pintar(); });
      c.addEventListener('mouseleave', () => { this.hover = null; this.pintar(); });
      this.fila.appendChild(c); this.cards[def.id] = c;
    }
  }

  pintar() {                                           // resalta lo elegido, atenúa lo que no se puede pagar y actualiza la descripción
    for (const [id, b] of Object.entries(this.tabs)) {
      const on = id === this.tab;
      b.style.cssText = `font:inherit;color:#fff;cursor:pointer;padding:6px 12px;border-radius:16px;border:2px solid ${on ? AMARILLO : BORDE};background:${on ? 'rgba(110,60,30,.95)' : 'rgba(20,12,14,.85)'};`;
    }
    this.btnCerrar.style.cssText = `font:inherit;color:#fff;cursor:pointer;padding:6px 12px;border-radius:16px;border:2px solid ${BORDE};background:rgba(20,12,14,.85);`;
    for (const [id, c] of Object.entries(this.cards)) {
      const on = id === this.actual, pobre = this.lock || this.mineral < EDIFICIOS[id].costo;
      c.style.cssText = `position:relative;width:112px;padding:6px 4px;box-sizing:border-box;font:inherit;color:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;border-radius:10px;border:2px solid ${on ? AMARILLO : id === this.hover ? '#a0725a' : BORDE};background:${on ? 'rgba(110,60,30,.95)' : 'rgba(20,12,14,.85)'};opacity:${pobre && !on ? .55 : 1};`;
      c.coste.style.color = pobre ? '#ff6b6b' : AMARILLO;
    }
    const def = EDIFICIOS[this.hover || this.actual];
    if (def) {
      this.infoTit.textContent = def.nombre;
      this.infoMeta.textContent = `◆ ${def.costo} · ${def.w}x${def.h} casilla${def.w * def.h > 1 ? 's' : ''}${def.sobre === 'ore' ? ' · sobre un depósito de mineral' : def.sobre === 'ice' ? ' · sobre un depósito de hielo' : ''}${def.alcance ? ` · cable ${def.alcance} casillas` : ''} · ⏱ ${def.tiempo}s`;
      this.infoTxt.textContent = def.descripcion;
    } else {
      this.infoTit.textContent = 'Construcción';
      this.infoMeta.textContent = '';
      this.infoTxt.textContent = 'Elige un edificio o pulsa su tecla. Clic izquierdo: construir · Clic derecho o Esc: cancelar · B: cerrar el menú.';
    }
  }
}

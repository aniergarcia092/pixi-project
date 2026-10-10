// Tutorial de bienvenida: un comandante habla por radio cuando la nave aterriza. Clic en el cuadro o Intro = siguiente · "Saltar" = cerrarlo.

import { sfx } from '../audio/sonido.js';

const NARANJA = '#ff9a2e', AMARILLO = '#ffc83a', BORDE = '#6b4a3a';
const PASOS = [
  '¡Hola, comandante! Arribamos sin problemas. Hora de tomar este planeta.',
  'Ya sale el rover. Conduce con WASD o las flechas (Shift = rápido). Arrastra para mover la cámara y pulsa Espacio para volver a seguirlo.',
  'Pulsa B para abrir el menú de construcción. Solo se puede construir en la zona amarilla de 3x3 que rodea al rover: muévelo para construir más lejos.',
  'Empieza con un Minero sobre un depósito de mineral (las rocas con puntos dorados) y un Panel solar con una Batería para darle energía. Se conectan solos con cable.',
  'Cuidado: de noche los paneles no producen. Guarda energía en baterías o usa hélices eólicas. Y pronto llegarán enemigos: levanta Torretas.',
  '¡Buena suerte, comandante! Cambio y corto.',
];

const AVATAR = `<svg viewBox="0 0 64 64" width="64" height="64" xmlns="http://www.w3.org/2000/svg">
<defs><radialGradient id="tutVisor" cx=".3" cy=".25" r=".9"><stop offset="0" stop-color="#9fe0ff"/><stop offset=".55" stop-color="#2d78c0"/><stop offset="1" stop-color="#12284d"/></radialGradient></defs>
<rect width="64" height="64" fill="#1d242d"/>
<path d="M4 66 Q32 42 60 66Z" fill="#ff9a2e" stroke="#14171c" stroke-width="2.5"/>
<rect x="24" y="52" width="16" height="6" rx="2" fill="#8d99a8" stroke="#14171c" stroke-width="2"/>
<circle cx="32" cy="30" r="22" fill="#dfe6ee" stroke="#14171c" stroke-width="3"/>
<path d="M12 24 Q32 6 52 24" fill="none" stroke="#ff9a2e" stroke-width="4" stroke-linecap="round"/>
<rect x="15" y="22" width="34" height="23" rx="11.5" fill="url(#tutVisor)" stroke="#14171c" stroke-width="2.5"/>
<ellipse cx="25" cy="28" rx="7" ry="3" fill="#fff" opacity=".55" transform="rotate(-22 25 28)"/>
<circle cx="45" cy="38" r="1.8" fill="#fff" opacity=".6"/>
<rect x="29.5" y="2" width="5" height="9" rx="2" fill="#8d99a8" stroke="#14171c" stroke-width="2"/>
<circle cx="32" cy="3" r="2.2" fill="#ff4a5a"/>
</svg>`;

const el = (tag, css, txt) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (txt != null) e.textContent = txt; return e; };

export class Tutorial {
  constructor() {
    this.paso = 0; this.timer = null; this.iniciado = false; this.completo = false;
    const st = document.createElement('style');
    st.textContent = `@keyframes tutAro{0%,100%{box-shadow:0 0 0 0 rgba(255,200,58,.5)}50%{box-shadow:0 0 0 7px rgba(255,200,58,0)}}
@keyframes tutParpadeo{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes tutOnda{0%,100%{transform:scaleY(.25)}50%{transform:scaleY(1)}}
.tutBarra{width:3px;height:14px;border-radius:2px;background:${AMARILLO};transform-origin:center;animation:tutOnda .5s ease-in-out infinite;animation-play-state:paused;transform:scaleY(.25)}
.tutHabla .tutBarra{animation-play-state:running}`;
    document.head.appendChild(st);

    this.el = el('div', `position:fixed;right:14px;top:190px;transform:translateX(40px);opacity:0;transition:transform .5s ease,opacity .5s ease;width:min(390px,calc(100vw - 28px));box-sizing:border-box;padding:12px 14px 10px 12px;display:none;gap:12px;align-items:flex-start;font:14px monospace;color:#fff;user-select:none;z-index:20;background:linear-gradient(160deg,rgba(38,22,18,.97),rgba(16,9,11,.97));border:2px solid ${BORDE};border-left:5px solid ${AMARILLO};border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.55);cursor:pointer;`);
    this.cara = el('div', `flex:none;width:64px;height:64px;border-radius:12px;overflow:hidden;border:2px solid ${AMARILLO};animation:tutAro 1.8s infinite;`);
    this.cara.innerHTML = AVATAR;

    const col = el('div', 'flex:1;min-width:0;');
    const cab = el('div', 'display:flex;align-items:center;gap:8px;margin-bottom:5px;');
    this.nombre = el('div', `color:${NARANJA};font-weight:bold;font-size:14px;`, 'Comandante');
    const radio = el('div', 'color:#9a8678;font-size:10px;letter-spacing:1px;', '· RADIO');
    this.ondas = el('div', 'display:flex;align-items:center;gap:2px;margin-left:auto;height:16px;');
    for (let i = 0; i < 5; i++) { const b = el('div'); b.className = 'tutBarra'; b.style.animationDelay = (i * .09) + 's'; this.ondas.appendChild(b); }
    cab.append(this.nombre, radio, this.ondas);

    this.texto = el('div', 'line-height:1.5;color:#efe2da;min-height:64px;');
    const pie = el('div', 'display:flex;align-items:center;gap:10px;margin-top:6px;');
    this.cuenta = el('div', 'color:#9a8678;font-size:11px;');
    this.sig = el('div', `color:${AMARILLO};font-size:12px;animation:tutParpadeo 1s infinite;`, '▶ Clic o Intro');
    this.saltar = el('button', `margin-left:auto;font:inherit;font-size:11px;color:#d8c8bf;cursor:pointer;padding:3px 10px;border-radius:12px;border:2px solid ${BORDE};background:rgba(20,12,14,.85);`, 'Saltar');
    this.saltar.tabIndex = -1;
    this.saltar.addEventListener('mousedown', e => e.preventDefault());
    this.saltar.addEventListener('click', e => { e.stopPropagation(); this.cerrar(); });
    pie.append(this.cuenta, this.sig, this.saltar);
    col.append(cab, this.texto, pie);
    this.el.append(this.cara, col);
    this.el.addEventListener('pointerdown', e => e.stopPropagation());
    this.el.addEventListener('click', () => this.siguiente());
    document.body.appendChild(this.el);
    window.addEventListener('keydown', e => { if (this.iniciado && !this.completo && e.code === 'Enter') this.siguiente(); });
  }

  iniciar(retardoMs = 0) {                             // se llama cuando aterriza la nave (solo arranca una vez)
    if (this.iniciado) return;
    this.iniciado = true;
    setTimeout(() => {
      if (this.completo) return;
      this.el.style.display = 'flex';
      requestAnimationFrame(() => requestAnimationFrame(() => { this.el.style.opacity = '1'; this.el.style.transform = 'translateX(0)'; }));
      sfx.play('mensaje');
      this.mostrar(0);
    }, retardoMs);
  }

  mostrar(i) {                                         // escribe el mensaje letra a letra
    this.paso = i; this.escrito = false;
    if (i > 0) sfx.play('radio');
    const txt = PASOS[i]; let n = 0;
    this.cuenta.textContent = `${i + 1}/${PASOS.length}`;
    this.sig.style.visibility = 'hidden';
    this.el.classList.add('tutHabla');
    clearInterval(this.timer);
    this.texto.textContent = '';
    this.timer = setInterval(() => {
      n += 2; this.texto.textContent = txt.slice(0, n);
      if (n % 4 === 0) sfx.play('habla');
      if (n >= txt.length) this.terminarTexto();
    }, 28);
  }

  terminarTexto() {
    clearInterval(this.timer); this.escrito = true;
    this.el.classList.remove('tutHabla');
    this.texto.textContent = PASOS[this.paso];
    this.sig.style.visibility = 'visible';
    this.sig.textContent = this.paso === PASOS.length - 1 ? '▶ Cerrar' : '▶ Clic o Intro';
  }

  siguiente() {
    if (this.completo) return;
    sfx.play('click');
    if (!this.escrito) { this.terminarTexto(); return; }          // primer clic: completa el texto
    if (this.paso >= PASOS.length - 1) this.cerrar(); else this.mostrar(this.paso + 1);
  }

  cerrar() {
    this.completo = true; clearInterval(this.timer);
    this.el.style.opacity = '0'; this.el.style.transform = 'translateX(40px)';
    setTimeout(() => { this.el.style.display = 'none'; }, 500);
  }
}

// Ciclo de día y noche: 7 min de día y 5 min de noche (con un atardecer y un amanecer suaves).
// Los paneles solares solo producen con luz (ciclo.sol: 1 = día, 0 = noche). La noche oscurece la pantalla.

import { Graphics } from 'pixi.js';
import { clamp, smooth } from '../nucleo/noise.js';

export const DIA = 420;               // segundos de día
export const NOCHE = 300;             // segundos de noche
const TRANS = 40;                     // segundos que dura el atardecer / el amanecer (dentro de cada fase)
const OSCURO = .55;                   // opacidad máxima de la oscuridad nocturna

class Ciclo {
  constructor() {
    this.t = 0;                       // segundos dentro del ciclo (empieza al comenzar el día)
    this.sol = 1;
    this.overlay = new Graphics();
    this.overlay.eventMode = 'none';
    this.ultimo = '';
  }

  reset() { this.t = 0; this.sol = 1; this.ultimo = ''; }

  get esDia() { return this.t < DIA; }

  restante() { return this.esDia ? DIA - this.t : DIA + NOCHE - this.t; }

  texto() {
    const s = Math.ceil(this.restante()), m = Math.floor(s / 60);
    return `${this.esDia ? '☀ Día' : '🌙 Noche'} ${m}:${String(s % 60).padStart(2, '0')}`;
  }

  update(dtMs, w, h) {
    this.t = (this.t + Math.min(dtMs, 100) / 1000) % (DIA + NOCHE);
    const t = this.t;
    if (t < DIA - TRANS) this.sol = 1;
    else if (t < DIA) this.sol = 1 - smooth((t - (DIA - TRANS)) / TRANS);                  // atardecer
    else if (t < DIA + NOCHE - TRANS) this.sol = 0;
    else this.sol = smooth((t - (DIA + NOCHE - TRANS)) / TRANS);                           // amanecer
    const noche = (1 - this.sol) * OSCURO, calido = 4 * this.sol * (1 - this.sol) * .12;   // el naranja solo se nota al amanecer / atardecer
    const clave = `${w}x${h}|${noche.toFixed(3)}|${calido.toFixed(3)}`;
    if (clave === this.ultimo) return;
    this.ultimo = clave;
    this.overlay.clear();
    if (calido > .002) this.overlay.rect(0, 0, w, h).fill({ color: 0xff7a30, alpha: calido });
    if (noche > .002) this.overlay.rect(0, 0, w, h).fill({ color: 0x070b2a, alpha: noche });
  }
}

export const ciclo = new Ciclo();

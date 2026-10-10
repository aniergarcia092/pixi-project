// Música de fondo: ambiente generativo sintetizado con WebAudio (acordes suaves + notas sueltas con eco). Sin archivos de audio.
// Usa el mismo AudioContext que los sonidos (se activa con el primer clic o tecla). I = música on/off · U = silenciar todo.

import { sfx } from './sonido.js';

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);                // nota MIDI → Hz
const ACORDES = [[57, 60, 64], [53, 57, 60, 64], [55, 60, 64], [55, 59, 62]];   // La menor · Fa · Do · Sol
const ESCALA = [69, 72, 74, 76, 79, 81, 84];                       // pentatónica de La menor (para las notas sueltas)
const DUR = 8;                                                     // segundos por acorde
const VOLUMEN = .22;

class Musica {
  constructor() {
    this.ctx = null; this.off = false; this.i = 0; this.tAcorde = 0; this.tNota = 0; this.acorde = ACORDES[0];
    window.addEventListener('keydown', e => { if (e.code === 'KeyI') this.off = !this.off; });
    setInterval(() => this.tick(), 200);
  }

  iniciar() {                                                      // monta el eco cuando el AudioContext de los sonidos ya existe
    const c = sfx.ctx;
    if (!c || this.ctx === c) return;
    this.ctx = c;
    this.out = c.createGain(); this.out.gain.value = 0; this.out.connect(c.destination);
    const eco = c.createDelay(2), fb = c.createGain(), lp = c.createBiquadFilter();
    eco.delayTime.value = .45; fb.gain.value = .4; lp.type = 'lowpass'; lp.frequency.value = 1800;
    eco.connect(lp); lp.connect(fb); fb.connect(eco); lp.connect(this.out);
    this.envio = c.createGain(); this.envio.gain.value = .5; this.envio.connect(eco);
    this.tAcorde = this.tNota = c.currentTime + .3;
  }

  tick() {
    this.iniciar();
    const c = this.ctx;
    if (!c) return;
    const callado = this.off || sfx.mudo || c.state !== 'running';
    this.out.gain.setTargetAtTime(callado ? 0 : VOLUMEN, c.currentTime, .5);
    if (c.state !== 'running') return;
    if (this.tAcorde < c.currentTime - 1) this.tAcorde = this.tNota = c.currentTime;     // si la pestaña estuvo dormida, no acumula
    while (this.tAcorde < c.currentTime + 1) { this.tocarAcorde(this.tAcorde, ACORDES[this.i++ % ACORDES.length]); this.tAcorde += DUR; }
    while (this.tNota < c.currentTime + 1) { this.tocarNota(this.tNota); this.tNota += .9 + Math.random() * 1.8; }
  }

  tocarAcorde(t, acorde) {
    const c = this.ctx; this.acorde = acorde;
    const voz = (midi, tipo, vol, filtro, eco, dets) => {          // nota larga con subida y bajada lentas
      const f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'lowpass'; f.frequency.value = filtro;
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + 2.5);
      g.gain.setValueAtTime(vol, t + DUR - 2); g.gain.linearRampToValueAtTime(.0001, t + DUR + 2.5);
      for (const det of dets) {
        const o = c.createOscillator(); o.type = tipo; o.frequency.value = mtof(midi); o.detune.value = det;
        o.connect(f); o.start(t); o.stop(t + DUR + 2.6);
      }
      f.connect(g); g.connect(this.out); if (eco) g.connect(this.envio);
    };
    for (const m of acorde) voz(m, 'triangle', .05, 800, true, [-7, 7]);   // acorde
    voz(acorde[0] - 12, 'sine', .13, 400, false, [0]);                      // bajo
  }

  tocarNota(t) {                                                    // nota suelta tipo campanilla, casi siempre del acorde actual
    if (Math.random() < .35) return;                                // a veces se queda en silencio
    const c = this.ctx;
    const midi = Math.random() < .7 ? this.acorde[Math.floor(Math.random() * this.acorde.length)] + 12 * (1 + Math.floor(Math.random() * 2))
      : ESCALA[Math.floor(Math.random() * ESCALA.length)];
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = mtof(midi);
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.07, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + 2);
    o.connect(g); g.connect(this.out); g.connect(this.envio);
    o.start(t); o.stop(t + 2.1);
  }
}

export const musica = new Musica();

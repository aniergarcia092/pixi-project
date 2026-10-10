// Sonidos del juego, sintetizados con WebAudio (no hay archivos de audio). Se activan con el primer clic o tecla. U = silenciar / activar.

const GAP = { laser: .12, laser2: .12, golpe: .25, muerte: .08, motor: .4, habla: .05, baliza: .9, orugas: .2 };   // segundos mínimos entre dos repeticiones del mismo sonido

class Sonido {
  constructor() {
    this.ctx = null; this.mudo = false; this.ult = {};
    const iniciar = () => {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.gain.value = .5; this.master.connect(this.ctx.destination);
        const n = this.ctx.sampleRate;                                 // 1 s de ruido blanco reutilizable
        this.buf = this.ctx.createBuffer(1, n, n);
        const d = this.buf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    };
    window.addEventListener('pointerdown', iniciar);
    window.addEventListener('keydown', iniciar);
    window.addEventListener('keydown', e => { if (e.code === 'KeyU') { this.mudo = !this.mudo; if (!this.mudo) this.play('click'); } });
  }

  tono(f, dur, tipo = 'sine', vol = .1, f2 = null, ret = 0) {          // pitido que puede subir o bajar de tono
    const c = this.ctx, t = c.currentTime + ret, o = c.createOscillator(), g = c.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .02);
  }

  ruido(dur, vol = .1, freq = 1000, ret = 0) {                         // golpe / explosión (ruido filtrado)
    const c = this.ctx, t = c.currentTime + ret, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.buf; f.type = 'lowpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + .02);
  }

  play(nombre) {
    if (!this.ctx || this.mudo || this.ctx.state !== 'running') return false;
    const ahora = this.ctx.currentTime;
    if (GAP[nombre] && ahora - (this.ult[nombre] || -9) < GAP[nombre]) return false;
    this.ult[nombre] = ahora;
    const s = SONIDOS[nombre]; if (s) s(this);
    return true;
  }
}

const SONIDOS = {
  click:     s => s.tono(660, .06, 'square', .06),
  cancelar:  s => s.tono(360, .1, 'square', .06, 220),
  error:     s => { s.tono(170, .14, 'sawtooth', .1); s.tono(150, .16, 'sawtooth', .1, null, .15); },
  construir: s => { s.ruido(.14, .18, 900); s.tono(130, .14, 'square', .14, 70); },
  terminado: s => [520, 660, 880].forEach((f, i) => s.tono(f, .16, 'triangle', .1, null, i * .08)),
  mejora:    s => { [440, 554, 659, 880].forEach((f, i) => s.tono(f, .2, 'square', .06, null, i * .07)); s.tono(1760, .5, 'sine', .06, 2200, .3); },
  combo:     s => { s.tono(200, .6, 'sawtooth', .07, 1200); s.tono(1320, .6, 'sine', .1, null, .5); s.tono(1760, .6, 'sine', .07, null, .6); },
  laser:     s => s.tono(900, .08, 'sawtooth', .04, 400),
  laser2:    s => s.tono(1200, .08, 'sine', .05, 700),
  golpe:     s => s.ruido(.07, .08, 1500),
  muerte:    s => { s.ruido(.25, .14, 500); s.tono(220, .25, 'square', .08, 60); },
  destruido: s => { s.ruido(.6, .25, 350); s.tono(90, .5, 'sawtooth', .14, 40); },
  alarma:    s => { s.tono(220, .15, 'square', .06); s.tono(165, .2, 'square', .06, null, .17); },
  mecha:     s => { s.tono(300, .2, 'square', .07, 600); s.tono(800, .12, 'triangle', .07, null, .2); },
  aterriza:  s => { s.ruido(1.2, .32, 500); s.tono(60, 1, 'sine', .32, 26); s.tono(120, .25, 'square', .1, 50); s.ruido(.6, .08, 3000, .25); s.tono(45, .6, 'sine', .25, 30, .3); },
  mensaje:   s => { s.ruido(.35, .06, 4500); [660, 880].forEach((f, i) => s.tono(f, .12, 'square', .05, null, .15 + i * .1)); },
  radio:     s => { s.ruido(.18, .05, 5000); s.tono(1200, .06, 'sine', .05); s.tono(900, .06, 'sine', .04, null, .08); },
  habla:     s => { const f = 280 + Math.random() * 380; s.tono(f, .05, 'square', .05); s.tono(f * 1.5, .04, 'triangle', .03, null, .025); if (Math.random() < .25) s.ruido(.03, .03, 5000); },
  entrada:   s => { s.ruido(3.4, .14, 2200); s.tono(320, 3.2, 'sawtooth', .04, 70); s.tono(160, 3.2, 'sine', .06, 50); },
  baliza:    s => { s.tono(1000, .08, 'square', .04); s.tono(1000, .08, 'square', .04, null, .14); },
  patas:     s => { s.ruido(.25, .14, 900); s.tono(160, .3, 'square', .09, 90); s.ruido(.15, .18, 500, .4); s.tono(90, .15, 'square', .12, 60, .4); },
  escotilla: s => { s.ruido(.45, .1, 3500); s.tono(120, .5, 'sawtooth', .06, 210); s.ruido(.12, .2, 600, .45); s.tono(80, .12, 'square', .14, 50, .45); },
  rampa:     s => { s.tono(220, .5, 'sawtooth', .05, 420); s.tono(300, .5, 'triangle', .04, 520); s.ruido(.5, .06, 2500); s.ruido(.12, .22, 500, .5); s.tono(70, .12, 'square', .14, 45, .5); },
  rover_arranca: s => { s.tono(90, .7, 'sawtooth', .08, 190); s.tono(60, .7, 'square', .05, 120); s.tono(600, .12, 'triangle', .06, 900, .55); s.tono(900, .12, 'triangle', .06, null, .7); },
  desacople: s => { s.ruido(.2, .2, 700); s.tono(140, .25, 'square', .12, 60); s.ruido(.3, .08, 2500, .15); },
  acople:    s => { s.tono(260, .4, 'sawtooth', .05, 520); s.ruido(.3, .1, 2800); s.ruido(.12, .22, 500, .4); s.tono(75, .14, 'square', .14, 45, .4); [660, 880, 1100].forEach((f, i) => s.tono(f, .15, 'triangle', .07, null, .55 + i * .08)); },
  orugas:    s => { s.ruido(.12, .06, 700); s.tono(70, .12, 'square', .05, 55); },
  rampa_guarda: s => { s.tono(420, .5, 'sawtooth', .05, 200); s.tono(520, .5, 'triangle', .04, 300); s.ruido(.5, .06, 2500); s.ruido(.12, .2, 500, .5); },
  escotilla_cierra: s => { s.ruido(.3, .1, 3500); s.tono(210, .4, 'sawtooth', .06, 110); s.ruido(.12, .22, 500, .4); s.tono(70, .15, 'square', .14, 40, .4); },
  canon:     s => { s.ruido(.16, .2, 900); s.tono(150, .18, 'square', .12, 60); },
  motor:     s => { s.ruido(.6, .12, 280); s.tono(55, .6, 'sawtooth', .05, 42); },
};

export const sfx = new Sonido();

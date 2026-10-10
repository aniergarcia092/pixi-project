// La nave: se dibuja desde arriba con Graphics. Desciende con propulsores, despliega las patas, levanta polvo al posarse y tiene una escotilla con rampa.

import { Container, Graphics } from 'pixi.js';
import { TILE } from '../nucleo/config.js';
import { clamp } from '../nucleo/noise.js';
import { sfx } from '../audio/sonido.js';

const DURACION = 4500;                       // milisegundos que tarda en aterrizar
const ESCALA = 1.35;                         // tamaño de la nave (así el rover se ve más pequeño a su lado)
const HW = 24, HH = 13;                      // media anchura y media altura de la escotilla
const HX = 0, HY = 58;                       // posición de la escotilla respecto al centro (abajo, en el borde del casco)
const L_RAMPA = 104;                         // largo de la rampa
const PATAS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const LUCES = [0, 1, 3, 4, 5, 6, 7];            // luces del casco en los bordes de las placas (la 2 es la de la escotilla)
const L = 0x14171c;
const ngon = (n, r, rot = 0, cx = 0, cy = 0) => {      // puntos de un polígono regular
  const p = [];
  for (let i = 0; i < n; i++) { const a = rot + i * 2 * Math.PI / n; p.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  return p;
};

export class Ship {
  constructor(tx, ty) {
    this.x = (tx + .5) * TILE; this.y = (ty + .5) * TILE;
    this.t = 0;
    this.landed = false;                     // cuando es true, el rover puede salir
    this.hx = HX * ESCALA; this.hy = HY * ESCALA;   // el rover sale por aquí (en coordenadas del mundo)
    this.alto = 1;                           // 1 = muy arriba · 0 = en el suelo
    this.reloj = 0; this.k = 0;              // reloj para parpadeos · intensidad de los propulsores
    this.parts = [];                         // partículas de polvo

    this.container = new Container();
    this.container.position.set(this.x, this.y);
    this.container.scale.set(ESCALA);

    this.suelo = new Graphics();             // luz de los propulsores sobre el suelo
    this.shadow = new Graphics().ellipse(0, 0, 90, 90).fill({ color: 0x000000, alpha: 1 });
    this.dust = new Graphics();
    this.body = new Container();
    this.llamas = new Graphics();
    this.patas = this.drawLegs();
    this.luces = new Graphics();
    this.buildHatch();
    this.body.addChild(this.llamas, this.patas, this.drawHull(), this.luces, this.ramp, this.doorL, this.doorR);

    this.container.addChild(this.suelo, this.shadow, this.dust, this.body);
    this.setHatch(0, 0);
    this.update(0);
  }

  drawLegs() {                                         // 4 puntales con riostras y bases octogonales con tobera
    const c = new Container(), g = new Graphics();
    for (const [dx, dy] of PATAS) {
      const ax = dx * 34, ay = dy * 34, bx = dx * 60, by = dy * 60, px = -dy * .7071, py = dx * .7071;   // px, py = dirección perpendicular a la viga
      g.poly([ax + px * 8, ay + py * 8, bx + px * 5.5, by + py * 5.5, bx - px * 5.5, by - py * 5.5, ax - px * 8, ay - py * 8]).fill(0x6b7684).stroke({ width: 2.5, color: L });
      for (const k of [.3, .6]) {                      // riostras
        const cx = ax + (bx - ax) * k, cy = ay + (by - ay) * k, w = 8 - 2.5 * k;
        g.moveTo(cx + px * w, cy + py * w).lineTo(cx - px * w, cy - py * w).stroke({ width: 2, color: 0x3a414b });
      }
      g.moveTo(ax, ay).lineTo(bx, by).stroke({ width: 2, color: 0x9aa5b3 });
      const x = dx * 62, y = dy * 62;
      g.poly(ngon(8, 16, Math.PI / 8, x, y)).fill(0x59616d).stroke({ width: 3, color: L });                 // base
      g.poly(ngon(8, 11.5, Math.PI / 8, x, y)).fill(0x3a414b).stroke({ width: 1.5, color: 0x8d99a8 });
      for (let k = 0; k < 4; k++) {                    // franjas de aviso alrededor de la base
        const a = k * Math.PI / 2 + Math.PI / 4;
        g.poly(ngon(4, 2.6, a, x + Math.cos(a) * 13.2, y + Math.sin(a) * 13.2)).fill(0xffc83a);
      }
      g.poly(ngon(6, 6, 0, x, y)).fill(0x14171c).stroke({ width: 1.5, color: 0x6b7684 });                    // tobera
      g.circle(x - 3, y - 3, 1.8).fill({ color: 0xffffff, alpha: .35 });
    }
    c.addChild(g);
    return c;
  }

  drawHull() {
    const g = new Graphics(), A = Math.PI / 4;
    g.poly(ngon(8, 78, Math.PI / 8)).fill(0x59616d).stroke({ width: 4, color: L });                  // marco exterior
    g.poly(ngon(8, 71, Math.PI / 8)).fill(0xcfd6df).stroke({ width: 2, color: 0x8d99a8 });           // casco
    g.poly(ngon(8, 60, Math.PI / 8, -6, -6)).fill({ color: 0xffffff, alpha: .14 });                   // luz desde arriba a la izquierda
    for (let i = 0; i < 8; i++) {                                                                    // placas de blindaje
      const a0 = i * A + .05, a1 = (i + 1) * A - .05, m = (a0 + a1) / 2, tx = -Math.sin(m), ty = Math.cos(m);
      const P = (a, r) => [Math.cos(a) * r, Math.sin(a) * r];
      g.poly([...P(a0, 42), ...P(a0, 67), ...P(a1, 67), ...P(a1, 42)]).fill(i % 2 ? 0xaeb8c4 : 0x9aa5b3).stroke({ width: 1.5, color: 0x59616d });
      for (const r of [51, 56]) {                                                                    // rejillas de ventilación
        const cx = Math.cos(m) * r, cy = Math.sin(m) * r;
        g.moveTo(cx - tx * 9, cy - ty * 9).lineTo(cx + tx * 9, cy + ty * 9).stroke({ width: 2, color: 0x59616d });
      }
      for (const a of [a0 + .07, a1 - .07]) { const [bx, by] = P(a, 63); g.rect(bx - 1.2, by - 1.2, 2.4, 2.4).fill(0x59616d); }   // tornillos
      if (i % 2 === 0) {                                                                             // franja naranja en el borde de las placas pares
        const pts = []; for (let k = 0; k <= 4; k++) pts.push(...P(a0 + .05 + (a1 - a0 - .1) * k / 4, 66));
        g.poly(pts, false).stroke({ width: 2.5, color: 0xff9a2e });
      }
    }
    g.poly(ngon(8, 43, Math.PI / 8)).fill(0x3a414b).stroke({ width: 3, color: L });                  // surco entre anillos
    g.poly(ngon(8, 38, Math.PI / 8)).fill(0x8d99a8).stroke({ width: 2, color: L });                  // cubierta interior
    g.rect(-35, -4, 70, 8).fill(0x7f8b9a); g.rect(-4, -35, 8, 70).fill(0x7f8b9a);                    // vigas cruzadas
    for (const [x, y] of [[-25, -25], [25, -25], [-25, 25], [25, 25]]) {                             // paneles de la cubierta
      g.roundRect(x - 9, y - 9, 18, 18, 3).fill(0x9aa5b3).stroke({ width: 1.5, color: 0x59616d });
      g.rect(x - 5, y - 1, 10, 2).fill(0x59616d);
    }
    g.poly(ngon(6, 25, Math.PI / 6)).fill(0x6b7684).stroke({ width: 3, color: L });                  // núcleo hexagonal
    g.circle(0, 0, 17).fill(0x3d8fd1).stroke({ width: 2.5, color: L });                              // cúpula
    g.circle(-5, -6, 5.5).fill({ color: 0xffffff, alpha: .5 });
    for (const a of [-Math.PI / 2, 2.6, .55]) {                                                      // sensores en el borde
      const x = Math.cos(a) * 56, y = Math.sin(a) * 56;
      g.roundRect(x - 5, y - 5, 10, 10, 2).fill(0x3d8fd1).stroke({ width: 2, color: L });
      g.circle(x - 1.5, y - 1.5, 1.5).fill({ color: 0xffffff, alpha: .7 });
    }
    g.moveTo(-38, -36).lineTo(-46, -50).stroke({ width: 2.5, color: L });                            // antena
    g.circle(-38, -36, 3.5).fill(0x59616d).stroke({ width: 2, color: L }); g.circle(-46, -50, 2.4).fill(0xff4a5a);
    // escotilla (abajo, en el borde del casco): marco gris, hueco oscuro y franja naranja debajo
    g.rect(HX - HW - 8, HY + HH + 6, 2 * HW + 16, 4).fill(0xff9a2e).stroke({ width: 1.5, color: L });
    g.roundRect(HX - HW - 5, HY - HH - 5, 2 * HW + 10, 2 * HH + 10, 4).fill(0x6b7684).stroke({ width: 3, color: L });
    g.rect(HX - HW, HY - HH, 2 * HW, 2 * HH).fill(0x0d1118);
    return g;
  }

  // La escotilla es un portón de lamas: sus dos mitades (arriba y abajo) se encogen hacia los bordes al abrirse y la rampa se estira hacia abajo.
  buildHatch() {
    const mitad = (y0, h) => {
      const d = new Graphics();
      d.rect(0, y0, 2 * HW, h).fill(0x8d99a8).stroke({ width: 2.5, color: L });
      d.rect(4, y0 + h * .35, 2 * HW - 8, 2).fill(0x59616d);
      d.rect(4, y0 + h * .7, 2 * HW - 8, 2).fill(0x59616d);
      return d;
    };
    this.doorL = mitad(0, HH);                         // mitad de arriba (se encoge hacia arriba)
    this.doorL.position.set(HX - HW, HY - HH);
    this.doorR = mitad(-HH, HH);                       // mitad de abajo (se encoge hacia abajo)
    this.doorR.position.set(HX - HW, HY + HH);

    this.ramp = new Graphics();
    this.ramp.position.set(HX, HY);
    this.ramp.rect(-21, 0, 42, L_RAMPA).fill(0x59616d).stroke({ width: 3, color: L });
    for (let y = 10; y < L_RAMPA - 4; y += 12) this.ramp.rect(-17, y, 34, 3).fill(0x3a414b);
  }

  setHatch(abierta, rampa) {
    this.doorL.scale.y = this.doorR.scale.y = Math.max(0.001, 1 - abierta);
    this.doorL.visible = this.doorR.visible = abierta < .98;
    this.ramp.scale.y = Math.max(0.001, rampa);
    this.ramp.visible = rampa > .01;
  }

  colisiones() {                                       // círculos {x, y, r} en coordenadas del mundo (con la escala de la nave)
    const c = [{ x: this.x, y: this.y, r: 76 * ESCALA }];
    for (const [dx, dy] of PATAS) c.push({ x: this.x + dx * 62 * ESCALA, y: this.y + dy * 62 * ESCALA, r: 17 * ESCALA });
    return c;
  }

  emitir(n, x, y, vel) {                                            // polvo que sale disparado desde (x, y) hacia fuera
    for (let i = 0; i < n; i++) {
      const a = Math.atan2(y, x) + (Math.random() - .5) * 1.6, v = vel * (.4 + Math.random() * .6);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 6 + Math.random() * 10, life: 0, max: .7 + Math.random() * .8 });
    }
  }

  update(dtMs) {
    const dt = Math.min(dtMs, 100) / 1000;
    this.reloj += dt;
    if (!this.landed) {
      this.t = Math.min(DURACION, this.t + dtMs);
      const p = this.t / DURACION, e = 1 - Math.pow(1 - p, 3), alto = 1 - e;
      this.alto = alto;
      if (!this.sEntrada && this.t > 0 && sfx.play('entrada')) this.sEntrada = true;        // zumbido de entrada en la atmósfera
      if (this.t > 0) sfx.play('baliza');                                                    // pitido de aviso
      if (p > .55 && !this.sPatas) { this.sPatas = true; sfx.play('patas'); }               // las patas se despliegan
      this.body.y = -alto * 260;
      this.body.scale.set(1 + alto * .6);
      this.body.rotation = Math.sin(this.t * .003) * .07 * alto;       // pequeño balanceo mientras baja
      this.patas.scale.set(.72 + .28 * clamp((p - .3) / .45, 0, 1));    // las patas se despliegan
      this.shadow.scale.set(1 + alto * .5);
      this.shadow.alpha = .12 + e * .28;
      this.k = clamp(alto * 8, 0, 1) * (.85 + Math.random() * .15);     // propulsores a tope hasta casi tocar suelo
      if (alto < .4) for (const [dx, dy] of PATAS) if (Math.random() < dt * 45) this.emitir(1, dx * 62, dy * 62, 90 + (1 - alto) * 120);
      if (this.t >= DURACION) {
        this.landed = true; this.t = 0; this.k = 0;
        for (let i = 0; i < 36; i++) { const a = Math.random() * 6.283; this.emitir(1, Math.cos(a) * 66, Math.sin(a) * 66, 180); }
      }
    } else {
      this.alto = 0;
      this.t += dtMs;
      const s = this.t < 450 ? 1 - .045 * Math.sin(this.t / 450 * Math.PI) : 1;   // pequeño rebote al apoyarse
      this.body.scale.set(s); this.body.y = 0; this.body.rotation = 0; this.patas.scale.set(1);
      this.shadow.scale.set(1); this.shadow.alpha = .4;
      this.k = 0;
    }

    const k = this.k, f = this.llamas.clear();                         // propulsores en cada pata
    if (k > .02) for (const [dx, dy] of PATAS) {
      const px = dx * 62 * this.patas.scale.x, py = dy * 62 * this.patas.scale.x, r = (12 + 16 * k) * (.85 + Math.random() * .3);
      f.circle(px, py, r * 1.9).fill({ color: 0xff6a20, alpha: .22 * k });
      f.circle(px, py, r * 1.1).fill({ color: 0xffa040, alpha: .55 * k });
      f.circle(px, py, r * .5).fill({ color: 0xfff3b0, alpha: .9 * k });
    }
    this.suelo.clear();
    if (k > .02) this.suelo.circle(0, 0, 130).fill({ color: 0xffa040, alpha: .14 * k }).circle(0, 0, 85).fill({ color: 0xffc070, alpha: .16 * k });

    const l = this.luces.clear();                                      // luces del casco: rápidas al bajar, tranquilas al posarse
    LUCES.forEach((k, i) => {
      const a = k * Math.PI / 4, on = this.landed ? (Math.floor(this.reloj * 2) + i) % 2 === 0 : Math.floor(this.reloj * 8 + i) % 2 === 0;
      const col = this.landed ? (i % 2 ? 0xffd83a : 0x5dff8a) : (i % 2 ? 0xff4a5a : 0xffffff);
      l.circle(Math.cos(a) * 62, Math.sin(a) * 62, 3.5).fill({ color: col, alpha: on ? 1 : .25 });
    });

    const d = this.dust.clear();                                       // polvo
    for (const q of this.parts) {
      q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - dt * 1.6; q.vy *= 1 - dt * 1.6; q.r += dt * 14;
      d.circle(q.x, q.y, q.r).fill({ color: 0xd9a37a, alpha: .45 * Math.max(0, 1 - q.life / q.max) });
    }
    this.parts = this.parts.filter(q => q.life < q.max);
  }

  destroy() { this.container.destroy({ children: true }); }
}

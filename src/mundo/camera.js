// Cámara 2D: arrastrar para mover, rueda para zoom, puede seguir a un objetivo (el rover). Espacio = volver a seguirlo.

import { clamp } from '../nucleo/noise.js';

export class Camera {
  constructor(app, world) {
    this.app = app; this.world = world;
    this.x = 0; this.y = 0;                   // centro de la vista en coordenadas del mundo
    this.zoom = 1; this.minZoom = .2; this.maxZoom = 3;
    this.bounds = { w: 1000, h: 1000 };
    this.drag = null;
    this.target = null;                       // objeto con {x, y} al que seguir (el rover)
    this.shake = 0;                           // vibración de pantalla (en píxeles)
    this.following = false;                   // true = la cámara va detrás del objetivo
    this.bind();
  }

  vibrar(a) { this.shake = Math.max(this.shake, a); }   // sacude la pantalla (se va apagando sola)

  setBounds(w, h) { this.bounds = { w, h }; }
  centerOn(x, y) { this.x = x; this.y = y; this.following = false; this.apply(); }   // saltar a un punto deja de seguir
  follow(target) { this.target = target; this.following = !!target; }                // null = no seguir a nadie

  apply() {
    this.x = clamp(this.x, 0, this.bounds.w); this.y = clamp(this.y, 0, this.bounds.h);
    this.world.scale.set(this.zoom);
    const sx = this.shake ? (Math.random() - .5) * 2 * this.shake : 0, sy = this.shake ? (Math.random() - .5) * 2 * this.shake : 0;
    this.world.position.set(this.app.screen.width / 2 - this.x * this.zoom + sx, this.app.screen.height / 2 - this.y * this.zoom + sy);
  }

  screenToWorld(sx, sy) { return { x: (sx - this.world.x) / this.zoom, y: (sy - this.world.y) / this.zoom }; }

  viewRect() {                                // zona del mundo visible (para ocultar lo que queda fuera)
    const l = -this.world.x / this.zoom, t = -this.world.y / this.zoom;
    return { left: l, top: t, right: l + this.app.screen.width / this.zoom, bottom: t + this.app.screen.height / this.zoom };
  }

  update(dtMs) {                              // si está siguiendo, se acerca suavemente al objetivo
    this.shake *= Math.exp(-dtMs / 1000 * 6); if (this.shake < .05) this.shake = 0;
    if (!this.following || !this.target) return;
    const k = 1 - Math.exp(-dtMs / 1000 * 8); // 0..1: cuánto avanza este fotograma (más alto = más pegada)
    this.x += (this.target.x - this.x) * k;
    this.y += (this.target.y - this.y) * k;
  }

  bind() {
    const cv = this.app.canvas;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      if (e.button === 2 || (e.button === 0 && e.shiftKey)) return;   // clic derecho = órdenes a los tanques · Shift+arrastrar = caja de selección
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId);
    });
    cv.addEventListener('pointermove', e => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      this.following = false;                 // al arrastrar, la cámara se suelta del rover
      this.x -= (e.clientX - this.drag.x) / this.zoom; this.y -= (e.clientY - this.drag.y) / this.zoom;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
    });
    const end = e => { if (this.drag && this.drag.id === e.pointerId) this.drag = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const before = this.screenToWorld(e.clientX, e.clientY);
      this.zoom = clamp(this.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), this.minZoom, this.maxZoom);
      if (this.following) return;             // siguiendo al rover: el zoom se hace hacia el centro de la pantalla
      this.x = before.x + (this.app.screen.width / 2 - e.clientX) / this.zoom;       // si no, hacia el cursor
      this.y = before.y + (this.app.screen.height / 2 - e.clientY) / this.zoom;
    }, { passive: false });
    window.addEventListener('keydown', e => {
      if (e.code === 'Space') { e.preventDefault(); if (this.target) this.following = true; }   // Espacio: volver al rover
    });
  }
}

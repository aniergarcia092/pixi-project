// Rover enemigo: se mueve por la base enemiga, construye extractores y paneles,
// y ordena la fabricación de tanques en el cuartel enemigo.

import { Container, Graphics } from 'pixi.js';
import { TILE } from '../nucleo/config.js';
import { isWalkable } from '../mundo/mapgen.js';
import { EDIFICIOS, crearDibujo } from '../edificios/buildings.js';
import { TIPOS } from './edificio_unidades.js';
import { sfx } from '../audio/sonido.js';

const VEL = 60;                    // píxeles por segundo
const RADIO = 24;                  // tamaño para colisiones
const RADIO_OBJ = 28;              // para chocar con recursos/nave
const GIRO = 4;                    // radianes por segundo
const RANGO_CONSTRUCCION = 5;      // casillas de radio para construir (mayor que el jugador, 3)
const TIEMPO_ENTRE_ORDENES = 8;    // segundos entre órdenes de construcción

export class RoverEnemigo {
  constructor({ x, y, map, builder, economia, enemigos, baseEnemiga, camera, canvas }) {
    this.map = map;
    this.builder = builder;
    this.economia = economia;
    this.enemigos = enemigos;
    this.baseEnemiga = baseEnemiga;
    this.camera = camera;
    this.canvas = canvas;

    this.x = x;
    this.y = y;
    this.a = Math.PI / 2;
    this.state = 'libre';
    this.t = 0;

    this.container = new Container();
    this.container.addChild(this.dibujar());
    this.sync();

    // IA
    this.ordenTimer = 0;
    this.objetivoActual = null;
    this.tipoOrden = null; // 'construir', 'mover', 'fabricar'
    this.edificiosPendientes = [];
    this.ultimaFabricacion = 0;

    // Buscar depósitos de mineral y hielo cercanos para construir extractores
    this.buscarRecursosCercanos();
  }

  dibujar() {
    const c = new Container();
    const g = new Graphics();
    const L = 0x14171c;

    // Rover enemigo - color rojizo para distinguirlo
    g.roundRect(-18, -30, 36, 60, 9).fill(0xb03040).stroke({ width: 3, color: L });
    g.roundRect(-14, -27, 28, 14, 5).fill(0x8a2535);
    g.roundRect(-14, -32, 8, 4, 2).fill(0xff4a5a).stroke({ width: 1.5, color: L });
    g.roundRect(6, -32, 8, 4, 2).fill(0xff4a5a).stroke({ width: 1.5, color: L });
    g.rect(-18, 2, 36, 4).fill(0xff9a2e);
    g.circle(0, -8, 11).fill(0x3d8fd1).stroke({ width: 2.5, color: L });
    g.circle(-3, -11, 3.5).fill({ color: 0xffffff, alpha: .55 });
    g.roundRect(-13, 10, 26, 15, 3).fill(0x1f4f9a).stroke({ width: 2, color: L });
    g.moveTo(-4.3, 10).lineTo(-4.3, 25).moveTo(4.3, 10).lineTo(4.3, 25).moveTo(-13, 17.5).lineTo(13, 17.5).stroke({ width: 1, color: 0x0e2a55 });
    g.rect(-16, 27, 6, 2.5).fill(0xff4a5a);
    g.rect(10, 27, 6, 2.5).fill(0xff4a5a);
    g.circle(13, -16, 2.5).fill(0x59616d).stroke({ width: 1.5, color: L });
    g.moveTo(13, -16).lineTo(16, -25).stroke({ width: 1.5, color: L });
    g.circle(16, -25, 1.8).fill(0xff4a5a);

    // Ruedas (simplificadas, no se animan)
    for (const cx of [-23, 23]) for (const cy of [-23, 0, 23]) {
      g.roundRect(cx - 6, cy - 10, 12, 20, 4).fill(0x20262e).stroke({ width: 2, color: L });
    }

    c.addChild(g);
    return c;
  }

  buscarRecursosCercanos() {
    this.recursosMineral = [];
    this.recursosHielo = [];

    const baseX = this.baseEnemiga.esquina.x;
    const baseY = this.baseEnemiga.esquina.y;
    const radioBusqueda = 20; // Radio mayor para encontrar más recursos

    for (const r of this.map.resources) {
      const dx = r.x - baseX;
      const dy = r.y - baseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radioBusqueda) {
        if (r.kind === 'ore') this.recursosMineral.push(r);
        if (r.kind === 'ice') this.recursosHielo.push(r);
      }
    }

    // Plan de construcción: priorizar extractores en recursos
    this.planConstruccion = [];

    // Mineros en depósitos de mineral
    for (const r of this.recursosMineral.slice(0, 3)) {
      this.planConstruccion.push({ id: 'minero', x: r.x, y: r.y, prioridad: 10, requiere: 'ore' });
    }

    // Pozos de agua en hielo
    for (const r of this.recursosHielo.slice(0, 2)) {
      this.planConstruccion.push({ id: 'pozoagua', x: r.x, y: r.y, prioridad: 8, requiere: 'ice' });
    }

    // Paneles solares alrededor de la base
    const baseCx = this.baseEnemiga.esquina.x + 2;
    const baseCy = this.baseEnemiga.esquina.y + 2;
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const px = Math.round(baseCx + Math.cos(ang) * 4);
      const py = Math.round(baseCy + Math.sin(ang) * 4);
      this.planConstruccion.push({ id: 'panel', x: px, y: py, prioridad: 5 });
    }

    // Baterías cerca de paneles
    this.planConstruccion.push({ id: 'bateria', x: baseCx + 3, y: baseCy + 4, prioridad: 6 });
    this.planConstruccion.push({ id: 'bateria', x: baseCx - 2, y: baseCy + 4, prioridad: 6 });

    // Torretas defensivas adicionales
    this.planConstruccion.push({ id: 'torreta', x: baseCx - 2, y: baseCy + 1, prioridad: 7 });
    this.planConstruccion.push({ id: 'torreta', x: baseCx + 5, y: baseCy + 1, prioridad: 7 });
    this.planConstruccion.push({ id: 'torreta', x: baseCx - 2, y: baseCy + 3, prioridad: 7 });
    this.planConstruccion.push({ id: 'torreta', x: baseCx + 5, y: baseCy + 3, prioridad: 7 });

    // Reparación
    this.planConstruccion.push({ id: 'reparacion', x: baseCx - 1, y: baseCy + 5, prioridad: 6 });
    this.planConstruccion.push({ id: 'reparacion', x: baseCx + 4, y: baseCy + 5, prioridad: 6 });

    // Ordenar por prioridad
    this.planConstruccion.sort((a, b) => b.prioridad - a.prioridad);
  }

  libreEn(x, y) {
    for (const [dx, dy] of [[-RADIO, -RADIO], [RADIO, -RADIO], [-RADIO, RADIO], [RADIO, RADIO]]) {
      const tx = Math.floor((x + dx) / TILE);
      const ty = Math.floor((y + dy) / TILE);
      if (!isWalkable(this.map, tx, ty) || this.builder.ocupado(tx, ty)) return false;
    }
    return true;
  }

  girarHacia(objetivo, paso) {
    let d = objetivo - this.a;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.a += Math.max(-paso, Math.min(paso, d));
  }

  moverHacia(tx, ty, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 10) return true; // Llegó

    const objetivoAng = Math.atan2(dy, dx);
    this.girarHacia(objetivoAng, GIRO * dt);

    const vel = VEL * dt;
    const nx = this.x + Math.cos(this.a) * vel;
    const ny = this.y + Math.sin(this.a) * vel;

    if (this.libreEn(nx, this.y)) this.x = nx;
    if (this.libreEn(this.x, ny)) this.y = ny;

    return false;
  }

  puedeConstruir(id) {
    const def = EDIFICIOS[id];
    if (!def) return false;
    if (this.economia.mineral < def.costo) return false;
    // Verificar si ya existe ese edificio en la base enemiga
    for (const e of this.baseEnemiga.edificios) {
      if (e.def.id === id) return false; // Ya tenemos uno (simplificado)
    }
    return true;
  }

  intentarConstruir(plan) {
    const def = EDIFICIOS[plan.id];
    if (!def) return false;

    // Verificar requisitos de terreno
    if (plan.requiere === 'ore') {
      const hayMineral = this.map.resources.some(r => r.kind === 'ore' && r.x === plan.x && r.y === plan.y);
      if (!hayMineral) return false;
    }
    if (plan.requiere === 'ice') {
      const hayHielo = this.map.resources.some(r => r.kind === 'ice' && r.x === plan.x && r.y === plan.y);
      if (!hayHielo) return false;
    }

    // Verificar si ya hay un edificio ahí
    if (this.builder.ocupado(plan.x, plan.y)) return false;

    // Verificar recursos
    if (this.economia.mineral < def.costo) return false;

    // Construir
    this.economia.mineral -= def.costo;
    const dibujo = crearDibujo(def);
    const contenedor = new Container();
    contenedor.addChild(dibujo);
    contenedor.position.set(plan.x * TILE, plan.y * TILE);

    const edificio = {
      x: plan.x,
      y: plan.y,
      def,
      dibujo,
      construccion: 0,
      vida: def.vida || 100,
      mejora: false,
      t: 0,
      cola: [],
      fab: null
    };

    this.baseEnemiga.edificios.push(edificio);
    this.builder.edificios.push(edificio);
    this.baseEnemiga.container.addChild(contenedor);

    sfx.play('click');
    return true;
  }

  intentarFabricarTanque() {
    // Buscar cuartel enemigo
    let cuartel = null;
    for (const e of this.baseEnemiga.edificios) {
      if (e.def.id === 'cuartel' && !e.construccion && !e.fab && (!e.cola || e.cola.length === 0)) {
        cuartel = e;
        break;
      }
    }
    if (!cuartel) return false;

    // Elegir tipo de tanque (alternar)
    const tipos = ['comet', 'sniper', 'pesada'];
    const tipo = tipos[Math.floor(this.ultimaFabricacion % tipos.length)];
    const def = TIPOS[tipo];

    // Verificar recursos (usar economía del jugador para simplicidad, o dar recursos al enemigo)
    if (this.economia.mineral < def.coste) return false;

    this.economia.mineral -= def.coste;
    cuartel.fab = { tipo, t: def.tiempo };
    this.ultimaFabricacion++;
    return true;
  }

  update(dtMs) {
    const dt = Math.min(dtMs, 100) / 1000;
    this.t += dt;

    // Timer para dar órdenes
    this.ordenTimer -= dt;
    if (this.ordenTimer <= 0) {
      this.ordenTimer = TIEMPO_ENTRE_ORDENES;
      this.elegirNuevaOrden();
    }

    // Ejecutar orden actual
    if (this.tipoOrden === 'construir' && this.objetivoActual) {
      const plan = this.objetivoActual;
      const tx = (plan.x + 0.5) * TILE;
      const ty = (plan.y + 0.5) * TILE;
      const dist = Math.hypot(tx - this.x, ty - this.y);

      if (dist > TILE * 1.5) {
        this.moverHacia(tx, ty, dt);
      } else {
        // Intentar construir
        if (this.intentarConstruir(plan)) {
          this.objetivoActual = null;
          this.tipoOrden = null;
        }
      }
    } else if (this.tipoOrden === 'fabricar') {
      this.intentarFabricarTanque();
      this.tipoOrden = null;
    } else if (this.tipoOrden === 'patrullar') {
      // Patrullar alrededor de la base
      const baseCx = (this.baseEnemiga.esquina.x + 2) * TILE;
      const baseCy = (this.baseEnemiga.esquina.y + 2) * TILE;
      const radio = 200;
      if (!this.patrullaDestino || Math.hypot(this.patrullaDestino.x - this.x, this.patrullaDestino.y - this.y) < 50) {
        const ang = Math.random() * Math.PI * 2;
        this.patrullaDestino = {
          x: baseCx + Math.cos(ang) * radio,
          y: baseCy + Math.sin(ang) * radio
        };
      }
      this.moverHacia(this.patrullaDestino.x, this.patrullaDestino.y, dt);
    }

    this.sync();
  }

  elegirNuevaOrden() {
    // Prioridad 1: Construir edificios del plan
    for (const plan of this.planConstruccion) {
      if (this.puedeConstruir(plan.id)) {
        this.objetivoActual = plan;
        this.tipoOrden = 'construir';
        return;
      }
    }

    // Prioridad 2: Fabricar tanques si hay cuartel
    if (Math.random() < 0.3) {
      this.tipoOrden = 'fabricar';
      return;
    }

    // Prioridad 3: Patrullar
    this.tipoOrden = 'patrullar';
  }

  sync() {
    this.container.position.set(this.x, this.y);
    this.container.rotation = this.a + Math.PI / 2;
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
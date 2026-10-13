// Base enemiga: una base pre-construida con torretas, extractores, paneles, baterías y un rover enemigo.
// Aparece en la esquina opuesta al spawn del jugador al inicio de la fase 2.

import { Container, Graphics } from 'pixi.js';
import { TILE } from '../nucleo/config.js';
import { EDIFICIOS, crearDibujo, mejorarDibujo } from '../edificios/buildings.js';
import { RoverEnemigo } from './roverenemigo.js';
import { sfx } from '../audio/sonido.js';

export class BaseEnemiga {
  constructor({ map, builder, economia, enemigos, tanques, mechas, camera, canvas, spawnJugador }) {
    this.map = map;
    this.builder = builder;
    this.economia = economia;
    this.enemigos = enemigos;
    this.tanques = tanques;
    this.mechas = mechas;
    this.camera = camera;
    this.canvas = canvas;

    this.container = new Container();
    this.edificios = [];
    this.roverEnemigo = null;
    this.nucleo = null; // el núcleo que el jugador debe destruir
    this.destruida = false;

    // Encontrar esquina opuesta al spawn del jugador
    this.esquina = this.buscarEsquinaOpuesta(spawnJugador);

    // Construir la base enemiga
    this.construirBase();
  }

  buscarEsquinaOpuesta(spawnJugador) {
    const W = this.map.w;
    const H = this.map.h;
    const margen = 8; // casillas desde el borde

    // Determinar en qué esquina está el jugador
    const jugadorArriba = spawnJugador.y < H / 2;
    const jugadorIzquierda = spawnJugador.x < W / 2;

    // Esquina opuesta
    let ex, ey;
    if (jugadorArriba && jugadorIzquierda) {
      // Jugador en esquina sup-izq -> base en inf-der
      ex = W - margen - 6;
      ey = H - margen - 6;
    } else if (jugadorArriba && !jugadorIzquierda) {
      // Jugador en esquina sup-der -> base en inf-izq
      ex = margen;
      ey = H - margen - 6;
    } else if (!jugadorArriba && jugadorIzquierda) {
      // Jugador en esquina inf-izq -> base en sup-der
      ex = W - margen - 6;
      ey = margen;
    } else {
      // Jugador en esquina inf-der -> base en sup-izq
      ex = margen;
      ey = margen;
    }

    // Asegurar que esté en terreno transitable
    for (let dy = 0; dy < 10; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        const tx = ex + dx;
        const ty = ey + dy;
        if (tx >= 0 && tx < W && ty >= 0 && ty < H) {
          // Buscar zona plana para la base
        }
      }
    }

    return { x: ex, y: ey };
  }

  construirBase() {
    const ex = this.esquina.x;
    const ey = this.esquina.y;

    // Definir layout de la base enemiga (pre-construida)
    // La base tendrá un radio mayor para que quepan más edificios
    const layout = [
      // Núcleo central (objetivo principal)
      { id: 'nucleo', x: ex + 2, y: ey + 2 },

      // Torretas alrededor del núcleo
      { id: 'torreta', x: ex, y: ey + 1 },
      { id: 'torreta', x: ex + 4, y: ey + 1 },
      { id: 'torreta', x: ex, y: ey + 3 },
      { id: 'torreta', x: ex + 4, y: ey + 3 },

      // Extractores de mineral (buscar depósitos cercanos)
      { id: 'minero', x: ex + 1, y: ey - 2 },
      { id: 'minero', x: ex + 3, y: ey - 2 },

      // Paneles solares
      { id: 'panel', x: ex - 1, y: ey + 1 },
      { id: 'panel', x: ex + 5, y: ey + 1 },
      { id: 'panel', x: ex - 1, y: ey + 3 },
      { id: 'panel', x: ex + 5, y: ey + 3 },

      // Baterías
      { id: 'bateria', x: ex + 1, y: ey + 5 },
      { id: 'bateria', x: ex + 3, y: ey + 5 },

      // Cuartel para fabricar tanques
      { id: 'cuartel', x: ex + 6, y: ey + 1 },

      // Fábrica de mechas
      { id: 'mecha', x: ex + 6, y: ey + 4 },

      // Bahías de reparación
      { id: 'reparacion', x: ex - 1, y: ey + 5 },
      { id: 'reparacion', x: ex + 5, y: ey + 5 },

      // Almacenes
      { id: 'almacen', x: ex + 1, y: ey - 4 },
      { id: 'almacenagua', x: ex + 3, y: ey - 4 },

      // Generador de oxígeno y laboratorio (para ruedas)
      { id: 'oxigeno', x: ex - 1, y: ey - 2 },
      { id: 'laboratorio', x: ex + 6, y: ey - 2 },

      // Pozo de agua
      { id: 'pozoagua', x: ex + 3, y: ey - 6 },

      // Hélice eólica
      { id: 'helice', x: ex - 1, y: ey - 4 },
      { id: 'helice', x: ex + 5, y: ey - 4 },

      // Receptor láser para extender energía
      { id: 'laser', x: ex - 2, y: ey + 2 },
      { id: 'laser', x: ex + 6, y: ey + 2 },
    ];

    // Crear cada edificio
    for (const def of layout) {
      this.crearEdificioEnemigo(def, ex, ey);
    }

    // Crear el núcleo central (objetivo)
    this.crearNucleo(ex + 2, ey + 2);

    // Crear rover enemigo cerca de la base
    const roverX = (ex + 3) * TILE;
    const roverY = (ey + 6) * TILE;
    this.roverEnemigo = new RoverEnemigo({
      x: roverX,
      y: roverY,
      map: this.map,
      builder: this.builder,
      economia: this.economia,
      enemigos: this.enemigos,
      baseEnemiga: this,
      camera: this.camera,
      canvas: this.canvas
    });
    this.container.addChild(this.roverEnemigo.container);
  }

  crearEdificioEnemigo(def, baseX, baseY) {
    const defEdificio = EDIFICIOS[def.id];
    if (!defEdificio) return;

    const x = def.x;
    const y = def.y;

    // Verificar que la casilla es válida y transitable
    if (x < 0 || y < 0 || x >= this.map.w || y >= this.map.h) return;
    if (this.builder.ocupado(x, y)) return;

    // Crear el dibujo
    const dibujo = crearDibujo(defEdificio);
    const contenedor = new Container();
    contenedor.addChild(dibujo);
    contenedor.position.set(x * TILE, y * TILE);

    // Crear objeto edificio compatible con el builder
    const edificio = {
      x,
      y,
      def: defEdificio,
      dibujo,
      construccion: 0, // ya construido
      vida: defEdificio.vida || 100,
      mejora: false,
      t: 0,
      cola: [],
      fab: null,
      owner: 'enemigo'
    };

    // Aplicar mejora visual (nivel 2) a torretas y reparación
    if (def.id === 'torreta' || def.id === 'reparacion') {
      mejorarDibujo(edificio);
    }

    this.edificios.push(edificio);
    this.builder.edificios.push(edificio); // añadir al builder para que las torretas funcionen
    this.container.addChild(contenedor);
  }

  crearNucleo(x, y) {
    const g = new Graphics();
    // Núcleo hexagonal brillante
    const radio = 28;
    const lados = 6;
    const puntos = [];
    for (let i = 0; i < lados; i++) {
      const a = (i / lados) * Math.PI * 2 - Math.PI / 2;
      puntos.push(Math.cos(a) * radio, Math.sin(a) * radio);
    }
    g.poly(puntos).fill({ color: 0x3d8fd1, alpha: 0.8 }).stroke({ width: 4, color: 0xffc83a });
    // Núcleo interior pulsante
    g.circle(0, 0, 12).fill({ color: 0x5fd0ff, alpha: 0.9 });
    g.circle(0, 0, 6).fill({ color: 0xffffff, alpha: 0.6 });

    const contenedor = new Container();
    contenedor.addChild(g);
    contenedor.position.set(x * TILE, y * TILE);

    this.nucleo = {
      x,
      y,
      vida: 500,
      vidaMax: 500,
      contenedor,
      g,
      pulsacion: 0
    };

    this.container.addChild(contenedor);
  }

  update(dtMs) {
    if (this.destruida) return;

    const dt = dtMs / 1000;

    // Animar núcleo
    if (this.nucleo) {
      this.nucleo.pulsacion += dt * 3;
      const escala = 1 + Math.sin(this.nucleo.pulsacion) * 0.1;
      this.nucleo.contenedor.scale.set(escala);
      this.nucleo.g.clear();
      const radio = 28;
      const lados = 6;
      const puntos = [];
      for (let i = 0; i < lados; i++) {
        const a = (i / lados) * Math.PI * 2 - Math.PI / 2;
        puntos.push(Math.cos(a) * radio, Math.sin(a) * radio);
      }
      this.nucleo.g.poly(puntos).fill({ color: 0x3d8fd1, alpha: 0.8 }).stroke({ width: 4, color: 0xffc83a });
      this.nucleo.g.circle(0, 0, 12 * escala).fill({ color: 0x5fd0ff, alpha: 0.9 });
      this.nucleo.g.circle(0, 0, 6 * escala).fill({ color: 0xffffff, alpha: 0.6 });

      // Barra de vida del núcleo
      if (this.nucleo.vida < this.nucleo.vidaMax) {
        const w = 80;
        this.nucleo.g.rect(-w / 2, -40, w, 6).fill(0x14171c);
        this.nucleo.g.rect(-w / 2, -40, w * (this.nucleo.vida / this.nucleo.vidaMax), 6).fill(0xff6b6b);
      }
    }

    // Actualizar rover enemigo
    if (this.roverEnemigo) {
      this.roverEnemigo.update(dtMs);
    }

    // Verificar si el núcleo fue destruido
    if (this.nucleo && this.nucleo.vida <= 0) {
      this.destruir();
    }
  }

  recibirDanoNucleo(dano) {
    if (this.nucleo && !this.destruida) {
      this.nucleo.vida -= dano;
      if (this.nucleo.vida <= 0) {
        this.destruir();
      }
    }
  }

  destruir() {
    this.destruida = true;
    sfx.play('destruido');
    // El núcleo explota y deja el "core" para el jugador
    // Aquí se podría añadir lógica de victoria
  }

  destroy() {
    if (this.roverEnemigo) this.roverEnemigo.destroy();
    this.container.destroy({ children: true });
  }
}
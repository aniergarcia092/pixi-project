// Los edificios que se pueden construir: su tamaño (en casillas), su coste y cómo se dibujan.
// Cada edificio se dibuja con su esquina superior izquierda en (0, 0).

import { Container, Graphics } from 'pixi.js';
import { TILE } from '../nucleo/config.js';
import { DEF_CUARTEL, DEF_MECHA } from '../unidades/edificio_unidades.js';

const L = 0x14171c;                                   // color de los contornos

function crearMinero() {                              // 1x1 · va sobre un depósito de mineral · la broca gira cuando trabaja
  const c = new Container();
  const base = new Graphics();
  base.roundRect(4, 4, 56, 56, 8).fill(0x59616d).stroke({ width: 3, color: L });    // base
  base.rect(9, 9, 46, 5).fill(0xffc83a); base.rect(9, 50, 46, 5).fill(0xffc83a);    // franjas amarillas
  base.circle(32, 32, 18).fill(0x2b3440).stroke({ width: 3, color: L });            // pozo
  const broca = new Graphics();                       // se dibuja alrededor de (0, 0) y se coloca en el centro para poder girarla
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    broca.circle(Math.cos(a) * 12, Math.sin(a) * 12, 3.2).fill(0x8d99a8);           // dientes
  }
  broca.rect(-13, -2.5, 26, 5).fill(0x8d99a8);                                      // aspas (así se nota el giro)
  broca.rect(-2.5, -13, 5, 26).fill(0x8d99a8);
  broca.circle(12, 0, 4).fill(0xff9a2e);                                            // diente naranja de referencia
  broca.circle(0, 0, 6).fill(0xffc83a).stroke({ width: 2, color: L });              // eje
  broca.position.set(32, 32);
  c.addChild(base, broca);
  c.broca = broca;
  return c;
}

function crearBateria() {                             // 1x1 · las celdas verdes muestran la carga
  const c = new Container();
  const g = new Graphics();
  g.roundRect(16, 8, 32, 50, 5).fill(0x3a414b).stroke({ width: 3, color: L });      // cuerpo
  g.rect(26, 3, 12, 6).fill(0x8d99a8).stroke({ width: 2, color: L });               // borne
  const halo = new Graphics().roundRect(13, 5, 38, 56, 7).stroke({ width: 3, color: 0x5dff8a, alpha: 1 });   // halo verde que late al cargar
  halo.alpha = 0;
  const haloCombo = new Graphics().roundRect(11, 3, 42, 60, 8).stroke({ width: 4, color: 0x4fe3ff });   // halo cian del combo solar
  haloCombo.alpha = 0;
  const rayo = new Graphics().poly([35, 22, 25, 35, 31, 35, 28, 46, 39, 31, 33, 31]).fill(0xffe36b).stroke({ width: 1.2, color: L });   // rayo (solo con combo)
  rayo.visible = false;
  const fx = new Graphics();                          // chispas y onda del combo (las dibuja la economía)
  c.addChild(halo, haloCombo, g);
  c.halo = halo; c.haloCombo = haloCombo; c.rayo = rayo; c.fx = fx; c.estallido = 1; c.pulso = Math.random() * 6;
  c.celdas = [];
  for (let i = 0; i < 3; i++) {                       // celda 0 = la de abajo
    const celda = new Graphics().rect(21, 14 + (2 - i) * 14, 22, 10).fill(0x5dff8a);
    celda.visible = false;
    c.addChild(celda); c.celdas.push(celda);
  }
  c.addChild(rayo, fx);                               // encima de las celdas
  return c;
}

function crearPanel() {                               // 1x1 · la placa gira y se inclina buscando el sol (lo anima la economía)
  const c = new Container();
  const base = new Graphics();
  base.roundRect(5, 5, 54, 54, 6).fill(0x1d242d).stroke({ width: 3, color: L });    // suelo fijo
  const aro = new Graphics();                         // arcos cian: se ven mientras la placa se mueve
  for (let i = 0; i < 3; i++) {
    const a = i * 2.094;
    aro.moveTo(Math.cos(a) * 28, Math.sin(a) * 28).arc(0, 0, 28, a, a + .7).stroke({ width: 2, color: 0x4fe3ff, alpha: .7 });
  }
  aro.position.set(32, 32); aro.visible = false;
  const placa = new Graphics();                       // se dibuja alrededor de (0, 0) para poder girarla e inclinarla
  placa.roundRect(-21, -21, 42, 42, 4).fill(0x2a3440).stroke({ width: 2.5, color: L });            // marco
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++)                                          // 2x2 celdas solares
    placa.rect(-17 + i * 18, -17 + j * 18, 16, 16).fill(0x1f4f9a).stroke({ width: 1.2, color: 0x0e2a55 });
  placa.poly([-17, -17, 17, -17, -17, 17]).fill({ color: 0xffffff, alpha: .12 });                  // reflejo
  placa.circle(0, 0, 3.5).fill(0x4b5666).stroke({ width: 1.5, color: L });                         // eje
  const brillo = new Graphics();                      // destello de sol (una estrellita) que aparece y se desvanece
  brillo.moveTo(-6, 0).lineTo(6, 0).moveTo(0, -6).lineTo(0, 6).stroke({ width: 2, color: 0xffffff });
  brillo.circle(0, 0, 2.5).fill(0xffffff);
  brillo.position.set(-8, -8); brillo.alpha = 0;
  placa.addChild(brillo);
  placa.position.set(32, 32);
  c.addChild(base, placa, aro);
  c.placa = placa; c.aro = aro; c.brillo = brillo;
  return c;
}

function dibujarRadar(g) {                            // 2x2 · radar de tormentas
  g.roundRect(6, 6, 116, 116, 14).fill(0x59616d).stroke({ width: 3, color: L });    // base
  g.rect(16, 14, 96, 6).fill(0xffc83a); g.rect(16, 108, 96, 6).fill(0xffc83a);      // franjas amarillas
  g.circle(64, 64, 40).fill(0x2b3440).stroke({ width: 3, color: L });               // plato
  g.circle(64, 64, 30).fill(0xcfd6df).stroke({ width: 2.5, color: L });
  g.circle(64, 64, 17).fill(0x8d99a8).stroke({ width: 2.5, color: L });
  g.moveTo(64, 64).lineTo(90, 38).stroke({ width: 5, color: L });                   // antena
  g.moveTo(64, 64).lineTo(90, 38).stroke({ width: 2.5, color: 0xcfd6df });
  g.circle(90, 38, 5).fill(0xff4a5a).stroke({ width: 2, color: L });
  g.circle(64, 64, 5).fill(0xffc83a).stroke({ width: 2, color: L });
}

function dibujarOxigeno(g) {                          // 1x1 · generador de oxígeno
  g.roundRect(4, 4, 56, 56, 8).fill(0x59616d).stroke({ width: 3, color: L });       // base
  g.rect(27, 4, 10, 10).fill(0x8d99a8).stroke({ width: 2, color: L });              // tubos
  g.rect(27, 50, 10, 10).fill(0x8d99a8).stroke({ width: 2, color: L });
  g.circle(32, 32, 20).fill(0x2b3440).stroke({ width: 3, color: L });               // depósito
  g.circle(32, 32, 13).fill(0x5fd0ff).stroke({ width: 2, color: L });
  g.circle(28, 28, 4).fill({ color: 0xffffff, alpha: .6 });
}

function dibujarLaboratorio(g) {                      // 2x2 · laboratorio
  g.roundRect(6, 6, 116, 116, 12).fill(0xcfd6df).stroke({ width: 3, color: L });    // casco
  g.rect(16, 14, 96, 6).fill(0xff9a2e);
  g.roundRect(18, 30, 92, 78, 8).fill(0x8d99a8).stroke({ width: 3, color: L });     // tejado
  g.circle(46, 68, 24).fill(0x3d8fd1).stroke({ width: 3, color: L });               // cúpula
  g.circle(39, 60, 6).fill({ color: 0xffffff, alpha: .55 });
  g.rect(80, 42, 22, 16).fill(0x1f4f9a).stroke({ width: 2, color: L });             // paneles
  g.rect(80, 64, 22, 16).fill(0x1f4f9a).stroke({ width: 2, color: L });
  g.circle(91, 94, 5).fill(0x5dff8a).stroke({ width: 2, color: L });                // luz
}

function crearPozoAgua() {                            // 1x1 · pozo de agua · va sobre un depósito de hielo · el agua ondula cuando bombea
  const c = new Container();
  const g = new Graphics();
  g.roundRect(4, 4, 56, 56, 8).fill(0x59616d).stroke({ width: 3, color: L });       // base
  g.rect(9, 9, 46, 5).fill(0x5fd0ff); g.rect(9, 50, 46, 5).fill(0x5fd0ff);          // franjas azules
  g.circle(32, 32, 18).fill(0x2b3440).stroke({ width: 3, color: L });               // pozo
  g.circle(32, 32, 11).fill(0x3d8fd1).stroke({ width: 2, color: L });               // agua
  g.circle(28, 28, 3.5).fill({ color: 0xffffff, alpha: .6 });
  const ondas = new Graphics();                       // anillos que se expanden desde el centro (los dibuja la economía)
  ondas.position.set(32, 32);
  const tubo = new Graphics().rect(29, 14, 6, 10).fill(0x8d99a8).stroke({ width: 1.5, color: L });   // tubo
  c.addChild(g, ondas, tubo);
  c.ondas = ondas; c.fase = Math.random();
  return c;
}

function crearHelice() {                              // 1x1 · hélice eólica · el rotor gira con el viento (lo anima la economía)
  const c = new Container();
  const base = new Graphics();
  base.roundRect(5, 5, 54, 54, 8).fill(0x2a3440).stroke({ width: 3, color: L });    // base
  base.circle(32, 32, 27).fill(0x3a414b).stroke({ width: 2.5, color: L });          // plataforma
  base.circle(32, 32, 23).fill(0x232a33);
  for (let i = 0; i < 12; i++) {                                                    // marcas del anillo
    const a = i * Math.PI / 6;
    base.moveTo(32 + Math.cos(a) * 23, 32 + Math.sin(a) * 23).lineTo(32 + Math.cos(a) * 27, 32 + Math.sin(a) * 27).stroke({ width: 1.5, color: 0x59616d });
  }
  for (const [x, y] of [[10, 10], [54, 10], [10, 54], [54, 54]]) base.circle(x, y, 2).fill(0x59616d);   // tornillos
  const aspas = (g, color, borde) => {                // 3 aspas curvadas que se afinan hacia la punta
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3, ca = Math.cos(a), sa = Math.sin(a), p = (x, y) => [x * ca - y * sa, x * sa + y * ca];
      g.poly([...p(5, -4), ...p(13, -6.5), ...p(22, -5), ...p(28, -1.5), ...p(28, 1.5), ...p(21, 1), ...p(11, 4), ...p(5, 3.5)]).fill(color);
      if (borde) g.poly([...p(5, -4), ...p(13, -6.5), ...p(22, -5), ...p(28, -1.5), ...p(28, 1.5), ...p(21, 1), ...p(11, 4), ...p(5, 3.5)]).stroke({ width: 1.5, color: L });
    }
  };
  const sombra = new Graphics(); aspas(sombra, 0x000000, false);
  sombra.alpha = .3; sombra.position.set(36, 37);                                   // sombra del rotor sobre la base
  const rotor = new Graphics();
  aspas(rotor, 0xe8eef5, true);
  for (let i = 0; i < 3; i++) {                                                     // franja de brillo, punta roja y raya central de cada aspa
    const a = i * Math.PI * 2 / 3, ca = Math.cos(a), sa = Math.sin(a), p = (x, y) => [x * ca - y * sa, x * sa + y * ca];
    rotor.poly([...p(8, -4.5), ...p(20, -4), ...p(20, -2), ...p(8, -2)]).fill({ color: 0xffffff, alpha: .6 });
    rotor.poly([...p(23, -3.6), ...p(28, -1.4), ...p(28, 1.4), ...p(23, .8)]).fill(0xff4a5a);
    rotor.moveTo(...p(6, 0)).lineTo(...p(24, 0)).stroke({ width: 1, color: 0x8d99a8 });
  }
  rotor.circle(0, 0, 7.5).fill(0xffc83a).stroke({ width: 2, color: L });            // cubo
  rotor.circle(0, 0, 3.5).fill(0x8d99a8).stroke({ width: 1.5, color: L });
  rotor.circle(-1.5, -1.5, 1.4).fill({ color: 0xffffff, alpha: .8 });
  rotor.position.set(32, 32);
  c.addChild(base, sombra, rotor);
  c.rotor = rotor; c.sombra = sombra;
  sombra.rotation = rotor.rotation = Math.random() * 6;
  return c;
}

function dibujarLaser(g) {                            // 1x1 · receptor láser
  g.roundRect(10, 10, 44, 44, 8).fill(0x3a414b).stroke({ width: 3, color: L });     // base
  g.rect(28, 30, 8, 20).fill(0x8d99a8).stroke({ width: 2, color: L });              // mástil
  g.circle(32, 24, 12).fill(0x2b3440).stroke({ width: 3, color: L });               // lente
  g.circle(32, 24, 6).fill(0xff4a5a).stroke({ width: 2, color: L });
  g.circle(30, 22, 2).fill({ color: 0xffffff, alpha: .7 });
}

function dibujarAlmacen(g) {                          // 1x1 · almacén de hierro
  g.roundRect(4, 4, 56, 56, 8).fill(0x59616d).stroke({ width: 3, color: L });       // base
  g.roundRect(10, 12, 44, 40, 5).fill(0x8d99a8).stroke({ width: 3, color: L });     // caja
  g.rect(10, 28, 44, 5).fill(0x59616d);                                             // refuerzos
  g.rect(28, 12, 8, 40).fill(0x59616d);
  g.circle(32, 31, 5).fill(0xffc83a).stroke({ width: 2, color: L });                // cierre
}

function dibujarAlmacenAgua(g) {                      // 1x1 · almacén de agua
  g.roundRect(4, 4, 56, 56, 8).fill(0x59616d).stroke({ width: 3, color: L });       // base
  g.circle(32, 32, 22).fill(0xcfd6df).stroke({ width: 3, color: L });               // depósito
  g.circle(32, 32, 15).fill(0x3d8fd1).stroke({ width: 2, color: L });               // agua
  g.rect(14, 30, 36, 4).fill({ color: 0xffffff, alpha: .35 });                      // nivel
  g.circle(27, 26, 4).fill({ color: 0xffffff, alpha: .55 });
}

function crearTorreta() {                             // 1x1 · la cabeza gira (c.cabeza) para apuntar a los enemigos
  const c = new Container(), base = new Graphics(), cabeza = new Graphics();
  base.roundRect(6, 6, 52, 52, 8).fill(0x59616d).stroke({ width: 3, color: L });    // base
  for (const [cx, cy, dx, dy] of [[10, 10, 1, 1], [54, 10, -1, 1], [10, 54, 1, -1], [54, 54, -1, -1]]) {   // esquinas con franja de aviso y tornillo
    base.poly([cx, cy, cx + dx * 14, cy, cx, cy + dy * 14]).fill(0xffc83a);
    base.poly([cx + dx * 3, cy + dy * 3, cx + dx * 8, cy + dy * 3, cx + dx * 3, cy + dy * 8]).fill(0x14171c);
    base.circle(cx + dx * 15, cy + dy * 15, 2).fill(0x3a414b);
  }
  base.circle(32, 32, 22).fill(0x2b3440).stroke({ width: 3, color: L });            // plataforma giratoria
  for (let i = 0; i < 12; i++) {                                                    // marcas de la corona
    const a = i * Math.PI / 6;
    base.moveTo(32 + Math.cos(a) * 17, 32 + Math.sin(a) * 17).lineTo(32 + Math.cos(a) * 20, 32 + Math.sin(a) * 20).stroke({ width: 2, color: 0x59616d });
  }
  cabeza.roundRect(-17, -9, 8, 18, 2).fill(0x3a414b).stroke({ width: 2, color: L });             // contrapeso
  cabeza.poly([-12, -12, 8, -12, 14, -6, 14, 6, 8, 12, -12, 12]).fill(0x8d99a8).stroke({ width: 2.5, color: L });   // torre
  cabeza.rect(-8, -9, 12, 3).fill(0xaeb8c4); cabeza.rect(-8, 6, 12, 3).fill(0xaeb8c4);           // placas
  cabeza.rect(12, -3.5, 20, 7).fill(0x3a414b).stroke({ width: 2.5, color: L });                   // cañón
  cabeza.rect(12, -2, 20, 1.5).fill(0x6b7684);
  cabeza.rect(30, -5.5, 7, 11).fill(0x2b3440).stroke({ width: 2, color: L });                     // freno de boca
  cabeza.rect(32, -3, 1.5, 6).fill(0x6b7684);
  cabeza.circle(-2, 0, 5.5).fill(0x3d8fd1).stroke({ width: 2, color: L });                        // sensor
  cabeza.circle(-3.5, -1.5, 1.6).fill({ color: 0xffffff, alpha: .6 });
  cabeza.circle(5, 0, 2.2).fill(0xff4a5a);
  cabeza.position.set(32, 32);
  c.addChild(base, cabeza);
  c.cabeza = cabeza;
  return c;
}

function dibujarReparacion(g) {                       // 1x1 · bahía de reparación
  g.roundRect(4, 4, 56, 56, 10).fill(0x59616d).stroke({ width: 3, color: L });      // base
  g.circle(32, 32, 20).fill(0xcfd6df).stroke({ width: 3, color: L });               // torre
  g.rect(28, 20, 8, 24).fill(0xff4a5a); g.rect(20, 28, 24, 8).fill(0xff4a5a);       // cruz
  for (const [x, y] of [[10, 10], [54, 54]])                                        // 2 drones
    g.circle(x, y, 5).fill(0xffc83a).stroke({ width: 2, color: L });
}

export const CATEGORIAS = [
  { id: 'recursos',  nombre: 'Recursos' },
  { id: 'energia',   nombre: 'Energía' },
  { id: 'almacenes', nombre: 'Almacenes' },
  { id: 'base',      nombre: 'Base' },
  { id: 'defensa',   nombre: 'Defensa' },
];

export const EDIFICIOS = {
  minero: { id: 'minero', nombre: 'Minero', cat: 'recursos', icono: '⛏️', tecla: '1', code: 'Digit1', costo: 40, tiempo: 10, w: 1, h: 1, sobre: 'ore', crear: crearMinero, mejora: { costo: 120, texto: 'Minado 1,5 → 2,5 /s' },
    descripcion: 'Extrae mineral de un depósito: colócalo sobre un depósito de mineral. Gasta 2 de energía por segundo, así que se conecta solo con cable a una batería o a un panel.' },
  bateria: { id: 'bateria', nombre: 'Batería', cat: 'energia', icono: '🔋', tecla: '2', code: 'Digit2', costo: 30, tiempo: 10, w: 1, h: 1, crear: crearBateria, mejora: { costo: 80, texto: 'Capacidad 100 → 200' },
    descripcion: 'Guarda hasta 100 de energía. Los paneles y los mineros se conectan a ella con prioridad: carga con el sobrante y cubre la falta.' },
  panel: { id: 'panel', nombre: 'Panel solar', cat: 'energia', icono: '☀️', tecla: '3', code: 'Digit3', costo: 40, tiempo: 10, alcance: 5, w: 1, h: 1, crear: crearPanel, mejora: { costo: 100, texto: 'Producción 3 → 5 /s' },
    descripcion: 'Produce 3 de energía por segundo, pero solo de día: de noche no produce nada, así que necesitas baterías. Se conecta solo a la batería más cercana (o a un minero si no hay batería). Su cable llega solo a 5 casillas.' },
  radar: { id: 'radar', nombre: 'Radar de tormentas', cat: 'base', icono: '📡', tecla: '4', code: 'Digit4', costo: 300, tiempo: 25, w: 2, h: 2, dibujar: dibujarRadar,
    descripcion: 'Detectará las tormentas de polvo antes de que lleguen a la base. (De momento no hace nada.)' },
  cuartel: DEF_CUARTEL,
  oxigeno: { id: 'oxigeno', nombre: 'Generador de oxígeno', cat: 'base', icono: '💨', tecla: '6', code: 'Digit6', costo: 120, tiempo: 14, w: 1, h: 1, dibujar: dibujarOxigeno,
    descripcion: 'Produce oxígeno a partir del agua: gasta 0,33 de agua y 3 de energía por segundo. Colócalo pegado a un laboratorio (o a una casilla de distancia). Necesita cable.' },
  laboratorio: { id: 'laboratorio', nombre: 'Laboratorio', cat: 'base', icono: '🔬', tecla: '7', code: 'Digit7', costo: 240, tiempo: 24, w: 2, h: 2, dibujar: dibujarLaboratorio,
    descripcion: 'Produce 2 de mineral por segundo y gasta 4 de energía por segundo. Solo funciona con un generador de oxígeno en marcha pegado a él. Necesita cable. Desde aquí también puedes fabricar ruedas todoterreno para el rover.' },
  pozoagua: { id: 'pozoagua', nombre: 'Pozo de agua', cat: 'recursos', icono: '💧', tecla: '8', code: 'Digit8', costo: 160, tiempo: 12, alcance: 4, w: 1, h: 1, sobre: 'ice', crear: crearPozoAgua, mejora: { costo: 240, texto: 'Bombeo 0,5 → 1 /s' },
    descripcion: 'Bombea agua de un depósito de hielo: colócalo sobre un depósito de hielo. Gasta 2 de energía por segundo. Su cable solo llega a 4 casillas: ponlo cerca de una batería o un panel, o enlázalo con un láser.' },
  helice: { id: 'helice', nombre: 'Hélice eólica', cat: 'energia', icono: '🌀', tecla: '9', code: 'Digit9', costo: 240, tiempo: 18, w: 1, h: 1, crear: crearHelice,
    descripcion: 'Genera 5 de energía por segundo con el viento, de día y de noche: ideal para cubrir la noche. Se conecta solo a la batería más cercana.' },
  laser: { id: 'laser', nombre: 'Receptor láser', cat: 'energia', icono: '📶', tecla: '0', code: 'Digit0', costo: 80, tiempo: 14, w: 1, h: 1, dibujar: dibujarLaser,
    descripcion: 'Repetidor láser: se enlaza solo con una batería o un panel, con otros láseres y con edificios sin cable cercano. Alcance: 30 casillas, mucho más que un cable (12).' },
  almacen: { id: 'almacen', nombre: 'Almacén de hierro', cat: 'almacenes', icono: '📦', tecla: 'Z', code: 'KeyZ', costo: 80, tiempo: 12, w: 1, h: 1, dibujar: dibujarAlmacen,
    descripcion: 'Guarda objetos de tu bodega en ranuras, a salvo si destruyen tu nave. (De momento no hace nada.)' },
  almacenagua: { id: 'almacenagua', nombre: 'Almacén de agua', cat: 'almacenes', icono: '🛢️', tecla: 'X', code: 'KeyX', costo: 60, tiempo: 12, w: 1, h: 1, dibujar: dibujarAlmacenAgua,
    descripcion: 'Aumenta la capacidad de agua de la colonia. (De momento no hace nada.)' },
  torreta: { id: 'torreta', nombre: 'Torreta', cat: 'defensa', icono: '🔫', tecla: 'V', code: 'KeyV', costo: 120, tiempo: 16, vida: 150, w: 1, h: 1, crear: crearTorreta, mejora: { costo: 180, texto: 'Daño 40 → 70 /s' },
    descripcion: 'Dispara automáticamente a los enemigos a menos de 6 casillas: 40 de daño por segundo. No consume energía.' },
  reparacion: { id: 'reparacion', nombre: 'Bahía de reparación', cat: 'defensa', icono: '🛠️', tecla: 'N', code: 'KeyN', costo: 260, tiempo: 22, w: 1, h: 1, dibujar: dibujarReparacion, mejora: { costo: 200, texto: 'Reparación 8 → 16 /s' },
    descripcion: 'Repara 8 de vida por segundo a los edificios dañados en un radio de 6 casillas. No consume energía.' },
  mecha: DEF_MECHA,
};

// Aspecto de nivel 2: marco dorado, chevrones en la esquina y mejoras propias de cada edificio.
export function mejorarDibujo(e) {
  const ORO = 0xffc83a, ORO2 = 0xffe28a, d = e.dib, id = e.def.id;
  const ex = d instanceof Graphics ? d : new Graphics();          // si el dibujo ya es un Graphics, se pinta encima
  ex.roundRect(2, 2, 60, 60, 9).stroke({ width: 3, color: ORO, alpha: .95 });             // marco dorado
  for (const gro of [[5, L], [3, ORO]]) for (const y of [18, 24])                         // dos chevrones ▲▲ (contorno oscuro y dorado)
    ex.moveTo(46, y).lineTo(52, y - 6).lineTo(58, y).stroke({ width: gro[0], color: gro[1], cap: 'round', join: 'round' });
  if (id === 'minero') {
    const br = d.broca;                                           // la broca gira: sus mejoras van dentro de ella
    for (const a of [Math.PI / 4, 3 * Math.PI / 4]) {
      const c = Math.cos(a), s = Math.sin(a), p = (x, y) => [x * c - y * s, x * s + y * c];
      br.poly([...p(-15, -2), ...p(15, -2), ...p(15, 2), ...p(-15, 2)]).fill(ORO);        // aspas doradas en diagonal
    }
    for (let i = 0; i < 8; i++) br.circle(Math.cos(i * Math.PI / 4) * 15, Math.sin(i * Math.PI / 4) * 15, 2).fill(ORO2);
    br.circle(0, 0, 6).fill(ORO).stroke({ width: 2, color: L }); br.circle(0, 0, 3).fill(0xff9a2e);
    ex.circle(32, 32, 21).stroke({ width: 2.5, color: ORO });
  } else if (id === 'bateria') {
    for (const x of [7, 51]) {                                    // módulos laterales con luz cian
      ex.roundRect(x, 20, 6, 28, 2).fill(0x3a414b).stroke({ width: 2, color: L });
      ex.rect(x + 1.5, 24, 3, 20).fill(0x4fe3ff);
    }
    ex.rect(26, 3, 12, 6).fill(ORO).stroke({ width: 2, color: L });                       // borne dorado
  } else if (id === 'panel') {
    const pl = d.placa;                                           // la placa gira e se inclina: sus mejoras van dentro de ella
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      pl.rect(-17 + i * 18, -17 + j * 18, 16, 16).fill({ color: 0x4fa0ff, alpha: .35 });
      pl.rect(-17 + i * 18, -17 + j * 18, 16, 3).fill({ color: 0x9fd0ff, alpha: .5 });
    }
    pl.roundRect(-21, -21, 42, 42, 4).stroke({ width: 2, color: ORO });
    for (const x of [-28, 22]) pl.roundRect(x, -7, 6, 14, 2).fill(0x8d99a8).stroke({ width: 1.5, color: L });   // alas laterales
    pl.circle(0, 0, 3.5).fill(ORO).stroke({ width: 1.5, color: L });
  } else if (id === 'pozoagua') {
    ex.circle(32, 32, 21).stroke({ width: 2.5, color: ORO });
    ex.circle(32, 32, 11).stroke({ width: 2, color: 0x9fe8ff, alpha: .9 });
    ex.rect(29, 40, 6, 10).fill(0x8d99a8).stroke({ width: 1.5, color: L });               // segundo tubo
  } else if (id === 'torreta') {
    const cb = d.cabeza;                                           // la cabeza gira: sus mejoras van dentro de ella
    ex.circle(32, 32, 24).stroke({ width: 2.5, color: ORO });
    for (const y of [-10, 6]) cb.rect(12, y, 24, 4).fill(0x8d99a8).stroke({ width: 1.5, color: L });   // cañones laterales
    cb.rect(20, -4, 3, 8).fill(ORO);
    cb.circle(5, 0, 4).fill(ORO).stroke({ width: 1.5, color: L }); cb.circle(5, 0, 2).fill(0xff4a5a);
  } else if (id === 'reparacion') {
    ex.circle(32, 32, 23).stroke({ width: 2.5, color: ORO });
    for (const [x, y] of [[54, 10], [10, 54]]) ex.circle(x, y, 5).fill(ORO).stroke({ width: 2, color: L });   // 2 drones más
    ex.circle(32, 32, 5).fill({ color: 0x5dff8a, alpha: .9 }).stroke({ width: 1.5, color: L });
  }
  if (ex !== d) d.addChild(ex);
}

export function crearDibujo(def) {                    // devuelve un dibujo nuevo (Container o Graphics) con el edificio
  if (def.crear) return def.crear();
  const g = new Graphics();
  def.dibujar(g);
  return g;
}

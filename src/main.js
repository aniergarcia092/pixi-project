// Punto de entrada: crea la aplicación Pixi, genera el mapa y arranca el bucle.
//   WASD/flechas = conducir el rover (Shift = rápido) · Arrastrar = mover cámara · Espacio = volver al rover
//   Rueda = zoom · G = cuadrícula · R = mapa nuevo

import { Application, Container } from 'pixi.js';
import { TILE, MAP_W, MAP_H, TILE_INFO } from './nucleo/config.js';
import { generateMap, inBounds } from './mundo/mapgen.js';
import { MapView } from './mundo/mapview.js';
import { Camera } from './mundo/camera.js';
import { Minimap } from './mundo/minimap.js';
import { Ship } from './mundo/ship.js';
import { Rover } from './unidades/rover.js';
import { Builder } from './edificios/builder.js';
import { BuildMenu } from './ui/buildmenu.js';
import { Economia } from './edificios/economia.js';
import { Enemigos } from './unidades/enemies.js';
import { Mechas, Tanques } from './unidades/edificio_unidades.js';
import { InfoPanel } from './ui/infopanel.js';
import { sfx } from './audio/sonido.js';
import { Niebla } from './mundo/niebla.js';
import { ciclo } from './mundo/ciclo.js';
import { Tutorial } from './ui/tutorial.js';
import { Hud } from './ui/hud.js';
import './audio/musica.js';                                   // música de fondo (se arranca sola)

async function main() {
  const app = new Application();
  await app.init({ resizeTo: window, background: 0x120a0b, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true });
  document.getElementById('app').appendChild(app.canvas);

  const world = new Container();                          // todo lo que vive en el mapa (se mueve y escala con la cámara)
  app.stage.addChild(world);
  const camera = new Camera(app, world);

  const hud = new Hud();                                  // la interfaz superior es HTML (ui/hud.js)
  app.stage.addChild(ciclo.overlay);                      // la oscuridad de la noche va encima del mundo

  let niebla, map, view, seed, ship, rover, builder, economia, enemigos, mechas, tanques, obstaculos = [], resAt = new Map(), hover = { x: -1, y: -1 };
  const minimap = new Minimap((u, v) => camera.centerOn(u * map.w * TILE, v * map.h * TILE));

  let aterrizado = false;                                 // ya se hizo lo del aterrizaje (sonido, sacudida, tutorial)
  const tutorial = new Tutorial();
  const info = new InfoPanel(() => builder, () => economia, () => tanques);
  const menu = new BuildMenu(id => builder && builder.seleccionar(id));   // el menú se crea una sola vez

  function load(s) {
    aterrizado = false;
    seed = s; location.hash = 'seed=' + s;
    ciclo.reset();
    map = generateMap({ seed: s, w: MAP_W, h: MAP_H });
    resAt = new Map(map.resources.map(r => [r.y * map.w + r.x, r]));
    if (view) { world.removeChild(view.container); view.destroy(); }
    view = new MapView(map);
    world.addChild(view.container);
    if (ship) ship.destroy();
    ship = new Ship(map.spawn.x, map.spawn.y);
    world.addChild(ship.container);
    if (builder) { menu.elegir(null); builder.destroy(); }   // mapa nuevo: se borran los edificios
    economia = new Economia();
    builder = new Builder({
      map, camera, canvas: app.canvas, economia,
      naveCirculos: ship.colisiones(),
      getRover: () => rover,
      mensaje: t => menu.setMensaje(t),
      alCancelar: () => menu.elegir(null),
    });
    builder.container.addChild(economia.tubos);             // los tubos se dibujan encima de los edificios
    world.addChild(builder.container);
    if (enemigos) enemigos.destroy();
    enemigos = new Enemigos({ map, builder });
    world.addChild(enemigos.container);
    if (mechas) mechas.destroy();
    mechas = new Mechas({ builder, economia, enemigos });
    world.addChild(mechas.container);
    if (tanques) tanques.destroy();
    tanques = new Tanques({ map, builder, economia, enemigos, camera, canvas: app.canvas });
    world.addChild(tanques.container);
    enemigos.tanques = tanques; enemigos.mechas = mechas;   // así los enemigos también atacan a las unidades
    if (niebla) { world.removeChild(niebla.sprite); niebla.destroy(); }
    niebla = new Niebla(map);                             // sombra de zona no explorada
    world.addChild(niebla.sprite);
    obstaculos = [                                        // todo lo que el rover no puede atravesar (círculos x, y, radio)
      ...ship.colisiones(),
      ...map.resources.map(r => r.kind === 'ice'
        ? { x: (r.x + .5) * TILE + 5, y: (r.y + .5) * TILE - 3, r: 20 }   // el dibujo del hielo está algo desplazado del centro
        : { x: (r.x + .5) * TILE, y: (r.y + .5) * TILE, r: 19 }),
    ];
    if (rover) { rover.destroy(); rover = null; }         // al cambiar de mapa, el rover se borra (saldrá otro)
    camera.follow(null);                                  // y la cámara deja de seguirlo
    camera.setBounds(map.w * TILE, map.h * TILE);
    camera.centerOn((map.spawn.x + .5) * TILE, (map.spawn.y + .5) * TILE);
    minimap.setMap(map);
  }

  const m = location.hash.match(/seed=(\d+)/);
  load(m ? +m[1] : Math.floor(Math.random() * 99999));

  app.canvas.addEventListener('pointermove', e => {
    const p = camera.screenToWorld(e.clientX, e.clientY);
    hover = { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
  });
  window.addEventListener('keydown', e => {
    if (e.code === 'KeyG') view.grid.visible = !view.grid.visible;
    if (e.code === 'KeyR') load(Math.floor(Math.random() * 99999));
  });

  app.ticker.add(t => {
    ship.update(t.deltaMS);
    if (!ship.landed) { camera.vibrar(1.5 + 3 * (1 - ship.alto)); sfx.play('motor'); }   // retumba mientras baja
    if (ship.landed && !aterrizado) { aterrizado = true; sfx.play('aterriza'); camera.vibrar(16); tutorial.iniciar(1800); }   // al posarse la nave
    if (ship.landed && !rover && ship.t >= 2000) {         // el rover tarda 2 s en salir después de aterrizar
      rover = new Rover(ship.x, ship.y, map, ship, obstaculos, (x, y) => builder.ocupado(x, y));     // recibe el mapa (dónde puede pisar) y la nave (para abrir su escotilla)
      world.addChild(rover.container);
      world.addChild(builder.container);
      world.addChild(tanques.container);                  // los tanques quedan por encima de los edificios
      world.addChild(niebla.sprite);                      // la niebla va encima de los edificios (así se iluminan al terminarse)                  // el fantasma siempre encima                    // se añade después de la nave: queda encima
      camera.follow(rover);                               // PASO 3: la cámara empieza a seguirlo
    }
    if (rover) rover.update(t.deltaMS);
    builder.update(t.deltaMS);
    niebla.update(t.deltaMS, rover, builder.edificios);
    enemigos.update(t.deltaMS);
    mechas.update(t.deltaMS);
    tanques.update(t.deltaMS);
    ciclo.update(t.deltaMS, app.screen.width, app.screen.height);
    economia.update(t.deltaMS);
    if (economia.ruedas === 'lista' && rover && rover.state === 'libre') { economia.ruedas = 'hecha'; rover.instalarRuedas(); }   // las ruedas del laboratorio se acoplan al rover
    info.update();
    menu.setBloqueo(!(rover && rover.state === 'libre'));
    menu.setMineral(economia.mineral);                    // el menú atenúa lo que no te alcanza
    camera.update(t.deltaMS);                             // la cámara se actualiza DESPUÉS del rover (así no va un fotograma atrasada)
    camera.apply();
    const v = camera.viewRect();
    view.cull(v);
    view.setHover(hover.x, hover.y);
    minimap.draw(v, { w: map.w * TILE, h: map.h * TILE }, niebla);

    let cell = '';
    if (inBounds(map, hover.x, hover.y)) {
      const info = TILE_INFO[map.type[hover.y * map.w + hover.x]], r = resAt.get(hover.y * map.w + hover.x);
      cell = `casilla (${hover.x}, ${hover.y}) · ${info.name}${info.buildable ? '' : ' · no se puede construir'}${r ? ` · ${r.kind === 'ice' ? 'depósito de hielo' : 'mineral'} (${Math.floor(r.amount)})` : ''}`;
    }
    hud.update({ economia, ciclo, seed, zoom: camera.zoom, fps: Math.round(app.ticker.FPS), celda: cell });
  });
}

main();

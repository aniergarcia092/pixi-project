// Ajustes globales del juego y definición de los tipos de casilla.

export const TILE = 64;                 // tamaño de una casilla en píxeles del mundo
export const MAP_W = 128;               // ancho del mapa en casillas
export const MAP_H = 128;               // alto del mapa en casillas
export const CHUNK = 16;                // casillas por lado de cada bloque de dibujo (se oculta lo que no se ve)

// Tipos de terreno (el número es el que se guarda en map.type)
export const T = { CANYON: 0, DUST: 1, ROCK: 2, MESA: 3, ICE: 4 };

export const TILE_INFO = [
  { name: 'Cañón',  buildable: false, walkable: false, color: 0x2b1b1e },
  { name: 'Polvo',  buildable: true,  walkable: true,  color: 0xb5683d },
  { name: 'Roca',   buildable: true,  walkable: true,  color: 0x7d5a4a },
  { name: 'Meseta', buildable: true,  walkable: true,  color: 0x9a8678 },
  { name: 'Hielo',  buildable: true,  walkable: true,  color: 0xbfe6f5 },
];

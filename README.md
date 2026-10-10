# Colonia · Pixi

Proyecto base con **Vite + PixiJS 8**: mapa procedural por casillas, cámara y minimapa.

## Arrancar

```bash
npm install
npm run dev
```

Abre la dirección que muestra la consola (normalmente http://localhost:5173).
La semilla del mapa queda en la URL (`#seed=1234`) para repetir el mismo mapa.

## Controles

- Arrastrar: mover · Rueda: zoom · WASD / flechas: mover (Shift = rápido)
- **G**: cuadrícula · **R**: mapa nuevo · Click en el minimapa: saltar

## Estructura

| Archivo | Qué hace |
|---|---|
| `src/config.js` | Tamaño de casilla y del mapa, tipos de terreno (`T`, `TILE_INFO`) |
| `src/noise.js` | Ruido con semilla y utilidades |
| `src/mapgen.js` | Genera el mapa (altura, cráteres, terreno, recursos) y consultas: `typeAt`, `isBuildable`, `isWalkable` |
| `src/mapview.js` | Dibuja el mapa con Pixi por bloques de 16×16 y oculta los que no se ven |
| `src/camera.js` | Cámara: arrastre, zoom al cursor, teclado |
| `src/minimap.js` | Minimapa en un canvas del DOM |
| `src/main.js` | Arranque y bucle |

El mapa son 128×128 casillas de 64 px. Cada casilla es un número en `map.type` (0 cañón, 1 polvo, 2 roca, 3 meseta, 4 hielo).
`map.resources` es una lista de depósitos `{ kind: 'ice' | 'ore', x, y, amount }` y `map.spawn` es la zona de aterrizaje.

`test-map.mjs` (opcional): `node test-map.mjs` muestra las proporciones de terreno de varias semillas sin abrir el navegador.

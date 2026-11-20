import { GRID_W, GRID_H, T_FLOOR, T_WALL } from '../config.js';

// The arena grid: static tiles plus per-cell transient state
// (burning bricks, flames, items). Entities (players, bombs) live in Game.
export class Board {
  constructor(w = GRID_W, h = GRID_H) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.tiles = new Uint8Array(n);
    this.hidden = new Array(n).fill(null);   // power-up hidden under a brick
    this.items = new Array(n).fill(null);    // visible power-up
    this.burning = new Float32Array(n);      // brick destruction timer
    this.flames = new Float32Array(n);       // flame time left
    this.flameKind = new Uint8Array(n);
    this.flameOwner = new Int8Array(n).fill(-1);
    this.flameChain = new Int32Array(n);
    this.features = new Uint8Array(n);       // teleports / conveyor belts (config FEAT_*)
    this.telePair = new Int16Array(n).fill(-1);
    this.door = -1;                          // adventure: exit door cell
    this.doorHidden = true;
    this.version = 0;                        // bumped whenever tiles change
  }

  idx(x, y) { return y * this.w + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  tile(x, y) { return this.inside(x, y) ? this.tiles[y * this.w + x] : T_WALL; }
  setTile(x, y, t) { this.tiles[this.idx(x, y)] = t; this.version++; }
  isSolid(x, y) { return this.tile(x, y) !== T_FLOOR; }
  hasFlame(x, y) { return this.inside(x, y) && this.flames[this.idx(x, y)] > 0; }
  itemAt(x, y) { return this.inside(x, y) ? this.items[this.idx(x, y)] : null; }
}

import {
  GRID_W, GRID_H, T_FLOOR, T_WALL, T_BRICK,
  FEAT_TELE, FEAT_BELT_UP, FEAT_BELT_DOWN, FEAT_BELT_LEFT, FEAT_BELT_RIGHT,
} from '../config.js';
import { Board } from './board.js';
import { createRng } from '../core/rng.js';
import { distributeItems } from './powerups.js';
import { WORLDS, STAGES_PER_WORLD, stageNumber, stageLabel } from './campaign.js';

// Colour themes for arenas.
export const THEMES = {
  grass: {
    bg: '#14301a', floorA: '#4f9a3d', floorB: '#468f35', floorDot: '#5fb04a', shadow: '#356f27',
    wallTop: '#c8c8d8', wallHi: '#f2f2ff', wallSide: '#7d7d96', wallDark: '#46465c',
    brick: '#c8743c', brickHi: '#eea062', brickDark: '#6e3418', brickSide: '#8f4a22', pattern: 'grass',
  },
  desert: {
    bg: '#3a2210', floorA: '#e0b56a', floorB: '#d8ab5e', floorDot: '#c99a4e', shadow: '#b88a44',
    wallTop: '#a7653b', wallHi: '#d48c55', wallSide: '#71401f', wallDark: '#3f220e',
    brick: '#e8d29a', brickHi: '#fff1c4', brickDark: '#9a8452', brickSide: '#b9a06a', pattern: 'sand',
  },
  ice: {
    bg: '#0d1b33', floorA: '#d4ecf8', floorB: '#c8e4f3', floorDot: '#f2fbff', shadow: '#9cc4dc',
    wallTop: '#5a7fc4', wallHi: '#9cc0ff', wallSide: '#34528c', wallDark: '#1b2c52',
    brick: '#7fb4e2', brickHi: '#c8e8ff', brickDark: '#36608e', brickSide: '#5486b8', pattern: 'ice',
  },
  factory: {
    bg: '#16161c', floorA: '#5c606c', floorB: '#555864', floorDot: '#6c717f', shadow: '#43464f',
    wallTop: '#e2b42a', wallHi: '#ffe27a', wallSide: '#9b7612', wallDark: '#4a380a',
    brick: '#9a5a3a', brickHi: '#c27a52', brickDark: '#4e2a18', brickSide: '#6e3e26', pattern: 'metal',
  },
  garden: {
    bg: '#2a1230', floorA: '#8ec95a', floorB: '#84bf50', floorDot: '#f07ab8', shadow: '#6a9f3e',
    wallTop: '#3e8a4a', wallHi: '#6cc276', wallSide: '#22582c', wallDark: '#123018',
    brick: '#d9a0e8', brickHi: '#f4d0ff', brickDark: '#7e4a8e', brickSide: '#a96cba', pattern: 'flowers',
  },
  neon: {
    bg: '#07051a', floorA: '#241a4a', floorB: '#20163f', floorDot: '#3a2a78', shadow: '#150f30',
    wallTop: '#ff3fa4', wallHi: '#ff9ad0', wallSide: '#a4186a', wallDark: '#4e0a32',
    brick: '#2ad6e8', brickHi: '#a6f6ff', brickDark: '#0e6a78', brickSide: '#1898aa', pattern: 'grid',
  },
};

// Layout legend: '#' wall, '.' always empty, '+' always brick, ' ' random brick.
// Spawn corners are cleared automatically.
export const MAPS = [
  { id: 'classic', name: 'KLASYCZNA ARENA', theme: 'grass', density: 0.78, layout: null },
  {
    id: 'desert', name: 'PUSTYNNE RUINY', theme: 'desert', density: 0.72,
    layout: [
      '###############',
      '#..         ..#',
      '#.# # ### # #.#',
      '#             #',
      '# # #  #  # # #',
      '#   ##   ##   #',
      '# #    #    # #',
      '#   ##   ##   #',
      '# # #  #  # # #',
      '#             #',
      '#.# # ### # #.#',
      '#..         ..#',
      '###############',
    ],
  },
  {
    id: 'ice', name: 'LODOWA TWIERDZA', theme: 'ice', density: 0.75,
    layout: [
      '###############',
      '#..    #    ..#',
      '#.# # # # # #.#',
      '#             #',
      '# # ##   ## # #',
      '#   #  +  #   #',
      '# #   +++   # #',
      '#   #  +  #   #',
      '# # ##   ## # #',
      '#             #',
      '#.# # # # # #.#',
      '#..    #    ..#',
      '###############',
    ],
  },
  {
    id: 'factory', name: 'HALA FABRYCZNA', theme: 'factory', density: 0.7,
    layout: [
      '###############',
      '#..         ..#',
      '#.####   ####.#',
      '#             #',
      '# # # ### # # #',
      '#   #     #   #',
      '##  #  #  #  ##',
      '#   #     #   #',
      '# # # ### # # #',
      '#             #',
      '#.####   ####.#',
      '#..         ..#',
      '###############',
    ],
  },
  {
    id: 'garden', name: 'OGRODOWY LABIRYNT', theme: 'garden', density: 0.72,
    layout: [
      '###############',
      '#.. #     # ..#',
      '#.# # ### # #.#',
      '#   #     #   #',
      '### # # # # ###',
      '#             #',
      '# ### # # ### #',
      '#             #',
      '### # # # # ###',
      '#   #     #   #',
      '#.# # ### # #.#',
      '#.. #     # ..#',
      '###############',
    ],
  },
  {
    // digits = teleport pairs (each digit appears twice)
    id: 'portals', name: 'PORTALE', theme: 'neon', density: 0.7,
    layout: [
      '###############',
      '#..   1 2   ..#',
      '#.# # # # # #.#',
      '#             #',
      '# # # # # # # #',
      '#3           4#',
      '# # # # # # # #',
      '#4           3#',
      '# # # # # # # #',
      '#             #',
      '#.# # # # # #.#',
      '#..   2 1   ..#',
      '###############',
    ],
  },
  {
    // ^ v < > = conveyor belts (carry players and bombs)
    id: 'conveyor', name: 'TAŚMOCIĄGI', theme: 'factory', density: 0.68,
    layout: [
      '###############',
      '#..         ..#',
      '#.# # # # # #.#',
      '#   >>>>>>v   #',
      '# # ^ # # v # #',
      '#   ^     v   #',
      '# # ^ # # v # #',
      '#   ^     v   #',
      '# # ^ # # v # #',
      '#   ^<<<<<<   #',
      '#.# # # # # #.#',
      '#..         ..#',
      '###############',
    ],
  },
  { id: 'procedural', name: 'PROCEDURALNA', theme: null, density: null, procedural: true },
];

const BELT_CHARS = { '^': FEAT_BELT_UP, v: FEAT_BELT_DOWN, '<': FEAT_BELT_LEFT, '>': FEAT_BELT_RIGHT };

export const SPAWNS = [
  { x: 1, y: 1 },
  { x: GRID_W - 2, y: GRID_H - 2 },
  { x: GRID_W - 2, y: 1 },
  { x: 1, y: GRID_H - 2 },
];

export function getMapDef(id) {
  return MAPS.find((m) => m.id === id) || MAPS[0];
}

function classicLayout() {
  const rows = [];
  for (let y = 0; y < GRID_H; y++) {
    let r = '';
    for (let x = 0; x < GRID_W; x++) {
      const border = x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1;
      r += border || (x % 2 === 0 && y % 2 === 0) ? '#' : ' ';
    }
    rows.push(r);
  }
  return rows;
}

function spawnZone() {
  const set = new Set();
  for (const s of SPAWNS) {
    const dx = s.x === 1 ? 1 : -1;
    const dy = s.y === 1 ? 1 : -1;
    for (const [x, y] of [[s.x, s.y], [s.x + dx, s.y], [s.x, s.y + dy]]) set.add(y * GRID_W + x);
  }
  return set;
}

function isConnected(grid) {
  const seen = new Uint8Array(GRID_W * GRID_H);
  const q = [[1, 1]];
  seen[GRID_W + 1] = 1;
  let count = 1;
  while (q.length) {
    const [x, y] = q.pop();
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const i = ny * GRID_W + nx;
      if (grid[ny][nx] !== '#' && !seen[i]) { seen[i] = 1; count++; q.push([nx, ny]); }
    }
  }
  let open = 0;
  for (let y = 0; y < GRID_H; y++) for (let x = 0; x < GRID_W; x++) if (grid[y][x] !== '#') open++;
  return count === open;
}

// Procedural layout: 4-fold symmetric, pillar based, with random extra walls
// and holes; verified to be fully connected.
export function generateLayout(rng) {
  const zone = spawnZone();
  for (let attempt = 0; attempt < 60; attempt++) {
    const g = classicLayout().map((r) => r.split(''));
    const extra = rng.range(0.06, 0.16);
    const removePillar = rng.range(0, 0.25);
    const cx = (GRID_W - 1) / 2, cy = (GRID_H - 1) / 2;
    for (let y = 1; y <= cy; y++) {
      for (let x = 1; x <= cx; x++) {
        let ch = g[y][x];
        const pillar = x % 2 === 0 && y % 2 === 0;
        if (pillar && !(x === 2 && y === 2) && rng.chance(removePillar)) ch = rng.chance(0.5) ? '+' : ' ';
        else if (!pillar && rng.chance(extra)) ch = '#';
        else if (!pillar && rng.chance(0.04)) ch = '.';
        for (const [mx, my] of [[x, y], [GRID_W - 1 - x, y], [x, GRID_H - 1 - y], [GRID_W - 1 - x, GRID_H - 1 - y]]) {
          g[my][mx] = ch;
        }
      }
    }
    for (const i of zone) g[Math.floor(i / GRID_W)][i % GRID_W] = '.';
    if (isConnected(g)) return g.map((r) => r.join(''));
  }
  return classicLayout();
}

// Build a fresh board for a round. Deterministic for a given (mapId, seed).
export function buildMap(mapId, seed) {
  const rng = createRng(seed);
  const def = getMapDef(mapId);
  let layout, theme, density;
  if (def.procedural) {
    layout = generateLayout(rng);
    theme = rng.pick(Object.keys(THEMES));
    density = rng.range(0.62, 0.85);
  } else {
    layout = def.layout || classicLayout();
    theme = def.theme;
    density = def.density;
  }
  const { board, bricks } = fillBoard(layout, density, spawnZone(), rng);
  const items = distributeItems(bricks.length, rng);
  items.forEach((id, k) => { board.hidden[bricks[k]] = id; });
  return { board, theme, name: def.name, layout };
}

// Turns a text layout into a Board (walls, random bricks, teleports, belts).
function fillBoard(layout, density, safe, rng) {
  const board = new Board();
  const bricks = [];
  const tele = {};
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const i = y * GRID_W + x;
      const ch = layout[y][x];
      let t = T_FLOOR;
      if (ch === '#') t = T_WALL;
      else if (BELT_CHARS[ch]) board.features[i] = BELT_CHARS[ch];
      else if (ch >= '1' && ch <= '9') {
        board.features[i] = FEAT_TELE;
        (tele[ch] = tele[ch] || []).push(i);
      } else if (safe.has(i) || ch === '.') t = T_FLOOR;
      else if (ch === '+') t = T_BRICK;
      else if (rng.chance(density)) t = T_BRICK;
      board.tiles[i] = t;
      if (t === T_BRICK) bricks.push(i);
    }
  }
  for (const pair of Object.values(tele)) {
    if (pair.length === 2) {
      board.telePair[pair[0]] = pair[1];
      board.telePair[pair[1]] = pair[0];
    }
  }
  rng.shuffle(bricks);
  return { board, bricks };
}

// ---------------------------------------------------------------- adventure

// Stage layout for the single-player adventure: player starts top-left,
// one exit door hidden under a brick far from the start. Stage 5 of every
// world is an open boss arena without a door.
//   opts: { extraItem, skulls }
export function buildAdventureMap(world, stage, seed, opts = {}) {
  const rng = createRng(seed);
  const W = WORLDS[world - 1] || WORLDS[0];
  const n = stageNumber(world, stage);
  const boss = stage === STAGES_PER_WORLD;
  let layout;
  if (boss) {
    layout = W.boss === 'emperor' ? getMapDef('portals').layout : classicLayout();
  } else {
    const def = getMapDef(W.layouts[(stage - 1) % W.layouts.length]);
    layout = def.procedural ? generateLayout(rng) : (def.layout || classicLayout());
  }
  const safe = new Set();
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) safe.add(y * GRID_W + x);
  if (boss) {
    // keep the middle of the arena open for the boss
    for (let y = 4; y <= 8; y++) for (let x = 5; x <= 9; x++) safe.add(y * GRID_W + x);
  }
  const density = boss ? 0.3 : Math.min(0.62, 0.44 + n * 0.007);
  const { board, bricks } = fillBoard(layout, density, safe, rng);
  let rest = bricks;
  if (!boss) {
    // door: a brick far (manhattan) from the start
    const far = bricks.filter((i) => (i % GRID_W) + Math.floor(i / GRID_W) >= 8);
    const doorCell = (far.length ? far : bricks)[0];
    board.door = doorCell;
    board.doorHidden = true;
    rest = bricks.filter((i) => i !== doorCell);
  }
  const items = [];
  const goods = ['bomb', 'fire', 'kick', 'bomb', 'fire', 'shield', 'remote', 'bomb', 'fire', 'pierce'];
  items.push(goods[(n - 1) % goods.length]);
  items.push(rng.pick(['bomb', 'fire']));
  items.push(rng.pick(['bomb', 'fire', 'shield', 'speed']));
  if (boss) items.push('bomb', 'fire');
  if (n % 3 === 0) items.push('speed');          // guaranteed speed every 3 stages
  if (opts.extraItem) items.push(rng.pick(['bomb', 'fire', 'speed', 'shield']));
  if (opts.skulls !== false && n >= 4 && !boss && rng.chance(0.3)) items.push('skull');
  // speed first so it never misses out on a free brick
  items.sort((a, b) => (b === 'speed') - (a === 'speed'));
  items.forEach((id, k) => { if (rest[k] !== undefined) board.hidden[rest[k]] = id; });
  return { board, theme: W.theme, name: `ETAP ${stageLabel(world, stage)}`, layout };
}

// Order in which walls fall during "hurry up" (outer ring inwards, clockwise).
export function spiralOrder() {
  const out = [];
  let x0 = 1, y0 = 1, x1 = GRID_W - 2, y1 = GRID_H - 2;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push([x, y0]);
    for (let y = y0 + 1; y <= y1; y++) out.push([x1, y]);
    if (y1 > y0) for (let x = x1 - 1; x >= x0; x--) out.push([x, y1]);
    if (x1 > x0) for (let y = y1 - 1; y > y0; y--) out.push([x0, y]);
    x0++; y0++; x1--; y1--;
  }
  return out;
}

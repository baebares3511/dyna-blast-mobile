// Adventure-mode monsters (classic Dyna Blaster style enemies).
import { DIRS, DIR_NAMES, T_WALL, T_BRICK, BASE_SPEED } from '../config.js';
import { WORLDS } from './campaign.js';

//   ai: 'wander' - goes straight, turns when blocked
//       'turny'  - picks a random direction at every crossing
//       'chase'  - hunts the player when it is within `sight` tiles
export const MONSTERS = {
  balloon: { name: 'BALONIK', speed: 1.4, points: 100, ai: 'wander' },
  drop: { name: 'KROPELKA', speed: 2.2, points: 200, ai: 'turny' },
  eye: { name: 'OCZKO', speed: 2.4, points: 400, ai: 'chase', sight: 6 },
  ghost: { name: 'DUSZEK', speed: 1.6, points: 800, ai: 'chase', sight: 9, passBricks: true },
  spark: { name: 'ISKRA', speed: 3.5, points: 1000, ai: 'turny' },
};
export const MONSTER_IDS = Object.keys(MONSTERS);

// Until the player picks up a speed bonus, no monster may be faster than this
// much below the player's base speed.
const SPEED_CAP_MARGIN = 0.2;
const SPAWN_GRACE = 1.2;   // freshly spawned "penalty" monsters ignore flames for a moment

const REVERSE = { up: 'down', down: 'up', left: 'right', right: 'left' };
let nextId = 1;

// Which monsters appear in a stage of a world (difficulty ramps up).
export function stageRoster(world, stage, rng, fewer = false) {
  const W = WORLDS[world - 1] || WORLDS[0];
  const count = Math.max(3, Math.min(9, 2 + world + stage - (fewer ? 1 : 0)));
  const pool = W.pool.slice();
  if (stage >= 3) pool.push(...W.late);
  const out = [];
  for (let i = 0; i < count; i++) out.push(pool[Math.floor(rng() * pool.length)]);
  return out;
}

//   opts.points - override score (0 = penalty / summoned monster, no reward)
//   opts.grace  - seconds of immunity to flames after spawning
export function createMonster(type, x, y, opts = {}) {
  const def = MONSTERS[type];
  return {
    id: nextId++, type, x: x + 0.5, y: y + 0.5, tx: x, ty: y, dir: DIR_NAMES[Math.floor(Math.random() * 4)],
    speed: def.speed, alive: true, deathTime: 0, anim: Math.random() * 2,
    points: opts.points ?? def.points, grace: opts.grace || 0,
  };
}

function walkable(game, m, x, y) {
  const b = game.board;
  const t = b.tile(x, y);
  if (t === T_WALL) return false;
  if (t === T_BRICK && !MONSTERS[m.type].passBricks) return false;
  if (game.bombAt(x, y)) return false;
  return true;
}

function freeDirs(game, m, cx, cy) {
  return DIR_NAMES.filter((d) => walkable(game, m, cx + DIRS[d].x, cy + DIRS[d].y));
}

function chaseDir(game, m, cx, cy, target, sight) {
  if (Math.abs(target.cellX - cx) + Math.abs(target.cellY - cy) > sight) return null;
  const b = game.board;
  const start = b.idx(cx, cy), goal = b.idx(target.cellX, target.cellY);
  const prev = new Int16Array(b.w * b.h).fill(-2);
  prev[start] = -1;
  const q = [start];
  for (let qi = 0; qi < q.length && qi < 160; qi++) {
    const c = q[qi];
    if (c === goal) break;
    const x = c % b.w, y = (c - x) / b.w;
    for (const d of DIR_NAMES) {
      const nx = x + DIRS[d].x, ny = y + DIRS[d].y;
      const ni = b.idx(nx, ny);
      if (prev[ni] !== -2 || !walkable(game, m, nx, ny)) continue;
      prev[ni] = c;
      q.push(ni);
    }
  }
  if (prev[goal] === -2) return null;
  let c = goal;
  while (prev[c] !== start && prev[c] >= 0) c = prev[c];
  const nx = c % b.w, ny = (c - nx) / b.w;
  return DIR_NAMES.find((d) => cx + DIRS[d].x === nx && cy + DIRS[d].y === ny) || null;
}

function chooseDir(game, m, cx, cy) {
  const def = MONSTERS[m.type];
  const dirs = freeDirs(game, m, cx, cy);
  if (!dirs.length) return null;
  const player = game.players.find((p) => p.alive);
  if (def.ai === 'chase' && player) {
    const d = chaseDir(game, m, cx, cy, player, def.sight);
    if (d) return d;
  }
  const forward = dirs.includes(m.dir);
  const noBack = dirs.filter((d) => d !== REVERSE[m.dir]);
  if (def.ai === 'wander') {
    if (forward && Math.random() > 0.12) return m.dir;
  } else if (forward && noBack.length <= 1 && Math.random() > 0.05) return m.dir;
  const pool = noBack.length ? noBack : dirs;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Effective monster speed: difficulty multiplier, capped below the player's
// speed while the player has no speed upgrade.
export function monsterSpeed(game, m) {
  let s = MONSTERS[m.type].speed * (game.adventure?.monsterSpeed || 1);
  const p = game.players[0];
  if (p && p.speedLevel === 0) s = Math.min(s, BASE_SPEED - SPEED_CAP_MARGIN);
  return s;
}

export function killMonster(game, m, cx, cy) {
  m.alive = false;
  m.deathTime = game.time;
  game.score += m.points;
  game.emit({ type: 'monsterDeath', x: cx, y: cy, points: m.points, mtype: m.type });
}

export function updateMonsters(game, dt) {
  const b = game.board;
  for (const m of game.monsters) {
    if (!m.alive) continue;
    m.anim += dt;
    if (m.grace > 0) m.grace -= dt;
    // target cell got blocked (bomb placed / kicked into it): turn back
    if (!walkable(game, m, m.tx, m.ty)) {
      m.tx = Math.floor(m.x);
      m.ty = Math.floor(m.y);
      m.dir = REVERSE[m.dir];
    }
    let move = monsterSpeed(game, m) * dt;
    while (move > 0) {
      const gx = m.tx + 0.5, gy = m.ty + 0.5;
      const dist = Math.abs(gx - m.x) + Math.abs(gy - m.y);
      if (dist > move) {
        m.x += Math.sign(gx - m.x) * Math.min(move, Math.abs(gx - m.x));
        m.y += Math.sign(gy - m.y) * Math.min(move, Math.abs(gy - m.y));
        break;
      }
      m.x = gx;
      m.y = gy;
      move -= dist;
      const d = chooseDir(game, m, m.tx, m.ty);
      if (!d) break;
      m.dir = d;
      m.tx += DIRS[d].x;
      m.ty += DIRS[d].y;
    }
    // flames
    const cx = Math.floor(m.x), cy = Math.floor(m.y);
    if (b.flames[b.idx(cx, cy)] > 0 && m.grace <= 0) {
      killMonster(game, m, cx, cy);
      continue;
    }
    // touching the player
    for (const p of game.players) {
      if (p.alive && Math.abs(p.x - m.x) < 0.7 && Math.abs(p.y - m.y) < 0.7) game.hurt(p, -1);
    }
  }
}

export { SPAWN_GRACE };

// Random free cell for spawning.
//   minDist - min distance from the player
//   near    - {x, y, max}: prefer cells within `max` of this point
//   avoidDanger - skip cells with flames, bombs in line or falling bombs nearby
export function spawnCell(game, rng, minDist = 5, opts = {}) {
  const b = game.board;
  const p = game.players[0];
  const cells = [];
  const threatened = opts.avoidDanger ? dangerCells(game) : null;
  for (let y = 1; y < b.h - 1; y++) {
    for (let x = 1; x < b.w - 1; x++) {
      const i = b.idx(x, y);
      if (b.tile(x, y) !== 0 || game.bombAt(x, y) || b.features[i] || i === b.door) continue;
      if (Math.abs(x - p.cellX) + Math.abs(y - p.cellY) < minDist) continue;
      if (threatened && threatened.has(i)) continue;
      if (opts.near && Math.abs(x - opts.near.x) + Math.abs(y - opts.near.y) > opts.near.max) continue;
      cells.push([x, y]);
    }
  }
  if (!cells.length && opts.near) return spawnCell(game, rng, minDist, { ...opts, near: null });
  return cells.length ? cells[Math.floor(rng() * cells.length)] : null;
}

// cells that are burning or lie in the (unobstructed) line of a bomb
function dangerCells(game) {
  const b = game.board;
  const out = new Set();
  for (let i = 0; i < b.flames.length; i++) if (b.flames[i] > 0) out.add(i);
  const bombs = game.bombs.map((x) => ({ x: x.x, y: x.y, r: x.range }))
    .concat(game.meteors.map((m) => ({ x: m.x, y: m.y, r: 2 })));
  for (const bm of bombs) {
    out.add(b.idx(bm.x, bm.y));
    for (const d of Object.values(DIRS)) {
      for (let r = 1; r <= bm.r; r++) {
        const x = bm.x + d.x * r, y = bm.y + d.y * r;
        if (b.tile(x, y) !== 0) break;
        out.add(b.idx(x, y));
      }
    }
  }
  return out;
}

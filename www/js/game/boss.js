// Adventure bosses: one per world, fought on stage 5 of the world.
// A boss walks the grid like a monster, but has hit points, a short
// invulnerability after each hit and a cycle of special attacks.
// Only flames started by the player hurt it (falling bombs, its own bombs
// and chains started by them do not).
import { DIRS, DIR_NAMES, T_FLOOR } from '../config.js';
import { Bomb } from './bomb.js';
import { createMonster, spawnCell, killMonster, SPAWN_GRACE } from './monsters.js';
import { BOSS_NAMES } from './campaign.js';

export const BOSSES = {
  king: { hp: 6, speed: 1.5, points: 5000, every: 4.2, attacks: ['summon', 'meteor', 'summon'], minion: 'balloon' },
  scarab: { hp: 7, speed: 1.7, points: 8000, every: 3.6, attacks: ['charge', 'summon', 'charge'], minion: 'eye' },
  golem: { hp: 8, speed: 1.3, points: 11000, every: 3.6, attacks: ['meteor', 'meteor', 'summon'], minion: 'drop' },
  mecha: { hp: 9, speed: 2.0, points: 14000, every: 3.2, attacks: ['bombs', 'charge', 'bombs', 'summon'], minion: 'spark' },
  emperor: { hp: 12, speed: 1.8, points: 25000, every: 3.0, attacks: ['teleport', 'meteor', 'summon', 'charge', 'darkness', 'bombs'], minion: 'ghost' },
};

const HURT_TIME = 1.3;
const CHARGE_SPEED = 7;
const WINDUP = 0.7;
const STUN = 0.9;
const REVERSE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function createBoss(type, x, y, hpMul = 1) {
  const def = BOSSES[type];
  const hp = Math.max(3, Math.round(def.hp * hpMul));
  return {
    type, name: BOSS_NAMES[type], x: x + 0.5, y: y + 0.5, tx: x, ty: y, dir: 'down',
    hp, maxHp: hp, alive: true, state: 'walk', timer: 0, attackTimer: 2.5, attackIdx: 0,
    hurt: 0, anim: 0, deathTime: 0, alpha: 1,
  };
}

function walkable(game, x, y) {
  return game.board.tile(x, y) === T_FLOOR && !game.bombAt(x, y);
}

function rage(boss) { return 1 - boss.hp / boss.maxHp; }

// next step towards the player (BFS), or null
function chaseStep(game, cx, cy, target) {
  const b = game.board;
  const start = b.idx(cx, cy), goal = b.idx(target.cellX, target.cellY);
  const prev = new Int16Array(b.w * b.h).fill(-2);
  prev[start] = -1;
  const q = [start];
  for (let qi = 0; qi < q.length; qi++) {
    const c = q[qi];
    if (c === goal) break;
    const x = c % b.w, y = (c - x) / b.w;
    for (const d of DIR_NAMES) {
      const nx = x + DIRS[d].x, ny = y + DIRS[d].y;
      const ni = b.idx(nx, ny);
      if (prev[ni] !== -2 || (!walkable(game, nx, ny) && ni !== goal)) continue;
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

function chooseDir(game, boss) {
  const p = game.players[0];
  const free = DIR_NAMES.filter((d) => walkable(game, boss.tx + DIRS[d].x, boss.ty + DIRS[d].y));
  if (!free.length) return null;
  if (p.alive && Math.random() < 0.75) {
    const d = chaseStep(game, boss.tx, boss.ty, p);
    if (d && free.includes(d)) return d;
  }
  const noBack = free.filter((d) => d !== REVERSE[boss.dir]);
  const pool = noBack.length ? noBack : free;
  return pool[Math.floor(Math.random() * pool.length)];
}

// straight clear line to the player? returns the direction
function lineToPlayer(game, boss) {
  const p = game.players[0];
  if (!p.alive) return null;
  const bx = boss.tx, by = boss.ty, px = p.cellX, py = p.cellY;
  if (bx !== px && by !== py) return null;
  const dir = bx === px ? (py > by ? 'down' : 'up') : (px > bx ? 'right' : 'left');
  const d = DIRS[dir];
  for (let x = bx + d.x, y = by + d.y, k = 0; k < 14; x += d.x, y += d.y, k++) {
    if (x === px && y === py) return dir;
    if (!walkable(game, x, y)) return null;
  }
  return null;
}

function startAttack(game, boss) {
  const def = BOSSES[boss.type];
  const r = rage(boss);
  for (let tries = 0; tries < def.attacks.length; tries++) {
    const kind = def.attacks[boss.attackIdx++ % def.attacks.length];
    if (doAttack(game, boss, kind, r)) {
      boss.attackTimer = def.every * (1 - r * 0.35) * (0.85 + Math.random() * 0.3);
      return;
    }
  }
  boss.attackTimer = 1;
}

function doAttack(game, boss, kind, r) {
  const p = game.players[0];
  const rng = game.rng;
  switch (kind) {
    case 'charge': {
      const dir = lineToPlayer(game, boss);
      if (!dir) return false;
      boss.state = 'windup';
      boss.timer = WINDUP;
      boss.dir = dir;
      game.emit({ type: 'bossWindup', x: boss.tx, y: boss.ty });
      return true;
    }
    case 'meteor': {
      if (!p.alive) return false;
      const n = 3 + Math.round(r * 3);
      const cells = [[p.cellX, p.cellY]];
      const b = game.board;
      for (let k = 0; k < 30 && cells.length < n; k++) {
        const x = p.cellX + Math.floor(rng() * 7) - 3, y = p.cellY + Math.floor(rng() * 7) - 3;
        if (b.tile(x, y) !== T_FLOOR || cells.some(([cx, cy]) => cx === x && cy === y)) continue;
        cells.push([x, y]);
      }
      cells.forEach(([x, y], k) => game.meteors.push({ x, y, t: 0.9 + k * 0.3 }));
      game.emit({ type: 'bossCast', x: boss.tx, y: boss.ty });
      return true;
    }
    case 'bombs': {
      if (game.bombAt(boss.tx, boss.ty)) return false;
      const bomb = new Bomb(null, boss.tx, boss.ty, { range: 2 + (r > 0.5 ? 1 : 0), fuse: 2.2 });
      game.bombs.push(bomb);
      game.emit({ type: 'place', x: boss.tx, y: boss.ty, owner: -1 });
      return true;
    }
    case 'summon': {
      const alive = game.monsters.filter((m) => m.alive).length;
      if (alive >= 2 + Math.round(r * 2)) return false;
      const type = BOSSES[boss.type].minion;
      for (let k = 0; k < 2; k++) {
        const c = spawnCell(game, rng, 3, { near: { x: boss.tx, y: boss.ty, max: 3 }, avoidDanger: true });
        if (!c) continue;
        game.monsters.push(createMonster(type, c[0], c[1], { points: 0, grace: SPAWN_GRACE }));
        game.emit({ type: 'monsterSpawn', x: c[0], y: c[1] });
      }
      game.emit({ type: 'bossCast', x: boss.tx, y: boss.ty });
      return true;
    }
    case 'teleport':
      boss.state = 'vanish';
      boss.timer = 0.5;
      game.emit({ type: 'teleport', fromX: boss.tx, fromY: boss.ty, x: boss.tx, y: boss.ty });
      return true;
    case 'darkness':
      if (game.darkness > 0) return false;
      game.darkness = 6;
      game.emit({ type: 'roundEvent', kind: 'darkness', label: 'CIEMNOŚĆ!' });
      return true;
    default:
      return false;
  }
}

function hitByPlayerFlame(game, boss) {
  const b = game.board;
  const xs = new Set([Math.floor(boss.x - 0.3), Math.floor(boss.x + 0.3)]);
  const ys = new Set([Math.floor(boss.y - 0.3), Math.floor(boss.y + 0.3)]);
  for (const x of xs) {
    for (const y of ys) {
      const i = b.idx(x, y);
      if (b.flames[i] > 0 && b.flameOwner[i] >= 0) return true;
    }
  }
  return false;
}

function walk(game, boss, dt, speed) {
  let move = speed * dt;
  while (move > 0) {
    const gx = boss.tx + 0.5, gy = boss.ty + 0.5;
    const dist = Math.abs(gx - boss.x) + Math.abs(gy - boss.y);
    if (dist > move) {
      boss.x += Math.sign(gx - boss.x) * Math.min(move, Math.abs(gx - boss.x));
      boss.y += Math.sign(gy - boss.y) * Math.min(move, Math.abs(gy - boss.y));
      return;
    }
    boss.x = gx;
    boss.y = gy;
    move -= dist;
    // at a cell centre: attack or pick the next cell
    if (boss.attackTimer <= 0) {
      startAttack(game, boss);
      if (boss.state !== 'walk') return;
    }
    const d = chooseDir(game, boss);
    if (!d) return;
    boss.dir = d;
    boss.tx += DIRS[d].x;
    boss.ty += DIRS[d].y;
  }
}

export function updateBoss(game, boss, dt) {
  if (!boss.alive) return;
  const def = BOSSES[boss.type];
  boss.anim += dt;
  if (boss.hurt > 0) boss.hurt -= dt;
  const r = rage(boss);
  // the cell it is heading to got blocked (bomb kicked / placed): turn back
  if (boss.state === 'walk' && !walkable(game, boss.tx, boss.ty) && !(Math.floor(boss.x) === boss.tx && Math.floor(boss.y) === boss.ty)) {
    boss.tx = Math.floor(boss.x);
    boss.ty = Math.floor(boss.y);
  }
  switch (boss.state) {
    case 'walk':
      boss.attackTimer -= dt;
      walk(game, boss, dt, def.speed * (1 + r * 0.6));
      break;
    case 'windup':
      boss.timer -= dt;
      if (boss.timer <= 0) boss.state = 'charge';
      break;
    case 'charge': {
      let move = CHARGE_SPEED * dt;
      const d = DIRS[boss.dir];
      while (move > 0) {
        const gx = boss.tx + 0.5, gy = boss.ty + 0.5;
        const dist = Math.abs(gx - boss.x) + Math.abs(gy - boss.y);
        if (dist > move) {
          boss.x += Math.sign(gx - boss.x) * Math.min(move, Math.abs(gx - boss.x));
          boss.y += Math.sign(gy - boss.y) * Math.min(move, Math.abs(gy - boss.y));
          break;
        }
        boss.x = gx;
        boss.y = gy;
        move -= dist;
        if (!walkable(game, boss.tx + d.x, boss.ty + d.y)) {
          boss.state = 'stun';
          boss.timer = STUN;
          game.emit({ type: 'bossStomp', x: boss.tx, y: boss.ty });
          break;
        }
        boss.tx += d.x;
        boss.ty += d.y;
      }
      break;
    }
    case 'stun':
      boss.timer -= dt;
      if (boss.timer <= 0) boss.state = 'walk';
      break;
    case 'vanish':
      boss.timer -= dt;
      boss.alpha = Math.max(0, boss.timer / 0.5);
      if (boss.timer <= 0) {
        const c = spawnCell(game, game.rng, 6, { avoidDanger: true });
        if (c) {
          boss.x = c[0] + 0.5; boss.y = c[1] + 0.5; boss.tx = c[0]; boss.ty = c[1];
          game.emit({ type: 'teleport', fromX: c[0], fromY: c[1], x: c[0], y: c[1] });
        }
        boss.state = 'appear';
        boss.timer = 0.5;
      }
      break;
    case 'appear':
      boss.timer -= dt;
      boss.alpha = 1 - Math.max(0, boss.timer / 0.5);
      if (boss.timer <= 0) { boss.state = 'walk'; boss.alpha = 1; }
      break;
    default:
  }

  // damage
  const visible = boss.state !== 'vanish' && boss.state !== 'appear';
  if (visible && boss.hurt <= 0 && hitByPlayerFlame(game, boss)) {
    boss.hp--;
    boss.hurt = HURT_TIME;
    game.emit({ type: 'bossHit', x: Math.floor(boss.x), y: Math.floor(boss.y), hp: boss.hp });
    if (boss.hp <= 0) {
      boss.alive = false;
      boss.deathTime = game.time;
      game.score += def.points;
      game.emit({ type: 'bossDeath', x: Math.floor(boss.x), y: Math.floor(boss.y), points: def.points });
      for (const m of game.monsters) if (m.alive) killMonster(game, m, Math.floor(m.x), Math.floor(m.y));
      return;
    }
  }
  // contact
  const p = game.players[0];
  if (visible && p.alive && Math.abs(p.x - boss.x) < 0.8 && Math.abs(p.y - boss.y) < 0.8) game.hurt(p, -1);
}

import {
  BASE_SPEED, SPEED_STEP, START_BOMBS, START_RANGE, DIRS,
} from '../config.js';

const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

// A bomber. Position (x, y) is the centre of the character in tile units,
// so a player standing in the middle of cell (3,4) has x=3.5, y=4.5.
export class Player {
  constructor(id, opts) {
    this.id = id;
    this.name = opts.name;
    this.style = opts.style ?? id;
    this.kind = opts.kind;             // 'local' | 'bot' | 'remote'
    this.difficulty = opts.difficulty || 'normal';
    this.character = opts.character || null;
    this.spawn = { x: 1, y: 1 };
    this.input = { dir: null, bomb: false, detonate: false };
    this.resetForRound();
  }

  resetForRound() {
    this.x = this.spawn.x + 0.5;
    this.y = this.spawn.y + 0.5;
    this.alive = true;
    this.dir = 'down';
    this.moving = false;
    this.anim = 0;
    this.maxBombs = START_BOMBS;
    this.range = START_RANGE;
    this.speedLevel = 0;
    this.canKick = false;
    this.hasRemote = false;
    this.pierce = false;
    this.shield = false;
    this.invuln = 0;
    this.curse = null;       // { type, time }
    this.turbo = false;      // set by the "TURBO" round event
    this.teleCell = -1;      // teleport we arrived on (must leave before reuse)
    this.activeBombs = 0;
    this.kills = 0;
    this.bombsPlaced = 0;
    this.collected = {};
    this.deathTime = 0;
    this.input.dir = null;
    this.input.bomb = false;
    this.input.detonate = false;
    this.curseImmune = false;
    this.applyTrait();
  }

  // the character's special trait (config.CHARACTERS)
  applyTrait() {
    switch (this.character) {
      case 'bomber': this.maxBombs++; break;
      case 'ignis': this.range++; break;
      case 'zefir': this.speedLevel++; break;
      case 'kopacz': this.canKick = true; break;
      case 'bastion': this.shield = true; break;
      case 'widmo': this.curseImmune = true; break;
      default:
    }
  }

  // keep upgrades between adventure stages (never below the trait's base)
  carryUpgradesFrom(prev) {
    this.maxBombs = Math.max(this.maxBombs, prev.maxBombs || 0);
    this.range = Math.max(this.range, prev.range || 0);
    this.speedLevel = Math.max(this.speedLevel, prev.speedLevel || 0);
    this.canKick = this.canKick || !!prev.canKick;
    this.hasRemote = this.hasRemote || !!prev.hasRemote;
    this.pierce = this.pierce || !!prev.pierce;
    this.shield = this.shield || !!prev.shield;
  }

  upgrades() {
    return {
      maxBombs: this.maxBombs, range: this.range, speedLevel: this.speedLevel,
      canKick: this.canKick, hasRemote: this.hasRemote, pierce: this.pierce, shield: this.shield,
    };
  }

  get speed() {
    let s = BASE_SPEED + this.speedLevel * SPEED_STEP;
    if (this.curse && this.curse.type === 'slow') s = BASE_SPEED * 0.55;
    if (this.curse && this.curse.type === 'fast') s = BASE_SPEED * 2.1;
    if (this.turbo) s *= 1.35;
    return s;
  }

  get cellX() { return Math.floor(this.x); }
  get cellY() { return Math.floor(this.y); }

  overlapsCell(cx, cy) {
    return Math.abs(this.x - (cx + 0.5)) < 0.99 && Math.abs(this.y - (cy + 0.5)) < 0.99;
  }
}

// Direction actually used for a human's input (the "reverse" curse flips it).
export function effectiveDir(p, dir) {
  if (dir && p.curse && p.curse.type === 'reverse') return OPPOSITE[dir];
  return dir;
}

// A cell can be entered if it is floor and there is no bomb in it -
// unless the player already overlaps that bomb (so you can walk off a bomb
// you just placed, but not walk back onto it once you left).
export function canEnter(game, p, cx, cy) {
  if (game.board.isSolid(cx, cy)) return false;
  if (game.bombAt(cx, cy) && !p.overlapsCell(cx, cy)) return false;
  return true;
}

// Grid-lane movement with corner assist: when moving along one axis the
// player is first nudged onto the nearest open lane of the other axis, which
// makes turning into corridors forgiving on a touch screen.
// opts.push: external push (conveyor) - keeps facing, no kicking, custom speed
export function movePlayer(game, p, dirName, dt, opts = {}) {
  const d = DIRS[dirName];
  if (!opts.push) p.dir = dirName;
  const horiz = d.x !== 0;
  const sgn = horiz ? d.x : d.y;
  let along = horiz ? p.x : p.y;
  let perp = horiz ? p.y : p.x;
  let dist = (opts.speed ?? p.speed) * dt;
  const ca = Math.floor(along);
  const enter = (a, b) => (horiz ? canEnter(game, p, a, b) : canEnter(game, p, b, a));
  let moved = false;

  const cp = Math.floor(perp);
  const off = perp - (cp + 0.5);
  if (Math.abs(off) > 1e-4) {
    let lane = null;
    if (enter(ca + sgn, cp)) lane = cp;
    else {
      const other = cp + (off > 0 ? 1 : -1);
      if (enter(ca + sgn, other) && enter(ca, other)) lane = other;
    }
    if (lane === null) {
      if (!opts.push) p.moving = false;
      return false;
    }
    const target = lane + 0.5;
    const delta = target - perp;
    const step = Math.min(Math.abs(delta), dist);
    perp += Math.sign(delta) * step;
    dist -= step;
    moved = step > 1e-6;
    if (Math.abs(target - perp) < 1e-4) perp = target;
  }

  if (dist > 0 && Math.abs(perp - (Math.floor(perp) + 0.5)) < 1e-4) {
    const lane = Math.floor(perp);
    let na = along + sgn * dist;
    if (!enter(ca + sgn, lane)) {
      const center = ca + 0.5;
      if (sgn > 0) na = along < center ? Math.min(na, center) : along;
      else na = along > center ? Math.max(na, center) : along;
      if (!opts.push && (Math.abs(na - center) < 1e-6 || na === along)) {
        const kx = horiz ? ca + sgn : lane;
        const ky = horiz ? lane : ca + sgn;
        tryKick(game, p, kx, ky, dirName);
      }
    }
    if (Math.abs(na - along) > 1e-6) moved = true;
    along = na;
  }

  if (horiz) { p.x = along; p.y = perp; } else { p.y = along; p.x = perp; }
  if (!opts.push) p.moving = moved;
  return moved;
}

export function tryKick(game, p, bx, by, dirName) {
  if (!p.canKick) return false;
  const b = game.bombAt(bx, by);
  if (!b || b.slideDir || p.overlapsCell(bx, by)) return false;
  const d = DIRS[dirName];
  if (!game.cellFreeForBomb(bx + d.x, by + d.y)) return false;
  b.slideDir = dirName;
  b.slideOff = 0;
  b.slideSpeed = 0;
  game.emit({ type: 'kick', x: bx, y: by });
  return true;
}

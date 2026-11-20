import {
  FUSE_TIME, KICK_SPEED, DIRS, CHAIN_DELAY, FEAT_TELE, BELT_DIR, BELT_SPEED,
} from '../config.js';

let nextBombId = 1;

// A placed bomb. `x, y` is always the integer cell the bomb logically occupies;
// while kicked (or carried by a conveyor) it slides towards the next cell.
// owner may be null for neutral bombs (e.g. the "bomb rain" event).
export class Bomb {
  constructor(owner, x, y, opts = {}) {
    this.id = nextBombId++;
    this.ownerId = owner ? owner.id : -1;
    this.x = x;
    this.y = y;
    const curse = owner && owner.curse ? owner.curse.type : null;
    this.range = opts.range ?? (curse === 'weak' ? 1 : owner.range);
    this.timer = opts.fuse ?? (curse === 'shortfuse' ? 1.1 : FUSE_TIME);
    this.remote = owner ? owner.hasRemote : false;   // waits for manual detonation
    this.pierce = owner ? owner.pierce : false;      // flame goes through bricks
    this.slideDir = null;
    this.slideOff = 0;
    this.slideSpeed = 0;   // 0 = kick speed
    this.age = 0;
    this.chainId = 0;
    this.teleCell = -1;
  }
}

function teleportBomb(game, b) {
  const board = game.board;
  const i = board.idx(b.x, b.y);
  if (board.features[i] !== FEAT_TELE || b.teleCell === i) return;
  const j = board.telePair[i];
  if (j < 0) return;
  const tx = j % board.w, ty = Math.floor(j / board.w);
  if (game.bombAt(tx, ty)) return;
  b.x = tx;
  b.y = ty;
  b.teleCell = j;
  game.emit({ type: 'teleport', x: tx, y: ty, fromX: i % board.w, fromY: Math.floor(i / board.w) });
}

export function updateBomb(game, b, dt) {
  b.age += dt;
  const owner = game.players[b.ownerId];
  if (b.remote && owner && !owner.alive) b.remote = false;
  if (!b.remote || b.timer <= CHAIN_DELAY) b.timer -= dt;

  const board = game.board;
  // conveyor belts carry resting bombs
  if (!b.slideDir) {
    const belt = BELT_DIR[board.features[board.idx(b.x, b.y)]];
    if (belt) {
      const d = DIRS[belt];
      if (game.cellFreeForBomb(b.x + d.x, b.y + d.y)) {
        b.slideDir = belt;
        b.slideOff = 0;
        b.slideSpeed = BELT_SPEED;
      }
    }
  }
  if (!b.slideDir) return;
  let move = (b.slideSpeed || KICK_SPEED) * dt;
  while (move > 0 && b.slideDir) {
    const d = DIRS[b.slideDir];
    if (b.slideOff === 0 && !game.cellFreeForBomb(b.x + d.x, b.y + d.y)) {
      b.slideDir = null;
      break;
    }
    const step = Math.min(move, 1 - b.slideOff);
    b.slideOff += step;
    move -= step;
    if (b.slideOff >= 1 - 1e-6) {
      b.x += d.x;
      b.y += d.y;
      b.slideOff = 0;
      if (board.features[board.idx(b.x, b.y)] !== FEAT_TELE) b.teleCell = -1;
      teleportBomb(game, b);
      // belt-carried bombs follow the belt and stop when they leave it
      if (b.slideSpeed) {
        const belt = BELT_DIR[board.features[board.idx(b.x, b.y)]];
        if (belt) b.slideDir = belt;
        else { b.slideDir = null; b.slideSpeed = 0; }
      }
    }
  }
}

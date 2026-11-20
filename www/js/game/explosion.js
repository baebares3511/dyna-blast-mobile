import {
  T_WALL, T_BRICK, FLAME_TIME, BRICK_BURN_TIME, CHAIN_DELAY, DIRS,
  F_CENTER, F_H, F_V, F_END_L, F_END_R, F_END_U, F_END_D,
} from '../config.js';

const ARMS = [
  { d: DIRS.left, mid: F_H, end: F_END_L },
  { d: DIRS.right, mid: F_H, end: F_END_R },
  { d: DIRS.up, mid: F_V, end: F_END_U },
  { d: DIRS.down, mid: F_V, end: F_END_D },
];

const isHorizontal = (k) => k === F_H || k === F_END_L || k === F_END_R;
const isVertical = (k) => k === F_V || k === F_END_U || k === F_END_D;

function addFlame(board, x, y, kind, owner, chain) {
  const i = board.idx(x, y);
  const prev = board.flames[i] > 0 ? board.flameKind[i] : 0;
  let k = kind;
  if (prev && prev !== kind) {
    if (isHorizontal(prev) && isHorizontal(kind)) k = F_H;
    else if (isVertical(prev) && isVertical(kind)) k = F_V;
    else k = F_CENTER;
  }
  board.flames[i] = FLAME_TIME;
  board.flameKind[i] = k;
  board.flameOwner[i] = owner;
  board.flameChain[i] = chain;
}

function triggerBomb(game, other, chain) {
  if (other.timer > CHAIN_DELAY) other.timer = CHAIN_DELAY;
  other.remote = false;
  other.slideDir = null;
  other.slideOff = 0;
  if (!other.chainId) other.chainId = chain;
}

// Detonate a bomb: spread flame in four directions, stopping at walls,
// destroying the first brick / item, and triggering other bombs (chains).
export function detonate(game, bomb) {
  const { board } = game;
  const idx = game.bombs.indexOf(bomb);
  if (idx < 0) return;
  game.bombs.splice(idx, 1);
  const owner = game.players[bomb.ownerId];
  if (owner) owner.activeBombs = Math.max(0, owner.activeBombs - 1);

  const chain = bomb.chainId || game.newChain(bomb.ownerId);
  const size = game.countChain(chain);
  // flames of a chain reaction are credited to whoever started the chain
  const credit = game.chainOwner(chain, bomb.ownerId);

  addFlame(board, bomb.x, bomb.y, F_CENTER, credit, chain);
  let cells = 1;
  for (const arm of ARMS) {
    for (let r = 1; r <= bomb.range; r++) {
      const x = bomb.x + arm.d.x * r;
      const y = bomb.y + arm.d.y * r;
      const t = board.tile(x, y);
      if (t === T_WALL) break;
      const i = board.idx(x, y);
      if (t === T_BRICK) {
        if (board.burning[i] <= 0) {
          board.burning[i] = BRICK_BURN_TIME;
          game.emit({ type: 'brick', x, y });
        }
        if (bomb.pierce) continue;   // piercing flame burns through every brick in range
        break;
      }
      const other = game.bombAt(x, y);
      if (other) {
        triggerBomb(game, other, chain);
        addFlame(board, x, y, r === bomb.range ? arm.end : arm.mid, credit, chain);
        cells++;
        break;
      }
      if (board.items[i]) {
        game.emit({ type: 'itemBurn', x, y, item: board.items[i] });
        board.items[i] = null;
        addFlame(board, x, y, arm.end, credit, chain);
        cells++;
        break;
      }
      addFlame(board, x, y, r === bomb.range ? arm.end : arm.mid, credit, chain);
      cells++;
    }
  }
  game.emit({ type: 'explode', x: bomb.x, y: bomb.y, chain: size, chainId: chain, cells, owner: bomb.ownerId });
}

export { triggerBomb };

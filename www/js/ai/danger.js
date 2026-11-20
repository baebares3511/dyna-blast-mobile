import {
  T_WALL, T_BRICK, FLAME_TIME, CHAIN_DELAY, DIRS, HURRY_STEP, METEOR_FUSE, FEAT_TELE,
  BELT_DIR, BELT_SPEED, KICK_SPEED,
} from '../config.js';

const ARMS = [DIRS.left, DIRS.right, DIRS.up, DIRS.down];
const ARM_NAMES = ['left', 'right', 'up', 'down'];
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };
const REMOTE_SELF = 1.2;   // own remote bombs: we decide when, but stay careful
const REMOTE_OTHER = 0.45; // enemy remote bombs can go off at any moment

// Cells a bomb at (x,y) would cover, with flame stopping like the real
// explosion. `bombs` is the list of (real + hypothetical) bombs for chaining.
export function blastOf(board, x, y, range, bombs, pierce = false) {
  const cells = [board.idx(x, y)];
  const bricks = [];
  const hitBombs = [];
  const items = [];
  for (const d of ARMS) {
    for (let r = 1; r <= range; r++) {
      const cx = x + d.x * r, cy = y + d.y * r;
      const t = board.tile(cx, cy);
      if (t === T_WALL) break;
      const i = board.idx(cx, cy);
      if (t === T_BRICK) { bricks.push(i); if (pierce) continue; break; }
      const bi = bombs.findIndex((b) => b.x === cx && b.y === cy);
      cells.push(i);
      if (bi >= 0) { hitBombs.push(bi); break; }
      if (board.items[i]) { items.push(i); break; }
    }
  }
  return { cells, bricks, hitBombs, items };
}

// Predicts the path of a kicked or belt-carried bomb, like updateBomb() does:
// kicked bombs slide until blocked (teleports pass them on), then a belt may
// take over. Returns the cell the bomb occupies after `tMax` seconds.
//   speed: 0 = kick speed, otherwise belt speed (belt-carried)
export function slideTrack(game, x, y, dir, off = 0, speed = 0, tMax = 3, selfId = -1) {
  const board = game.board;
  let cx = x, cy = y, d = dir || null, offset = off || 0, belt = !!speed, t = 0;
  const track = [{ x, y, t: 0 }];
  const free = (nx, ny) => {
    if (board.isSolid(nx, ny)) return false;
    const other = game.bombAt(nx, ny);
    if (other && other.id !== selfId) return false;
    return game.cellFreeForBomb(nx, ny) || !!other;
  };
  for (let guard = 0; guard < 40; guard++) {
    if (!d) {
      const bd = BELT_DIR[board.features[board.idx(cx, cy)]];
      if (!bd) break;
      d = bd;
      belt = true;
      offset = 0;
    }
    const nx = cx + DIRS[d].x, ny = cy + DIRS[d].y;
    if (offset === 0 && !free(nx, ny)) {
      if (!belt) { d = null; continue; }
      break;
    }
    const dt = (1 - offset) / (belt ? BELT_SPEED : KICK_SPEED);
    offset = 0;
    if (t + dt > tMax) break;
    t += dt;
    cx = nx;
    cy = ny;
    const i = board.idx(cx, cy);
    if (board.features[i] === FEAT_TELE && board.telePair[i] >= 0) {
      const j = board.telePair[i];
      if (!game.bombAt(j % board.w, Math.floor(j / board.w))) { cx = j % board.w; cy = Math.floor(j / board.w); }
    }
    track.push({ x: cx, y: cy, t });
    if (belt) {
      const bd = BELT_DIR[board.features[board.idx(cx, cy)]];
      if (bd) d = bd;
      else break;
    }
  }
  return { x: cx, y: cy, track };
}

// Danger map from the perspective of player `meId`:
//   start[i]  - seconds until a flame reaches the cell (Infinity = safe)
//   end[i]    - seconds until that cell is safe again
//   noStay[i] - cell where you cannot rest (belts carry you, teleports move you)
// Chain reactions are resolved so a bomb's effective time can be earlier
// than its own fuse. `extra` adds hypothetical bombs (for planning).
//   opts.predict - follow sliding / belt-carried bombs to where they will be
//   opts.kick    - {id, dir}: assume that bomb gets kicked in `dir`
export function computeDanger(game, meId, extra = [], remoteOther = REMOTE_OTHER, opts = {}) {
  const { board } = game;
  const n = board.w * board.h;
  const start = new Float32Array(n).fill(Infinity);
  const end = new Float32Array(n);
  const noStay = new Uint8Array(n);
  const predict = opts.predict !== false;

  for (let i = 0; i < n; i++) {
    if (board.flames[i] > 0) { start[i] = 0; end[i] = board.flames[i]; }
    const f = board.features[i];
    if (f === FEAT_TELE || BELT_DIR[f]) noStay[i] = 1;
  }

  const list = game.bombs.map((b) => {
    let t = Math.max(0, b.timer);
    const owner = game.players[b.ownerId];
    if (b.remote && owner && owner.alive) t = b.ownerId === meId ? REMOTE_SELF : remoteOther;
    let x = b.x, y = b.y;
    if (opts.kick && opts.kick.id === b.id) {
      const pr = slideTrack(game, b.x, b.y, opts.kick.dir, 0, 0, Math.min(t, 6), b.id);
      x = pr.x; y = pr.y;
    } else if (predict && (b.slideDir || BELT_DIR[board.features[board.idx(b.x, b.y)]])) {
      const pr = slideTrack(game, b.x, b.y, b.slideDir, b.slideOff, b.slideSpeed, Math.min(t, 6), b.id);
      x = pr.x; y = pr.y;
    }
    return { x, y, range: b.range, t, owner: b.ownerId, pierce: b.pierce };
  })
    // bombs about to fall from the sky (round event / boss)
    .concat((game.meteors || []).map((m) => ({ x: m.x, y: m.y, range: 2, t: m.t + METEOR_FUSE, owner: -1 })))
    .concat(extra.map((e) => {
      const h = { ...e };
      // a bomb dropped on a conveyor rides it
      if (predict && BELT_DIR[board.features[board.idx(e.x, e.y)]]) {
        const pr = slideTrack(game, e.x, e.y, null, 0, BELT_SPEED, Math.min(e.t, 6));
        h.x = pr.x; h.y = pr.y;
      }
      return h;
    }));

  const blasts = list.map((b) => blastOf(board, b.x, b.y, b.range, list, b.pierce));
  for (let iter = 0, changed = true; changed && iter < 24; iter++) {
    changed = false;
    for (let a = 0; a < list.length; a++) {
      for (const j of blasts[a].hitBombs) {
        const nt = list[a].t + CHAIN_DELAY;
        if (nt < list[j].t) { list[j].t = nt; changed = true; }
      }
    }
  }
  for (let a = 0; a < list.length; a++) {
    const t = list[a].t;
    for (const i of blasts[a].cells) {
      if (t < start[i]) start[i] = t;
      end[i] = Math.max(end[i], t + FLAME_TIME);
    }
  }

  const h = game.hurry;
  if (h.active) {
    let t = Math.max(0, h.timer);
    for (let k = h.index; k < Math.min(h.order.length, h.index + 14); k++) {
      const [x, y] = h.order[k];
      const i = board.idx(x, y);
      if (t < start[i]) start[i] = t;
      end[i] = 1e9;
      t += HURRY_STEP;
    }
  }
  return { start, end, noStay, list, blasts };
}

const beltPush = (belt, dir) => (belt === dir ? BELT_SPEED : belt === OPPOSITE[dir] ? -BELT_SPEED : 0);

// BFS over walkable cells, respecting the timing of explosions:
// a cell may be crossed only if no flame is there while we pass.
// Conveyor belts speed up / slow down steps, teleports jump to their pair.
//   opts.from      - {x,y} start cell (default: player's cell)
//   opts.t0        - time offset when we start walking from `from`
//   opts.margin    - safety margin in seconds
//   opts.ignoreTiming - plain BFS (used for desperate escapes)
//   opts.maxDepth
//   opts.teleports - false: treat teleports as walls
//   opts.unblock / opts.block - Sets of cell indices overriding bomb blocking
// Result: dist (steps), time (arrival s), prev, via (teleport entered to reach a cell)
export function bfs(game, p, danger, opts = {}) {
  const { board } = game;
  const n = board.w * board.h;
  const sx = opts.from ? opts.from.x : p.cellX;
  const sy = opts.from ? opts.from.y : p.cellY;
  const speed = p.speed;
  const step = 1 / speed;
  const t0 = opts.t0 || 0;
  const margin = opts.margin ?? 0.15;
  const maxDepth = opts.maxDepth ?? 60;
  const useTele = opts.teleports !== false;
  const dist = new Int16Array(n).fill(-1);
  const prev = new Int16Array(n).fill(-1);
  const via = new Int16Array(n).fill(-1);
  const time = new Float32Array(n).fill(Infinity);
  const order = [];
  const s = board.idx(sx, sy);
  dist[s] = 0;
  time[s] = t0;
  order.push(s);
  const blocked = (i, x, y) => {
    if (opts.unblock && opts.unblock.has(i)) return false;
    if (opts.block && opts.block.has(i)) return true;
    return !!game.bombAt(x, y);
  };
  const unsafe = (i, tIn, tOut) => !opts.ignoreTiming && danger.start[i] - margin < tOut && tIn < danger.end[i] + margin;
  // standing on a portal we have not used yet: it is about to carry us away
  if (!opts.from && useTele && board.features[s] === FEAT_TELE && p.teleCell !== s && board.telePair[s] >= 0) {
    const j = board.telePair[s];
    const jx = j % board.w, jy = (j - jx) / board.w;
    if (!game.bombAt(jx, jy) && !unsafe(j, t0, t0 + step)) {
      dist[j] = 1;
      prev[j] = s;
      via[j] = s;
      time[j] = t0 + 0.3 * step;
      order.push(j);
    }
  }
  for (let qi = 0; qi < order.length; qi++) {
    const c = order[qi];
    const d = dist[c];
    if (d >= maxDepth) continue;
    const cx = c % board.w, cy = (c - cx) / board.w;
    const tc = time[c];
    for (let k = 0; k < 4; k++) {
      const dd = ARMS[k];
      const nx = cx + dd.x, ny = cy + dd.y;
      if (board.isSolid(nx, ny)) continue;
      const ni = board.idx(nx, ny);
      if (dist[ni] >= 0) continue;
      if (blocked(ni, nx, ny)) continue;
      if (opts.avoidFlames && board.flames[ni] > 0) continue;
      if (opts.avoidSkull && board.items[ni] === 'skull') continue;
      const name = ARM_NAMES[k];
      const v = Math.max(1, speed + (beltPush(BELT_DIR[board.features[c]], name) + beltPush(BELT_DIR[board.features[ni]], name)) / 2);
      const st = 1 / v;
      if (unsafe(ni, tc + 0.5 * st, tc + 1.6 * st)) continue;
      let target = ni;
      const arrive = tc + st;
      if (board.features[ni] === FEAT_TELE) {
        if (!useTele) continue;
        const j = board.telePair[ni];
        if (j < 0) continue;
        const jx = j % board.w, jy = (j - jx) / board.w;
        if (dist[j] >= 0 || game.bombAt(jx, jy)) continue;
        if (unsafe(j, arrive - 0.1, arrive + 1.2 * step)) continue;
        target = j;
        via[j] = ni;
      }
      dist[target] = d + 1;
      prev[target] = c;
      time[target] = arrive;
      order.push(target);
    }
  }
  return { dist, prev, via, time, order, step, t0, w: board.w };
}

// Path of cells to walk; a teleport entry is marked with `tele: true` and is
// followed by its exit cell.
export function pathTo(res, target) {
  const path = [];
  let c = target;
  while (c >= 0 && res.dist[c] > 0) {
    path.push({ x: c % res.w, y: Math.floor(c / res.w) });
    if (res.via[c] >= 0) path.push({ x: res.via[c] % res.w, y: Math.floor(res.via[c] / res.w), tele: true });
    c = res.prev[c];
  }
  return path.reverse();
}

// A cell where we can stay indefinitely after arriving there.
export function isSafeToStay(danger, i, tArrive, margin) {
  if (danger.noStay[i]) return false;
  return danger.start[i] === Infinity || danger.end[i] + margin < tArrive;
}

export function findEscape(game, p, danger, opts = {}) {
  const res = bfs(game, p, danger, opts);
  const margin = opts.margin ?? 0.15;
  for (const c of res.order) {
    if (isSafeToStay(danger, c, res.time[c], margin)) return { res, target: c, path: pathTo(res, c) };
  }
  return null;
}

// Number of cells an enemy can walk to (bombs and `blockIdx` block), capped.
export function regionSize(game, e, blockIdx = -1, limit = 12) {
  const b = game.board;
  const s = b.idx(e.cellX, e.cellY);
  const seen = new Set([s]);
  const q = [s];
  for (let qi = 0; qi < q.length && seen.size < limit; qi++) {
    const c = q[qi];
    const x = c % b.w, y = (c - x) / b.w;
    for (const d of ARMS) {
      const nx = x + d.x, ny = y + d.y;
      const ni = b.idx(nx, ny);
      if (seen.has(ni) || ni === blockIdx || b.isSolid(nx, ny) || game.bombAt(nx, ny)) continue;
      seen.add(ni);
      q.push(ni);
    }
  }
  return seen.size;
}

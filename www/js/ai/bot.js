import { FUSE_TIME, DIRS, DIR_NAMES } from '../config.js';
import {
  computeDanger, bfs, pathTo, findEscape, isSafeToStay, blastOf, slideTrack, regionSize,
} from './danger.js';

// Difficulty profiles: reflexes AND skills.
//   think / react  - seconds between re-plans / delay before reacting to a new bomb
//   margin         - safety margin (s) when timing paths through blast zones
//   noise          - randomness of goal choice
//   mistake        - chance to skip the escape check on a juicy bomb
//   aggression     - weight of threatening enemies
//   items          - weight of power-ups
//   kick           - 0 never kicks, 1 kicks adjacent bombs (attack & escape),
//                    2 also walks to good kicking spots
//   predict        - follows kicked / belt-carried bombs in its danger map
//   teleports      - plans paths through portals (else treats them as walls)
//   trap           - weight of tactics that lock enemies in dead ends
//   skulls         - stays away from skull items
//   remoteDelay    - how long it keeps remote bombs before using them on bricks
const PROFILES = {
  easy: {
    think: 0.55, react: 0.45, margin: 0.05, noise: 3, mistake: 0.2, aggression: 0.5, items: 0.6, randomBomb: 0.08,
    kick: 0, predict: false, teleports: false, trap: 0, skulls: false, remoteDelay: 2.5,
  },
  normal: {
    think: 0.25, react: 0.15, margin: 0.15, noise: 1, mistake: 0, aggression: 1, items: 1, randomBomb: 0,
    kick: 1, predict: true, teleports: true, trap: 0.5, skulls: true, remoteDelay: 0.6,
  },
  hard: {
    think: 0.1, react: 0.03, margin: 0.2, noise: 0.25, mistake: 0, aggression: 1.6, items: 1.2, randomBomb: 0,
    kick: 2, predict: true, teleports: true, trap: 1, skulls: true, remoteDelay: 0.3,
  },
};
const GOAL_MARGIN = 99; // goals are only pursued through cells that are not about to burn
const ITEM_VALUE = { bomb: 1, fire: 1, speed: 1, kick: 0.9, remote: 0.9, shield: 1.1, pierce: 0.8, fullfire: 1.2 };
const SMART_ITEM_VALUE = { ...ITEM_VALUE, kick: 1.3, remote: 1.3, speed: 1.2 };

export class BotController {
  constructor(game, player, difficulty) {
    this.game = game;
    this.p = player;
    this.cfg = PROFILES[difficulty] || PROFILES.normal;
    this.itemValue = this.cfg.kick >= 2 ? SMART_ITEM_VALUE : ITEM_VALUE;
    this.path = null;
    this.goal = null;
    this.kick = null;
    this.thinkTimer = 0.2 + Math.random() * 0.3;
    this.lastSig = '';
    this.stuckTime = 0;
    this.lastPos = { x: player.x, y: player.y };
    this.danger = null;
    this.dangerAge = 0;
    this.seed = Math.random() * 1000;
  }

  // bfs / findEscape options for this bot
  o(extra) { return { teleports: this.cfg.teleports, ...extra }; }

  dangerMap(extra = [], remoteOther, opts = {}) {
    return computeDanger(this.game, this.p.id, extra, remoteOther, { predict: this.cfg.predict, ...opts });
  }

  update(dt) {
    const g = this.game, p = this.p;
    if (!p.alive || !g.isActive) { p.input.dir = null; this.kick = null; return; }
    let sig = g.bombs.length + ':';
    for (const b of g.bombs) sig += b.x * 31 + b.y * 7 + (b.slideDir ? 1 : 0) + (b.remote ? 2 : 0) + ',';
    if (sig !== this.lastSig) {
      this.lastSig = sig;
      this.thinkTimer = Math.min(this.thinkTimer, this.cfg.react);
    }
    this.thinkTimer -= dt;
    this.dangerAge += dt;
    if (this.thinkTimer <= 0 && !this.kick) {
      this.hold = 0;
      this.think();
      this.thinkTimer = Math.max(this.hold, this.cfg.think * (0.75 + Math.random() * 0.5));
    }
    this.follow(dt);
  }

  noise(c) {
    const v = Math.sin(c * 12.9898 + this.seed) * 43758.5453;
    return (v - Math.floor(v) - 0.5) * this.cfg.noise;
  }

  setPath(path, goal) {
    this.path = path ? path.slice() : null;
    this.goal = goal;
  }

  steerTo(x, y) {
    const p = this.p;
    const dx = x - p.x, dy = y - p.y;
    p.input.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }

  follow(dt) {
    const p = this.p, g = this.game, b = g.board;
    const moved = Math.abs(p.x - this.lastPos.x) + Math.abs(p.y - this.lastPos.y);
    if (p.input.dir && moved < 1e-4) {
      this.stuckTime += dt;
      if (this.stuckTime > 0.35) { this.path = null; this.kick = null; this.stuckTime = 0; this.thinkTimer = 0; }
    } else this.stuckTime = 0;
    this.lastPos.x = p.x; this.lastPos.y = p.y;

    if (this.kick) { this.doKick(dt); return; }
    if (!this.path) { p.input.dir = null; return; }
    const cx = p.cellX, cy = p.cellY;
    // drop the steps already reached (a teleport jump skips its entry cell)
    const k = this.path.findIndex((s, m) => m < 4 && s.x === cx && s.y === cy);
    if (k >= 0) {
      if (this.path[k].tele) {
        // walk onto the portal's centre and let it carry us
        this.path.splice(0, k);
        if (Math.abs(cx + 0.5 - p.x) + Math.abs(cy + 0.5 - p.y) < 0.02) {
          this.path = null; this.thinkTimer = 0; p.input.dir = null;
          return;
        }
        this.steerTo(cx + 0.5, cy + 0.5);
        return;
      }
      this.path.splice(0, k === this.path.length - 1 ? k : k + 1);
    }
    const next = this.path[0];
    if (!next) {
      p.input.dir = null;
      this.path = null;
      this.onArrive();
      return;
    }
    if (next.x === cx && next.y === cy) {
      const dx = cx + 0.5 - p.x, dy = cy + 0.5 - p.y;
      if (Math.abs(dx) + Math.abs(dy) <= p.speed * dt * 1.05) {
        p.x = cx + 0.5; p.y = cy + 0.5;
        p.input.dir = null;
        this.path = null;
        this.onArrive();
        return;
      }
      this.steerTo(cx + 0.5, cy + 0.5);
      return;
    }
    const ddx = next.x - cx, ddy = next.y - cy;
    if (Math.abs(ddx) + Math.abs(ddy) !== 1 || g.bombAt(next.x, next.y) || b.isSolid(next.x, next.y)) {
      this.path = null;
      this.thinkTimer = 0;
      p.input.dir = null;
      return;
    }
    if (!this.goal || !['flee', 'kick', 'kickSpot'].includes(this.goal.type)) {
      const i = b.idx(next.x, next.y);
      const d = this.danger;
      const soon = d && d.start[i] - this.dangerAge < 0.7 + this.cfg.margin && d.end[i] - this.dangerAge > -0.1;
      if (b.flames[i] > 0 || soon) { p.input.dir = null; return; }
    }
    p.input.dir = ddx > 0 ? 'right' : ddx < 0 ? 'left' : ddy > 0 ? 'down' : 'up';
  }

  // push into a bomb until it starts sliding
  doKick(dt) {
    const k = this.kick, p = this.p, g = this.game;
    k.t -= dt;
    const bomb = g.bombs.find((b) => b.id === k.bombId);
    if (!bomb || bomb.slideDir || k.t <= 0) {
      this.kick = null;
      p.input.dir = null;
      this.thinkTimer = Math.min(this.thinkTimer, 0.02);
      return;
    }
    // kicking needs the bot exactly on the lane of the bomb
    const horiz = k.dir === 'left' || k.dir === 'right';
    const off = horiz ? p.y - (p.cellY + 0.5) : p.x - (p.cellX + 0.5);
    if (Math.abs(off) > 1e-4) {
      if (Math.abs(off) <= p.speed * dt * 1.05) {
        if (horiz) p.y = p.cellY + 0.5; else p.x = p.cellX + 0.5;
      } else {
        p.input.dir = horiz ? (off > 0 ? 'up' : 'down') : (off > 0 ? 'left' : 'right');
        return;
      }
    }
    p.input.dir = k.dir;
  }

  startKick(k) {
    this.kick = { dir: k.dir, bombId: k.bomb.id, t: 0.5 };
    this.path = null;
    this.goal = { type: 'kick' };
  }

  onArrive() {
    const g = this.game, p = this.p;
    if (this.goal && this.goal.type === 'bomb' && p.activeBombs < p.maxBombs) {
      const danger = this.dangerMap();
      const ev = this.evalBomb(p.cellX, p.cellY, danger, 0);
      if (ev && ev.score > 0) {
        p.input.bomb = true;
        this.setPath(ev.escape, { type: 'flee' });
        return;
      }
    }
    if (this.goal && this.goal.type === 'kickSpot' && p.canKick) {
      const d = DIRS[this.goal.dir];
      const bomb = g.bombAt(p.cellX + d.x, p.cellY + d.y);
      if (bomb && bomb.id === this.goal.bombId && !bomb.slideDir) {
        const ev = this.kickEval(bomb, this.goal.dir, this.dangerMap(), { x: p.cellX, y: p.cellY }, 0);
        if (ev && ev.score > 0) { this.startKick({ bomb, dir: this.goal.dir }); return; }
      }
    }
    this.goal = null;
    this.thinkTimer = Math.min(this.thinkTimer, 0.04);
  }

  targetedBricks(danger) {
    const s = new Set();
    for (const bl of danger.blasts) for (const b of bl.bricks) s.add(b);
    return s;
  }

  enemies() {
    return this.game.players.filter((e) => e.alive && e.id !== this.p.id);
  }

  quickScore(c, targeted, enemies) {
    const g = this.game, board = g.board, p = this.p;
    const x = c % board.w, y = (c - x) / board.w;
    let s = 0;
    for (const e of enemies) if (e.cellX === x && e.cellY === y) s += 3;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let r = 1; r <= p.range; r++) {
        const nx = x + dx * r, ny = y + dy * r;
        if (!board.inside(nx, ny)) break;
        const t = board.tile(nx, ny);
        const i = board.idx(nx, ny);
        if (t === 1) break;
        if (t === 2) { if (!targeted.has(i) && board.burning[i] <= 0) s += 1; break; }
        for (const e of enemies) if (e.cellX === nx && e.cellY === ny) s += 3;
        if (board.items[i]) { s -= 1; break; }
      }
    }
    return s;
  }

  // Cells where a bomb would shut a nearby enemy into a small pocket.
  trapCells(res, enemies) {
    const g = this.game, board = g.board;
    const out = [];
    for (const e of enemies) {
      if (regionSize(g, e, -1, 10) >= 10) continue; // enemy has plenty of room
      for (const c of res.order) {
        if (res.dist[c] <= 0 || res.dist[c] > 12) continue;
        const x = c % board.w, y = (c - x) / board.w;
        if (Math.abs(x - e.cellX) + Math.abs(y - e.cellY) > 4) continue;
        if (regionSize(g, e, c, 6) <= 4) out.push(c);
      }
    }
    return out;
  }

  // Score a bomb at (x,y) placed `t0` seconds from now. Returns null if we
  // would not survive it (no escape route), else {score, escape}.
  evalBomb(x, y, danger, t0, allowMistake = false) {
    const g = this.game, p = this.p, cfg = this.cfg, board = g.board;
    const weak = p.curse && p.curse.type === 'weak';
    const fuse = p.curse && p.curse.type === 'shortfuse' ? 1.1 : FUSE_TIME;
    const hyp = { x, y, range: weak ? 1 : p.range, t: t0 + (p.hasRemote ? 1.0 : fuse), owner: p.id, pierce: p.pierce };
    const d2 = this.dangerMap([hyp]);
    const bl = d2.blasts[d2.blasts.length - 1];
    const targeted = this.targetedBricks(danger);
    let score = 0;
    for (const b of bl.bricks) if (!targeted.has(b) && board.burning[b] <= 0) score += 1;
    score -= bl.items.length * 2;
    score += bl.hitBombs.length * 0.3;
    const hi = board.idx(x, y);
    for (const e of this.enemies()) {
      const ei = board.idx(e.cellX, e.cellY);
      if (d2.start[ei] < Infinity && danger.start[ei] === Infinity) {
        score += 2.5 * cfg.aggression;
        if (cfg.trap) {
          const esc = findEscape(g, e, d2, { margin: 0 });
          if (!esc) score += 12 * cfg.trap;
          else if (esc.path.length <= 2) score += 2 * cfg.trap;
        }
      } else if (cfg.trap) {
        // cutting off: does this bomb lock the enemy in a dead end?
        const before = regionSize(g, e, -1, 10);
        const after = regionSize(g, e, hi, 10);
        if (after < before && after <= 4) score += 4 * cfg.trap;
        else {
          const escB = findEscape(g, e, danger, { margin: 0 });
          const escA = findEscape(g, e, d2, { margin: 0 });
          if (escB && !escA) score += 6 * cfg.trap;
        }
      }
    }
    const esc = findEscape(g, p, d2, this.o({ from: { x, y }, t0, margin: cfg.margin }));
    if (!esc) {
      // easy bots sometimes go for a juicy bomb without checking the way out
      if (allowMistake && score >= 2 && Math.random() < cfg.mistake) return { score, escape: [] };
      return null;
    }
    return { score, escape: esc.path };
  }

  // Kick `bomb` in `dir` while standing at `from` (behind it) at time `tArrive`.
  // Returns {score, escape} if we survive it, else null.
  kickEval(bomb, dir, danger, from, tArrive) {
    const g = this.game, p = this.p, board = g.board;
    if (bomb.slideDir) return null;
    const d = DIRS[dir];
    if (!g.cellFreeForBomb(bomb.x + d.x, bomb.y + d.y)) return null;
    const d2 = this.dangerMap([], undefined, { kick: { id: bomb.id, dir } });
    let score = 0;
    for (const e of this.enemies()) {
      const ei = board.idx(e.cellX, e.cellY);
      if (d2.start[ei] < Infinity && danger.start[ei] === Infinity) {
        score += 3 * this.cfg.aggression;
        if (!findEscape(g, e, d2, { margin: 0 })) score += 8;
      }
    }
    const esc = findEscape(g, p, d2, this.o({
      from, t0: tArrive + 0.1, margin: this.cfg.margin, unblock: new Set([board.idx(bomb.x, bomb.y)]),
    }));
    if (!esc) return null;
    return { score, escape: esc.path };
  }

  // best kick of a bomb right next to us
  bestAdjacentKick(danger, escaping) {
    const g = this.game, p = this.p;
    let best = null;
    for (const dir of DIR_NAMES) {
      const d = DIRS[dir];
      const bomb = g.bombAt(p.cellX + d.x, p.cellY + d.y);
      if (!bomb || bomb.slideDir) continue;
      const ev = this.kickEval(bomb, dir, danger, { x: p.cellX, y: p.cellY }, 0);
      if (!ev) continue;
      const score = ev.score + (escaping ? 1 : 0);
      if (!best || score > best.score) best = { bomb, dir, score };
    }
    return best;
  }

  considerRemote() {
    const g = this.game, p = this.p, board = g.board;
    const own = g.bombs.filter((b) => b.ownerId === p.id && b.remote);
    if (!own.length) return false;
    const cells = new Set();
    let bricks = 0;
    const queue = own.slice();
    const seen = new Set(queue);
    while (queue.length) {
      const b = queue.pop();
      const bl = blastOf(board, b.x, b.y, b.range, g.bombs, b.pierce);
      bl.cells.forEach((c) => cells.add(c));
      bricks += bl.bricks.length;
      for (const j of bl.hitBombs) if (!seen.has(g.bombs[j])) { seen.add(g.bombs[j]); queue.push(g.bombs[j]); }
    }
    if (cells.has(board.idx(p.cellX, p.cellY))) return false;
    if (own.some((b) => b.slideDir)) return false; // let a kicked bomb arrive first
    const enemyHit = this.enemies().some((e) => cells.has(board.idx(e.cellX, e.cellY)));
    const oldest = Math.max(...own.map((b) => b.age));
    if (enemyHit || (oldest > this.cfg.remoteDelay && (bricks > 0 || oldest > 3))) {
      p.input.detonate = true;
      return true;
    }
    return false;
  }

  // Is the path we are following still a valid escape under `danger`?
  pathStillSafe(danger, margin) {
    const g = this.game, p = this.p, board = g.board;
    const path = this.path;
    if (!path || !path.length) return false;
    const step = 1 / p.speed;
    let t = 0;
    let last = null;
    for (let k = 0; k < path.length; k++) {
      const s = path[k];
      if (s.tele) continue;
      const i = board.idx(s.x, s.y);
      if (board.isSolid(s.x, s.y) || (g.bombAt(s.x, s.y) && !(s.x === p.cellX && s.y === p.cellY))) return false;
      const tIn = t + 0.5 * step, tOut = t + 1.6 * step;
      if (danger.start[i] - margin < tOut && tIn < danger.end[i] + margin) return false;
      t += step;
      last = i;
    }
    return last !== null && isSafeToStay(danger, last, t, margin);
  }

  // No clean escape: go where the flames arrive last, still respecting the
  // timing of fused bombs (enemy remote bombs are assumed to stay quiet).
  desperate() {
    const g = this.game, p = this.p;
    const calm = this.dangerMap([], 3);
    const res = bfs(g, p, calm, this.o({ margin: 0 }));
    let best = -1, bestT = -Infinity;
    for (const c of res.order) {
      // standing still on a belt is not an option
      if (calm.noStay[c] && res.dist[c] === 0) continue;
      const t = (calm.start[c] === Infinity ? 1e9 : calm.start[c]) - res.dist[c] * 0.01 - (calm.noStay[c] ? 0.5 : 0);
      if (t > bestT) { bestT = t; best = c; }
    }
    return best >= 0 ? { path: pathTo(res, best) } : null;
  }

  think() {
    const g = this.game, p = this.p, cfg = this.cfg, board = g.board;
    const danger = this.dangerMap();
    this.danger = danger;
    this.dangerAge = 0;
    const me = board.idx(p.cellX, p.cellY);
    const margin = cfg.margin;
    const canKick = cfg.kick >= 1 && p.canKick;

    // 1. get out of harm's way
    if (danger.start[me] !== Infinity) {
      // keep running the current escape while it still works (no dithering)
      if (this.goal && this.goal.type === 'flee' && this.pathStillSafe(danger, margin)) {
        this.reason = 'flee';
        return;
      }
      let esc = findEscape(g, p, danger, this.o({ margin }));
      if (!esc && margin > 0) esc = findEscape(g, p, danger, this.o({ margin: 0 }));
      if (canKick) {
        // kick the threatening bomb away - or at an enemy
        const k = this.bestAdjacentKick(danger, !esc);
        if (k && (!esc || k.score >= 3)) { this.startKick(k); return; }
      }
      if (!esc) {
        // maybe the way out is blocked by flames that will die down soon: wait
        // (not possible on a conveyor belt - it would carry us away)
        for (const w of danger.noStay[me] ? [] : [0.2, 0.4, 0.7, 1.0]) {
          if (danger.start[me] - margin <= w + 0.35) break;
          if (findEscape(g, p, danger, this.o({ margin, t0: w }))) {
            this.setPath(null, { type: 'flee' });
            this.hold = 0.05;
            return;
          }
        }
        // assume enemy remote bombs stay quiet for a moment and dodge the fused ones
        const calm = this.dangerMap([], 3);
        esc = findEscape(g, p, calm, this.o({ margin: 0 })) || this.desperate();
      }
      if (esc) this.setPath(esc.path, { type: 'flee' });
      else this.path = null;
      this.reason = esc ? 'flee' : 'noEscape';
      return;
    }
    if (this.goal && (this.goal.type === 'flee' || this.goal.type === 'kick')) this.goal = null;

    // 2. remote detonator
    if (p.hasRemote && this.considerRemote()) {
      // stay put while our flames burn
      this.setPath(null, null);
      this.hold = 0.7;
      this.reason = 'remote';
      return;
    }

    const enemies = this.enemies();
    const canBomb = p.activeBombs < p.maxBombs && !(p.curse && p.curse.type === 'constipation');

    // 3. a bomb right next to us that we can send at someone
    if (canKick) {
      const k = this.bestAdjacentKick(danger, false);
      if (k && k.score >= 3) { this.startKick(k); return; }
    }

    // 4. bomb right here?
    if (canBomb) {
      const ev = this.evalBomb(p.cellX, p.cellY, danger, 0, true);
      const randomBomb = ev && cfg.randomBomb && Math.random() < cfg.randomBomb;
      if (ev && (ev.score >= 1 || randomBomb)) {
        p.input.bomb = true;
        this.setPath(ev.escape, { type: 'flee' });
        return;
      }
    }

    // 5. choose a goal among reachable safe cells
    const res = bfs(g, p, danger, this.o({ margin: GOAL_MARGIN, maxDepth: 20, avoidSkull: cfg.skulls && !p.curseImmune }));
    const targeted = this.targetedBricks(danger);
    let best = null;
    const consider = (score, cell, goal, from = res) => {
      const s = score + this.noise(cell);
      if (!best || s > best.score) best = { score: s, cell, goal, res: from };
    };
    const cands = [];
    for (const c of res.order) {
      const d = res.dist[c];
      if (d === 0) continue;
      if (!isSafeToStay(danger, c, res.time[c], margin)) continue;
      const item = board.items[c];
      if (item && item !== 'skull') consider(9 * cfg.items * (this.itemValue[item] || 1) - d * 0.5, c, { type: 'item' });
      if (canBomb) {
        const q = this.quickScore(c, targeted, enemies);
        if (q > 0) cands.push({ c, q, d });
      }
    }
    if (canBomb && cfg.trap > 0) {
      for (const c of this.trapCells(res, enemies)) {
        if (!cands.some((k) => k.c === c) && isSafeToStay(danger, c, res.time[c], margin)) cands.push({ c, q: 3, d: res.dist[c] });
      }
    }
    cands.sort((a, b) => (b.q - b.d * 0.35) - (a.q - a.d * 0.35));
    for (const bc of cands.slice(0, 8)) {
      const x = bc.c % board.w, y = (bc.c - x) / board.w;
      const ev = this.evalBomb(x, y, danger, res.time[bc.c]);
      if (ev && ev.score > 0) consider(ev.score * 1.6 - bc.d * 0.45, bc.c, { type: 'bomb' });
    }
    // 5b. walk behind a bomb and kick it at an enemy
    if (cfg.kick >= 2 && p.canKick && g.bombs.length) this.considerKickSpots(danger, enemies, consider);
    // hunt the nearest reachable enemy
    let nearest = -1;
    for (const e of enemies) {
      const i = board.idx(e.cellX, e.cellY);
      if (res.dist[i] > 0 && (nearest < 0 || res.dist[i] < res.dist[nearest])) nearest = i;
    }
    if (nearest >= 0 && res.dist[nearest] > 1) {
      const path = pathTo(res, nearest);
      const t = path[Math.max(0, path.length - 2)];
      if (!t.tele) consider(2.2 * cfg.aggression - res.dist[nearest] * 0.08, board.idx(t.x, t.y), { type: 'hunt' });
    }
    if (!best && res.order.length > 1 && Math.random() < 0.4) {
      const safe = res.order.filter((c) => res.dist[c] > 0 && res.dist[c] < 6 && isSafeToStay(danger, c, res.time[c], margin));
      if (safe.length) best = { cell: safe[Math.floor(Math.random() * safe.length)], goal: { type: 'wander' }, res };
    }
    if (!best && danger.noStay[me]) {
      // never idle on a conveyor belt or a portal
      const spot = res.order.find((c) => res.dist[c] > 0 && isSafeToStay(danger, c, res.time[c], margin));
      if (spot !== undefined) best = { cell: spot, goal: { type: 'wander' }, res };
    }
    if (best) this.setPath(pathTo(best.res, best.cell), best.goal);
    else this.setPath([{ x: p.cellX, y: p.cellY }], { type: 'idle' }); // wait centred in the cell
  }

  considerKickSpots(danger, enemies, consider) {
    const g = this.game, p = this.p, board = g.board;
    // kicking spots are next to a bomb, i.e. in its blast: plan with real timing
    const res = bfs(g, p, danger, this.o({ margin: this.cfg.margin, maxDepth: 10 }));
    g.bombs.forEach((bomb, bi) => {
      if (bomb.slideDir || Math.abs(bomb.x - p.cellX) + Math.abs(bomb.y - p.cellY) > 9) return;
      const tB = danger.list[bi] ? danger.list[bi].t : bomb.timer;
      for (const dir of DIR_NAMES) {
        const d = DIRS[dir];
        const kx = bomb.x - d.x, ky = bomb.y - d.y;
        const ki = board.idx(kx, ky);
        if (res.dist[ki] <= 0 || res.via[ki] >= 0) continue;
        if (res.time[ki] > tB - 0.9) continue; // it would blow up before we get there
        if (!g.cellFreeForBomb(bomb.x + d.x, bomb.y + d.y)) continue;
        const pr = slideTrack(g, bomb.x, bomb.y, dir, 0, 0, tB, bomb.id);
        const bl = blastOf(board, pr.x, pr.y, bomb.range, [], bomb.pierce);
        if (!enemies.some((e) => bl.cells.includes(board.idx(e.cellX, e.cellY)))) continue;
        const ev = this.kickEval(bomb, dir, danger, { x: kx, y: ky }, res.time[ki]);
        if (ev && ev.score > 0) consider(ev.score * 1.5 - res.dist[ki] * 0.4, ki, { type: 'kickSpot', dir, bombId: bomb.id }, res);
      }
    });
  }
}

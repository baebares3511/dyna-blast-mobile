import {
  COUNTDOWN_TIME, HURRY_TIME, HURRY_STEP, ROUND_END_DELAY, CHAIN_DELAY,
  T_FLOOR, T_WALL, T_BRICK, CURSES, SHIELD_INVULN, FEAT_TELE, BELT_DIR, BELT_SPEED,
  EVENT_FIRST, EVENT_GAP, METEOR_FUSE,
} from '../config.js';
import { buildMap, buildAdventureMap, SPAWNS, spiralOrder } from './maps.js';
import { Player, movePlayer } from './player.js';
import { Bomb, updateBomb } from './bomb.js';
import { detonate } from './explosion.js';
import { applyPowerup, randomGoodItem } from './powerups.js';
import { createMonster, updateMonsters, stageRoster, spawnCell, SPAWN_GRACE } from './monsters.js';
import { createBoss, updateBoss } from './boss.js';
import { WORLDS, STAGES_PER_WORLD } from './campaign.js';
import { createRng } from '../core/rng.js';

// Spawn corner order by player count, so that 2 players start diagonally.
const SPAWN_ORDER = { 1: [0], 2: [0, 1], 3: [0, 1, 2], 4: [0, 1, 2, 3] };

// Random round events ("WYDARZENIA").
export const ROUND_EVENTS = {
  bombRain: 'DESZCZ BOMB!',
  itemRain: 'DESZCZ BONUSÓW!',
  turbo: 'TURBO!',
  darkness: 'CIEMNOŚĆ!',
  regrow: 'MURY ODRASTAJĄ!',
};
const EVENT_IDS = Object.keys(ROUND_EVENTS);

const ADVENTURE_TIME = 200;
const BOSS_TIME = 240;
const BOSS_CLEAR_DELAY = 2.6;
const DOOR_GRACE = 1.0;   // monsters leaving a bombed door ignore flames this long

// One round of the game: pure simulation, no rendering/audio/input.
// Controllers set `player.input`; output goes to `events`.
//   config: { mapId, seed, players:[{name, style, kind, difficulty, character}], events?: bool,
//             adventure?: { world, stage, carry?: upgrades, monsterSpeed, bossHp, extraItem, skulls } }
export class Game {
  constructor(config) {
    this.config = config;
    this.adventure = config.adventure || null;
    const adv = this.adventure;
    const map = adv ? buildAdventureMap(adv.world, adv.stage, config.seed, adv) : buildMap(config.mapId, config.seed);
    this.board = map.board;
    this.theme = map.theme;
    this.mapName = map.name;
    const order = SPAWN_ORDER[config.players.length];
    this.players = config.players.map((pc, i) => {
      const p = new Player(i, pc);
      p.spawn = SPAWNS[order[i]];
      p.resetForRound();
      if (this.adventure && this.adventure.carry) p.carryUpgradesFrom(this.adventure.carry);
      return p;
    });
    this.bombs = [];
    this.events = [];
    this.time = 0;
    this.state = 'countdown';          // countdown | playing | ending | over
    this.countdown = COUNTDOWN_TIME;
    this.endTimer = 0;
    this.result = null;
    this.hurry = { active: false, order: spiralOrder(), index: 0, timer: 0 };
    this.chainSeq = 0;
    this.chainCounts = new Map();
    this.chainOwners = new Map();
    this.bestChain = 1;
    // round events
    this.rng = createRng((config.seed ^ 0x5bd1e995) >>> 0).next;
    this.eventsOn = !!config.events && !this.adventure;
    this.nextEvent = EVENT_FIRST;
    this.meteors = [];                 // { x, y, t }
    this.darkness = 0;
    this.turbo = 0;
    // adventure
    this.monsters = [];
    this.score = 0;
    this.cleared = false;
    this.doorSpawnCooldown = 0;
    this.doorQueue = 0;
    this.doorEmit = 0;
    this.overtimeTimer = 0;
    this.boss = null;
    this.bossClear = 0;
    if (adv) {
      const W = WORLDS[adv.world - 1] || WORLDS[0];
      if (adv.stage === STAGES_PER_WORLD) {
        this.boss = createBoss(W.boss, 7, 6, adv.bossHp || 1);
      } else {
        const rng = createRng((config.seed * 7 + 13) >>> 0).next;
        for (const type of stageRoster(adv.world, adv.stage, rng, !!adv.extraItem)) {
          const c = spawnCell(this, rng, 6);
          if (c) this.monsters.push(createMonster(type, c[0], c[1]));
        }
      }
    }
  }

  get stageTime() { return this.boss ? BOSS_TIME : ADVENTURE_TIME; }

  emit(ev) { this.events.push(ev); }

  newChain(ownerId) {
    const id = ++this.chainSeq;
    this.chainOwners.set(id, ownerId);
    return id;
  }

  chainOwner(id, fallback) {
    return this.chainOwners.has(id) ? this.chainOwners.get(id) : fallback;
  }

  countChain(id) {
    const n = (this.chainCounts.get(id) || 0) + 1;
    this.chainCounts.set(id, n);
    if (n > this.bestChain) this.bestChain = n;
    return n;
  }

  bombAt(x, y) {
    for (const b of this.bombs) if (b.x === x && b.y === y) return b;
    return null;
  }

  cellFreeForBomb(x, y) {
    if (this.board.isSolid(x, y) || this.bombAt(x, y)) return false;
    for (const p of this.players) {
      if (p.alive && Math.abs(p.x - (x + 0.5)) < 0.9 && Math.abs(p.y - (y + 0.5)) < 0.9) return false;
    }
    for (const m of this.monsters) {
      if (m.alive && Math.abs(m.x - (x + 0.5)) < 0.9 && Math.abs(m.y - (y + 0.5)) < 0.9) return false;
    }
    const bs = this.boss;
    if (bs && bs.alive && Math.abs(bs.x - (x + 0.5)) < 0.9 && Math.abs(bs.y - (y + 0.5)) < 0.9) return false;
    return true;
  }

  alivePlayers() { return this.players.filter((p) => p.alive); }

  get isActive() { return this.state === 'playing' || this.state === 'ending'; }

  placeBomb(p) {
    if (!p.alive || !this.isActive) return false;
    if (p.curse && p.curse.type === 'constipation') return false;
    const cx = p.cellX, cy = p.cellY;
    if (this.board.isSolid(cx, cy) || this.bombAt(cx, cy)) return false;
    if (p.activeBombs >= p.maxBombs) return false;
    const b = new Bomb(p, cx, cy);
    this.bombs.push(b);
    p.activeBombs++;
    p.bombsPlaced++;
    if (this.board.hasFlame(cx, cy)) b.timer = CHAIN_DELAY;
    this.emit({ type: 'place', x: cx, y: cy, owner: p.id });
    return true;
  }

  detonateRemote(p) {
    let any = false;
    for (const b of this.bombs) {
      if (b.ownerId === p.id && b.remote) {
        b.remote = false;
        b.timer = 0;
        any = true;
      }
    }
    return any;
  }

  // Lethal hit: a shield absorbs it (with a short invulnerability).
  hurt(p, killerId) {
    if (!p.alive || p.invuln > 0) return;
    if (p.shield) {
      p.shield = false;
      p.invuln = SHIELD_INVULN;
      this.emit({ type: 'shieldBreak', id: p.id, x: p.cellX, y: p.cellY });
      return;
    }
    this.kill(p, killerId);
  }

  kill(p, killerId) {
    if (!p.alive) return;
    p.alive = false;
    p.moving = false;
    p.deathTime = this.time;
    if (killerId >= 0 && killerId !== p.id && this.players[killerId]) this.players[killerId].kills++;
    this.emit({ type: 'death', id: p.id, killer: killerId, x: p.x, y: p.y, style: p.style });
  }

  update(dt) {
    if (this.state === 'over') return;
    if (this.state === 'countdown') {
      for (const p of this.players) { p.input.bomb = false; p.input.detonate = false; }
      const before = Math.ceil(this.countdown);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown);
      if (after !== before && after > 0) this.emit({ type: 'count', n: after });
      if (this.countdown <= 0) {
        this.state = 'playing';
        this.emit({ type: 'start' });
      }
      return;
    }

    this.time += dt;
    const { board } = this;

    if (this.turbo > 0) this.turbo -= dt;
    if (this.darkness > 0) this.darkness -= dt;

    for (const p of this.players) {
      if (!p.alive) continue;
      p.turbo = this.turbo > 0;
      if (p.invuln > 0) p.invuln -= dt;
      if (p.curse) {
        p.curse.time -= dt;
        if (p.curse.time <= 0) {
          p.curse = null;
          this.emit({ type: 'curseEnd', id: p.id });
        } else if (p.curse.type === 'diarrhea') this.placeBomb(p);
      }
      const inp = p.input;
      if (inp.bomb) {
        inp.bomb = false;
        // with a remote: pressing BOMB when no bomb can be placed detonates instead
        if (!this.placeBomb(p) && p.hasRemote && this.detonateRemote(p)) this.emit({ type: 'remote', id: p.id });
      }
      if (inp.detonate) { inp.detonate = false; if (this.detonateRemote(p)) this.emit({ type: 'remote', id: p.id }); }
      if (p.kind !== 'remote') {
        if (inp.dir) movePlayer(this, p, inp.dir, dt);
        else p.moving = false;
        this.applyFeatures(p, dt);
      }
      if (p.moving) p.anim += dt;
    }
    this.spreadCurses();

    for (const b of this.bombs.slice()) updateBomb(this, b, dt);

    // bombs that slid / were placed into flames
    for (const b of this.bombs) {
      const i = board.idx(b.x, b.y);
      if (board.flames[i] > 0 && b.timer > CHAIN_DELAY) {
        b.timer = CHAIN_DELAY;
        b.remote = false;
        b.slideDir = null;
        b.slideOff = 0;
        if (!b.chainId) b.chainId = board.flameChain[i];
      }
    }
    let guard = 0;
    let due = this.bombs.filter((b) => b.timer <= 0);
    while (due.length && guard++ < 64) {
      for (const b of due) detonate(this, b);
      due = this.bombs.filter((b) => b.timer <= 0);
    }

    const n = board.w * board.h;
    for (let i = 0; i < n; i++) {
      if (board.flames[i] > 0) {
        board.flames[i] -= dt;
        if (board.flames[i] <= 0) {
          board.flames[i] = 0;
          board.flameKind[i] = 0;
          board.flameOwner[i] = -1;
        }
      }
      if (board.burning[i] > 0) {
        board.burning[i] -= dt;
        if (board.burning[i] <= 0) {
          board.burning[i] = 0;
          board.tiles[i] = T_FLOOR;
          board.version++;
          const x = i % board.w, y = Math.floor(i / board.w);
          if (i === board.door) {
            board.doorHidden = false;
            this.emit({ type: 'doorReveal', x, y });
          } else if (board.hidden[i]) {
            board.items[i] = board.hidden[i];
            board.hidden[i] = null;
            this.emit({ type: 'reveal', x, y, item: board.items[i] });
          }
        }
      }
    }

    for (const p of this.players) {
      if (!p.alive) continue;
      const i = board.idx(p.cellX, p.cellY);
      if (board.flames[i] > 0) {
        this.hurt(p, board.flameOwner[i]);
        if (!p.alive) continue;
      }
      const item = board.items[i];
      if (item) {
        board.items[i] = null;
        const label = applyPowerup(p, item);
        this.emit({ type: 'pickup', id: p.id, item, label, x: p.cellX, y: p.cellY });
      }
    }

    this.updateMeteors(dt);
    if (this.eventsOn && !this.hurry.active) this.updateRoundEvents();
    if (this.adventure) this.updateAdventure(dt);
    else this.updateHurry(dt);

    if (this.state === 'playing') {
      const lost = this.adventure ? !this.players[0].alive : this.alivePlayers().length <= 1;
      if (lost || this.cleared) {
        this.state = 'ending';
        this.endTimer = ROUND_END_DELAY;
      }
    } else if (this.state === 'ending') {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.finish();
    }
  }

  // teleports and conveyor belts
  applyFeatures(p, dt) {
    const b = this.board;
    const i = b.idx(p.cellX, p.cellY);
    const f = b.features[i];
    if (p.teleCell >= 0 && p.teleCell !== i) p.teleCell = -1;
    if (f === FEAT_TELE && p.teleCell !== i) {
      const cx = p.cellX + 0.5, cy = p.cellY + 0.5;
      if (Math.abs(p.x - cx) < 0.2 && Math.abs(p.y - cy) < 0.2) {
        const j = b.telePair[i];
        const tx = j % b.w, ty = Math.floor(j / b.w);
        if (j >= 0 && !this.bombAt(tx, ty)) {
          this.emit({ type: 'teleport', id: p.id, fromX: p.cellX, fromY: p.cellY, x: tx, y: ty });
          p.x = tx + 0.5;
          p.y = ty + 0.5;
          p.teleCell = j;
        }
      }
    }
    const belt = BELT_DIR[f];
    if (belt) movePlayer(this, p, belt, dt, { push: true, speed: BELT_SPEED });
  }

  spreadCurses() {
    const alive = this.alivePlayers();
    for (const a of alive) {
      if (!a.curse) continue;
      for (const c of alive) {
        if (c === a || c.curse || c.curseImmune) continue;
        if (Math.abs(a.x - c.x) < 0.8 && Math.abs(a.y - c.y) < 0.8) {
          c.curse = { type: a.curse.type, time: Math.max(4, a.curse.time) };
          this.emit({ type: 'curse', id: c.id, label: 'ZARAŻENIE: ' + CURSES[c.curse.type], x: c.cellX, y: c.cellY });
        }
      }
    }
  }

  // ------------------------------------------------------------ round events

  freeCells(minPlayerDist = 0) {
    const b = this.board;
    const out = [];
    for (let y = 1; y < b.h - 1; y++) {
      for (let x = 1; x < b.w - 1; x++) {
        const i = b.idx(x, y);
        if (b.tiles[i] !== T_FLOOR || b.items[i] || b.features[i] || this.bombAt(x, y) || b.flames[i] > 0) continue;
        if (minPlayerDist && this.players.some((p) => p.alive && Math.abs(p.cellX - x) + Math.abs(p.cellY - y) < minPlayerDist)) continue;
        out.push([x, y]);
      }
    }
    return out;
  }

  pickCells(cells, n) {
    const out = [];
    const pool = cells.slice();
    while (out.length < n && pool.length) out.push(pool.splice(Math.floor(this.rng() * pool.length), 1)[0]);
    return out;
  }

  updateRoundEvents() {
    if (this.time < this.nextEvent) return;
    const [lo, hi] = EVENT_GAP;
    this.nextEvent = this.time + lo + this.rng() * (hi - lo);
    const kind = EVENT_IDS[Math.floor(this.rng() * EVENT_IDS.length)];
    this.emit({ type: 'roundEvent', kind, label: ROUND_EVENTS[kind] });
    if (kind === 'bombRain') {
      this.pickCells(this.freeCells(), 7).forEach(([x, y], k) => this.meteors.push({ x, y, t: 1.2 + k * 0.45 }));
    } else if (kind === 'itemRain') {
      for (const [x, y] of this.pickCells(this.freeCells(), 5)) {
        this.board.items[this.board.idx(x, y)] = randomGoodItem(this.rng);
        this.emit({ type: 'reveal', x, y });
      }
    } else if (kind === 'turbo') this.turbo = 10;
    else if (kind === 'darkness') this.darkness = 12;
    else if (kind === 'regrow') {
      for (const [x, y] of this.pickCells(this.freeCells(3), 10)) {
        const i = this.board.idx(x, y);
        this.board.tiles[i] = T_BRICK;
        if (this.rng() < 0.3) this.board.hidden[i] = randomGoodItem(this.rng);
        this.emit({ type: 'grow', x, y });
      }
      this.board.version++;
    }
  }

  updateMeteors(dt) {
    if (!this.meteors.length) return;
    const keep = [];
    for (const m of this.meteors) {
      m.t -= dt;
      if (m.t > 0) { keep.push(m); continue; }
      if (!this.board.isSolid(m.x, m.y) && !this.bombAt(m.x, m.y)) {
        const b = new Bomb(null, m.x, m.y, { range: 2, fuse: METEOR_FUSE });
        this.bombs.push(b);
        this.emit({ type: 'meteor', x: m.x, y: m.y });
      }
    }
    this.meteors = keep;
  }

  // ------------------------------------------------------------ adventure

  // Penalty monsters (bombed door, overtime) give no points and spawn away
  // from flames, with a short immunity, so they can't be farmed for score.
  spawnPenaltyMonster(type, near) {
    const c = spawnCell(this, this.rng, 4, { near, avoidDanger: true });
    if (!c) return;
    this.monsters.push(createMonster(type, c[0], c[1], { points: 0, grace: SPAWN_GRACE }));
    this.emit({ type: 'monsterSpawn', x: c[0], y: c[1] });
  }

  updateAdventure(dt) {
    updateMonsters(this, dt);
    const b = this.board;
    const p = this.players[0];
    const world = this.adventure.world || 1;
    if (this.doorSpawnCooldown > 0) this.doorSpawnCooldown -= dt;
    const alive = this.monsters.filter((m) => m.alive).length;
    if (this.boss) {
      updateBoss(this, this.boss, dt);
      if (!this.boss.alive && !this.cleared && p.alive) {
        this.bossClear += dt;
        if (this.bossClear >= BOSS_CLEAR_DELAY) {
          this.cleared = true;
          this.score += Math.max(0, Math.round(BOSS_TIME - this.time)) * 10;
          this.emit({ type: 'stageClear' });
        }
      }
    }
    if (b.door >= 0 && !b.doorHidden) {
      const dx = b.door % b.w, dy = Math.floor(b.door / b.w);
      // bombing an exposed exit angers it: once the fire on it dies down, two
      // monsters walk out of the door, one after another (no points for them)
      if (b.flames[b.door] > 0 && this.doorSpawnCooldown <= 0) {
        this.doorSpawnCooldown = 3;
        this.doorQueue = (this.doorQueue || 0) + 2;
        this.doorEmit = 0.25;
        this.emit({ type: 'doorAngry', x: dx, y: dy });
      }
      if (this.doorQueue > 0 && b.flames[b.door] <= 0 && !this.bombAt(dx, dy)) {
        this.doorEmit -= dt;
        if (this.doorEmit <= 0) {
          this.doorQueue--;
          this.doorEmit = 0.5;
          const type = world >= 4 ? 'spark' : world >= 2 ? 'eye' : 'balloon';
          this.monsters.push(createMonster(type, dx, dy, { points: 0, grace: DOOR_GRACE }));
          this.emit({ type: 'monsterSpawn', x: dx, y: dy });
        }
      }
      if (alive === 0 && p.alive && p.cellX === dx && p.cellY === dy && !this.cleared) {
        this.cleared = true;
        this.score += Math.max(0, Math.round(ADVENTURE_TIME - this.time)) * 10;
        this.emit({ type: 'stageClear' });
      }
    }
    if (this.time > this.stageTime && !this.cleared) {
      this.overtimeTimer -= dt;
      if (this.overtimeTimer <= 0) {
        if (this.overtimeTimer > -1) this.emit({ type: 'hurry' });
        this.overtimeTimer = 9;
        this.spawnPenaltyMonster('spark', null);
      }
    }
  }

  get timeLeft() {
    return this.adventure ? this.stageTime - this.time : HURRY_TIME - this.time;
  }

  // ------------------------------------------------------------ hurry up

  updateHurry(dt) {
    const h = this.hurry;
    if (!h.active) {
      if (this.time < HURRY_TIME) return;
      h.active = true;
      h.timer = 1.5;
      this.darkness = 0;
      this.emit({ type: 'hurry' });
    }
    h.timer -= dt;
    while (h.timer <= 0 && h.index < h.order.length) {
      const [x, y] = h.order[h.index++];
      if (this.board.tile(x, y) === T_WALL) continue;
      h.timer += HURRY_STEP;
      this.dropWall(x, y);
    }
  }

  dropWall(x, y) {
    const { board } = this;
    const i = board.idx(x, y);
    board.tiles[i] = T_WALL;
    board.version++;
    board.hidden[i] = null;
    board.items[i] = null;
    board.burning[i] = 0;
    board.flames[i] = 0;
    board.flameKind[i] = 0;
    board.features[i] = 0;
    const b = this.bombAt(x, y);
    if (b) {
      this.bombs.splice(this.bombs.indexOf(b), 1);
      const o = this.players[b.ownerId];
      if (o) o.activeBombs = Math.max(0, o.activeBombs - 1);
    }
    this.meteors = this.meteors.filter((m) => m.x !== x || m.y !== y);
    for (const p of this.players) if (p.alive && p.cellX === x && p.cellY === y) this.kill(p, -1);
    this.emit({ type: 'wall', x, y });
  }

  finish() {
    const alive = this.alivePlayers();
    this.state = 'over';
    this.result = {
      winner: this.adventure ? (this.cleared ? 0 : -1) : alive.length === 1 ? alive[0].id : -1,
      time: this.time,
      bestChain: this.bestChain,
      adventure: !!this.adventure,
      cleared: this.cleared,
      score: this.score,
      players: this.players.map((p) => ({
        id: p.id, name: p.name, style: p.style, alive: p.alive, kills: p.kills,
        collected: { ...p.collected }, bombsPlaced: p.bombsPlaced,
      })),
    };
    this.emit({ type: 'over', result: this.result });
  }
}

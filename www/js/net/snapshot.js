// Compact serialisation of the authoritative game state (host -> guest).
import { DIR_NAMES, CURSE_IDS } from '../config.js';
import { POWERUPS, CODE_TO_POWERUP } from '../game/powerups.js';

const r3 = (v) => Math.round(v * 1000);

export function makeSnapshot(game, events) {
  const b = game.board;
  const n = b.w * b.h;
  let tiles = '';
  let items = '';
  const fl = [];
  const bu = [];
  for (let i = 0; i < n; i++) {
    tiles += b.tiles[i];
    items += b.items[i] ? POWERUPS[b.items[i]].code : '0';
    if (b.flames[i] > 0) fl.push(i, b.flameKind[i], r3(b.flames[i]));
    if (b.burning[i] > 0) bu.push(i, r3(b.burning[i]));
  }
  return {
    t: 's',
    st: game.state,
    cd: r3(game.countdown),
    tm: r3(game.time),
    hz: game.hurry.active ? 1 : 0,
    dk: Math.round(game.darkness * 10),
    tb: Math.round(game.turbo * 10),
    mt: game.meteors.map((m) => [m.x, m.y, Math.round(m.t * 100)]),
    tiles,
    items,
    fl,
    bu,
    bombs: game.bombs.map((x) => [
      x.id, x.x, x.y, x.slideDir ? DIR_NAMES.indexOf(x.slideDir) : -1, Math.round(x.slideOff * 100),
      r3(x.timer), x.ownerId, x.remote ? 1 : 0, r3(x.age), x.range,
    ]),
    players: game.players.map((p) => [
      r3(p.x), r3(p.y), DIR_NAMES.indexOf(p.dir), p.moving ? 1 : 0, p.alive ? 1 : 0,
      p.maxBombs, p.range, p.speedLevel, p.canKick ? 1 : 0, p.hasRemote ? 1 : 0,
      p.kills, p.activeBombs, r3(p.deathTime),
      p.shield ? 1 : 0, Math.round(p.invuln * 100), p.curse ? CURSE_IDS.indexOf(p.curse.type) : -1,
      p.curse ? Math.round(p.curse.time * 10) : 0, p.pierce ? 1 : 0,
    ]),
    ev: events,
  };
}

// Apply on the guest's mirror Game. The guest's own player position is
// predicted locally and only corrected on large divergence.
export function applySnapshot(game, s, localId) {
  const b = game.board;
  const n = b.w * b.h;
  game.state = s.st;
  game.countdown = s.cd / 1000;
  game.time = s.tm / 1000;
  game.hurry.active = !!s.hz;
  game.darkness = (s.dk || 0) / 10;
  game.turbo = (s.tb || 0) / 10;
  game.meteors = (s.mt || []).map((a) => ({ x: a[0], y: a[1], t: a[2] / 100 }));
  let changed = false;
  for (let i = 0; i < n; i++) {
    const v = s.tiles.charCodeAt(i) - 48;
    if (b.tiles[i] !== v) { b.tiles[i] = v; changed = true; }
    const c = s.items[i];
    b.items[i] = c === '0' ? null : CODE_TO_POWERUP[c] || null;
  }
  if (changed) b.version++;
  b.flames.fill(0);
  b.flameKind.fill(0);
  for (let k = 0; k < s.fl.length; k += 3) {
    b.flames[s.fl[k]] = s.fl[k + 2] / 1000;
    b.flameKind[s.fl[k]] = s.fl[k + 1];
  }
  b.burning.fill(0);
  for (let k = 0; k < s.bu.length; k += 2) b.burning[s.bu[k]] = s.bu[k + 1] / 1000;

  game.bombs = s.bombs.map((a) => ({
    id: a[0], x: a[1], y: a[2], slideDir: a[3] >= 0 ? DIR_NAMES[a[3]] : null, slideOff: a[4] / 100,
    timer: a[5] / 1000, ownerId: a[6], remote: !!a[7], age: a[8] / 1000, range: a[9],
  }));

  s.players.forEach((a, i) => {
    const p = game.players[i];
    if (!p) return;
    const sx = a[0] / 1000, sy = a[1] / 1000;
    const alive = !!a[4];
    const isLocal = i === localId;
    const grace = game.teleGrace && game.teleGrace > performance.now();
    if (!isLocal || !alive || game.state === 'countdown' || (!grace && Math.hypot(sx - p.x, sy - p.y) > 1.6)) {
      if (isLocal) { p.x = sx; p.y = sy; }
      p.netX = sx;
      p.netY = sy;
    }
    if (!isLocal) {
      p.dir = DIR_NAMES[a[2]] || 'down';
      p.moving = !!a[3];
    }
    p.alive = alive;
    p.maxBombs = a[5];
    p.range = a[6];
    p.speedLevel = a[7];
    p.canKick = !!a[8];
    p.hasRemote = !!a[9];
    p.kills = a[10];
    p.activeBombs = a[11];
    p.deathTime = a[12] / 1000;
    p.shield = !!a[13];
    p.invuln = a[14] / 100;
    p.curse = a[15] >= 0 ? { type: CURSE_IDS[a[15]], time: a[16] / 10 } : null;
    p.pierce = !!a[17];
    p.turbo = game.turbo > 0;
  });
}

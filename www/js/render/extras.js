// Rendering of arena features and newer gameplay elements: teleports, conveyor
// belts, the adventure exit door, falling bombs, monsters, player auras and the
// "darkness" round event.
import { TILE, FEAT_TELE, BELT_DIR } from '../config.js';
import { sprites, monsterFrames, bossFrames, makeCanvas } from './sprites.js';

export function drawFeatures(g, board, time) {
  for (let y = 0; y < board.h; y++) {
    for (let x = 0; x < board.w; x++) {
      const f = board.features[board.idx(x, y)];
      if (!f || board.tile(x, y) !== 0) continue;
      const px = x * TILE, py = y * TILE;
      if (f === FEAT_TELE) {
        const pulse = (Math.sin(time * 5 + x + y) + 1) / 2;
        g.fillStyle = '#1a0a2e';
        g.fillRect(px + 2, py + 2, 12, 12);
        g.fillStyle = '#7a2ad8';
        g.fillRect(px + 3, py + 3, 10, 10);
        g.fillStyle = pulse > 0.5 ? '#d070ff' : '#a040f0';
        g.fillRect(px + 5, py + 5, 6, 6);
        g.fillStyle = '#ffffff';
        const r = Math.floor((time * 8 + x * 3) % 4);
        g.fillRect(px + 5 + r, py + 5, 1, 1);
        g.fillRect(px + 10 - r, py + 10, 1, 1);
        continue;
      }
      const dir = BELT_DIR[f];
      if (!dir) continue;
      g.fillStyle = '#2a2a34';
      g.fillRect(px, py, TILE, TILE);
      g.fillStyle = '#3c3c4a';
      const horiz = dir === 'left' || dir === 'right';
      if (horiz) { g.fillRect(px, py + 1, TILE, 1); g.fillRect(px, py + 14, TILE, 1); } else { g.fillRect(px + 1, py, 1, TILE); g.fillRect(px + 14, py, 1, TILE); }
      // moving chevrons (clipped to the tile)
      g.save();
      g.beginPath();
      g.rect(px, py, TILE, TILE);
      g.clip();
      const off = Math.floor(time * 14) % 8;
      g.fillStyle = '#ffb020';
      for (let k = -1; k < 2; k++) {
        const o = k * 8 + off;
        for (let s = 0; s < 4; s++) {
          let ax, ay;
          if (dir === 'right') { ax = px + o + s; ay = py + 4 + s; g.fillRect(ax, ay, 1, 1); g.fillRect(ax, py + 11 - s, 1, 1); }
          if (dir === 'left') { ax = px + 15 - o - s; ay = py + 4 + s; g.fillRect(ax, ay, 1, 1); g.fillRect(ax, py + 11 - s, 1, 1); }
          if (dir === 'down') { ay = py + o + s; g.fillRect(px + 4 + s, ay, 1, 1); g.fillRect(px + 11 - s, ay, 1, 1); }
          if (dir === 'up') { ay = py + 15 - o - s; g.fillRect(px + 4 + s, ay, 1, 1); g.fillRect(px + 11 - s, ay, 1, 1); }
        }
      }
      g.restore();
    }
  }
}

export function drawDoor(g, game, time) {
  const b = game.board;
  if (b.door < 0 || b.doorHidden || b.tiles[b.door] !== 0) return;
  const x = b.door % b.w, y = Math.floor(b.door / b.w);
  const px = x * TILE, py = y * TILE;
  const open = !game.monsters.some((m) => m.alive);
  g.fillStyle = '#3a2410';
  g.fillRect(px + 1, py + 1, 14, 15);
  g.fillStyle = '#8a5a2a';
  g.fillRect(px + 2, py + 2, 12, 14);
  if (open) {
    const glow = Math.floor(time * 6) % 2;
    g.fillStyle = glow ? '#fff6b0' : '#ffe14a';
    g.fillRect(px + 4, py + 4, 8, 12);
    g.fillStyle = '#ffffff';
    g.fillRect(px + 6, py + 6, 4, 10);
  } else {
    g.fillStyle = '#140c1e';
    g.fillRect(px + 4, py + 4, 8, 12);
    g.fillStyle = '#9a9aa8';
    for (let k = 0; k < 3; k++) g.fillRect(px + 5 + k * 3, py + 4, 1, 12);
  }
  g.fillStyle = '#ffd23a';
  g.fillRect(px + 7, py + 1, 2, 2);
}

export function drawMeteors(g, game, time) {
  const spr = sprites();
  for (const m of game.meteors) {
    const px = m.x * TILE, py = m.y * TILE;
    const k = Math.max(0, Math.min(1, 1 - m.t / 1.2));
    // target marker
    if (Math.floor(time * 8) % 2) {
      g.fillStyle = 'rgba(255,40,40,0.55)';
      g.fillRect(px + 2, py + 2, 12, 1); g.fillRect(px + 2, py + 13, 12, 1);
      g.fillRect(px + 2, py + 2, 1, 12); g.fillRect(px + 13, py + 2, 1, 12);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    const w = Math.round(4 + k * 8);
    g.fillRect(px + 8 - w / 2, py + 12, w, 3);
    if (m.t < 1.2) {
      const fall = Math.round(m.t * 90);
      g.drawImage(spr.bomb[1], px, py - fall);
    }
  }
}

export function drawMonsters(g, game, time) {
  const list = game.monsters.slice().sort((a, b) => a.y - b.y);
  for (const m of list) {
    const sx = Math.round((m.x - 0.5) * TILE), sy = Math.round((m.y - 0.5) * TILE) - 2;
    const frames = monsterFrames(m.type);
    if (!m.alive) {
      const t = game.time - m.deathTime;
      if (t > 0.6) continue;
      g.globalAlpha = 1 - t / 0.6;
      const s = 1 + t;
      g.drawImage(frames[0], 0, 0, 18, 18, sx - 1 - (s - 1) * 8, sy - 1 - (s - 1) * 8, 18 * s, 18 * s);
      g.globalAlpha = 1;
      continue;
    }
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(sx + 4, sy + 16, 8, 2);
    if (m.type === 'ghost') g.globalAlpha = 0.72;
    if (m.grace > 0 && Math.floor(time * 12) % 2) g.globalAlpha = 0.3;
    const bob = m.type === 'balloon' ? Math.round(Math.sin(m.anim * 4)) : 0;
    g.drawImage(frames[Math.floor(m.anim * 4) % 2], sx - 1, sy - 1 + bob);
    g.globalAlpha = 1;
  }
}

// Boss: 32x32 sprite standing on its cell; blinks white after a hit,
// shakes before a charge, fades while teleporting.
export function drawBoss(g, game, time) {
  const b = game.boss;
  if (!b) return;
  const frames = bossFrames(b.type);
  const sx = Math.round(b.x * TILE - 17), sy = Math.round(b.y * TILE - 27);
  if (!b.alive) {
    const t = game.time - b.deathTime;
    if (t > 1.6) return;
    g.globalAlpha = Math.max(0, 1 - t / 1.6);
    const spr = Math.floor(t * 14) % 2 ? frames.flash : frames[0];
    const s = 1 + t * 0.4;
    g.drawImage(spr, 0, 0, 34, 34, Math.round(b.x * TILE - 17 * s), Math.round(b.y * TILE - 27 * s), Math.round(34 * s), Math.round(34 * s));
    g.globalAlpha = 1;
    return;
  }
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.fillRect(sx + 7, sy + 29, 20, 3);
  g.fillRect(sx + 9, sy + 28, 16, 5);
  let ox = 0;
  if (b.state === 'windup') ox = Math.floor(time * 30) % 2 ? 1 : -1;
  g.globalAlpha = b.alpha ?? 1;
  const speed = b.state === 'charge' ? 14 : 4;
  let spr = frames[Math.floor(b.anim * speed) % 2];
  if (b.hurt > 0 && Math.floor(time * 16) % 2) spr = frames.flash;
  g.drawImage(spr, sx + ox, sy);
  g.globalAlpha = 1;
  if (b.state === 'stun') {
    g.fillStyle = '#ffe14a';
    for (let k = 0; k < 3; k++) {
      const a = time * 6 + (k * Math.PI * 2) / 3;
      g.fillRect(Math.round(b.x * TILE + Math.cos(a) * 9), Math.round(sy + 2 + Math.sin(a) * 2), 2, 2);
    }
  }
}

// shield bubble, curse aura, invulnerability blink - drawn over the player
export function drawPlayerAura(g, p, time) {
  if (!p.alive) return;
  const cx = Math.round(p.x * TILE), cy = Math.round(p.y * TILE) - 4;
  if (p.shield) {
    g.fillStyle = Math.floor(time * 6) % 2 ? 'rgba(124,242,255,0.9)' : 'rgba(124,242,255,0.5)';
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + time;
      g.fillRect(Math.round(cx + Math.cos(a) * 9), Math.round(cy + Math.sin(a) * 10), 1, 1);
    }
  }
  if (p.curse && Math.floor(time * 10) % 3 === 0) {
    g.fillStyle = '#c060ff';
    const a = time * 7;
    g.fillRect(Math.round(cx + Math.cos(a) * 7), Math.round(cy - 8 + Math.sin(a * 1.3) * 3), 2, 2);
    g.fillRect(Math.round(cx - Math.cos(a) * 7), Math.round(cy - 6 - Math.sin(a) * 3), 1, 1);
  }
  if (p.turbo && p.moving) {
    g.fillStyle = 'rgba(255,255,255,0.6)';
    const d = p.dir === 'left' ? 1 : p.dir === 'right' ? -1 : 0;
    const v = p.dir === 'up' ? 1 : p.dir === 'down' ? -1 : 0;
    for (let k = 1; k < 4; k++) g.fillRect(cx + d * (6 + k * 3) - (v ? 4 : 0), cy + v * (6 + k * 3) - (d ? 3 - k : 0), v ? 8 : 2, d ? 1 : 2);
  }
}

// Darkness event: everything black except light around players, bombs, flames.
let mask = null;
export function drawDarkness(g, game, strength) {
  if (!mask) mask = makeCanvas(g.canvas.width, g.canvas.height);
  const [mc, mg] = mask;
  mg.globalCompositeOperation = 'source-over';
  mg.fillStyle = `rgba(4,2,12,${0.93 * strength})`;
  mg.fillRect(0, 0, mc.width, mc.height);
  mg.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r) => {
    const grd = mg.createRadialGradient(x, y, r * 0.35, x, y, r);
    grd.addColorStop(0, 'rgba(0,0,0,1)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    mg.fillStyle = grd;
    mg.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (const p of game.players) if (p.alive) hole(p.x * TILE, p.y * TILE, 40);
  for (const b of game.bombs) hole((b.x + 0.5) * TILE, (b.y + 0.5) * TILE, 14);
  const bd = game.board;
  for (let i = 0; i < bd.flames.length; i++) {
    if (bd.flames[i] > 0) hole((i % bd.w + 0.5) * TILE, (Math.floor(i / bd.w) + 0.5) * TILE, 20);
  }
  g.drawImage(mc, 0, 0);
}

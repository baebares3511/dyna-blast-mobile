import {
  TILE, GRID_W, GRID_H, T_WALL, T_BRICK, BRICK_BURN_TIME, FLAME_TIME, DIRS, PLAYER_STYLES,
  F_CENTER, F_H, F_V, F_END_L, F_END_R, F_END_U, F_END_D,
} from '../config.js';
import { THEMES } from '../game/maps.js';
import { makeCanvas, hash, themeTiles, sprites, bomberFrames } from './sprites.js';
import { Particles } from './particles.js';
import { drawFeatures, drawDoor, drawMeteors, drawMonsters, drawBoss, drawPlayerAura, drawDarkness } from './extras.js';

const BW = GRID_W * TILE;
const BH = GRID_H * TILE;
const FLAME_LAYERS = [
  [0, '#c41e14'],
  [-1, '#ff6a12'],
  [-3, '#ffc928'],
  [-5, '#fffbe4'],
];
const FONT = '"Press Start 2P", "Courier New", monospace';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    [this.low, this.lg] = makeCanvas(BW, BH);
    [this.stat, this.sg] = makeCanvas(BW, BH);
    this.statKey = '';
    this.particles = new Particles();
    this.popups = [];
    this.glows = [];
    this.shake = 0;
    this.flash = 0;
    this.time = 0;
    this.banner = null;
    this.margins = { left: 0, right: 0, top: 0, bottom: 0 };
    this.shakeEnabled = true;
    this.rect = { x: 0, y: 0, w: BW, h: BH, s: 1 };
    this.resize();
  }

  setMargins(m) {
    this.margins = { left: 0, right: 0, top: 0, bottom: 0, ...m };
    this.resize();
  }

  reset() {
    this.particles.list = [];
    this.popups = [];
    this.glows = [];
    this.shake = 0;
    this.flash = 0;
    this.banner = null;
    this.statKey = '';
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const W = window.innerWidth, H = window.innerHeight;
    this.dpr = dpr;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.canvas.style.width = W + 'px';
    this.canvas.style.height = H + 'px';
    const m = this.margins;
    const aw = Math.max(100, W - m.left - m.right) * dpr;
    const ah = Math.max(100, H - m.top - m.bottom) * dpr;
    let s = Math.min(aw / BW, ah / BH);
    if (s >= 2.5) s = Math.floor(s);       // crisp integer scaling when possible
    const w = BW * s, h = BH * s;
    const x = m.left * dpr + (aw - w) / 2;
    const y = m.top * dpr + (ah - h) / 2;
    this.rect = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), s };
  }

  // board-pixel -> screen (device px)
  toScreen(px, py) {
    return [this.rect.x + px * this.rect.s, this.rect.y + py * this.rect.s];
  }

  handleEvent(ev) {
    const P = this.particles;
    const cx = (ev.x + 0.5) * TILE, cy = (ev.y + 0.5) * TILE;
    switch (ev.type) {
      case 'explode': {
        this.shake = Math.min(7, this.shake + 1.6 + ev.chain * 0.6);
        P.burst(cx, cy, 10, { speed: 70, colors: ['#fff6b0', '#ffd23a', '#ff8a1f'], life: 0.45, size: 1 });
        P.burst(cx, cy, 4, { speed: 18, colors: ['#5a5060', '#7a7080'], life: 0.9, size: 5, kind: 'smoke' });
        this.glows.push({ x: cx, y: cy, t: 0, life: 0.4, r: 26 + ev.cells * 3 });
        if (ev.chain >= 2) {
          const color = ev.chain >= 4 ? '#ff4fd8' : '#ffe14a';
          const prev = this.popups.find((p) => p.chainId === ev.chainId);
          if (prev) Object.assign(prev, { text: `COMBO x${ev.chain}`, x: cx, y: cy - 6, t: 0, color });
          else this.popups.push({ text: `COMBO x${ev.chain}`, x: cx, y: cy - 6, t: 0, life: 1.1, color, chainId: ev.chainId });
          if (ev.chain >= 3) this.flash = Math.min(0.35, 0.12 + ev.chain * 0.04);
        }
        break;
      }
      case 'brick': {
        const th = THEMES[this.themeKey] || THEMES.grass;
        P.burst(cx, cy, 9, { speed: 40, up: 60, g: 260, colors: [th.brick, th.brickHi, th.brickDark], life: 0.8, size: 2 });
        break;
      }
      case 'reveal':
        P.burst(cx, cy, 8, { speed: 30, colors: ['#ffffff', '#fff27a'], life: 0.5, kind: 'star' });
        break;
      case 'pickup':
        P.burst(cx, cy, 12, { speed: 55, colors: ['#ffffff', '#7cf2ff', '#fff27a'], life: 0.55, kind: 'star' });
        this.popups.push({ text: ev.label || '', x: cx, y: cy - 10, t: 0, life: 0.9, color: '#ffffff', small: true });
        break;
      case 'itemBurn':
        P.burst(cx, cy, 6, { speed: 20, colors: ['#3a3040'], life: 0.7, size: 4, kind: 'smoke' });
        break;
      case 'death':
        P.add({ kind: 'ghost', x: ev.x * TILE, y: ev.y * TILE - 6, life: 1.4 });
        P.burst(ev.x * TILE, ev.y * TILE, 14, { speed: 60, colors: ['#ffffff', PLAYER_STYLES[ev.style ?? 0]?.body || '#fff'], life: 0.6, size: 2 });
        this.shake = Math.min(8, this.shake + 3);
        break;
      case 'wall':
        P.burst(cx, cy + 6, 6, { speed: 30, colors: ['#9a9088', '#c8c0b8'], life: 0.6, size: 4, kind: 'smoke' });
        this.shake = Math.min(4, this.shake + 0.6);
        break;
      case 'kick':
        P.burst(cx, cy, 5, { speed: 30, colors: ['#ffffff'], life: 0.3, size: 1 });
        break;
      case 'hurry':
        this.banner = { text: 'POŚPIESZ SIĘ!', t: 0, life: 2.6, color: '#ff4a4a' };
        break;
      case 'teleport':
        P.burst((ev.fromX + 0.5) * TILE, (ev.fromY + 0.5) * TILE, 10, { speed: 40, colors: ['#d070ff', '#ffffff'], life: 0.5, kind: 'star' });
        P.burst(cx, cy, 10, { speed: 40, colors: ['#d070ff', '#ffffff'], life: 0.5, kind: 'star' });
        break;
      case 'shieldBreak':
        P.burst(cx, cy, 18, { speed: 70, colors: ['#7cf2ff', '#ffffff'], life: 0.6, kind: 'star' });
        this.popups.push({ text: 'TARCZA!', x: cx, y: cy - 10, t: 0, life: 0.9, color: '#7cf2ff', small: true });
        break;
      case 'curse':
        this.popups.push({ text: ev.label, x: cx, y: cy - 10, t: 0, life: 1.2, color: '#d78aff', small: true });
        break;
      case 'roundEvent':
        this.banner = { text: ev.label, t: 0, life: 2.4, color: { bombRain: '#ff6a3a', itemRain: '#7cf2ff', turbo: '#ffe14a', darkness: '#b090ff', regrow: '#9adf6a' }[ev.kind] || '#ffffff' };
        break;
      case 'meteor':
        P.burst(cx, cy + 4, 6, { speed: 30, colors: ['#9a9088', '#c8c0b8'], life: 0.5, size: 3, kind: 'smoke' });
        this.shake = Math.min(4, this.shake + 1);
        break;
      case 'grow':
        P.burst(cx, cy, 5, { speed: 20, colors: ['#9adf6a', '#ffffff'], life: 0.5, kind: 'star' });
        break;
      case 'monsterDeath':
        P.burst(cx, cy, 12, { speed: 50, colors: ['#ffffff', '#ffe14a', '#ff8a3d'], life: 0.5, kind: 'star' });
        if (ev.points) this.popups.push({ text: String(ev.points), x: cx, y: cy - 8, t: 0, life: 1.0, color: '#ffe14a', small: true });
        break;
      case 'monsterSpawn':
        P.burst(cx, cy, 10, { speed: 30, colors: ['#b070ff', '#ffffff'], life: 0.5, kind: 'star' });
        break;
      case 'bossHit':
        P.burst(cx, cy - 6, 16, { speed: 70, colors: ['#ffffff', '#ffe14a', '#ff5a2a'], life: 0.6, kind: 'star' });
        this.popups.push({ text: ev.hp > 0 ? `TRAFIENIE! ${ev.hp}` : 'K.O.!', x: cx, y: cy - 22, t: 0, life: 1.0, color: '#ff8a5a', small: true });
        this.shake = Math.min(8, this.shake + 3);
        break;
      case 'bossDeath':
        for (let k = 0; k < 4; k++) P.burst(cx + (k % 2 ? 8 : -8), cy - 6 + (k > 1 ? 8 : -8), 16, { speed: 90, colors: ['#ffffff', '#ffe14a', '#ff8a1f', '#ff4fd8'], life: 0.9, kind: 'star' });
        this.glows.push({ x: cx, y: cy, t: 0, life: 0.9, r: 70 });
        this.popups.push({ text: String(ev.points), x: cx, y: cy - 24, t: 0, life: 1.8, color: '#ffe14a' });
        this.banner = { text: 'BOSS POKONANY!', t: 0, life: 2.4, color: '#ffe14a' };
        this.flash = 0.5;
        this.shake = 10;
        break;
      case 'bossWindup':
        this.popups.push({ text: '!!', x: cx, y: cy - 26, t: 0, life: 0.6, color: '#ff4a4a' });
        break;
      case 'bossStomp':
        P.burst(cx, cy + 4, 8, { speed: 40, colors: ['#9a9088', '#c8c0b8'], life: 0.6, size: 4, kind: 'smoke' });
        this.shake = Math.min(6, this.shake + 3);
        break;
      case 'bossCast':
        P.burst(cx, cy - 10, 12, { speed: 45, colors: ['#d070ff', '#7cf2ff', '#ffffff'], life: 0.6, kind: 'star' });
        break;
      case 'doorReveal':
        P.burst(cx, cy, 14, { speed: 40, colors: ['#ffe14a', '#ffffff'], life: 0.8, kind: 'star' });
        this.popups.push({ text: 'WYJŚCIE!', x: cx, y: cy - 10, t: 0, life: 1.4, color: '#ffe14a', small: true });
        break;
      case 'doorAngry':
        this.popups.push({ text: 'NIE BOMBARDUJ WYJŚCIA!', x: cx, y: cy - 10, t: 0, life: 1.4, color: '#ff6a6a', small: true });
        break;
      case 'stageClear':
        this.banner = { text: 'ETAP UKOŃCZONY!', t: 0, life: 2, color: '#ffe14a' };
        break;
      case 'start':        this.banner = { text: 'START!', t: 0, life: 0.9, color: '#ffe14a', big: true };
        break;
      default:
    }
  }

  buildStatic(game) {
    const g = this.sg;
    const b = game.board;
    const tiles = themeTiles(game.theme);
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const t = b.tiles[b.idx(x, y)];
        const px = x * TILE, py = y * TILE;
        if (t === T_WALL) g.drawImage(tiles.wall, px, py);
        else if (t === T_BRICK) g.drawImage(tiles.brick, px, py);
        else {
          const dark = (x + y) % 2;
          g.drawImage(tiles.floors[dark][Math.floor(hash(x, y) * 4)], px, py);
          if (b.tile(x, y - 1) !== 0) {
            g.fillStyle = 'rgba(0,0,0,0.28)';
            g.fillRect(px, py, TILE, 3);
            g.fillStyle = 'rgba(0,0,0,0.12)';
            g.fillRect(px, py + 3, TILE, 2);
          }
          if (b.tile(x - 1, y) !== 0) {
            g.fillStyle = 'rgba(0,0,0,0.12)';
            g.fillRect(px, py, 2, TILE);
          }
        }
      }
    }
  }

  drawFlame(g, x, y, kind, frac, board) {
    const px = x * TILE, py = y * TILE;
    const life = 1 - frac;
    const s = life < 0.12 ? life / 0.12 : frac < 0.45 ? frac / 0.45 : 1;
    const wob = ((Math.floor(this.time * 24) + x * 3 + y * 5) % 3) - 1;
    const base = Math.max(1, Math.round(1.5 + s * 5.5));
    const axis = (h, a0, a1, w) => {
      if (w <= 0 || a1 <= a0) return;
      if (h) g.fillRect(px + a0, py + 8 - w, a1 - a0, w * 2);
      else g.fillRect(px + 8 - w, py + a0, w * 2, a1 - a0);
    };
    for (const [dw, col] of FLAME_LAYERS) {
      const w = base + dw + (dw === 0 ? (wob > 0 ? 1 : 0) : 0);
      if (w <= 0) continue;
      g.fillStyle = col;
      switch (kind) {
        case F_H: axis(true, 0, 16, w); break;
        case F_V: axis(false, 0, 16, w); break;
        case F_END_L: axis(true, 3, 16, w); axis(true, 2, 3, w - 1); axis(true, 1, 2, w - 2); break;
        case F_END_R: axis(true, 0, 13, w); axis(true, 13, 14, w - 1); axis(true, 14, 15, w - 2); break;
        case F_END_U: axis(false, 3, 16, w); axis(false, 2, 3, w - 1); axis(false, 1, 2, w - 2); break;
        case F_END_D: axis(false, 0, 13, w); axis(false, 13, 14, w - 1); axis(false, 14, 15, w - 2); break;
        case F_CENTER:
        default: {
          const r = Math.min(8, w + 1);
          g.fillRect(px + 8 - r, py + 8 - r + 1, r * 2, r * 2 - 2);
          g.fillRect(px + 8 - r + 1, py + 8 - r, r * 2 - 2, r * 2);
          if (board.hasFlame(x - 1, y)) axis(true, 0, 8, w);
          if (board.hasFlame(x + 1, y)) axis(true, 8, 16, w);
          if (board.hasFlame(x, y - 1)) axis(false, 0, 8, w);
          if (board.hasFlame(x, y + 1)) axis(false, 8, 16, w);
        }
      }
    }
  }

  drawPlayer(g, p, game, marker) {
    const frames = bomberFrames(p.style);
    let sx = Math.round((p.x - 0.5) * TILE);
    let sy = Math.round((p.y - 0.5) * TILE) - 4;
    if (!p.alive) {
      const t = game.time - p.deathTime;
      if (t > 1.1 || t < 0) return;
      if (t < 0.6) {
        const spr = Math.floor(t * 16) % 2 ? frames.flash : frames.down[0];
        g.drawImage(spr, sx - 1, sy - 1);
      } else {
        const k = 1 - (t - 0.6) / 0.5;
        const h = Math.max(1, Math.round(18 * k));
        g.globalAlpha = Math.max(0, k);
        g.drawImage(frames.flash, 0, 0, 18, 18, sx - 1 - Math.round((1 - k) * 4), sy - 1 + (18 - h), 18 + Math.round((1 - k) * 8), h);
        g.globalAlpha = 1;
      }
      return;
    }
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(sx + 3, sy + 18, 10, 2);
    g.fillRect(sx + 4, sy + 17, 8, 4);
    const frame = p.moving ? Math.floor(p.anim * 9) % 4 : 0;
    const set = frames[p.dir] || frames.down;
    g.drawImage(set[frame], sx - 1, sy - 1);
    if (marker) {
      const style = PLAYER_STYLES[p.style % PLAYER_STYLES.length];
      const bob = Math.round(Math.sin(this.time * 6));
      g.fillStyle = '#140c1e';
      g.fillRect(sx + 4, sy - 7 + bob, 9, 3);
      g.fillRect(sx + 6, sy - 4 + bob, 5, 2);
      g.fillStyle = style.hud;
      g.fillRect(sx + 5, sy - 7 + bob, 7, 2);
      g.fillRect(sx + 7, sy - 5 + bob, 3, 2);
    }
  }

  render(game, dt, opts = {}) {
    this.time += dt;
    this.themeKey = game.theme;
    const ctx = this.ctx;
    const g = this.lg;
    const board = game.board;
    const th = THEMES[game.theme] || THEMES.grass;

    const key = game.theme + ':' + board.version;
    if (key !== this.statKey) {
      this.buildStatic(game);
      this.statKey = key;
    }
    g.drawImage(this.stat, 0, 0);

    const spr = sprites();
    const tiles = themeTiles(game.theme);
    drawFeatures(g, board, this.time);
    if (game.monsters) drawDoor(g, game, this.time);

    // items & burning bricks
    for (let y = 0; y < board.h; y++) {
      for (let x = 0; x < board.w; x++) {
        const i = board.idx(x, y);
        const it = board.items[i];
        if (it && spr.items[it]) {
          const bob = Math.floor(this.time * 3 + x + y) % 2;
          g.drawImage(spr.items[it], x * TILE, y * TILE - bob);
        }
        if (board.burning[i] > 0) {
          const f = Math.min(3, Math.floor((1 - board.burning[i] / BRICK_BURN_TIME) * 4));
          g.drawImage(tiles.floors[(x + y) % 2][0], x * TILE, y * TILE);
          g.drawImage(tiles.burn[f], x * TILE, y * TILE);
        }
      }
    }

    // bombs
    for (const b of game.bombs) {
      let bx = b.x, by = b.y;
      if (b.slideDir) { const d = DIRS[b.slideDir]; bx += d.x * b.slideOff; by += d.y * b.slideOff; }
      const px = Math.round(bx * TILE), py = Math.round(by * TILE);
      const speed = b.timer < 0.7 && !b.remote ? 18 : 7;
      const f = [0, 1, 2, 1][Math.floor(b.age * speed) % 4];
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(px + 3, py + 13, 10, 2);
      g.drawImage((b.remote ? spr.remoteBomb : spr.bomb)[f], px, py);
      const spark = Math.floor(this.time * 20) % 2;
      if (b.remote) {
        g.fillStyle = spark ? '#ff3030' : '#601010';
        g.fillRect(px + 9, py + 1, 2, 1);
      } else {
        g.fillStyle = spark ? '#ffffff' : '#ffd23a';
        g.fillRect(px + 10, py + (spark ? 0 : 1), 1, 1);
        g.fillStyle = '#ff8a1f';
        g.fillRect(px + 9 + spark, py, 1, 1);
      }
    }

    if (game.meteors && game.meteors.length) drawMeteors(g, game, this.time);

    // flames
    for (let y = 0; y < board.h; y++) {
      for (let x = 0; x < board.w; x++) {
        const i = board.idx(x, y);
        if (board.flames[i] > 0) this.drawFlame(g, x, y, board.flameKind[i], board.flames[i] / FLAME_TIME, board);
      }
    }

    // players (sorted by y for overlap)
    const order = game.players.slice().sort((a, b) => a.y - b.y);
    for (const p of order) {
      if (p.alive && p.invuln > 0 && Math.floor(this.time * 20) % 2) g.globalAlpha = 0.35;
      this.drawPlayer(g, p, game, opts.markers && opts.markers.includes(p.id));
      g.globalAlpha = 1;
      drawPlayerAura(g, p, this.time);
    }
    if (game.monsters && game.monsters.length) drawMonsters(g, game, this.time);
    if (game.boss) drawBoss(g, game, this.time);

    this.particles.update(dt);
    this.particles.draw(g);
    if (game.darkness > 0) drawDarkness(g, game, Math.min(1, game.darkness));

    // ---- compose to screen
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawBackdrop(ctx, th);

    let ox = 0, oy = 0;
    if (this.shakeEnabled && this.shake > 0.05) {
      ox = (Math.random() * 2 - 1) * this.shake * this.rect.s * 0.5;
      oy = (Math.random() * 2 - 1) * this.shake * this.rect.s * 0.5;
    }
    this.shake *= Math.exp(-dt * 9);
    const R = this.rect;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(R.x + R.s * 3, R.y + R.s * 4, R.w, R.h);
    ctx.drawImage(this.low, Math.round(R.x + ox), Math.round(R.y + oy), R.w, R.h);

    // glow
    ctx.globalCompositeOperation = 'lighter';
    this.glows = this.glows.filter((gl) => (gl.t += dt) < gl.life);
    for (const gl of this.glows) {
      const k = 1 - gl.t / gl.life;
      const [sx, sy] = this.toScreen(gl.x, gl.y);
      const r = gl.r * R.s;
      const grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      grd.addColorStop(0, `rgba(255,200,90,${0.45 * k})`);
      grd.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,250,220,${this.flash})`;
      ctx.fillRect(R.x, R.y, R.w, R.h);
      this.flash = Math.max(0, this.flash - dt * 1.2);
    }

    this.drawTexts(ctx, game, dt, opts);
  }

  drawBackdrop(ctx, th) {
    // subtle retro stripes behind the arena
    const W = this.canvas.width, H = this.canvas.height;
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    const step = Math.max(8, Math.round(12 * this.dpr));
    const off = (this.time * 10 * this.dpr) % (step * 2);
    for (let y = -step * 2 + off; y < H; y += step * 2) ctx.fillRect(0, y, W, step);
  }

  text(ctx, str, x, y, size, color, align = 'center') {
    ctx.font = `${Math.round(size)}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const o = Math.max(2, Math.round(size / 8));
    ctx.fillStyle = '#140c1e';
    ctx.fillText(str, x + o, y + o);
    ctx.fillText(str, x - o * 0.5, y);
    ctx.fillText(str, x + o * 0.5, y - o * 0.5);
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  drawTexts(ctx, game, dt, opts) {
    const R = this.rect;
    this.popups = this.popups.filter((p) => (p.t += dt) < p.life);
    for (const p of this.popups) {
      const [sx, sy] = this.toScreen(p.x, p.y - p.t * 14);
      const size = (p.small ? 5 : 8) * R.s;
      ctx.globalAlpha = p.t > p.life * 0.7 ? (p.life - p.t) / (p.life * 0.3) : 1;
      this.text(ctx, p.text, sx, sy, size, p.color);
      ctx.globalAlpha = 1;
    }
    const cxs = R.x + R.w / 2, cys = R.y + R.h / 2;
    if (game.state === 'countdown') {
      const n = Math.ceil(game.countdown);
      const k = game.countdown - Math.floor(game.countdown);
      this.text(ctx, String(n), cxs, cys, (26 + k * 14) * R.s, '#ffe14a');
      if (opts.subtitle) this.text(ctx, opts.subtitle, cxs, cys + 34 * R.s, 7 * R.s, '#ffffff');
    }
    if (this.banner) {
      const b = this.banner;
      b.t += dt;
      if (b.t > b.life) this.banner = null;
      else {
        const pop = Math.min(1, b.t * 6);
        const size = (b.big ? 22 : 12) * R.s * (0.6 + 0.4 * pop);
        ctx.globalAlpha = b.t > b.life - 0.3 ? (b.life - b.t) / 0.3 : 1;
        if (Math.floor(b.t * 6) % 2 === 0 || b.big) this.text(ctx, b.text, cxs, cys, size, b.color);
        ctx.globalAlpha = 1;
      }
    }
    if (opts.overlayText) this.text(ctx, opts.overlayText, cxs, cys, 10 * R.s, '#ffffff');
    if (game.boss && game.boss.alive) this.drawBossBar(ctx, game.boss);
  }

  drawBossBar(ctx, boss) {
    const R = this.rect;
    const w = Math.round(R.w * 0.46), h = Math.max(4, Math.round(5 * R.s));
    const x = Math.round(R.x + (R.w - w) / 2), y = Math.round(R.y + 9 * R.s);
    ctx.fillStyle = '#140c1e';
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    ctx.fillStyle = '#3a1020';
    ctx.fillRect(x, y, w, h);
    const k = boss.hp / boss.maxHp;
    ctx.fillStyle = boss.hurt > 0 && Math.floor(this.time * 16) % 2 ? '#ffffff' : k > 0.5 ? '#ff4a4a' : k > 0.25 ? '#ff8a1f' : '#ffe14a';
    ctx.fillRect(x, y, Math.round(w * k), h);
    for (let i = 1; i < boss.maxHp; i++) {
      ctx.fillStyle = 'rgba(20,12,30,0.6)';
      ctx.fillRect(x + Math.round((w * i) / boss.maxHp), y, Math.max(1, Math.round(R.s / 2)), h);
    }
    this.text(ctx, boss.name, x + w / 2, y - 5 * R.s, 5 * R.s, '#ffffff');
  }
}

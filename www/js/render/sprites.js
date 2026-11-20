// Procedurally generated pixel-art. Everything is drawn in code at 16x16 so the
// game ships with zero external image assets.
import { PLAYER_STYLES } from '../config.js';
import { THEMES } from '../game/maps.js';
import { POWERUPS } from '../game/powerups.js';

const OUTLINE = '#140c1e';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}

export function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function outline(c, color = OUTLINE) {
  const g = c.getContext('2d');
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const w = c.width, h = c.height;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const mark = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1)) mark.push(x, y);
    }
  }
  g.fillStyle = color;
  for (let k = 0; k < mark.length; k += 2) g.fillRect(mark[k], mark[k + 1], 1, 1);
}

function flipped(src) {
  const [c, g] = makeCanvas(src.width, src.height);
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

function silhouette(src, color) {
  const [c, g] = makeCanvas(src.width, src.height);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

function bitmap(g, rows, palette, ox, oy) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const col = palette[row[x]];
      if (col) { g.fillStyle = col; g.fillRect(ox + x, oy + y, 1, 1); }
    }
  });
}

// ---------------------------------------------------------------- tiles

function floorTile(th, dark, variant) {
  const [c, g] = makeCanvas(16, 16);
  g.fillStyle = dark ? th.floorB : th.floorA;
  g.fillRect(0, 0, 16, 16);
  const dot = th.floorDot;
  const r = (k) => hash(variant, k, dark ? 7 : 3);
  g.fillStyle = dot;
  switch (th.pattern) {
    case 'grass':
      for (let k = 0; k < 4; k++) {
        const x = Math.floor(r(k) * 14) + 1, y = Math.floor(r(k + 9) * 13) + 2;
        g.fillRect(x, y, 1, 2);
        g.fillRect(x + 1, y + 1, 1, 1);
      }
      break;
    case 'sand':
      for (let k = 0; k < 6; k++) g.fillRect(Math.floor(r(k) * 16), Math.floor(r(k + 20) * 16), 1, 1);
      break;
    case 'ice':
      if (variant % 2 === 0) for (let k = 0; k < 5; k++) g.fillRect(3 + k, 10 - k, 1, 1);
      g.fillRect(Math.floor(r(1) * 14), Math.floor(r(2) * 14), 1, 1);
      break;
    case 'metal':
      g.fillStyle = th.shadow;
      g.fillRect(0, 15, 16, 1);
      g.fillRect(15, 0, 1, 16);
      g.fillStyle = dot;
      g.fillRect(0, 0, 16, 1);
      g.fillRect(0, 0, 1, 16);
      g.fillRect(2, 2, 1, 1); g.fillRect(13, 2, 1, 1); g.fillRect(2, 13, 1, 1); g.fillRect(13, 13, 1, 1);
      break;
    case 'flowers':
      if (r(5) < 0.35) {
        const x = 3 + Math.floor(r(6) * 9), y = 3 + Math.floor(r(7) * 9);
        g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3);
        g.fillStyle = '#ffe14a'; g.fillRect(x, y, 1, 1);
      } else {
        g.fillStyle = th.shadow;
        g.fillRect(Math.floor(r(8) * 15), Math.floor(r(9) * 15), 1, 2);
      }
      break;
    case 'grid':
      g.fillRect(0, 0, 16, 1);
      g.fillRect(0, 0, 1, 16);
      if (r(3) < 0.3) { g.fillStyle = '#5a46b8'; g.fillRect(7, 7, 2, 2); }
      break;
    default:
  }
  return c;
}

function wallTile(th) {
  const [c, g] = makeCanvas(16, 16);
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  P(0, 0, 16, 16, th.wallSide);
  P(0, 0, 16, 12, th.wallTop);
  P(0, 0, 16, 1, th.wallHi);
  P(0, 0, 1, 12, th.wallHi);
  P(15, 0, 1, 12, th.wallSide);
  P(3, 3, 10, 1, th.wallSide);
  P(3, 3, 1, 6, th.wallSide);
  P(4, 8, 9, 1, th.wallHi);
  P(12, 4, 1, 5, th.wallHi);
  P(0, 12, 16, 1, th.wallDark);
  P(0, 15, 16, 1, th.wallDark);
  P(5, 13, 1, 2, th.wallDark);
  P(11, 13, 1, 2, th.wallDark);
  return c;
}

function brickTile(th) {
  const [c, g] = makeCanvas(16, 16);
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  P(0, 0, 16, 16, th.brickSide);
  P(0, 0, 16, 12, th.brick);
  // mortar
  P(0, 3, 16, 1, th.brickDark);
  P(0, 7, 16, 1, th.brickDark);
  P(0, 11, 16, 1, th.brickDark);
  for (const [x, y] of [[7, 0], [15, 0], [3, 4], [11, 4], [7, 8], [15, 8]]) P(x, y, 1, 3, th.brickDark);
  // highlights
  for (const [x, y, w] of [[0, 0, 6], [8, 0, 6], [0, 4, 2], [4, 4, 6], [12, 4, 3], [0, 8, 6], [8, 8, 6]]) P(x, y, w, 1, th.brickHi);
  P(0, 12, 16, 1, th.brickDark);
  P(0, 15, 16, 1, th.brickDark);
  P(4, 13, 1, 2, th.brickDark);
  P(10, 13, 1, 2, th.brickDark);
  return c;
}

function burnFrames(brick) {
  const frames = [];
  const fire = ['#fff3a0', '#ffd23a', '#ff8a1f', '#e33b1a'];
  for (let f = 0; f < 4; f++) {
    const [c, g] = makeCanvas(16, 16);
    g.drawImage(brick, 0, 0);
    if (f >= 2) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = f === 2 ? 'rgba(40,20,10,0.55)' : 'rgba(20,10,5,0.8)';
      g.fillRect(0, 0, 16, 16);
      g.globalCompositeOperation = 'source-over';
    }
    const density = [0.25, 0.45, 0.35, 0.2][f];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const h = hash(x, y, f + 11);
        if (f >= 2 && h < [0, 0, 0.25, 0.55][f]) { g.clearRect(x, y, 1, 1); continue; }
        if (hash(y, x, f + 3) < density) {
          g.fillStyle = fire[Math.floor(hash(x, y, f) * 4)];
          g.fillRect(x, y, 1, 1);
        }
      }
    }
    frames.push(c);
  }
  return frames;
}

const themeCache = new Map();
export function themeTiles(key) {
  if (themeCache.has(key)) return themeCache.get(key);
  const th = THEMES[key] || THEMES.grass;
  const brick = brickTile(th);
  const set = {
    th,
    floors: [[0, 1, 2, 3].map((v) => floorTile(th, false, v)), [0, 1, 2, 3].map((v) => floorTile(th, true, v))],
    wall: wallTile(th),
    brick,
    burn: burnFrames(brick),
  };
  themeCache.set(key, set);
  return set;
}

// ---------------------------------------------------------------- bombs

function bombSprite(radius, remote) {
  const [c, g] = makeCanvas(16, 16);
  const cx = 8, cy = 9.5;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= radius) {
        let col = '#24243a';
        if (dx + dy > radius * 0.6) col = '#141422';
        if (dx + dy < -radius * 0.5) col = '#3e3e62';
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  if (remote) {
    g.fillStyle = '#e8343a';
    g.fillRect(3, 9, 10, 2);
    g.fillStyle = '#ff9aa0';
    g.fillRect(4, 9, 3, 1);
  }
  g.fillStyle = '#ffffff';
  g.fillRect(5, 6, 2, 1);
  g.fillRect(5, 7, 1, 1);
  g.fillStyle = '#9a7a4a';
  g.fillRect(7, 2, 3, 2);
  g.fillStyle = '#5e4628';
  g.fillRect(9, 1, 1, 1);
  outline(c);
  return c;
}

// ---------------------------------------------------------------- items

const ICONS = {
  bomb: [
    '......o...',
    '.....o.o..',
    '....kk....',
    '..kkkkkk..',
    '.kkwkkkkk.',
    '.kwkkkkkk.',
    '.kkkkkkkk.',
    '.kkkkkkkk.',
    '..kkkkkk..',
    '...kkkk...',
  ],
  fire: [
    '....r.....',
    '....rr....',
    '...rrr.r..',
    '..rroorr..',
    '..rooyorr.',
    '.rroyyyor.',
    '.royywyor.',
    '.roywwyor.',
    '..royyor..',
    '...rrrr...',
  ],
  speed: [
    '.....yyyy.',
    '....yyyy..',
    '...yyyy...',
    '..yyyy....',
    '.yyyyyyy..',
    '....yyyy..',
    '...yyyy...',
    '..yyy.....',
    '.yy.......',
    'y.........',
  ],
  kick: [
    '..bbbb....',
    '..bbbb....',
    '..bhbb....',
    '..bbbb....',
    '..bbbbb...',
    '..bbbbbbb.',
    '.bbbbbbbbb',
    '.bhhhhhbbb',
    '.kkkkkkkkk',
    '..........',
  ],
  remote: [
    '.......r..',
    '......k...',
    '.....k....',
    '.kkkkkkkk.',
    '.kggggggk.',
    '.kgrrrrgk.',
    '.kgrwrrgk.',
    '.kggggggk.',
    '.kkkkkkkk.',
    '..........',
  ],
};
ICONS.shield = [
  'kkkkkkkkkk',
  'kwwwccccck',
  'kwwwccccck',
  'kwwwccccck',
  'kcccwwwwwk',
  '.kccwwwwk.',
  '.kccwwwwk.',
  '..kcwwwk..',
  '...kcwk...',
  '....kk....',
];
ICONS.pierce = [
  '......wwww',
  '.......www',
  '......wyww',
  '.....yy..w',
  '....yy....',
  '...oo.....',
  '..oo......',
  '.rr.......',
  'rr........',
  'r.........',
];
ICONS.fullfire = [
  '.y..y..y..',
  '.yyyyyyy..',
  '....r.....',
  '...rrr.r..',
  '..rroorr..',
  '.rroyyyor.',
  '.royywyor.',
  '.roywwyor.',
  '..royyor..',
  '...rrrr...',
];
ICONS.skull = [
  '..wwwwww..',
  '.wwwwwwww.',
  'wwwwwwwwww',
  'wwkkwwkkww',
  'wwkkwwkkww',
  'wwwwkkwwww',
  '.wwwwwwww.',
  '..wkwkwkw.',
  '..wwwwww..',
  '..........',
];

const ICON_PAL = {
  c: '#7cf2ff',
  k: '#1a1a26', w: '#ffffff', o: '#ff9a2a', y: '#ffe14a', r: '#ff3b2b',
  b: '#a0582e', h: '#d48a52', g: '#a8aec0',
};

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  const r = f(n >> 16), gg = f((n >> 8) & 255), b = f(n & 255);
  return `rgb(${r},${gg},${b})`;
}

function itemSprite(id) {
  const [c, g] = makeCanvas(16, 16);
  const col = POWERUPS[id].color;
  g.fillStyle = shade(col, -0.25);
  g.fillRect(1, 2, 14, 13);
  g.fillRect(2, 1, 12, 15);
  g.fillStyle = col;
  g.fillRect(2, 2, 12, 11);
  g.fillStyle = shade(col, 0.25);
  g.fillRect(2, 2, 12, 1);
  g.fillRect(2, 2, 1, 10);
  bitmap(g, ICONS[id] || ICONS.bomb, ICON_PAL, 3, 2);
  outline(c);
  return c;
}

// ---------------------------------------------------------------- bombers

function drawBomber(style, dir, frame) {
  const [c, g] = makeCanvas(18, 18);
  g.translate(1, 1);
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const { body, shade: sh, accent } = style;
  const feet = '#2b2238';
  const visor = '#221a38';
  const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const side = dir === 'right';

  // feet
  if (!side) {
    P(4, 14 - (step > 0 ? 1 : 0), 3, 2, feet);
    P(9, 14 - (step < 0 ? 1 : 0), 3, 2, feet);
  } else {
    P(5 + step, 14, 3, 2, '#1c1628');
    P(8 - step, 14, 4, 2, feet);
  }
  // torso
  P(5, 10, 6, 4, body);
  P(4, 11, 8, 2, body);
  P(5, 13, 6, 1, sh);
  P(10, 10, 1, 3, sh);
  if (dir === 'down') { P(5, 12, 6, 1, sh); P(7, 12, 2, 1, accent); }
  // hands
  if (!side) {
    P(2, 10 + (step > 0 ? 1 : 0), 2, 2, accent);
    P(12, 10 + (step < 0 ? 1 : 0), 2, 2, accent);
  } else {
    P(7 + step * 2, 11, 2, 2, accent);
  }
  // head
  for (let y = 1; y < 12; y++) {
    for (let x = 2; x < 14; x++) {
      const dx = x + 0.5 - 8, dy = y + 0.5 - 6;
      if (dx * dx + dy * dy <= 4.8 * 4.8) {
        P(x, y, 1, 1, dx + dy * 0.6 > 3.2 ? sh : body);
      }
    }
  }
  P(5, 3, 2, 1, '#ffffff');
  P(4, 4, 1, 1, '#ffffff');
  // antenna
  P(8, 0, 1, 1, feet);
  P(7, -1, 2, 1, accent);
  // face
  if (dir === 'down') {
    P(5, 5, 6, 4, visor);
    P(4, 6, 8, 2, visor);
    P(6, 6, 1, 2, '#ffffff');
    P(9, 6, 1, 2, '#ffffff');
    P(7, 8, 2, 1, '#ff7aa2');
  } else if (side) {
    P(8, 5, 5, 4, visor);
    P(7, 6, 6, 2, visor);
    P(10, 6, 1, 2, '#ffffff');
    P(12, 6, 1, 1, '#ffffff');
    P(11, 8, 1, 1, '#ff7aa2');
  } else {
    P(7, 3, 2, 6, sh);
    P(5, 9, 6, 1, sh);
  }
  outline(c);
  return c;
}

const bomberCache = new Map();
export function bomberFrames(styleIndex) {
  if (bomberCache.has(styleIndex)) return bomberCache.get(styleIndex);
  const style = PLAYER_STYLES[styleIndex % PLAYER_STYLES.length];
  const set = {};
  for (const dir of ['down', 'up', 'right']) {
    set[dir] = [0, 1, 2, 3].map((f) => drawBomber(style, dir, f));
  }
  set.left = set.right.map(flipped);
  set.flash = silhouette(set.down[0], '#ffffff');
  bomberCache.set(styleIndex, set);
  return set;
}

// ---------------------------------------------------------------- monsters

function drawMonster(type, frame) {
  const [c, g] = makeCanvas(18, 18);
  g.translate(1, 1);
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const disc = (cx, cy, rx, ry, col, shadeCol) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) P(x, y, 1, 1, shadeCol && dx + dy > 0.7 ? shadeCol : col);
      }
    }
  };
  const eyes = (y, dx = 0) => {
    P(5 + dx, y, 2, 3, '#ffffff'); P(9 + dx, y, 2, 3, '#ffffff');
    P(6 + dx, y + 1, 1, 2, '#140c1e'); P(10 + dx, y + 1, 1, 2, '#140c1e');
  };
  switch (type) {
    case 'balloon':
      disc(8, 7, frame ? 6.4 : 6, frame ? 5.6 : 6, '#ff8a3d', '#c8501a');
      P(5, 3, 2, 1, '#ffd0a0');
      eyes(5);
      P(7, 9, 3, 1, '#7a2a10');
      P(8, 13, 1, 1, '#ffffff'); P(frame ? 9 : 7, 14, 1, 1, '#ffffff');
      break;
    case 'drop':
      disc(8, 10, 5, 4.8, '#3fa0ff', '#1f5ec8');
      for (let y = 2; y < 7; y++) { const w = Math.max(1, (y - 2) * 2 - 1); P(8 - Math.floor(w / 2), y, w, 1, '#3fa0ff'); }
      P(6, 5, 1, 2, '#bfe6ff');
      eyes(8, frame ? 1 : 0);
      break;
    case 'eye':
      disc(8, 7, 6, 6, '#f4f4ff', '#b8b8d8');
      disc(8 + (frame ? 1 : -1), 7, 3, 3, '#e0302a');
      P(7 + (frame ? 1 : -1), 6, 2, 2, '#140c1e');
      P(4, 13, 2, 2, '#6a3a8a'); P(10, 13, 2, 2, '#6a3a8a');
      P(frame ? 3 : 4, 14, 1, 1, '#6a3a8a'); P(frame ? 12 : 11, 14, 1, 1, '#6a3a8a');
      break;
    case 'ghost':
      disc(8, 7, 6, 6, '#e8e8ff');
      P(2, 7, 12, 6, '#e8e8ff');
      for (let x = 2; x < 14; x += 2) P(x + (frame ? 1 : 0), 13, 1, 2, '#e8e8ff');
      P(5, 5, 2, 3, '#2a2050'); P(9, 5, 2, 3, '#2a2050');
      P(7, 9, 2, 2, '#2a2050');
      break;
    case 'spark':
    default: {
      const rot = frame ? Math.PI / 8 : 0;
      for (let k = 0; k < 8; k++) {
        const a = rot + (k * Math.PI) / 4;
        for (let r = 3; r < 7.5; r += 0.5) P(Math.round(8 + Math.cos(a) * r - 0.5), Math.round(8 + Math.sin(a) * r - 0.5), 1, 1, '#ffb020');
      }
      disc(8, 8, 4, 4, '#ffe14a');
      disc(8, 8, 2, 2, '#ffffff');
      P(6, 7, 1, 2, '#140c1e'); P(9, 7, 1, 2, '#140c1e');
    }
  }
  outline(c);
  return c;
}

const monsterCache = new Map();
export function monsterFrames(type) {
  if (!monsterCache.has(type)) monsterCache.set(type, [drawMonster(type, 0), drawMonster(type, 1)]);
  return monsterCache.get(type);
}

// ---------------------------------------------------------------- bosses (32x32)

function drawBoss(type, frame) {
  const [c, g] = makeCanvas(34, 34);
  g.translate(1, 1);
  const P = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const disc = (cx, cy, rx, ry, col, shadeCol, hiCol) => {
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        let col2 = col;
        if (shadeCol && dx + dy > 0.75) col2 = shadeCol;
        if (hiCol && dx + dy < -0.9) col2 = hiCol;
        P(x, y, 1, 1, col2);
      }
    }
  };
  const f = frame ? 1 : 0;
  switch (type) {
    case 'king': {
      disc(16, 17, 13, 12 - f, '#ff8a3d', '#c8501a', '#ffc08a');
      // crown
      P(9, 2 + f, 14, 4, '#ffd23a');
      for (const x of [9, 14, 19]) P(x, 0 + f, 3, 3, '#ffd23a');
      P(10, 3 + f, 2, 2, '#e8343a'); P(15, 3 + f, 2, 2, '#3f86ff'); P(20, 3 + f, 2, 2, '#45cf5c');
      P(9, 5 + f, 14, 1, '#b8860b');
      // angry face
      P(9, 12, 5, 5, '#ffffff'); P(18, 12, 5, 5, '#ffffff');
      P(11, 14, 2, 3, '#140c1e'); P(19, 14, 2, 3, '#140c1e');
      P(8, 10, 6, 2, '#7a2a10'); P(18, 10, 6, 2, '#7a2a10');
      P(12, 21, 8, 2, '#7a2a10'); P(13, 23, 6, 1, '#ff5a7a');
      // string
      P(16, 29, 1, 2, '#ffffff'); P(f ? 17 : 15, 31, 1, 1, '#ffffff');
      break;
    }
    case 'scarab': {
      // legs
      for (const [y, k] of [[13, 0], [18, 1], [23, 0]]) {
        const o = (k + f) % 2 ? 1 : -1;
        P(2, y + o, 6, 2, '#16302c'); P(24, y - o, 6, 2, '#16302c');
      }
      disc(16, 19, 10, 11, '#2a9a86', '#16524a', '#7af0d0');
      P(15, 9, 2, 21, '#103a34');
      disc(16, 8, 6, 5, '#1c3a36', null, '#3e6a62');
      // mandibles
      P(9 + f, 1, 3, 5, '#d8c060'); P(20 - f, 1, 3, 5, '#d8c060');
      P(11 + f, 0, 2, 2, '#fff1a0'); P(19 - f, 0, 2, 2, '#fff1a0');
      P(12, 6, 3, 2, '#ff3b2b'); P(17, 6, 3, 2, '#ff3b2b');
      P(10, 14, 4, 2, '#9af8e0'); P(19, 18, 3, 2, '#9af8e0');
      break;
    }
    case 'golem': {
      P(6, 10 + f, 20, 16, '#9cd8f8');
      P(6, 22 + f, 20, 4, '#5a9ac8');
      P(9, 1, 14, 11, '#c8ecff');
      P(9, 9, 14, 3, '#7ab8e0');
      P(11, 4, 4, 3, '#2ad6ff'); P(17, 4, 4, 3, '#2ad6ff');
      P(12, 5, 2, 1, '#ffffff'); P(18, 5, 2, 1, '#ffffff');
      // crystals
      P(10, -1, 2, 3, '#ffffff'); P(15, -1, 2, 2, '#e8f8ff'); P(20, 0, 2, 2, '#ffffff');
      // arms
      P(0, 11 + (f ? 3 : 0), 6, 12, '#7ab8e0'); P(26, 11 + (f ? 0 : 3), 6, 12, '#7ab8e0');
      P(0, 20 + (f ? 3 : 0), 6, 3, '#4a88b8'); P(26, 20 + (f ? 0 : 3), 6, 3, '#4a88b8');
      // legs
      P(8, 26, 6, 5, '#5a9ac8'); P(18, 26, 6, 5, '#5a9ac8');
      P(11, 14 + f, 10, 2, '#ffffff'); P(13, 18 + f, 6, 1, '#d8f4ff');
      break;
    }
    case 'mecha': {
      const st = f ? 1 : -1;
      P(8 + st, 27, 6, 4, '#2b2238'); P(18 - st, 27, 6, 4, '#2b2238');
      P(8, 17, 16, 10, '#a8aec0'); P(6, 19, 20, 6, '#a8aec0');
      P(8, 25, 16, 2, '#5a6070');
      disc(16, 21, 3, 3, '#24243a'); P(17, 17, 1, 1, '#ffd23a');
      P(2, 18 + (f ? 1 : 0), 4, 5, '#e8343a'); P(26, 18 + (f ? 0 : 1), 4, 5, '#e8343a');
      disc(16, 10, 9, 9, '#c8cede', '#6a7080', '#ffffff');
      P(9, 8, 14, 5, '#1a0a14'); P(8, 9, 16, 3, '#1a0a14');
      P(11 + f * 6, 9, 5, 2, '#ff3b2b');
      P(16, 0, 1, 2, '#2b2238'); P(15, -1, 3, 1, '#e8343a');
      break;
    }
    case 'emperor':
    default: {
      // cape
      for (let y = 10; y < 32; y++) {
        const w = Math.min(15, 5 + Math.floor((y - 10) * 0.55));
        P(16 - w, y, w * 2, 1, y > 28 && (y + f) % 2 ? '#2e1050' : '#5a2a8a');
      }
      for (let y = 14; y < 32; y += 3) P(16 - 1, y, 2, 2, '#ffd23a');
      P(7 + f, 29, 3, 3, '#2e1050'); P(22 - f, 29, 3, 3, '#2e1050');
      disc(16, 9, 7, 7, '#1a0a2e', null, '#3a2a5a');
      P(11, 8, 3, 2, '#ffe14a'); P(18, 8, 3, 2, '#ffe14a');
      P(12, 8, 1, 1, '#ffffff'); P(19, 8, 1, 1, '#ffffff');
      // crown
      P(9, 1, 14, 3, '#ffd23a');
      for (const x of [9, 13, 18, 22]) P(x, -1, 1, 2, '#ffd23a');
      P(15, 0, 2, 2, '#c040ff');
      // hands with magic
      P(4, 16, 3, 3, '#1a0a2e'); P(25, 16, 3, 3, '#1a0a2e');
      P(4 - f, 13 - f, 2, 2, '#d070ff'); P(26 + f, 13 - f, 2, 2, '#d070ff');
    }
  }
  outline(c);
  return c;
}

const bossCache = new Map();
export function bossFrames(type) {
  if (!bossCache.has(type)) {
    const frames = [drawBoss(type, 0), drawBoss(type, 1)];
    frames.flash = silhouette(frames[0], '#ffffff');
    bossCache.set(type, frames);
  }
  return bossCache.get(type);
}

export function bossIconURL(type) {
  return bossFrames(type)[0].toDataURL();
}

// ---------------------------------------------------------------- shared bank

let bank = null;
export function sprites() {
  if (bank) return bank;
  bank = {
    bomb: [5.4, 5.9, 6.4].map((r) => bombSprite(r, false)),
    remoteBomb: [5.4, 5.9, 6.4].map((r) => bombSprite(r, true)),
    items: Object.fromEntries(Object.keys(POWERUPS).map((id) => [id, itemSprite(id)])),
  };
  return bank;
}

const iconUrlCache = {};
export function itemIconURL(id) {
  if (!iconUrlCache[id]) iconUrlCache[id] = sprites().items[id].toDataURL();
  return iconUrlCache[id];
}

export function bomberIconURL(style) {
  return bomberFrames(style).down[0].toDataURL();
}

// Input sources: on-screen touch controls and keyboard. Each local player reads
// one InputSource (dir + edge-triggered bomb / detonate presses).
import { audio } from '../audio/audio.js';

export class InputSource {
  constructor() {
    this.touchDir = null;
    this.keyDirs = [];
    this.bombQueued = false;
    this.detQueued = false;
  }
  get dir() { return this.touchDir || this.keyDirs[this.keyDirs.length - 1] || null; }
  consumeBomb() { const b = this.bombQueued; this.bombQueued = false; return b; }
  consumeDet() { const d = this.detQueued; this.detQueued = false; return d; }
  clear() { this.touchDir = null; this.keyDirs = []; this.bombQueued = false; this.detQueued = false; }
}

export const sources = [new InputSource(), new InputSource()];

// ------------------------------------------------------------ keyboard
// code -> [player index, action]; built from the (rebindable) settings
let KEYMAP = {};
let keyboardMerge = true; // single local player: both key sets -> source 0
let capture = null;       // settings screen waiting for a key press

export function setKeyBindings(keys) {
  KEYMAP = {};
  [keys.p1, keys.p2].forEach((set, pi) => {
    for (const [act, code] of Object.entries(set)) if (code) KEYMAP[code] = [pi, act];
  });
  if (KEYMAP.Enter && !KEYMAP.NumpadEnter) KEYMAP.NumpadEnter = KEYMAP.Enter;
}

// Next key press is reported to `fn(code)` instead of controlling the game.
export function captureNextKey(fn) { capture = fn; }

export function keyLabel(code) {
  if (!code) return '—';
  const names = {
    Space: 'SPACJA', Enter: 'ENTER', ShiftLeft: 'L-SHIFT', ShiftRight: 'P-SHIFT', ControlLeft: 'L-CTRL',
    ControlRight: 'P-CTRL', AltLeft: 'L-ALT', AltRight: 'P-ALT', ArrowUp: 'STRZ. GÓRA', ArrowDown: 'STRZ. DÓŁ',
    ArrowLeft: 'STRZ. LEWO', ArrowRight: 'STRZ. PRAWO', Tab: 'TAB', Backspace: 'BACKSPACE', CapsLock: 'CAPS',
    NumpadEnter: 'NUM ENTER',
  };
  if (names[code]) return names[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM ' + code.slice(6);
  return code.toUpperCase();
}

export function setKeyboardPlayers(n) { keyboardMerge = n < 2; }

window.addEventListener('keydown', (e) => {
  if (capture) {
    e.preventDefault();
    e.stopImmediatePropagation();
    const fn = capture;
    capture = null;
    fn(e.code === 'Escape' ? null : e.code);
    return;
  }
  const m = KEYMAP[e.code];
  if (!m) return;
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  e.preventDefault();
  const src = sources[keyboardMerge ? 0 : m[0]];
  const act = m[1];
  if (act === 'bomb') { if (!e.repeat) src.bombQueued = true; }
  else if (act === 'det') { if (!e.repeat) src.detQueued = true; }
  else if (!src.keyDirs.includes(act)) src.keyDirs.push(act);
});
window.addEventListener('keyup', (e) => {
  const m = KEYMAP[e.code];
  if (!m) return;
  for (const src of sources) src.keyDirs = src.keyDirs.filter((d) => d !== m[1]);
});
window.addEventListener('blur', () => sources.forEach((s) => { s.keyDirs = []; s.touchDir = null; }));

// ------------------------------------------------------------ touch
function el(tag, cls, parent) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (parent) parent.appendChild(e);
  return e;
}

function dirFromVector(dx, dy, dead, current) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (Math.max(ax, ay) < dead) return null;
  // small hysteresis keeps the current direction on near-diagonals
  const bias = 1.18;
  if (current === 'left' || current === 'right') { if (ax * bias >= ay) return dx > 0 ? 'right' : 'left'; }
  if (current === 'up' || current === 'down') { if (ay * bias >= ax) return dy > 0 ? 'down' : 'up'; }
  return ax > ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

// Builds one control set (pad + bomb + detonator) into `root`.
//   side: 'left' | 'right' - which edge the pad sits on
//   compact: dual-player layout (pad and bomb on the same edge)
function buildControlSet(root, src, opts) {
  const { padSide, bombSide, mode, size, sideWidth, compact } = opts;
  const set = el('div', 'ctl-set', root);
  const H = window.innerHeight;
  const padSizePx = Math.round(Math.min(sideWidth * 0.86, H * (compact ? 0.38 : 0.46)) * size);
  const bombSizePx = Math.round(Math.min(sideWidth * 0.6, H * (compact ? 0.2 : 0.3)) * size);
  const padBottom = Math.round(H * (compact ? 0.03 : 0.06));
  // in the duel layout the bomb button sits above the pad, below the HUD
  const compactBombBottom = padBottom + padSizePx + Math.round(H * 0.03);

  // pad zone covers the lower part of the side panel for forgiving touches
  const zone = el('div', 'pad-zone', set);
  zone.style[padSide] = '0px';
  zone.style.width = sideWidth + 'px';
  zone.style.bottom = '0px';
  zone.style.height = compact ? (compactBombBottom - 4) + 'px' : '78%';

  const pad = el('div', mode === 'joystick' ? 'joy' : 'dpad', zone);
  pad.style.width = pad.style.height = padSizePx + 'px';
  pad.style[padSide] = Math.round((sideWidth - padSizePx) / 2) + 'px';
  pad.style.bottom = padBottom + 'px';
  let knob = null;
  if (mode === 'joystick') knob = el('div', 'joy-knob', pad);
  else for (const d of ['up', 'down', 'left', 'right']) el('div', 'dpad-arm ' + d, pad);
  el('div', 'dpad-center', pad);

  let pid = null;
  let origin = null;
  const update = (e) => {
    const r = pad.getBoundingClientRect();
    const cx = origin ? origin.x : r.left + r.width / 2;
    const cy = origin ? origin.y : r.top + r.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const dir = dirFromVector(dx, dy, r.width * 0.1, src.touchDir);
    src.touchDir = dir;
    pad.dataset.dir = dir || '';
    if (knob) {
      const max = r.width * 0.32;
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, max / len);
      knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    }
  };
  zone.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    audio.unlock();
    pid = e.pointerId;
    try { zone.setPointerCapture(pid); } catch { /* pointer already gone */ }
    if (mode === 'joystick') {
      const zr = zone.getBoundingClientRect();
      origin = { x: e.clientX, y: e.clientY };
      pad.style.left = (e.clientX - zr.left - padSizePx / 2) + 'px';
      pad.style.right = 'auto';
      pad.style.bottom = (zr.bottom - e.clientY - padSizePx / 2) + 'px';
      pad.classList.add('active');
    }
    update(e);
  });
  zone.addEventListener('pointermove', (e) => { if (e.pointerId === pid) update(e); });
  const release = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    origin = null;
    src.touchDir = null;
    pad.dataset.dir = '';
    if (knob) knob.style.transform = '';
    pad.classList.remove('active');
  };
  zone.addEventListener('pointerup', release);
  zone.addEventListener('pointercancel', release);

  const bomb = el('button', 'btn-bomb', set);
  bomb.innerHTML = '<span>BOMBA</span>';
  bomb.style.width = bomb.style.height = bombSizePx + 'px';
  const bombInset = compact ? Math.round(sideWidth * 0.1) : Math.round((sideWidth - bombSizePx) / 2);
  bomb.style[bombSide] = bombInset + 'px';
  bomb.style.bottom = (compact ? compactBombBottom : Math.round(H * 0.1)) + 'px';

  const det = el('button', 'btn-det hidden', set);
  det.innerHTML = '<span>BUM!</span>';
  const detSize = Math.round(bombSizePx * (compact ? 0.75 : 0.62));
  det.style.width = det.style.height = detSize + 'px';
  if (compact) {
    det.style[bombSide] = (bombInset + bombSizePx + 10) + 'px';
    det.style.bottom = Math.round(compactBombBottom + (bombSizePx - detSize) / 2) + 'px';
  } else {
    det.style[bombSide] = Math.round(bombInset + bombSizePx * 0.55) + 'px';
    det.style.bottom = Math.round(H * 0.1 + bombSizePx * 1.05) + 'px';
  }

  const press = (btn, fn) => {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      audio.unlock();
      fn();
      btn.classList.add('pressed');
    });
    const up = () => btn.classList.remove('pressed');
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', up);
  };
  press(bomb, () => { src.bombQueued = true; });
  press(det, () => { src.detQueued = true; });
  return { set, det };
}

export class TouchControls {
  constructor(root) {
    this.root = root;
    this.sets = [];
  }

  // players: 1 (single local) or 2 (same-device duel)
  build(players, settings, sideWidth) {
    this.root.innerHTML = '';
    this.sets = [];
    const mode = settings.control;
    const size = settings.controlSize;
    this.root.style.opacity = settings.ctlOpacity ?? 1;
    if (players === 1) {
      const padSide = settings.swap ? 'right' : 'left';
      const bombSide = settings.swap ? 'left' : 'right';
      this.sets.push(buildControlSet(this.root, sources[0], { padSide, bombSide, mode, size, sideWidth, compact: false }));
    } else {
      this.sets.push(buildControlSet(this.root, sources[0], { padSide: 'left', bombSide: 'left', mode, size, sideWidth, compact: true }));
      this.sets.push(buildControlSet(this.root, sources[1], { padSide: 'right', bombSide: 'right', mode, size, sideWidth, compact: true }));
    }
    this.root.classList.remove('hidden');
  }

  setRemoteVisible(i, on) {
    const s = this.sets[i];
    if (s) s.det.classList.toggle('hidden', !on);
  }

  hide() {
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
    this.sets = [];
    sources.forEach((s) => s.clear());
  }
}

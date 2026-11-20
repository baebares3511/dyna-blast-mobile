// Persistent settings & statistics (localStorage; survives app restarts).
import { DEFAULT_KEYS } from '../config.js';
const KEY = 'dynablast-mobile.v1';

const DEFAULT_SETTINGS = {
  name: 'GRACZ',
  music: 0.6,
  musicStyle: 'original', // in-game music: 'original' | 'classical' | 'mixed'
  sfx: 0.8,
  control: 'dpad',      // 'dpad' | 'joystick'
  controlSize: 1,       // 0.8 | 1 | 1.2
  swap: false,          // bomb button on the left
  shake: true,
  fps: false,
  ctlOpacity: 1,
  character: 'bomber',   // player 1 (and online) character
  character2: 'ignis',   // player 2 on a shared screen
  keys: { p1: { ...DEFAULT_KEYS.p1 }, p2: { ...DEFAULT_KEYS.p2 } },
};

const DEFAULT_STATS = {
  rounds: 0, wins: 0, losses: 0, draws: 0,
  kills: 0, deaths: 0, bombs: 0, powerups: 0,
  bestChain: 1, playTime: 0, fastestWin: 0,
  onlineRounds: 0, onlineWins: 0,
  advBestStage: 0, advBestScore: 0, monsters: 0,
};

const DEFAULT_ADVENTURE = { difficulty: 'normal', unlocked: 1, completed: 0, top: [] };

const DEFAULT_SETUP = {
  bots: { bots: 3, difficulty: 'normal', map: 'random', wins: 3, events: true },
  local: { bots: 0, difficulty: 'normal', map: 'classic', wins: 3, events: true },
  online: { bots: 0, difficulty: 'normal', map: 'classic', wins: 3, events: true },
};

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      settings: {
        ...DEFAULT_SETTINGS,
        ...(raw.settings || {}),
        keys: {
          p1: { ...DEFAULT_KEYS.p1, ...(raw.settings?.keys?.p1 || {}) },
          p2: { ...DEFAULT_KEYS.p2, ...(raw.settings?.keys?.p2 || {}) },
        },
      },
      stats: { ...DEFAULT_STATS, ...(raw.stats || {}) },
      setup: {
        bots: { ...DEFAULT_SETUP.bots, ...(raw.setup?.bots || {}) },
        local: { ...DEFAULT_SETUP.local, ...(raw.setup?.local || {}) },
        online: { ...DEFAULT_SETUP.online, ...(raw.setup?.online || {}) },
      },
      adventure: { ...DEFAULT_ADVENTURE, ...(raw.adventure || {}) },
    };
  } catch {
    return { settings: { ...DEFAULT_SETTINGS }, stats: { ...DEFAULT_STATS }, setup: structuredClone(DEFAULT_SETUP), adventure: structuredClone(DEFAULT_ADVENTURE) };
  }
}

export const store = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* storage unavailable */ }
}

export function resetStats() {
  store.stats = { ...DEFAULT_STATS };
  save();
}

// Adventure ranking (top 8). Returns the position of the new entry or -1.
export function addHighScore(entry) {
  const a = store.adventure;
  const item = { ...entry, at: Date.now() };
  const list = (a.top || []).concat([item]);
  list.sort((x, y) => y.score - x.score || y.n - x.n);
  a.top = list.slice(0, 8);
  save();
  return a.top.indexOf(item);
}
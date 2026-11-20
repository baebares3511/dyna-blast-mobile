// Global gameplay constants. Tweak balance here.

export const TILE = 16;            // sprite size in virtual pixels
export const GRID_W = 15;
export const GRID_H = 13;
export const SIM_DT = 1 / 60;      // fixed simulation step

export const FUSE_TIME = 2.6;
export const FLAME_TIME = 0.6;
export const BRICK_BURN_TIME = 0.5;
export const CHAIN_DELAY = 0.08;   // delay between chained detonations (looks better than instant)
export const KICK_SPEED = 9;       // tiles / s

export const BASE_SPEED = 3.4;     // tiles / s
export const SPEED_STEP = 0.5;
export const MAX_SPEED_LEVEL = 5;
export const START_BOMBS = 1;
export const START_RANGE = 2;
export const MAX_BOMBS = 8;
export const MAX_RANGE = 8;

export const COUNTDOWN_TIME = 3;
export const HURRY_TIME = 120;     // after this, walls start closing in
export const HURRY_STEP = 0.2;
export const ROUND_END_DELAY = 1.8;

export const T_FLOOR = 0;
export const T_WALL = 1;
export const T_BRICK = 2;

// flame piece kinds (for rendering)
export const F_NONE = 0;
export const F_CENTER = 1;
export const F_H = 2;
export const F_V = 3;
export const F_END_L = 4;
export const F_END_R = 5;
export const F_END_U = 6;
export const F_END_D = 7;

export const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
export const DIR_NAMES = ['up', 'down', 'left', 'right'];

export const PLAYER_STYLES = [
  { name: 'Biały', body: '#f2f0f7', shade: '#a9a6c4', accent: '#ff5a7a', hud: '#ffffff' },
  { name: 'Czerwony', body: '#ff4b3e', shade: '#a8231d', accent: '#ffd23f', hud: '#ff6b5e' },
  { name: 'Niebieski', body: '#3f86ff', shade: '#1f4aa8', accent: '#7cf2ff', hud: '#6aa4ff' },
  { name: 'Zielony', body: '#45cf5c', shade: '#21813a', accent: '#fff07a', hud: '#6fe282' },
  { name: 'Żółty', body: '#ffd23a', shade: '#b8860b', accent: '#ff5a2a', hud: '#ffe14a' },
  { name: 'Fioletowy', body: '#a65cff', shade: '#5e2aa8', accent: '#7cf2ff', hud: '#c08aff' },
];

// Playable characters: each one has a single special trait (see Player.applyTrait).
export const CHARACTERS = [
  { id: 'bomber', name: 'BOMBER', style: 0, trait: '+1 BOMBA NA START' },
  { id: 'ignis', name: 'IGNIS', style: 1, trait: '+1 ZASIĘG OGNIA NA START' },
  { id: 'zefir', name: 'ZEFIR', style: 2, trait: 'SZYBSZY: +1 SPEED NA START' },
  { id: 'kopacz', name: 'KOPACZ', style: 3, trait: 'KOPIE BOMBY OD POCZĄTKU' },
  { id: 'bastion', name: 'BASTION', style: 4, trait: 'TARCZA NA START KAŻDEJ RUNDY' },
  { id: 'widmo', name: 'WIDMO', style: 5, trait: 'ODPORNY NA KLĄTWY CZASZKI' },
];
export const CHARACTER_IDS = CHARACTERS.map((c) => c.id);
export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
}

// curses (skull power-up)
export const CURSE_TIME = 10;
export const CURSES = {
  slow: 'ŚLIMAK',
  fast: 'NADPOBUDLIWOŚĆ',
  reverse: 'ODWRÓCONE STEROWANIE',
  diarrhea: 'BOMBOWA BIEGUNKA',
  constipation: 'ZATWARDZENIE (BRAK BOMB)',
  weak: 'SŁABY OGIEŃ',
  shortfuse: 'KRÓTKI LONT',
};
export const CURSE_IDS = Object.keys(CURSES);
export const SHIELD_INVULN = 1.5;

// arena features
export const FEAT_NONE = 0;
export const FEAT_TELE = 1;
export const FEAT_BELT_UP = 2;
export const FEAT_BELT_DOWN = 3;
export const FEAT_BELT_LEFT = 4;
export const FEAT_BELT_RIGHT = 5;
export const BELT_DIR = { 2: 'up', 3: 'down', 4: 'left', 5: 'right' };
export const BELT_SPEED = 1.7;

// random round events
export const EVENT_FIRST = 28;
export const EVENT_GAP = [22, 32];
export const METEOR_FUSE = 1.6;

// default keyboard bindings (KeyboardEvent.code), rebindable in settings
export const DEFAULT_KEYS = {
  p1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', bomb: 'Space', det: 'ShiftLeft' },
  p2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', bomb: 'Enter', det: 'ShiftRight' },
};
export const KEY_ACTIONS = { up: 'GÓRA', down: 'DÓŁ', left: 'LEWO', right: 'PRAWO', bomb: 'BOMBA', det: 'ZAPALNIK' };

export const DIFFICULTIES = ['easy', 'normal', 'hard'];
export const DIFFICULTY_LABELS = { easy: 'ŁATWY', normal: 'NORMALNY', hard: 'TRUDNY' };

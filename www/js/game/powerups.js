import {
  MAX_BOMBS, MAX_RANGE, MAX_SPEED_LEVEL, CURSE_IDS, CURSES, CURSE_TIME,
} from '../config.js';

// Power-up registry. To add a new power-up: add an entry here (unique one-letter
// `code` for network sync), give it an icon in render/sprites.js, done.
//   share - fraction of bricks that hide this item
//   min   - guaranteed minimum count per map
//   bad   - harmful item (bots avoid it)
//   apply(player) may return a custom pickup label
export const POWERUPS = {
  bomb: {
    code: 'b', label: '+1 BOMBA', share: 0.11, min: 2, color: '#3a64d8',
    apply: (p) => { p.maxBombs = Math.min(MAX_BOMBS, p.maxBombs + 1); },
  },
  fire: {
    code: 'f', label: 'ZASIĘG +1', share: 0.11, min: 2, color: '#d8452a',
    apply: (p) => { p.range = Math.min(MAX_RANGE, p.range + 1); },
  },
  speed: {
    code: 's', label: 'SPEED', share: 0.06, min: 1, color: '#7a3fd0',
    apply: (p) => { p.speedLevel = Math.min(MAX_SPEED_LEVEL, p.speedLevel + 1); },
  },
  kick: {
    code: 'k', label: 'KOPNIĘCIE BOMB', share: 0.035, min: 1, color: '#21a088',
    apply: (p) => { p.canKick = true; },
  },
  remote: {
    code: 'r', label: 'ZDALNY ZAPALNIK', share: 0.025, min: 1, color: '#c99a12',
    apply: (p) => { p.hasRemote = true; },
  },
  shield: {
    code: 'h', label: 'TARCZA', share: 0.025, min: 1, color: '#2fb6e0',
    apply: (p) => { p.shield = true; },
  },
  pierce: {
    code: 'p', label: 'PRZEBIJAJĄCY OGIEŃ', share: 0.018, min: 0, color: '#e0367a',
    apply: (p) => { p.pierce = true; },
  },
  fullfire: {
    code: 'F', label: 'MAKSYMALNY OGIEŃ', share: 0.012, min: 0, color: '#ff7a00',
    apply: (p) => { p.range = MAX_RANGE; },
  },
  skull: {
    code: 'x', label: 'KLĄTWA!', share: 0.03, min: 1, color: '#5a2a78', bad: true,
    apply: (p) => {
      if (p.curseImmune) return 'ODPORNOŚĆ NA KLĄTWĘ!';
      const type = CURSE_IDS[Math.floor(Math.random() * CURSE_IDS.length)];
      p.curse = { type, time: CURSE_TIME };
      return 'KLĄTWA: ' + CURSES[type];
    },
  },
};

export const POWERUP_IDS = Object.keys(POWERUPS);
export const CODE_TO_POWERUP = Object.fromEntries(POWERUP_IDS.map((id) => [POWERUPS[id].code, id]));

export function distributeItems(brickCount, rng, exclude = []) {
  const list = [];
  for (const id of POWERUP_IDS) {
    if (exclude.includes(id)) continue;
    const def = POWERUPS[id];
    const exact = brickCount * def.share;
    // fractional part becomes a chance, so rare items appear only sometimes
    const n = Math.max(def.min, Math.floor(exact) + (rng.chance(exact - Math.floor(exact)) ? 1 : 0));
    for (let i = 0; i < n; i++) list.push(id);
  }
  rng.shuffle(list);
  return list.slice(0, Math.floor(brickCount * 0.5));
}

export function applyPowerup(player, id) {
  const label = POWERUPS[id].apply(player);
  player.collected[id] = (player.collected[id] || 0) + 1;
  return label || POWERUPS[id].label;
}

export function randomGoodItem(rng) {
  const pool = ['bomb', 'bomb', 'fire', 'fire', 'speed', 'kick', 'remote', 'shield', 'pierce'];
  return pool[Math.floor(rng() * pool.length)];
}

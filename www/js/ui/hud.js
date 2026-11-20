// In-match HUD (DOM): player stats in the side panels, timer pill on top.
import { PLAYER_STYLES, CURSES } from '../config.js';
import { itemIconURL, bomberIconURL } from '../render/sprites.js';

function fmtTime(s) {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const FLAGS = ['kick', 'remote', 'shield', 'pierce'];

export class Hud {
  constructor(root) {
    this.root = root;
    this.left = root.querySelector('#hud-left');
    this.right = root.querySelector('#hud-right');
    this.timer = root.querySelector('#hud-timer');
    this.cache = new Map();
  }

  layout(side) {
    this.left.style.width = side + 'px';
    this.right.style.width = side + 'px';
  }

  setup(session) {
    const game = session.game;
    this.root.classList.remove('hidden');
    this.cache.clear();
    this.session = session;
    this.localIds = session.localIds;
    this.wins = session.wins;
    this.targetWins = session.cfg.targetWins || 1;
    const panels = [this.left, this.right];
    panels.forEach((p) => { p.innerHTML = ''; });
    this.localIds.slice(0, 2).forEach((id, k) => {
      panels[k].appendChild(this.playerPanel(game.players[id]));
    });
    if (game.adventure) this.right.appendChild(this.adventurePanel());
    else if (this.localIds.length < 2) this.right.appendChild(this.rivalPanel());
  }

  playerPanel(p) {
    const style = PLAYER_STYLES[p.style % PLAYER_STYLES.length];
    const d = document.createElement('div');
    d.className = 'hud-card';
    d.innerHTML = `
      <div class="hud-name"><img src="${bomberIconURL(p.style)}" alt=""><span style="color:${style.hud}">${p.name}</span></div>
      <div class="hud-stats">
        <span class="hs"><img src="${itemIconURL('bomb')}" alt=""><b data-k="bombs"></b></span>
        <span class="hs"><img src="${itemIconURL('fire')}" alt=""><b data-k="range"></b></span>
        <span class="hs"><img src="${itemIconURL('speed')}" alt=""><b data-k="speed"></b></span>
        ${FLAGS.map((f) => `<span class="hs pw" data-k="${f}"><img src="${itemIconURL(f)}" alt=""></span>`).join('')}
        <span class="hs status" data-k="status"></span>
      </div>`;
    d.dataset.pid = p.id;
    return d;
  }

  rivalPanel() {
    const d = document.createElement('div');
    d.className = 'hud-card rivals';
    d.innerHTML = '<div class="hud-label">RYWALE</div><div class="rival-list"></div>';
    return d;
  }

  adventurePanel() {
    const d = document.createElement('div');
    d.className = 'hud-card adventure';
    d.innerHTML = `
      <div class="adv-line"><span>ETAP</span><b data-a="stage"></b></div>
      <div class="adv-line"><span>ŻYCIA</span><b class="adv-hearts" data-a="lives"></b></div>
      <div class="adv-line"><span>PUNKTY</span><b data-a="score"></b></div>
      <div class="adv-line"><span>POTWORY</span><b data-a="monsters"></b></div>
      <div class="adv-line"><span data-a="doorLabel">WYJŚCIE</span><b data-a="door"></b></div>`;
    return d;
  }

  set(el, key, value, fn) {
    const k = el.dataset.pid + key;
    if (this.cache.get(k) === value) return;
    this.cache.set(k, value);
    fn(value);
  }

  update(game) {
    for (const card of this.root.querySelectorAll('.hud-card[data-pid]')) {
      const p = game.players[+card.dataset.pid];
      const q = (k) => card.querySelector(`[data-k="${k}"]`);
      this.set(card, 'b', `${p.maxBombs - p.activeBombs}/${p.maxBombs}`, (v) => { q('bombs').textContent = v; });
      this.set(card, 'r', p.curse && p.curse.type === 'weak' ? '1!' : String(p.range), (v) => { q('range').textContent = v; });
      this.set(card, 's', p.speedLevel, (v) => { q('speed').textContent = '+' + v; });
      this.set(card, 'k', p.canKick, (v) => q('kick').classList.toggle('on', v));
      this.set(card, 'rm', p.hasRemote, (v) => q('remote').classList.toggle('on', v));
      this.set(card, 'sh', p.shield, (v) => q('shield').classList.toggle('on', v));
      this.set(card, 'pi', p.pierce, (v) => q('pierce').classList.toggle('on', v));
      const status = p.curse ? `☠ ${CURSES[p.curse.type]} ${Math.ceil(p.curse.time)}s` : p.turbo ? 'TURBO!' : '';
      this.set(card, 'st', status, (v) => {
        const el = q('status');
        el.textContent = v;
        el.classList.toggle('bad', !!p.curse);
      });
      this.set(card, 'a', p.alive, (v) => card.classList.toggle('dead', !v));
    }
    const adv = this.root.querySelector('.hud-card.adventure');
    if (adv && this.session) {
      const s = this.session;
      const left = game.monsters.filter((m) => m.alive).length;
      const boss = game.boss;
      const door = boss ? (boss.alive ? `${boss.hp}/${boss.maxHp}` : 'POKONANY!') : game.board.doorHidden ? '???' : left ? 'ZAMKNIĘTE' : 'OTWARTE!';
      const key = [s.stageLabel, s.lives, s.totalScore, left, door].join('|');
      if (this.cache.get('adv') !== key) {
        this.cache.set('adv', key);
        adv.querySelector('[data-a="stage"]').textContent = s.stageLabel;
        adv.querySelector('[data-a="doorLabel"]').textContent = boss ? 'BOSS' : 'WYJŚCIE';
        adv.querySelector('[data-a="lives"]').textContent = String(Math.max(0, s.lives));
        adv.querySelector('[data-a="score"]').textContent = s.totalScore;
        adv.querySelector('[data-a="monsters"]').textContent = left;
        adv.querySelector('[data-a="door"]').textContent = door;
      }
    }
    const rivals = this.root.querySelector('.rival-list');
    if (rivals) {
      const others = game.players.filter((p) => !this.localIds.includes(p.id));
      const key = others.map((p) => (p.alive ? 1 : 0)).join('') + this.wins.join(',');
      if (this.cache.get('rivals') !== key) {
        this.cache.set('rivals', key);
        const alive = others.filter((p) => p.alive).length;
        rivals.innerHTML = `<div class="rival-count">${alive}/${others.length}</div>` + others.map((p) => `
          <div class="rival ${p.alive ? '' : 'dead'}"><img src="${bomberIconURL(p.style)}" alt=""><span>${p.name}</span>${this.targetWins > 1 ? `<i>${this.wins[p.id]}★</i>` : ''}</div>`).join('');
      }
    }
    const tl = game.timeLeft;
    let t;
    if (game.state === 'countdown') t = fmtTime(tl);
    else if (game.hurry.active || tl <= 0) t = '!!!';
    else t = fmtTime(tl);
    let series = '';
    if (this.targetWins > 1) series = ' · ' + this.localIds.map((id) => `${this.wins[id]}★`).join(' ') + ` / ${this.targetWins}`;
    const txt = t + series;
    if (this.cache.get('timer') !== txt) {
      this.cache.set('timer', txt);
      this.timer.textContent = txt;
      this.timer.classList.toggle('hurry', game.hurry.active || (game.state !== 'countdown' && tl < 10));
    }
  }

  hide() {
    this.root.classList.add('hidden');
  }
}


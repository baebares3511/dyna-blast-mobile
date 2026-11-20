// Match sessions: own a Game per round, drive controllers, connect simulation
// events to rendering/audio/stats, and handle rematches & series scores.
import { SIM_DT, getCharacter } from '../config.js';
import { Game } from '../game/game.js';
import { MAPS } from '../game/maps.js';
import { movePlayer, effectiveDir } from '../game/player.js';
import { BotController } from '../ai/bot.js';
import { HumanController, RemoteController } from './controllers.js';
import { sources } from '../input/input.js';
import { audio } from '../audio/audio.js';
import { randomSeed } from '../core/rng.js';
import { store, save, addHighScore } from '../core/storage.js';
import {
  WORLDS, PROLOGUE, EPILOGUE, BOSS_NAMES, ADV_DIFFICULTY, STAGES_PER_WORLD,
  stageLabel, stageNumber, withBaseline, afterDeath,
} from '../game/campaign.js';
import { makeSnapshot, applySnapshot } from '../net/snapshot.js';

const LINK_TIMEOUT_MS = 10000; // no packets for this long = connection lost

const SOUND_FOR = {
  place: 'place', brick: 'brick', pickup: 'pickup', death: 'death', kick: 'kick',
  remote: 'remote', count: 'count', start: 'start', hurry: 'hurry', wall: 'wall',
  teleport: 'teleport', shieldBreak: 'shield', curse: 'curse', roundEvent: 'event', meteor: 'place',
  monsterDeath: 'monster', doorReveal: 'door', doorAngry: 'hurry', stageClear: 'pickup', grow: 'brick',
  bossHit: 'bossHit', bossDeath: 'bossDeath', bossWindup: 'roar', bossCast: 'roar', bossStomp: 'wall', monsterSpawn: 'teleport',
};

export function pickMap(mapId) {
  if (mapId !== 'random') return mapId;
  return MAPS[Math.floor(Math.random() * MAPS.length)].id;
}

function feedback(app, ev) {
  app.renderer.handleEvent(ev);
  if (ev.type === 'explode') audio.play('explode', { chain: ev.chain });
  else if (SOUND_FOR[ev.type]) audio.play(SOUND_FOR[ev.type]);
  if (ev.type === 'hurry') audio.setTempoBoost(1.18);
}

// fuse ticking, faster in the last moments
function tickSounds(game, memo) {
  for (const b of game.bombs) {
    if (b.remote) continue;
    const fast = b.timer < 0.8;
    const bucket = Math.floor(b.timer / (fast ? 0.15 : 0.5));
    if (memo.get(b.id) !== bucket) {
      if (memo.has(b.id)) audio.play('tick', { fast });
      memo.set(b.id, bucket);
    }
  }
  if (memo.size > 64) memo.clear();
}

function buildResults(result, players, wins, targetWins) {
  const winner = result.winner >= 0 ? players[result.winner] : null;
  let champion = -1;
  if (targetWins > 1) wins.forEach((w, i) => { if (w >= targetWins) champion = i; });
  return {
    winner: result.winner,
    title: winner ? winner.name : 'REMIS',
    time: result.time,
    bestChain: result.bestChain,
    champion,
    championName: champion >= 0 ? players[champion].name : null,
    targetWins,
    rows: result.players.map((r, i) => ({ ...r, wins: wins[i] })),
  };
}

function recordStats(result, meId, online, chainOwnerIsMe) {
  const s = store.stats;
  const me = result.players[meId];
  s.rounds++;
  if (online) s.onlineRounds++;
  if (result.winner === meId) {
    s.wins++;
    if (online) s.onlineWins++;
    if (!s.fastestWin || result.time < s.fastestWin) s.fastestWin = Math.round(result.time * 10) / 10;
  } else if (result.winner < 0) s.draws++;
  else s.losses++;
  if (!me.alive) s.deaths++;
  s.kills += me.kills;
  s.bombs += me.bombsPlaced || 0;
  s.powerups += Object.values(me.collected).reduce((a, b) => a + b, 0);
  if (chainOwnerIsMe && result.bestChain > s.bestChain) s.bestChain = result.bestChain;
  s.playTime += result.time;
  save();
}

// ------------------------------------------------------------------ local / host

export class LocalSession {
  // cfg: { mode, mapId, players:[{name, style, kind, difficulty, input, cid?}], targetWins, link? }
  // Online (cfg.link): this device is the host; every 'remote' player is a
  // guest identified by its connection id `cid`.
  constructor(app, cfg) {
    this.app = app;
    this.cfg = cfg;
    this.link = cfg.link || null;
    this.wins = cfg.players.map(() => 0);
    this.acc = 0;
    this.paused = false;
    this.game = null;
    this.tickMemo = new Map();
    this.netEvents = [];
    this.snapAcc = 0;
    this.myChains = new Set();
    this.lastHeard = new Map();
    this.rematch = new Set();
    if (this.link) {
      this.link.accepting = false;
      for (const cid of this.guestIds) this.lastHeard.set(cid, performance.now());
      this.link.on('message', (m, cid) => { this.lastHeard.set(cid, performance.now()); this.onNet(m, cid); });
      this.link.on('leave', (cid) => this.guestLeft(cid));
    }
  }

  get localIds() {
    return this.cfg.players.map((p, i) => (p.kind === 'local' ? i : -1)).filter((i) => i >= 0);
  }

  // connection ids of guests still in the game
  get guestIds() {
    return this.cfg.players.filter((p) => p.kind === 'remote').map((p) => p.cid);
  }

  get canPause() { return !this.link; }
  get canRestart() { return !this.link; }

  startRound() {
    if (this.lastResults && this.lastResults.champion >= 0) this.wins = this.wins.map(() => 0);
    const mapId = pickMap(this.cfg.mapId);
    const seed = randomSeed();
    this.game = new Game({ mapId, seed, players: this.cfg.players, events: this.cfg.events });
    this.remoteCtl = new Map();
    this.controllers = this.game.players.map((p, i) => this.controllerFor(i));
    this.acc = 0;
    this.paused = false;
    this.lastResults = null;
    this.rematch = new Set();
    this.tickMemo.clear();
    this.myChains.clear();
    sources.forEach((s) => s.clear());
    this.app.beginRound(this);
    if (this.link) {
      const players = this.cfg.players.map((p) => ({ name: p.name, style: p.style, character: p.character, kind: p.kind === 'bot' ? 'bot' : 'remote' }));
      this.cfg.players.forEach((p, i) => {
        if (p.kind !== 'remote') return;
        this.link.sendTo(p.cid, { t: 'start', mapId, seed, you: i, wins: this.wins, targetWins: this.cfg.targetWins, players });
      });
    }
  }

  controllerFor(i) {
    const pc = this.cfg.players[i];
    const p = this.game.players[i];
    if (pc.kind === 'bot') return new BotController(this.game, p, pc.difficulty);
    if (pc.kind === 'remote') {
      const ctl = new RemoteController(this.game, p);
      this.remoteCtl.set(pc.cid, ctl);
      return ctl;
    }
    return new HumanController(this.game, p, sources[pc.input || 0]);
  }

  update(dt) {
    if (this.link) {
      const now = performance.now();
      for (const cid of this.guestIds) if (now - (this.lastHeard.get(cid) || now) > LINK_TIMEOUT_MS) this.guestLeft(cid);
      if (!this.link) return;
    }
    if (this.paused || !this.game) return;
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= SIM_DT) {
      this.acc -= SIM_DT;
      for (const c of this.controllers) c.update(SIM_DT);
      this.game.update(SIM_DT);
      const evs = this.game.events;
      this.game.events = [];
      for (const ev of evs) this.handleEvent(ev);
      if (this.link) {
        for (const ev of evs) this.netEvents.push(ev);
        this.snapAcc += SIM_DT;
        if (this.snapAcc >= 1 / 30 - 1e-6) {
          this.snapAcc = 0;
          this.link.send(makeSnapshot(this.game, this.netEvents));
          this.netEvents = [];
        }
      }
    }
    tickSounds(this.game, this.tickMemo);
  }

  handleEvent(ev) {
    feedback(this.app, ev);
    if (ev.type === 'explode' && ev.owner === 0) this.myChains.add(ev.chain);
    if (ev.type === 'over') this.roundOver(ev.result);
  }

  roundOver(result) {
    if (result.winner >= 0) this.wins[result.winner]++;
    const res = buildResults(result, this.cfg.players, this.wins, this.cfg.targetWins || 1);
    this.lastResults = res;
    const humans = this.localIds;
    if (this.cfg.mode !== 'local') recordStats(result, 0, !!this.link, this.myChains.has(result.bestChain));
    audio.stopMusic();
    const humanWon = humans.includes(result.winner);
    audio.play(humanWon || (this.cfg.mode === 'local' && result.winner >= 0) ? 'win' : 'lose');
    if (this.link) this.link.send({ t: 'over', results: res });
    setTimeout(() => {
      if (this.app.session !== this || !this.lastResults) return;
      this.app.ui.showResults(res, {
        rematch: () => this.requestRematch(),
        newGame: () => this.app.openSetup(this.cfg.mode),
        menu: () => this.app.toMenu(),
        waiting: false,
        online: !!this.link,
      });
      if (this.link) this.rematchStatus();
    }, 1100);
  }

  requestRematch() {
    if (!this.link) { this.startRound(); return; }
    this.rematch.add('host');
    this.checkRematch();
  }

  // online rematch: every human still in the room has to agree
  checkRematch() {
    const need = this.guestIds;
    if (this.rematch.has('host') && need.every((cid) => this.rematch.has(cid))) { this.startRound(); return; }
    this.rematchStatus();
  }

  rematchStatus() {
    const total = this.guestIds.length + 1;
    const ready = (this.rematch.has('host') ? 1 : 0) + this.guestIds.filter((cid) => this.rematch.has(cid)).length;
    const text = ready ? `REWANŻ: gotowi ${ready}/${total}` : '';
    this.app.ui.setResultsStatus(text);
    this.link.send({ t: 'rstat', text });
  }

  onNet(m, cid) {
    if (m.t === 'i') {
      const ctl = this.remoteCtl && this.remoteCtl.get(cid);
      if (ctl) ctl.receive(m);
    } else if (m.t === 'rematch') {
      if (!this.lastResults) return;
      this.rematch.add(cid);
      this.checkRematch();
    } else if (m.t === 'bye') this.guestLeft(cid);
  }

  // A guest left (or timed out): a bot takes over their bomber. When the
  // last guest is gone the match ends.
  guestLeft(cid) {
    if (!this.link) return;
    const i = this.cfg.players.findIndex((p) => p.kind === 'remote' && p.cid === cid);
    if (i < 0) return;
    this.link.kick(cid);
    const pc = this.cfg.players[i];
    pc.kind = 'bot';
    pc.difficulty = 'normal';
    this.rematch.delete(cid);
    if (!this.guestIds.length) { this.app.disconnected(); return; }
    this.app.ui.toast(`${pc.name} opuścił grę — zastępuje go bot`);
    if (this.game && this.game.state !== 'over') {
      this.game.players[i].kind = 'bot';
      this.controllers[i] = this.controllerFor(i);
    }
    if (this.lastResults) this.checkRematch();
  }

  pause(on) {
    if (!this.canPause) return;
    this.paused = on;
    sources.forEach((s) => s.clear());
  }

  dispose() {
    if (this.link) {
      const link = this.link;
      this.link = null;
      link.send({ t: 'bye' });
      setTimeout(() => link.close(), 150);
    }
  }
}

// ------------------------------------------------------------------ guest

export class GuestSession {
  constructor(app, link) {
    this.app = app;
    this.link = link;
    this.game = null;
    this.me = 1;
    this.bombSeq = 0;
    this.detSeq = 0;
    this.tickMemo = new Map();
    this.cfg = { mode: 'online' };
    this.lastHeard = performance.now();
    link.on('message', (m) => { this.lastHeard = performance.now(); this.onNet(m); });
    link.on('close', () => this.app.disconnected());
  }

  get localIds() { return [this.me]; }
  get canPause() { return false; }
  get canRestart() { return false; }

  onNet(m) {
    switch (m.t) {
      case 'start': this.startRound(m); break;
      case 's':
        if (!this.game) return;
        applySnapshot(this.game, m, this.me);
        for (const ev of m.ev) {
          feedback(this.app, ev);
          if (ev.type === 'over') this.roundResult = ev.result;
        }
        break;
      case 'over': this.showOver(m.results); break;
      case 'rstat': this.app.ui.setResultsStatus(m.text); break;
      case 'bye': this.app.disconnected(); break;
      case 'full': this.app.disconnected(m.reason); break;
      case 'lobby':
        this.app.ui.setJoinStatus(`Połączono! W pokoju (${m.players.length}/4): ${m.players.join(', ')}. Czekam aż host rozpocznie grę…`);
        break;
      default:
    }
  }

  startRound(m) {
    this.me = m.you;
    this.cfg = { mode: 'online', targetWins: m.targetWins };
    this.game = new Game({ mapId: m.mapId, seed: m.seed, players: m.players.map((p, i) => ({ ...p, kind: i === m.you ? 'local' : p.kind })) });
    this.wins = m.wins;
    this.tickMemo.clear();
    this.results = null;
    sources.forEach((s) => s.clear());
    this.app.beginRound(this);
  }

  showOver(res) {
    this.results = res;
    if (res.rows[this.me]) {
      recordStats({
        winner: res.winner, time: res.time, bestChain: res.bestChain,
        players: res.rows.map((r) => ({ ...r })),
      }, this.me, true, false);
    }
    audio.stopMusic();
    audio.play(res.winner === this.me ? 'win' : 'lose');
    setTimeout(() => {
      if (this.app.session !== this || this.results !== res) return;
      this.app.ui.showResults(res, {
        rematch: () => { this.link.send({ t: 'rematch' }); this.app.ui.setResultsStatus('Czekam na pozostałych graczy…'); },
        newGame: () => this.app.openSetup('online'),
        menu: () => this.app.toMenu(),
        online: true,
      });
    }, 1100);
  }

  update(dt) {
    const g = this.game;
    if (!g) return;
    if (performance.now() - this.lastHeard > LINK_TIMEOUT_MS) { this.app.disconnected(); return; }
    const src = sources[0];
    const p = g.players[this.me];
    let remaining = Math.min(dt, 0.1);
    if (p.alive && g.isActive) {
      const dir = effectiveDir(p, src.dir);
      while (remaining > 1e-6) {
        const step = Math.min(SIM_DT, remaining);
        remaining -= step;
        if (dir) movePlayer(g, p, dir, step);
        else p.moving = false;
        g.applyFeatures(p, step);
        if (p.moving) p.anim += step;
      }
      // local teleport: don't let a stale snapshot pull us back for a moment
      if (g.events.some((e) => e.type === 'teleport')) g.teleGrace = performance.now() + 700;
      g.events = [];
      if (src.consumeBomb()) this.bombSeq++;
      if (src.consumeDet()) this.detSeq++;
    } else {
      p.moving = false;
      src.consumeBomb();
      src.consumeDet();
    }
    // through a relay server inputs go at the broker's rate (direct: every frame)
    const now = performance.now();
    const pressed = this.bombSeq !== this.sentBomb || this.detSeq !== this.sentDet;
    if (pressed || now - (this.lastSend || 0) >= this.link.sendGap) {
      this.lastSend = now;
      this.sentBomb = this.bombSeq;
      this.sentDet = this.detSeq;
      this.link.send({
        t: 'i', x: p.x, y: p.y, dir: p.dir, moving: p.moving, press: src.dir, bomb: this.bombSeq, det: this.detSeq,
      });
    }
    const k = Math.min(1, dt * 20);
    for (const q of g.players) {
      if (q.id === this.me || q.netX === undefined) continue;
      if (Math.hypot(q.netX - q.x, q.netY - q.y) > 2) { q.x = q.netX; q.y = q.netY; }
      q.x += (q.netX - q.x) * k;
      q.y += (q.netY - q.y) * k;
      if (q.moving) q.anim += dt;
    }
    g.time += dt; // keeps death animations smooth between snapshots
    tickSounds(g, this.tickMemo);
  }

  pause() {}

  dispose() {
    this.link.send({ t: 'bye' });
    this.link.close();
  }
}

// ------------------------------------------------------------------ adventure

// Story campaign: 5 worlds x 5 stages, a boss at the end of every world.
// Losing all lives lets you continue from the start of the current world.
//   opts: { difficulty, character, world, fresh }
export class AdventureSession {
  constructor(app, opts = {}) {
    this.app = app;
    this.opts = opts;
    this.diffKey = ADV_DIFFICULTY[opts.difficulty] ? opts.difficulty : 'normal';
    this.diff = ADV_DIFFICULTY[this.diffKey];
    this.character = getCharacter(opts.character);
    this.cfg = { mode: 'adventure', targetWins: 1 };
    this.wins = [0];
    this.paused = false;
    this.game = null;
    this.tickMemo = new Map();
    this.continued = false;
    this.newRun(opts.world || 1);
  }

  newRun(world) {
    this.world = world;
    this.stage = 1;
    this.lives = this.diff.lives;
    this.score = 0;
    this.carry = withBaseline(null, world);
    this.monstersKilled = 0;
  }

  get localIds() { return [0]; }
  get canPause() { return true; }
  get canRestart() { return false; }
  get isBoss() { return this.stage === STAGES_PER_WORLD; }
  get stageLabel() { return stageLabel(this.world, this.stage); }
  get worldDef() { return WORLDS[this.world - 1]; }
  get totalScore() { return this.score + (this.game ? this.game.score : 0); }

  begin() {
    const pages = [];
    if (this.opts.fresh && this.world === 1) pages.push(...PROLOGUE.map((p) => ({ ...p, art: { hero: this.character.style } })));
    pages.push(this.worldPage());
    this.story(pages, () => this.startRound());
  }

  worldPage() {
    return { title: `ŚWIAT ${this.world}: ${this.worldDef.name}`, text: this.worldDef.intro, art: { hero: this.character.style } };
  }

  bossPage() {
    const W = this.worldDef;
    return { title: `STRAŻNIK ISKRY: ${BOSS_NAMES[W.boss]}`, text: W.bossIntro, art: { boss: W.boss } };
  }

  story(pages, done, delay = 0) {
    setTimeout(() => {
      if (this.app.session !== this) return;
      this.app.ui.showStory(pages, () => { if (this.app.session === this) done(); });
    }, delay);
  }

  startRound() {
    const ch = this.character;
    this.game = new Game({
      seed: randomSeed(),
      players: [{ name: store.settings.name || 'GRACZ', style: ch.style, character: ch.id, kind: 'local', input: 0 }],
      adventure: {
        world: this.world,
        stage: this.stage,
        carry: this.carry,
        monsterSpeed: this.diff.monsterSpeed,
        bossHp: this.diff.bossHp,
        extraItem: this.diff.extraItem,
        skulls: this.diff.skulls,
      },
    });
    this.controllers = [new HumanController(this.game, this.game.players[0], sources[0])];
    this.acc = 0;
    this.paused = false;
    this.tickMemo.clear();
    sources.forEach((s) => s.clear());
    this.app.beginRound(this);
  }

  update(dt) {
    if (this.paused || !this.game) return;
    this.acc += Math.min(dt, 0.1);
    while (this.acc >= SIM_DT) {
      this.acc -= SIM_DT;
      for (const c of this.controllers) c.update(SIM_DT);
      this.game.update(SIM_DT);
      const evs = this.game.events;
      this.game.events = [];
      for (const ev of evs) {
        feedback(this.app, ev);
        if (ev.type === 'monsterDeath') this.monstersKilled++;
        if (ev.type === 'over') this.stageOver(ev.result);
      }
    }
    tickSounds(this.game, this.tickMemo);
  }

  stageOver(result) {
    this.score += result.score;
    const s = store.stats;
    const p = this.game.players[0];
    s.playTime += result.time;
    s.bombs += result.players[0].bombsPlaced || 0;
    s.powerups += Object.values(result.players[0].collected).reduce((a, b) => a + b, 0);
    s.monsters += this.game.monsters.filter((m) => !m.alive).length;
    audio.stopMusic();
    if (result.cleared) {
      this.carry = p.upgrades();
      s.advBestStage = Math.max(s.advBestStage, stageNumber(this.world, this.stage));
      save();
      audio.play('win');
      if (this.isBoss) { this.worldCleared(); return; }
      const done = this.stageLabel;
      this.stage++;
      const next = this.isBoss ? () => this.story([this.bossPage()], () => this.startRound()) : undefined;
      this.interlude(`ETAP ${done} UKOŃCZONY!`, `PUNKTY: ${this.score}`, next);
      return;
    }
    s.deaths++;
    this.lives--;
    this.carry = withBaseline(afterDeath(p.upgrades(), this.diff.loss, this.world), this.world);
    save();
    audio.play('lose');
    if (this.lives > 0) {
      const note = { none: 'ULEPSZENIA ZACHOWANE', half: 'STRACIŁEŚ POŁOWĘ ULEPSZEŃ', all: 'STRACIŁEŚ ULEPSZENIA' }[this.diff.loss];
      this.interlude(`ETAP ${this.stageLabel}`, `POZOSTAŁE ŻYCIA: ${this.lives} · ${note}`);
      return;
    }
    this.finishRun(false, 1000);
  }

  worldCleared() {
    const W = this.worldDef;
    const a = store.adventure;
    a.unlocked = Math.max(a.unlocked || 1, Math.min(WORLDS.length, this.world + 1));
    save();
    const pages = [{ title: `ISKRA ${W.spark} ODZYSKANA! (${this.world}/${WORLDS.length})`, text: W.outro, art: { item: 'fire' } }];
    if (this.world >= WORLDS.length) {
      a.completed = (a.completed || 0) + 1;
      save();
      pages.push(...EPILOGUE.map((p) => ({ ...p, art: { hero: this.character.style } })));
      this.story(pages, () => this.finishRun(true, 0), 1200);
      return;
    }
    this.world++;
    this.stage = 1;
    this.carry = withBaseline(this.carry, this.world);
    pages.push(this.worldPage());
    this.story(pages, () => this.startRound(), 1200);
  }

  finishRun(victory, delay) {
    const s = store.stats;
    const entry = {
      score: this.score, stage: this.stageLabel, n: stageNumber(this.world, this.stage), diff: this.diffKey,
      char: this.character.id, name: store.settings.name || 'GRACZ', win: victory, cont: this.continued,
    };
    const rank = addHighScore(entry);
    s.advBestScore = Math.max(s.advBestScore, this.score);
    save();
    setTimeout(() => {
      if (this.app.session !== this) return;
      this.app.ui.showResults({
        adventure: true,
        victory,
        title: victory ? 'ZWYCIĘSTWO!' : 'KONIEC GRY',
        stage: this.stageLabel,
        world: this.world,
        score: this.score,
        best: s.advBestScore,
        monsters: this.monstersKilled,
        rank,
        top: store.adventure.top,
        winner: -1,
        rows: [],
      }, {
        rematch: () => this.continueRun(victory),
        newGame: () => this.app.openAdventure(),
        menu: () => this.app.toMenu(),
      });
    }, delay);
  }

  // after a game over: start the current world again (score starts from 0);
  // after the victory: a new run from world 1
  continueRun(victory) {
    this.app.ui.hideOverlays();
    this.continued = !victory;
    this.newRun(victory ? 1 : this.world);
    this.story([this.worldPage()], () => this.startRound());
  }

  interlude(title, sub, next) {
    setTimeout(() => {
      if (this.app.session !== this) return;
      this.app.ui.showInterlude(title, sub);
      setTimeout(() => {
        if (this.app.session !== this) return;
        if (next) { this.app.ui.hideOverlays(); next(); } else this.startRound();
      }, 2300);
    }, 900);
  }

  pause(on) {
    this.paused = on;
    sources.forEach((s) => s.clear());
  }

  dispose() {}
}

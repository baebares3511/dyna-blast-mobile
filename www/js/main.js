// App shell: wires renderer, UI, input, audio and sessions; runs the frame loop.
import { GRID_W, GRID_H, SIM_DT, CHARACTERS, getCharacter } from './config.js';
import { Renderer } from './render/renderer.js';
import { Hud } from './ui/hud.js';
import { UI } from './ui/ui.js';
import { TouchControls, setKeyboardPlayers, setKeyBindings, sources } from './input/input.js';
import { audio } from './audio/audio.js';
import { pickSong, SONG_TITLES } from './audio/music.js';
import { store } from './core/storage.js';
import { randomSeed } from './core/rng.js';
import { Game } from './game/game.js';
import { BotController } from './ai/bot.js';
import { LocalSession, GuestSession, AdventureSession, pickMap } from './session/session.js';

const BOT_NAMES = ['KNOCIK', 'PETARDA', 'DYNAMIX'];
const $ = (s) => document.querySelector(s);
const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

class App {
  constructor() {
    this.renderer = new Renderer($('#game'));
    this.hud = new Hud($('#hud'));
    this.controls = new TouchControls($('#controls'));
    this.ui = new UI(this);
    this.session = null;
    this.demo = null;
    this.paused = false;
    this.fpsEl = $('#fps');
    this.fps = { frames: 0, t: 0 };
    this.applySettings();

    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.onResize(), 200));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.session && this.session.canPause && this.session.game && this.session.game.isActive && !this.paused) this.setPaused(true);
        audio.pause(true);
      } else audio.pause(false);
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') this.onBack();
    });
    const unlock = () => {
      audio.unlock();
      if (!isNative && matchMedia('(pointer: coarse)').matches && !document.fullscreenElement && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
      }
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', () => audio.unlock());
    const cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (cap) cap.addListener('backButton', () => this.onBack());
    this.capApp = cap;

    this.toMenu();
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  applySettings() {
    const s = store.settings;
    audio.setVolumes(s.music, s.sfx);
    this.renderer.shakeEnabled = s.shake;
    setKeyBindings(s.keys);
    this.fpsEl.classList.toggle('hidden', !s.fps);
  }

  sideWidth() {
    const W = window.innerWidth, H = window.innerHeight;
    const bw = H * (GRID_W / GRID_H);
    return Math.round(Math.max(120, Math.min(340, (W - bw) / 2)));
  }

  onResize() {
    if (this.session && this.session.game) {
      const side = this.sideWidth();
      this.renderer.setMargins({ left: side, right: side });
      this.controls.build(this.localCount(), store.settings, side);
      this.hud.layout(side);
    } else this.renderer.resize();
  }

  localCount() {
    return this.session instanceof GuestSession ? 1 : this.session.localIds.length;
  }

  // ------------------------------------------------------------ navigation
  startDemo() {
    const players = [0, 1, 2, 3].map((i) => ({ name: 'CPU', style: i, kind: 'bot', difficulty: 'hard' }));
    const game = new Game({ mapId: pickMap('random'), seed: randomSeed(), players });
    game.countdown = 0.01;
    this.demo = { game, bots: game.players.map((p) => new BotController(game, p, 'hard')), acc: 0 };
    this.renderer.setMargins({});
    this.renderer.reset();
  }

  disposeSession() {
    if (this.session) {
      const s = this.session;
      this.session = null;
      s.dispose();
    }
    this.paused = false;
    this.ui.hideOverlays();
    this.controls.hide();
    this.hud.hide();
  }

  toMenu() {
    this.disposeSession();
    this.ui.showScreen('menu');
    if (!this.demo) this.startDemo();
    audio.playMusic('menu');
    audio.setTempoBoost(1);
  }

  openSetup(mode) {
    this.disposeSession();
    if (!this.demo) this.startDemo();
    audio.playMusic('menu');
    audio.setTempoBoost(1);
    this.ui.openSetup(mode);
  }

  // Humans use their chosen characters (colour = character); bots get the
  // remaining ones at random.
  //   guests (online): [{ cid, name, character }]
  buildPlayers(mode, setup, guests = []) {
    const s = store.settings;
    const used = new Set();
    const human = (name, charId, extra) => {
      let ch = getCharacter(charId);
      if (used.has(ch.id)) ch = CHARACTERS.find((c) => !used.has(c.id));
      used.add(ch.id);
      return { name, style: ch.style, character: ch.id, ...extra };
    };
    const list = [human(s.name || 'GRACZ', s.character, { kind: 'local', input: 0 })];
    if (mode === 'local') {
      list[0].name = 'GRACZ 1';
      list.push(human('GRACZ 2', s.character2, { kind: 'local', input: 1 }));
    }
    if (mode === 'online') for (const g of guests) list.push(human(g.name, g.character || 'ignis', { kind: 'remote', cid: g.cid }));
    const free = CHARACTERS.filter((c) => !used.has(c.id)).sort(() => Math.random() - 0.5);
    const bots = Math.min(setup.bots, 4 - list.length);
    for (let i = 0; i < bots; i++) {
      const difficulty = setup.difficulty === 'mixed' ? ['easy', 'normal', 'hard'][i % 3] : setup.difficulty;
      const ch = free[i % free.length];
      list.push({ name: BOT_NAMES[i], style: ch.style, character: ch.id, kind: 'bot', difficulty });
    }
    return list;
  }
  startLocalMode(mode, setup) {
    this.disposeSession();
    const cfg = {
      mode,
      mapId: setup.map,
      targetWins: setup.wins,
      players: this.buildPlayers(mode, setup),
      events: setup.events !== false,
    };
    this.session = new LocalSession(this, cfg);
    this.session.startRound();
  }

  startHost(link, setup, guests) {
    this.disposeSession();
    const cfg = {
      mode: 'online',
      mapId: setup.map,
      targetWins: setup.wins,
      players: this.buildPlayers('online', setup, guests),
      events: setup.events !== false,
      link,
    };
    this.session = new LocalSession(this, cfg);
    this.session.startRound();
  }

  openAdventure() {
    this.disposeSession();
    if (!this.demo) this.startDemo();
    audio.playMusic('menu');
    audio.setTempoBoost(1);
    this.ui.openAdventure();
  }

  // opts: { difficulty, character, world, fresh }
  startAdventure(opts) {
    this.disposeSession();
    if (!this.demo) this.startDemo();
    this.ui.showScreen(null);
    audio.playMusic('adventure');
    this.session = new AdventureSession(this, opts);
    this.session.begin();
  }

  startGuest(link) {
    if (this.session) this.disposeSession();
    this.session = new GuestSession(this, link);
  }

  // called by a session whenever a new round begins
  beginRound(session) {
    if (session !== this.session) return;
    this.demo = null;
    this.paused = false;
    const locals = this.localCount();
    setKeyboardPlayers(locals);
    const side = this.sideWidth();
    this.renderer.setMargins({ left: side, right: side });
    this.renderer.reset();
    this.controls.build(locals, store.settings, side);
    this.hud.layout(side);
    this.hud.setup(session);
    this.ui.showScreen(null);
    this.ui.hideOverlays();
    const kind = session instanceof AdventureSession ? (session.isBoss ? 'boss' : 'adventure') : 'battle';
    const song = pickSong(kind, store.settings.musicStyle);
    this.songTitle = SONG_TITLES[song] || '';
    audio.playMusic(song);
    audio.setTempoBoost(1);
  }

  disconnected(reason) {
    if (!this.session || !this.session.link) return;
    this.toMenu();
    this.ui.toast(reason || 'Połączenie z pozostałymi graczami zostało przerwane');
  }

  togglePause() {
    if (!this.session || !this.session.game) return;
    for (const id of ['#ov-results', '#ov-story', '#ov-stage']) if (!$(id).classList.contains('hidden')) return;
    this.setPaused(!this.paused);
  }

  setPaused(on) {
    if (!this.session) return;
    this.paused = on;
    this.session.pause(on);
    this.ui.showPause(on, this.session.canRestart);
  }

  onBack() {
    if (this.ui.storyOpen) { this.ui.skipStory(); return; }
    if (this.session && this.session.game) { this.togglePause(); return; }
    const cur = this.ui.current;
    if (cur === 'menu' || !cur) { if (this.capApp) this.capApp.exitApp(); return; }
    audio.play('back');
    if (cur === 'host' || cur === 'join' || cur === 'local') { this.toMenu(); this.ui.showScreen('twop'); } else this.toMenu();
  }

  // ------------------------------------------------------------ loop
  frame(now) {
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    const s = this.session;
    if (s && s.game) {
      const frozen = this.paused && s.canPause;
      if (!frozen) s.update(dt);
      this.renderer.render(s.game, frozen ? 0 : dt, { markers: s.localIds, subtitle: this.songTitle });
      this.hud.update(s.game);
      s.localIds.slice(0, 2).forEach((id, k) => this.controls.setRemoteVisible(k, s.game.players[id].hasRemote && s.game.players[id].alive));
    } else if (this.demo) {
      this.updateDemo(dt);
    }
    this.fps.frames++;
    this.fps.t += dt;
    if (this.fps.t >= 0.5) {
      this.fpsEl.textContent = Math.round(this.fps.frames / this.fps.t) + ' FPS';
      this.fps.frames = 0;
      this.fps.t = 0;
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  updateDemo(dt) {
    const d = this.demo;
    d.acc += dt;
    while (d.acc >= SIM_DT) {
      d.acc -= SIM_DT;
      for (const b of d.bots) b.update(SIM_DT);
      d.game.update(SIM_DT);
      for (const ev of d.game.events) if (ev.type !== 'start' && ev.type !== 'hurry') this.renderer.handleEvent(ev);
      d.game.events = [];
    }
    this.renderer.render(d.game, dt, {});
    if (d.game.state === 'over') this.startDemo();
  }
}

// Web version: offline cache + "install" hints (iPhone has no APK - the game
// is added to the home screen from Safari instead).
function setupWebApp() {
  if (isNative || !/^https?:$/.test(location.protocol)) return;
  const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if ('serviceWorker' in navigator && !local) navigator.serviceWorker.register('sw.js').catch(() => {});
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  if (standalone) return;
  const hint = $('#install-hint');
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const show = (html, onClick) => {
    hint.innerHTML = html;
    hint.classList.remove('hidden');
    hint.onclick = (e) => {
      if (e.target.closest('.x')) { hint.classList.add('hidden'); return; }
      if (onClick) onClick();
    };
  };
  if (ios) {
    show('<b>IPHONE / IPAD:</b> w Safari stuknij <b>Udostępnij</b>, potem <b>Do ekranu początkowego</b> — gra uruchomi się na pełnym ekranie, z ikoną, także bez internetu. <span class="x">ZAMKNIJ</span>');
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    show('<b>ZAINSTALUJ GRĘ</b> na tym urządzeniu (pełny ekran, ikona, gra offline) <span class="x">ZAMKNIJ</span>', () => {
      hint.classList.add('hidden');
      e.prompt();
    });
  });
}

window.addEventListener('DOMContentLoaded', () => {
  sources.forEach((s) => s.clear());
  window.app = new App();
  setupWebApp();
});

// Menus, setup screens, overlays. All DOM based.
import { DIFFICULTY_LABELS, PLAYER_STYLES, KEY_ACTIONS, DEFAULT_KEYS, CHARACTERS, getCharacter } from '../config.js';
import { ADV_DIFFICULTY, WORLDS, stageLabel } from '../game/campaign.js';
import { captureNextKey, keyLabel } from '../input/input.js';
import { MAPS, buildMap, THEMES } from '../game/maps.js';
import { POWERUP_IDS, POWERUPS } from '../game/powerups.js';
import { itemIconURL, bomberIconURL, bossIconURL } from '../render/sprites.js';
import { store, save, resetStats } from '../core/storage.js';
import { audio } from '../audio/audio.js';
import { NetLink, randomCode, MAX_GUESTS } from '../net/peer.js';

const $ = (sel, root = document) => root.querySelector(sel);

const MAP_OPTIONS = [{ value: 'random', label: 'LOSOWA' }, ...MAPS.map((m) => ({ value: m.id, label: m.name }))];
const DIFF_OPTIONS = ['easy', 'normal', 'hard'].map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }));
const DIFF_MIXED = [...DIFF_OPTIONS, { value: 'mixed', label: 'MIESZANY' }];
const WINS_OPTIONS = [1, 3, 5].map((n) => ({ value: n, label: n === 1 ? '1 RUNDA' : `DO ${n} WYGRANYCH` }));
const EVENTS_ROW = { key: 'events', label: 'WYDARZENIA', options: [{ value: true, label: 'WŁĄCZONE' }, { value: false, label: 'WYŁĄCZONE' }] };

const SETUPS = {
  bots: {
    title: 'GRA Z BOTAMI',
    rows: [
      { key: 'bots', label: 'BOTY', options: [1, 2, 3].map((n) => ({ value: n, label: `${n} ${n === 1 ? 'BOT' : 'BOTY'}` })) },
      { key: 'difficulty', label: 'POZIOM', options: DIFF_MIXED },
      { key: 'map', label: 'MAPA', options: MAP_OPTIONS },
      { key: 'wins', label: 'MECZ', options: WINS_OPTIONS },
      EVENTS_ROW,
    ],
  },
  local: {
    title: '2 GRACZY · 1 EKRAN',
    rows: [
      { key: 'bots', label: 'BOTY', options: [0, 1, 2].map((n) => ({ value: n, label: n ? `+${n} ${n === 1 ? 'BOT' : 'BOTY'}` : 'BEZ BOTÓW' })) },
      { key: 'difficulty', label: 'POZIOM BOTÓW', options: DIFF_OPTIONS },
      { key: 'map', label: 'MAPA', options: MAP_OPTIONS },
      { key: 'wins', label: 'MECZ', options: WINS_OPTIONS },
      EVENTS_ROW,
    ],
  },
  online: {
    rows: [
      { key: 'bots', label: 'WOLNE MIEJSCA', options: [0, 1, 2, 3].map((n) => ({ value: n, label: n ? `DO ${n} ${n === 1 ? 'BOTA' : 'BOTÓW'}` : 'BEZ BOTÓW' })) },
      { key: 'difficulty', label: 'POZIOM BOTÓW', options: DIFF_OPTIONS },
      { key: 'map', label: 'MAPA', options: MAP_OPTIONS },
      { key: 'wins', label: 'MECZ', options: WINS_OPTIONS },
      EVENTS_ROW,
    ],
  },
};

function selector(parent, row, obj, onChange) {
  const d = document.createElement('div');
  d.className = 'row';
  d.innerHTML = `<label>${row.label}</label><div class="sel"><button class="arr" aria-label="poprzedni">◀</button><span class="val"></span><button class="arr" aria-label="następny">▶</button></div>`;
  const val = $('.val', d);
  const opts = row.options;
  let i = Math.max(0, opts.findIndex((o) => o.value === obj[row.key]));
  const render = () => { val.textContent = opts[i].label; };
  const go = (k) => {
    i = (i + k + opts.length) % opts.length;
    obj[row.key] = opts[i].value;
    audio.play('click');
    render();
    onChange && onChange(row.key, opts[i].value);
  };
  const [prev, next] = d.querySelectorAll('.arr');
  prev.onclick = () => go(-1);
  next.onclick = () => go(1);
  val.onclick = () => go(1);
  obj[row.key] = opts[i].value;
  render();
  parent.appendChild(d);
  return d;
}

// Character picker: sprite + name, and the special trait underneath.
// `otherKey` - setting of another player that may not pick the same one.
function charSelector(parent, label, key, otherKey) {
  const s = store.settings;
  const d = document.createElement('div');
  d.className = 'row char-row';
  d.innerHTML = `<label>${label}</label><div class="sel"><button class="arr" aria-label="poprzednia">◀</button><span class="val char-val"><img alt=""><b></b></span><button class="arr" aria-label="następna">▶</button></div><div class="char-trait"></div>`;
  const img = $('img', d), name = $('b', d), trait = $('.char-trait', d);
  const N = CHARACTERS.length;
  let i = Math.max(0, CHARACTERS.findIndex((c) => c.id === s[key]));
  const taken = (k) => otherKey && CHARACTERS[k].id === s[otherKey];
  const render = () => {
    const c = CHARACTERS[i];
    img.src = bomberIconURL(c.style);
    name.textContent = c.name;
    name.style.color = PLAYER_STYLES[c.style].hud;
    trait.textContent = '★ ' + c.trait;
  };
  const step = (k) => {
    do i = (i + k + N) % N; while (taken(i));
    s[key] = CHARACTERS[i].id;
    save();
  };
  if (taken(i)) step(1);
  s[key] = CHARACTERS[i].id;
  const [prev, next] = d.querySelectorAll('.arr');
  const go = (k) => { step(k); audio.play('click'); render(); };
  prev.onclick = () => go(-1);
  next.onclick = () => go(1);
  $('.val', d).onclick = () => go(1);
  render();
  parent.appendChild(d);
  return d;
}

const DIFF_SHORT = { easy: 'ŁAT', normal: 'NOR', hard: 'TRU' };

function rankingHTML(top, highlight = -1) {
  if (!top || !top.length) return '<tr><td class="muted">Brak wyników — zagraj pierwszą przygodę!</td></tr>';
  return '<tr><th>#</th><th>GRACZ</th><th>PUNKTY</th><th>ETAP</th><th>POZ.</th></tr>' + top.map((e, k) => `
    <tr class="${k === highlight ? 'win' : ''}">
      <td>${k + 1}</td>
      <td class="pl"><img src="${bomberIconURL(getCharacter(e.char).style)}" alt="">${e.name}</td>
      <td>${e.score}</td><td>${e.win ? '★ KONIEC' : e.stage}${e.cont ? '*' : ''}</td><td>${DIFF_SHORT[e.diff] || ''}</td>
    </tr>`).join('');
}

export function drawMapPreview(canvas, mapId) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  if (mapId === 'random') {
    g.fillStyle = '#20183a';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffe14a';
    g.font = `${Math.round(H * 0.5)}px "Press Start 2P", monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', W / 2, H / 2 + 4);
    return;
  }
  const { board, theme } = buildMap(mapId, 4242);
  const th = THEMES[theme];
  const cs = Math.floor(Math.min(W / board.w, H / board.h));
  const ox = Math.floor((W - cs * board.w) / 2), oy = Math.floor((H - cs * board.h) / 2);
  for (let y = 0; y < board.h; y++) {
    for (let x = 0; x < board.w; x++) {
      const t = board.tiles[board.idx(x, y)];
      g.fillStyle = t === 1 ? th.wallTop : t === 2 ? th.brick : ((x + y) % 2 ? th.floorB : th.floorA);
      g.fillRect(ox + x * cs, oy + y * cs, cs, cs);
      if (t === 1) { g.fillStyle = th.wallSide; g.fillRect(ox + x * cs, oy + y * cs + cs - 2, cs, 2); }
      if (t === 2) { g.fillStyle = th.brickDark; g.fillRect(ox + x * cs, oy + y * cs + cs - 1, cs, 1); }
      const f = board.features[board.idx(x, y)];
      if (f) { g.fillStyle = f === 1 ? '#c040ff' : '#ffb020'; g.fillRect(ox + x * cs + 2, oy + y * cs + 2, cs - 4, cs - 4); }
    }
  }
  [[1, 1], [board.w - 2, board.h - 2], [board.w - 2, 1], [1, board.h - 2]].forEach(([x, y], k) => {
    g.fillStyle = PLAYER_STYLES[k].body;
    g.fillRect(ox + x * cs + 2, oy + y * cs + 2, cs - 4, cs - 4);
  });
}

export class UI {
  constructor(app) {
    this.app = app;
    this.screens = document.querySelectorAll('.screen');
    this.current = null;
    this.toastTimer = null;
    this.link = null;

    document.querySelectorAll('[data-go]').forEach((b) => {
      b.addEventListener('click', () => {
        audio.unlock();
        audio.play('click');
        const go = b.dataset.go;
        if (go === 'menu') this.app.toMenu();
        else if (go === 'adventure') this.app.openAdventure();
        else if (go === 'bots' || go === 'local') this.openSetup(go);
        else if (go === 'host') this.openHost();
        else if (go === 'join') this.openJoin();
        else if (go === 'settings') this.openSettings();
        else if (go === 'stats') this.openStats();
        else this.showScreen(go);
      });
    });
    $('#btn-resume').onclick = () => { audio.play('click'); this.app.setPaused(false); };
    $('#btn-restart').onclick = () => { audio.play('click'); this.app.setPaused(false); this.app.session.startRound(); };
    $('#btn-pause-menu').onclick = () => { audio.play('back'); this.app.toMenu(); };
    $('#btn-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); this.app.togglePause(); });
  }

  showScreen(id) {
    this.current = id;
    captureNextKey(null);
    this.screens.forEach((s) => s.classList.toggle('active', s.id === 'scr-' + id));
    document.getElementById('screens').classList.toggle('hidden', !id);
    if (id !== 'host' && id !== 'join' && this.link && !this.linkInUse) {
      this.link.close();
      this.link = null;
    }
  }

  // ------------------------------------------------------------ setup
  openSetup(mode) {
    if (mode === 'online') { this.showScreen('twop'); return; }
    const def = SETUPS[mode];
    const scr = $('#scr-setup');
    $('.title', scr).textContent = def.title;
    const rows = $('.rows', scr);
    rows.innerHTML = '';
    const obj = store.setup[mode];
    const canvas = $('#map-preview');
    const mapName = $('.map-name', scr);
    const refresh = () => {
      drawMapPreview(canvas, obj.map);
      const m = MAPS.find((x) => x.id === obj.map);
      mapName.textContent = obj.map === 'random' ? 'LOSOWA ARENA' : m.procedural ? 'NOWY UKŁAD CO RUNDĘ' : m.name;
      save();
    };
    if (mode === 'local') {
      charSelector(rows, 'POSTAĆ G1', 'character', 'character2');
      charSelector(rows, 'POSTAĆ G2', 'character2', 'character');
    } else charSelector(rows, 'POSTAĆ', 'character');
    def.rows.forEach((r) => selector(rows, r, obj, refresh));
    refresh();
    $('[data-act="start"]', scr).onclick = () => {
      audio.unlock();
      audio.play('click');
      this.app.startLocalMode(mode, obj);
    };
    $('[data-act="back"]', scr).onclick = () => { audio.play('back'); this.showScreen(mode === 'local' ? 'twop' : 'menu'); };
    this.showScreen('setup');
  }

  // ------------------------------------------------------------ adventure
  openAdventure() {
    const scr = $('#scr-adv');
    const rows = $('.rows', scr);
    rows.innerHTML = '';
    const a = store.adventure;
    const desc = document.createElement('p');
    desc.className = 'hint adv-desc';
    const diffRow = {
      key: 'difficulty', label: 'POZIOM',
      options: Object.entries(ADV_DIFFICULTY).map(([value, d]) => ({ value, label: d.label })),
    };
    const showDesc = () => { desc.textContent = ADV_DIFFICULTY[a.difficulty].desc; save(); };
    selector(rows, diffRow, a, showDesc);
    rows.appendChild(desc);
    showDesc();
    charSelector(rows, 'POSTAĆ', 'character');
    const story = document.createElement('p');
    story.className = 'hint';
    story.textContent = `${WORLDS.length} światów po 5 etapów · na końcu każdego świata boss · po utracie żyć kontynuujesz od początku świata`;
    rows.appendChild(story);
    $('.rank-table', scr).innerHTML = rankingHTML(a.top);
    const unlocked = Math.min(WORLDS.length, a.unlocked || 1);
    const cont = $('[data-act="continue"]', scr);
    cont.classList.toggle('hidden', unlocked <= 1);
    cont.textContent = `KONTYNUUJ · ŚWIAT ${unlocked}`;
    const start = (world, fresh) => {
      audio.unlock();
      audio.play('click');
      this.app.startAdventure({ difficulty: a.difficulty, character: store.settings.character, world, fresh });
    };
    cont.onclick = () => start(unlocked, false);
    $('[data-act="new"]', scr).onclick = () => start(1, true);
    $('[data-act="back"]', scr).onclick = () => { audio.play('back'); this.app.toMenu(); };
    this.showScreen('adv');
  }

  // Story pages with a typewriter effect. Enter/Space/tap = next, Esc = skip.
  showStory(pages, done) {
    this.closeStory();
    this.hideOverlays();
    this.showScreen(null);
    const ov = $('#ov-story');
    const img = $('.story-art img', ov), title = $('.story-title', ov), text = $('.story-text', ov);
    let i = 0, full = '', shown = 0, timer = null;
    const finishTyping = () => { clearInterval(timer); timer = null; text.textContent = full; };
    const show = () => {
      const pg = pages[i];
      title.textContent = pg.title;
      const art = pg.art || {};
      img.src = art.boss ? bossIconURL(art.boss) : art.item ? itemIconURL(art.item) : bomberIconURL(art.hero || 0);
      img.className = art.boss ? 'boss' : '';
      full = pg.text;
      shown = 0;
      text.textContent = '';
      clearInterval(timer);
      timer = setInterval(() => {
        shown += 2;
        text.textContent = full.slice(0, shown);
        if (shown >= full.length) finishTyping();
      }, 22);
      $('[data-act="next"]', ov).textContent = i === pages.length - 1 ? 'GRAJ! ▶' : 'DALEJ ▶';
    };
    const close = (callDone) => {
      clearInterval(timer);
      window.removeEventListener('keydown', onKey, true);
      ov.classList.add('hidden');
      this.storyCleanup = null;
      if (callDone) done();
    };
    const next = () => {
      if (timer) { finishTyping(); return; }
      i++;
      if (i >= pages.length) close(true);
      else show();
    };
    const onKey = (e) => {
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') { e.preventDefault(); e.stopImmediatePropagation(); next(); } else if (e.code === 'Escape') { e.stopImmediatePropagation(); close(true); }
    };
    window.addEventListener('keydown', onKey, true);
    $('[data-act="next"]', ov).onclick = () => { audio.play('click'); next(); };
    $('[data-act="skip"]', ov).onclick = () => { audio.play('back'); close(true); };
    this.storyCleanup = close;
    ov.classList.remove('hidden');
    show();
  }

  get storyOpen() { return !!this.storyCleanup; }

  skipStory() { if (this.storyCleanup) this.storyCleanup(true); }

  closeStory() { if (this.storyCleanup) this.storyCleanup(false); }

  // ------------------------------------------------------------ online
  openHost() {
    const scr = $('#scr-host');
    const rows = $('.rows', scr);
    rows.innerHTML = '';
    const obj = store.setup.online;
    charSelector(rows, 'POSTAĆ', 'character');
    SETUPS.online.rows.forEach((r) => selector(rows, r, obj, () => save()));
    const status = $('.status', scr);
    const codeEl = $('.room-code', scr);
    const list = $('.room-players', scr);
    const startBtn = $('[data-act="start"]', scr);
    startBtn.disabled = true;
    codeEl.textContent = '····';
    status.textContent = 'Tworzenie pokoju…';
    list.innerHTML = '';
    this.showScreen('host');
    if (this.link) this.link.close();
    const link = new NetLink();
    this.link = link;
    this.linkInUse = false;
    const guests = new Map(); // cid -> { cid, name, character }
    const refresh = () => {
      const me = getCharacter(store.settings.character);
      const entries = [{ name: store.settings.name || 'GRACZ', character: me.id, host: true }, ...guests.values()];
      list.innerHTML = entries.map((e) => `<div class="room-player"><img src="${bomberIconURL(getCharacter(e.character).style)}" alt=""><span>${e.name}</span>${e.host ? '<i>HOST</i>' : e.cid && e.cid.startsWith('relay-') ? '<i class="via">PRZEZ SERWER</i>' : ''}</div>`).join('')
        + Array.from({ length: MAX_GUESTS - guests.size }, () => '<div class="room-player empty">wolne miejsce</div>').join('');
      startBtn.disabled = guests.size === 0;
      if (codeEl.textContent !== '····') {
        status.textContent = guests.size ? `Graczy w pokoju: ${guests.size + 1}/4. Możesz zaczynać!` : 'Podaj ten kod znajomym (do 3 osób). Czekam…';
      }
      link.send({ t: 'lobby', host: store.settings.name, players: entries.map((e) => e.name) });
    };
    const tryHost = async (attempt) => {
      const code = randomCode();
      try {
        await link.host(code);
        if (this.link !== link) return;
        codeEl.textContent = code;
        refresh();
      } catch (err) {
        if (this.link !== link) return;
        if (attempt < 2 && /zajęty/.test(err.message)) return tryHost(attempt + 1);
        status.textContent = err.message;
      }
    };
    link.on('message', (m, cid) => {
      if (m.t === 'hello' && !guests.has(cid)) {
        const name = String(m.name || 'GOŚĆ').slice(0, 8).toUpperCase();
        const character = CHARACTERS.some((ch) => ch.id === m.character) ? m.character : null;
        guests.set(cid, { cid, name, character });
        audio.play('pickup');
        refresh();
      } else if (m.t === 'bye') {
        guests.delete(cid);
        link.kick(cid);
        refresh();
      }
    });
    link.on('leave', (cid) => {
      if (this.link !== link) return;
      guests.delete(cid);
      refresh();
    });
    tryHost(0);
    startBtn.onclick = () => {
      const active = [...guests.values()].filter((g) => link.guestIds.includes(g.cid));
      if (!active.length) return;
      audio.play('click');
      this.linkInUse = true;
      this.link = null;
      this.app.startHost(link, obj, active);
    };
    $('[data-act="back"]', scr).onclick = () => { audio.play('back'); link.send({ t: 'bye' }); this.showScreen('twop'); };
  }
  openJoin() {
    const scr = $('#scr-join');
    const input = $('input', scr);
    const status = $('.status', scr);
    const btn = $('[data-act="join"]', scr);
    status.textContent = 'Wpisz 4-znakowy kod pokoju.';
    btn.disabled = false;
    input.value = '';
    this.showScreen('join');
    input.oninput = () => { input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); };
    btn.onclick = async () => {
      const code = input.value.trim();
      if (code.length !== 4) { status.textContent = 'Kod musi mieć 4 znaki.'; return; }
      audio.unlock();
      audio.play('click');
      input.blur();
      btn.disabled = true;
      status.textContent = 'Łączenie z pokojem ' + code + '… (do 20 s)';
      if (this.link) this.link.close();
      const link = new NetLink();
      this.link = link;
      this.linkInUse = false;
      try {
        await link.join(code);
        if (this.link !== link) return;
        this.linkInUse = true;
        this.link = null;
        status.textContent = link.via === 'relay'
          ? 'Połączono przez serwer zapasowy! Czekam aż host rozpocznie grę…'
          : 'Połączono! Czekam aż host rozpocznie grę…';
        link.send({ t: 'hello', name: store.settings.name, character: store.settings.character });
        this.app.startGuest(link);
      } catch (err) {
        if (this.link !== link) return;
        status.textContent = err.message;
        btn.disabled = false;
        link.close();
        this.link = null;
      }
    };
    $('[data-act="back"]', scr).onclick = () => { audio.play('back'); this.app.toMenu(); this.showScreen('twop'); };
  }

  // ------------------------------------------------------------ settings & stats
  openSettings(tab = 'general') {
    const scr = $('#scr-settings');
    const rows = $('.rows', scr);
    rows.innerHTML = '';
    rows.classList.toggle('keys-grid', tab === 'keys');
    scr.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === tab);
      t.onclick = () => { audio.play('click'); this.openSettings(t.dataset.tab); };
    });
    const s = store.settings;
    const onOff = [{ value: true, label: 'WŁ.' }, { value: false, label: 'WYŁ.' }];
    const apply = () => { save(); this.app.applySettings(); };
    const addRows = (defs) => defs.forEach((d) => {
      d.options.forEach((o) => { if (typeof o.value === 'number') o.value = Math.round(o.value * 10) / 10; });
      selector(rows, d, s, apply);
    });
    if (tab === 'touch') {
      addRows([
        { key: 'control', label: 'RUCH', options: [{ value: 'dpad', label: 'D-PAD' }, { value: 'joystick', label: 'JOYSTICK' }] },
        { key: 'controlSize', label: 'PRZYCISKI', options: [{ value: 0.8, label: 'MAŁE' }, { value: 1, label: 'ŚREDNIE' }, { value: 1.2, label: 'DUŻE' }] },
        { key: 'swap', label: 'BOMBA PO', options: [{ value: false, label: 'PRAWEJ' }, { value: true, label: 'LEWEJ' }] },
        { key: 'ctlOpacity', label: 'WIDOCZNOŚĆ', options: [0.4, 0.6, 0.8, 1].map((v) => ({ value: v, label: `${v * 100}%` })) },
      ]);
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = 'ZDALNY ZAPALNIK: przycisk BUM! albo BOMBA, gdy nie masz już wolnych bomb.';
      rows.appendChild(hint);
      this.showScreen('settings');
      return;
    }
    if (tab === 'keys') {
      this.renderKeyRows(rows);
      this.showScreen('settings');
      return;
    }
    const nameRow = document.createElement('div');
    nameRow.className = 'row';
    nameRow.innerHTML = '<label>IMIĘ</label><input class="name-input" maxlength="8" spellcheck="false" autocomplete="off">';
    const ni = $('input', nameRow);
    ni.value = s.name;
    ni.oninput = () => {
      ni.value = ni.value.toUpperCase().replace(/[^A-Z0-9ĄĆĘŁŃÓŚŹŻ _-]/g, '').slice(0, 8);
      s.name = ni.value.trim() || 'GRACZ';
      save();
    };
    rows.appendChild(nameRow);
    const vol = Array.from({ length: 11 }, (_, i) => ({ value: i / 10, label: i === 0 ? 'WYŁ.' : `${i * 10}%` }));
    addRows([
      { key: 'music', label: 'MUZYKA', options: vol },
      { key: 'musicStyle', label: 'MUZYKA W GRZE', options: [{ value: 'original', label: 'ORYGINALNA' }, { value: 'classical', label: 'KLASYCZNA' }, { value: 'mixed', label: 'MIESZANA' }] },
      { key: 'sfx', label: 'EFEKTY', options: vol },
      { key: 'shake', label: 'WSTRZĄSY', options: onOff },
      { key: 'fps', label: 'LICZNIK FPS', options: onOff },
    ]);
    this.showScreen('settings');
  }

  // Keyboard rebinding: click a key button, then press the new key (Esc = cancel).
  renderKeyRows(rows) {
    const keys = store.settings.keys;
    rows.innerHTML = '';
    for (const [pk, title] of [['p1', 'GRACZ 1'], ['p2', 'GRACZ 2']]) {
      const col = document.createElement('div');
      col.className = 'key-col';
      col.innerHTML = `<div class="key-title">${title}</div>`;
      for (const [act, label] of Object.entries(KEY_ACTIONS)) {
        const r = document.createElement('div');
        r.className = 'row key-row';
        r.innerHTML = `<label>${label}</label><button class="key-btn">${keyLabel(keys[pk][act])}</button>`;
        const btn = $('button', r);
        btn.onclick = () => {
          audio.play('click');
          rows.querySelectorAll('.key-btn').forEach((b) => b.classList.remove('waiting'));
          btn.classList.add('waiting');
          btn.textContent = 'NACIŚNIJ…';
          captureNextKey((code) => {
            if (code) {
              // a key can only do one thing: swap with whatever used it before
              for (const [opk, set] of Object.entries(keys)) {
                for (const [oact, ocode] of Object.entries(set)) {
                  if (ocode === code && !(opk === pk && oact === act)) keys[opk][oact] = keys[pk][act];
                }
              }
              keys[pk][act] = code;
              save();
              this.app.applySettings();
            }
            this.renderKeyRows(rows);
          });
        };
        col.appendChild(r);
      }
      rows.appendChild(col);
    }
    const reset = document.createElement('button');
    reset.className = 'key-reset';
    reset.textContent = 'PRZYWRÓĆ DOMYŚLNE';
    reset.onclick = () => {
      audio.play('click');
      store.settings.keys = { p1: { ...DEFAULT_KEYS.p1 }, p2: { ...DEFAULT_KEYS.p2 } };
      save();
      this.app.applySettings();
      this.renderKeyRows(rows);
    };
    rows.appendChild(reset);
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Gdy gra 1 osoba, działają klawisze obu graczy. Esc = pauza / anuluj.';
    rows.appendChild(hint);
  }

  openStats() {
    const s = store.stats;
    const grid = $('#scr-stats .stats-grid');
    const pct = s.rounds ? Math.round((s.wins / s.rounds) * 100) : 0;
    const mins = Math.round(s.playTime / 60);
    const items = [
      ['ROZEGRANE RUNDY', s.rounds], ['ZWYCIĘSTWA', `${s.wins} (${pct}%)`], ['PORAŻKI', s.losses], ['REMISY', s.draws],
      ['ELIMINACJE', s.kills], ['ŚMIERCI', s.deaths], ['POSTAWIONE BOMBY', s.bombs], ['ZEBRANE BONUSY', s.powerups],
      ['NAJDŁUŻSZE COMBO', `x${s.bestChain}`], ['NAJSZYBSZA WYGRANA', s.fastestWin ? `${s.fastestWin}s` : '—'],
      ['GRY ONLINE / WYGRANE', `${s.onlineRounds} / ${s.onlineWins}`], ['CZAS GRY', `${mins} min`],
      ['PRZYGODA: NAJDALEJ', s.advBestStage ? `ETAP ${stageLabel(Math.ceil(s.advBestStage / 5), ((s.advBestStage - 1) % 5) + 1)}` : '—'],
      ['PRZYGODA: REKORD', s.advBestScore || 0],
      ['POKONANE POTWORY', s.monsters || 0], ['UKOŃCZONE PRZYGODY', store.adventure.completed || 0],
    ];
    grid.innerHTML = items.map(([k, v]) => `<div class="st"><span>${k}</span><b>${v}</b></div>`).join('');
    const reset = $('#btn-reset-stats');
    reset.textContent = 'WYZERUJ';
    reset.onclick = () => {
      if (reset.dataset.confirm === '1') {
        resetStats();
        reset.dataset.confirm = '';
        this.openStats();
      } else {
        reset.dataset.confirm = '1';
        reset.textContent = 'NA PEWNO?';
        setTimeout(() => { reset.dataset.confirm = ''; reset.textContent = 'WYZERUJ'; }, 2500);
      }
    };
    this.showScreen('stats');
  }

  // ------------------------------------------------------------ overlays
  showPause(on, canRestart = true) {
    $('#ov-pause').classList.toggle('hidden', !on);
    $('#btn-restart').classList.toggle('hidden', !canRestart);
    const k = store.settings.keys.p1;
    $('#ov-pause .pause-hint').textContent = `KLAWIATURA: RUCH ${keyLabel(k.up)}/${keyLabel(k.left)}/${keyLabel(k.down)}/${keyLabel(k.right)} · BOMBA ${keyLabel(k.bomb)} · ZAPALNIK ${keyLabel(k.det)}`;
  }

  showInterlude(title, sub) {
    const ov = $('#ov-stage');
    $('.stage-title', ov).textContent = title;
    $('.stage-sub', ov).textContent = sub;
    ov.classList.remove('hidden');
  }

  showAdventureResults(res, h) {
    const ov = $('#ov-results');
    $('.res-head', ov).textContent = res.title;
    $('.res-winner', ov).innerHTML = `<span>${res.score} PKT</span>`;
    $('.res-info', ov).textContent = (res.victory ? 'PRZYGODA UKOŃCZONA!' : `DOTARŁEŚ DO ETAPU ${res.stage}`) + ` · POKONANE POTWORY: ${res.monsters}`;
    $('.res-table', ov).innerHTML = rankingHTML(res.top, res.rank);
    $('.res-status', ov).textContent = res.rank === 0 ? 'NOWY REKORD!' : res.rank > 0 ? `${res.rank + 1}. MIEJSCE W RANKINGU!` : '';
    const rem = $('#btn-rematch');
    rem.textContent = res.victory ? 'NOWA PRZYGODA' : `KONTYNUUJ · ŚWIAT ${res.world}`;
    rem.title = res.victory ? '' : 'Od 1. etapu świata, punkty liczone od zera';
    rem.onclick = () => { audio.play('click'); h.rematch(); };
    const ng = $('#btn-newgame');
    ng.classList.remove('hidden');
    ng.textContent = 'USTAWIENIA';
    ng.onclick = () => { audio.play('click'); h.newGame(); };
    $('#btn-res-menu').onclick = () => { audio.play('back'); h.menu(); };
    ov.classList.remove('hidden');
  }

  showResults(res, h) {
    if (res.adventure) { this.showAdventureResults(res, h); return; }
    $('#btn-newgame').classList.remove('hidden');
    $('#btn-newgame').textContent = 'NOWA GRA';
    const ov = $('#ov-results');
    const winner = res.winner >= 0 ? res.rows[res.winner] : null;
    $('.res-head', ov).textContent = res.champion >= 0 ? 'ZWYCIĘZCA MECZU' : winner ? 'ZWYCIĘZCA' : 'REMIS!';
    $('.res-winner', ov).innerHTML = winner
      ? `<img src="${bomberIconURL(res.rows[res.champion >= 0 ? res.champion : res.winner].style)}" alt=""><span>${res.champion >= 0 ? res.championName : winner.name}</span>`
      : '<span>NIKT NIE PRZETRWAŁ</span>';
    const t = Math.round(res.time);
    const series = res.targetWins > 1;
    $('.res-info', ov).textContent = `CZAS RUNDY ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` + (res.bestChain > 1 ? ` · COMBO x${res.bestChain}` : '') + (series ? ` · MECZ DO ${res.targetWins}` : '');
    const rows = res.rows.map((r) => {
      const pw = POWERUP_IDS.filter((id) => r.collected[id]).map((id) => `<span class="pw-count"><img src="${itemIconURL(id)}" alt="${POWERUPS[id].label}">${r.collected[id]}</span>`).join('') || '<span class="muted">—</span>';
      return `<tr class="${r.id === res.winner ? 'win' : ''} ${r.alive ? '' : 'dead'}">
        <td class="pl"><img src="${bomberIconURL(r.style)}" alt="">${r.name}</td>
        <td>${r.kills}</td><td class="pws">${pw}</td>${series ? `<td>${r.wins}★</td>` : ''}</tr>`;
    }).join('');
    $('.res-table', ov).innerHTML = `<tr><th>GRACZ</th><th>ELIM.</th><th>BONUSY</th>${series ? '<th>WYGR.</th>' : ''}</tr>` + rows;
    $('.res-status', ov).textContent = '';
    const rem = $('#btn-rematch');
    rem.textContent = series && res.champion < 0 ? 'NASTĘPNA RUNDA' : 'REWANŻ';
    rem.onclick = () => { audio.play('click'); h.rematch(); };
    $('#btn-newgame').onclick = () => { audio.play('click'); h.newGame(); };
    $('#btn-res-menu').onclick = () => { audio.play('back'); h.menu(); };
    ov.classList.remove('hidden');
  }

  setJoinStatus(text) {
    $('#scr-join .status').textContent = text;
  }

  setResultsStatus(text) {
    $('#ov-results .res-status').textContent = text;
  }

  hideOverlays() {
    this.closeStory();
    $('#ov-results').classList.add('hidden');
    $('#ov-pause').classList.add('hidden');
    $('#ov-stage').classList.add('hidden');
  }

  toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }
}

// Network transport.
// 1) Direct: WebRTC data channels (PeerJS). A room code maps to a PeerJS id;
//    the public PeerJS broker only introduces the devices, game traffic then
//    flows directly between them.
// 2) Fallback: when a direct connection can't be made within a few seconds
//    (e.g. iPhone <-> Android), messages go through a public MQTT relay
//    (see relay.js). The host listens on both, so guests may mix them.
// The host keeps one connection per guest (up to MAX_GUESTS); a guest has a
// single connection to the host.
import { MqttRelay, RELAY_ROOT, BROKERS } from './relay.js';

const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const ID_PREFIX = 'dynablast-mobile-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_GUESTS = 3;
const DIRECT_TIMEOUT = 7000;    // then fall back to the relay
const RELAY_PING = 2000;        // relay guests send a ping this often...
const RELAY_DEAD = 12000;       // ...and count as gone after this much silence
const PEER_OPTIONS = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ],
  },
};

let loading = null;
function loadPeerJS() {
  if (window.Peer) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PEERJS_URL;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error('Nie można pobrać biblioteki sieciowej (brak internetu?)')); };
    document.head.appendChild(s);
  });
  return loading;
}

export function randomCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s;
}

// Relay sender limited to `rate` messages/s. Snapshots ('s') that come too
// soon are merged into the next one (keeping their events); other messages go
// out at once, after any snapshot still waiting.
function rateLimited(raw, rate) {
  const gap = 1000 / rate;
  let last = 0, pending = null, timer = null;
  const flush = () => {
    clearTimeout(timer);
    timer = null;
    if (!pending) return;
    const m = pending;
    pending = null;
    last = performance.now();
    raw(m);
  };
  return (msg) => {
    const now = performance.now();
    if (msg.t !== 's') { flush(); last = now; raw(msg); return; }
    if (pending) { pending = { ...msg, ev: pending.ev.concat(msg.ev) }; return; }
    if (now - last >= gap) { last = now; raw(msg); return; }
    pending = msg;
    timer = setTimeout(flush, gap - (now - last));
  };
}

function notFound(code) {
  const e = new Error('Nie znaleziono pokoju ' + code);
  e.notFound = true;
  return e;
}

// Events (set with on()):
//   message(msg, cid) - cid identifies the guest connection on the host
//   join(cid)         - host: a guest connected
//   leave(cid)        - host: a guest disconnected
//   close()           - guest: the connection to the host was lost
export class NetLink {
  constructor() {
    this.peer = null;
    this.relay = null;           // guest: its relay connection
    this.relays = [];            // host: one per broker
    this.conns = new Map();      // cid -> DataConnection | relay pseudo-connection
    this.isHost = false;
    this.accepting = true;       // host: let new guests in
    this.via = 'direct';         // guest: 'direct' | 'relay'
    this.handlers = { message: () => {}, join: () => {}, leave: () => {}, close: () => {}, error: () => {} };
    this.closed = false;
  }

  on(ev, fn) { this.handlers[ev] = fn; return this; }

  // ------------------------------------------------------------ host

  async host(code) {
    await loadPeerJS();
    this.isHost = true;
    this.code = code;
    await new Promise((resolve, reject) => {
      let opened = false;
      this.peer = new window.Peer(ID_PREFIX + code, PEER_OPTIONS);
      this.peer.on('open', () => { opened = true; resolve(); });
      this.peer.on('error', (err) => {
        if (err.type === 'unavailable-id') reject(new Error('Kod zajęty, spróbuj ponownie'));
        else if (!opened) reject(new Error('Błąd sieci: ' + (err.type || err.message)));
        else this.handlers.error(err);
      });
      this.peer.on('connection', (conn) => {
        if (!this.canAccept()) {
          conn.on('open', () => {
            conn.send(this.fullMsg());
            setTimeout(() => conn.close(), 500);
          });
          return;
        }
        this.attach(conn, conn.peer);
      });
    });
    // fallback channel; the room works without it (direct connections only)
    this.hostRelay(code).catch(() => {});
    return code;
  }

  canAccept() { return this.accepting && this.conns.size < MAX_GUESTS; }

  fullMsg() { return { t: 'full', reason: this.accepting ? 'Pokój jest pełny' : 'Gra już trwa' }; }

  // Listen on every relay broker: a guest uses whichever one it can reach,
  // and the host answers on that same broker.
  async hostRelay(code) {
    const results = await Promise.all(BROKERS.map(async (url) => {
      const relay = new MqttRelay();
      try { await relay.connect([url]); return relay; } catch { return null; }
    }));
    this.relays = results.filter(Boolean);
    if (this.closed) { this.relays.forEach((r) => r.close()); this.relays = []; return; }
    for (const relay of this.relays) this.listenRelay(relay, code);
    // relay guests that went silent are gone
    this.watch = setInterval(() => {
      const now = performance.now();
      for (const [cid, c] of this.conns) if (c.lastSeen && now - c.lastSeen > RELAY_DEAD) this.drop(cid);
    }, 2000);
  }

  listenRelay(relay, code) {
    const base = RELAY_ROOT + code;
    relay.subscribe(base + '/h', (env) => {
      if (!env || typeof env.c !== 'string') return;
      const cid = 'relay-' + env.c;
      const m = env.m || {};
      const toGuest = base + '/g/' + env.c;
      let conn = this.conns.get(cid);
      if (m.t === 'relay-hello') {
        if (conn) { relay.publish(toGuest, { t: 'relay-ok' }); return; }
        if (!this.canAccept()) { relay.publish(toGuest, this.fullMsg()); return; }
        conn = {
          open: true,
          lastSeen: performance.now(),
          send: rateLimited((msg) => relay.publish(toGuest, msg), relay.rate),
          close: () => { conn.open = false; },
        };
        this.conns.set(cid, conn);
        relay.publish(toGuest, { t: 'relay-ok' });
        this.handlers.join(cid);
        return;
      }
      if (!conn) return;
      conn.lastSeen = performance.now();
      if (m.t === 'relay-bye') { this.drop(cid); return; }
      if (m.t !== 'ping') this.handlers.message(m, cid);
    });
  }

  // ------------------------------------------------------------ guest

  async join(code) {
    await loadPeerJS();
    try {
      await this.joinDirect(code);
      this.via = 'direct';
      return;
    } catch (err) {
      if (err.notFound || this.closed) throw err;
    }
    // the room exists, but a direct connection could not be made
    this.cleanupPeer();
    await this.joinRelay(code);
    this.via = 'relay';
  }

  joinDirect(code) {
    return new Promise((resolve, reject) => {
      this.peer = new window.Peer(PEER_OPTIONS);
      const timeout = setTimeout(() => reject(new Error('timeout')), DIRECT_TIMEOUT);
      this.peer.on('open', () => {
        const conn = this.peer.connect(ID_PREFIX + code, { reliable: true, serialization: 'json' });
        conn.on('open', () => { clearTimeout(timeout); resolve(); });
        this.attach(conn, 'host');
      });
      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        if (err.type === 'peer-unavailable') reject(notFound(code));
        else reject(new Error('Błąd sieci: ' + (err.type || err.message)));
      });
    });
  }

  // Try each relay broker in turn until the host answers on one of them.
  async joinRelay(code) {
    let reached = false;
    for (const url of BROKERS) {
      const relay = new MqttRelay();
      try { await relay.connect([url]); } catch { continue; }
      reached = true;
      if (this.closed) { relay.close(); throw new Error('Anulowano'); }
      try {
        await this.helloRelay(relay, code);
        return;
      } catch (err) {
        relay.close();
        if (!err.notFound) throw err; // e.g. the room is full
      }
    }
    if (!reached) throw new Error('Nie udało się połączyć z pokojem (ani bezpośrednio, ani przez serwer zapasowy)');
    throw notFound(code);
  }

  helloRelay(relay, code) {
    const me = Math.random().toString(36).slice(2, 10);
    const base = RELAY_ROOT + code;
    const toHost = (m) => relay.publish(base + '/h', { c: me, m });
    const conn = { open: true, send: toHost, close: () => { toHost({ t: 'relay-bye' }); conn.open = false; } };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(notFound(code)), 4000);
      let ok = false;
      relay.subscribe(base + '/g/' + me, (m) => {
        if (!ok) {
          if (m.t === 'full') { clearTimeout(timeout); reject(new Error(m.reason || 'Pokój jest pełny')); return; }
          if (m.t !== 'relay-ok') return;
          ok = true;
          clearTimeout(timeout);
          this.relay = relay;
          this.conns.set('host', conn);
          this.ping = setInterval(() => toHost({ t: 'ping' }), RELAY_PING);
          relay.onclose = () => { if (!this.closed) { this.conns.delete('host'); this.handlers.close(); } };
          resolve();
          return;
        }
        if (m.t !== 'relay-ok') this.handlers.message(m, 'host');
      });
      toHost({ t: 'relay-hello' });
    });
  }

  // ------------------------------------------------------------ common

  attach(conn, cid) {
    this.conns.set(cid, conn);
    const gone = () => {
      if (this.conns.get(cid) !== conn) return;
      this.conns.delete(cid);
      if (this.closed) return;
      if (this.isHost) this.handlers.leave(cid); else this.handlers.close();
    };
    conn.on('open', () => { if (this.isHost) this.handlers.join(cid); });
    conn.on('data', (d) => this.handlers.message(d, cid));
    conn.on('close', gone);
    conn.on('error', gone);
  }

  // host: forget a relay guest
  drop(cid) {
    if (!this.conns.has(cid)) return;
    this.conns.delete(cid);
    if (!this.closed) this.handlers.leave(cid);
  }

  // guest: minimum ms between input messages (relay brokers limit the rate)
  get sendGap() { return this.via === 'relay' && this.relay ? 1000 / this.relay.rate : 0; }

  get connected() {
    for (const c of this.conns.values()) if (c.open) return true;
    return false;
  }

  get guestIds() { return [...this.conns.keys()].filter((cid) => this.conns.get(cid).open); }

  // to everyone (host) / to the host (guest)
  send(msg) {
    for (const c of this.conns.values()) if (c.open) c.send(msg);
  }

  sendTo(cid, msg) {
    const c = this.conns.get(cid);
    if (c && c.open) c.send(msg);
  }

  kick(cid) {
    const c = this.conns.get(cid);
    this.conns.delete(cid);
    try { if (c) c.close(); } catch { /* ignore */ }
  }

  cleanupPeer() {
    for (const c of this.conns.values()) { try { c.close(); } catch { /* ignore */ } }
    this.conns.clear();
    try { if (this.peer) this.peer.destroy(); } catch { /* ignore */ }
    this.peer = null;
  }

  close() {
    this.closed = true;
    clearInterval(this.ping);
    clearInterval(this.watch);
    this.cleanupPeer();
    const relays = (this.relays || []).concat(this.relay ? [this.relay] : []);
    this.relays = [];
    this.relay = null;
    setTimeout(() => relays.forEach((r) => r.close()), 300); // let a last 'bye' get out
  }
}

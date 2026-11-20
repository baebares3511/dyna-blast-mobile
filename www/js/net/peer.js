// Peer-to-peer transport over WebRTC data channels (PeerJS).
// A room code maps to a PeerJS id; the public PeerJS broker is used only to
// introduce the devices - game traffic then flows directly between them
// (inside the Wi-Fi/LAN when the phones are on the same network).
// The host keeps one connection per guest (up to MAX_GUESTS); a guest has a
// single connection to the host.
const PEERJS_URL = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const ID_PREFIX = 'dynablast-mobile-v1-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_GUESTS = 3;

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

// Events (set with on()):
//   message(msg, cid) - cid identifies the guest connection on the host
//   join(cid)         - host: a guest connected
//   leave(cid)        - host: a guest disconnected
//   close()           - guest: the connection to the host was lost
export class NetLink {
  constructor() {
    this.peer = null;
    this.conns = new Map();      // cid -> DataConnection
    this.isHost = false;
    this.accepting = true;       // host: let new guests in
    this.handlers = { message: () => {}, join: () => {}, leave: () => {}, close: () => {}, error: () => {} };
    this.closed = false;
  }

  on(ev, fn) { this.handlers[ev] = fn; return this; }

  async host(code) {
    await loadPeerJS();
    this.isHost = true;
    return new Promise((resolve, reject) => {
      let opened = false;
      this.peer = new window.Peer(ID_PREFIX + code, { debug: 0 });
      this.peer.on('open', () => { opened = true; resolve(code); });
      this.peer.on('error', (err) => {
        if (err.type === 'unavailable-id') reject(new Error('Kod zajęty, spróbuj ponownie'));
        else if (!opened) reject(new Error('Błąd sieci: ' + (err.type || err.message)));
        else this.handlers.error(err);
      });
      this.peer.on('connection', (conn) => {
        if (!this.accepting || this.conns.size >= MAX_GUESTS) {
          conn.on('open', () => {
            conn.send({ t: 'full', reason: this.accepting ? 'Pokój jest pełny' : 'Gra już trwa' });
            setTimeout(() => conn.close(), 500);
          });
          return;
        }
        this.attach(conn, conn.peer);
      });
    });
  }

  async join(code) {
    await loadPeerJS();
    return new Promise((resolve, reject) => {
      this.peer = new window.Peer({ debug: 0 });
      const timeout = setTimeout(() => reject(new Error('Nie znaleziono pokoju ' + code)), 12000);
      this.peer.on('open', () => {
        const conn = this.peer.connect(ID_PREFIX + code, { reliable: true, serialization: 'json' });
        conn.on('open', () => { clearTimeout(timeout); resolve(); });
        this.attach(conn, 'host');
      });
      this.peer.on('error', (err) => {
        clearTimeout(timeout);
        if (err.type === 'peer-unavailable') reject(new Error('Nie znaleziono pokoju ' + code));
        else reject(new Error('Błąd sieci: ' + (err.type || err.message)));
        this.handlers.error(err);
      });
    });
  }

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

  close() {
    this.closed = true;
    for (const c of this.conns.values()) { try { c.close(); } catch { /* ignore */ } }
    try { if (this.peer) this.peer.destroy(); } catch { /* ignore */ }
    this.conns.clear();
    this.peer = null;
  }
}

// Fallback transport used when a direct WebRTC connection between devices
// cannot be made (typical between an iPhone and an Android phone: Safari hides
// local network addresses and no free TURN relay is available). Game messages
// then travel through a public MQTT broker over a secure WebSocket.
// A minimal MQTT 3.1.1 client (QoS 0 only) - no external library needed.
export const BROKERS = ['wss://broker.hivemq.com:8884/mqtt', 'wss://broker.emqx.io:8084/mqtt'];
export const RELAY_ROOT = 'dynablast-mobile-v1/';
const KEEPALIVE = 30;

const enc = new TextEncoder();
const dec = new TextDecoder();

function str(s) {
  const b = enc.encode(s);
  return [b.length >> 8, b.length & 255, ...b];
}

function varLen(n) {
  const out = [];
  do {
    let d = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) d |= 128;
    out.push(d);
  } while (n > 0);
  return out;
}

function packet(type, body) {
  const head = [type, ...varLen(body.length)];
  const p = new Uint8Array(head.length + body.length);
  p.set(head, 0);
  p.set(body, head.length);
  return p;
}

export class MqttRelay {
  constructor() {
    this.ws = null;
    this.subs = new Map();   // topic -> fn(msg)
    this.packetId = 1;
    this.onclose = null;
    this.closed = false;
  }

  get open() { return !!(this.ws && this.ws.readyState === 1 && this.ready); }

  // Brokers refuse connections opened too quickly one after another, so
  // each one gets a second try after a short pause.
  async connect(urls = BROKERS) {
    for (const url of urls) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await this.connectTo(url);
          this.url = url;
          return;
        } catch {
          if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }
    throw new Error('Brak połączenia z serwerem zapasowym');
  }

  // messages per second this broker passes through reliably
  get rate() { return /hivemq/.test(this.url || '') ? 30 : 8; }

  connectTo(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, 'mqtt');
      ws.binaryType = 'arraybuffer';
      const timer = setTimeout(() => { try { ws.close(); } catch { /* ignore */ } reject(new Error('timeout')); }, 5000);
      ws.onopen = () => {
        const id = 'db' + Math.random().toString(36).slice(2, 12);
        // CONNECT: protocol "MQTT" level 4, clean session, keep-alive
        ws.send(packet(0x10, [...str('MQTT'), 4, 2, 0, KEEPALIVE, ...str(id)]));
      };
      ws.onmessage = (e) => this.receive(new Uint8Array(e.data), () => {
        clearTimeout(timer);
        this.ws = ws;
        this.ready = true;
        this.ping = setInterval(() => { if (ws.readyState === 1) ws.send(new Uint8Array([0xc0, 0])); }, (KEEPALIVE / 2) * 1000);
        resolve();
      });
      ws.onerror = () => { clearTimeout(timer); reject(new Error('ws')); };
      ws.onclose = () => {
        clearTimeout(timer);
        clearInterval(this.ping);
        if (this.ws === ws) {
          this.ready = false;
          if (!this.closed && this.onclose) this.onclose();
        }
      };
    });
  }

  // a WebSocket frame may carry several MQTT packets
  receive(data, onConnack) {
    let i = 0;
    while (i < data.length) {
      const type = data[i] >> 4;
      let mul = 1, n = 0, k = i + 1, b;
      do { b = data[k++]; n += (b & 127) * mul; mul *= 128; } while (b & 128);
      const body = data.subarray(k, k + n);
      i = k + n;
      if (type === 2) { if (body[1] === 0) onConnack(); }
      else if (type === 3) {
        const tl = (body[0] << 8) | body[1];
        const topic = dec.decode(body.subarray(2, 2 + tl));
        const fn = this.subs.get(topic);
        if (!fn) continue;
        try { fn(JSON.parse(dec.decode(body.subarray(2 + tl)))); } catch { /* malformed */ }
      }
    }
  }

  subscribe(topic, fn) {
    this.subs.set(topic, fn);
    const id = this.packetId++ & 0xffff;
    this.ws.send(packet(0x82, [id >> 8, id & 255, ...str(topic), 0]));
  }

  publish(topic, msg) {
    if (!this.open) return;
    const t = str(topic);
    const payload = enc.encode(JSON.stringify(msg));
    const body = new Uint8Array(t.length + payload.length);
    body.set(t, 0);
    body.set(payload, t.length);
    this.ws.send(packet(0x30, body));
  }

  close() {
    this.closed = true;
    clearInterval(this.ping);
    try {
      if (this.ws && this.ws.readyState === 1) this.ws.send(new Uint8Array([0xe0, 0]));
      if (this.ws) this.ws.close();
    } catch { /* ignore */ }
  }
}

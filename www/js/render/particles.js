// Lightweight particle system in virtual-pixel space (board resolution).
export class Particles {
  constructor() {
    this.list = [];
  }

  add(p) {
    if (this.list.length > 600) this.list.shift();
    this.list.push({ vx: 0, vy: 0, vz: 0, z: 0, g: 0, size: 2, life: 0.5, t: 0, kind: 'sq', ...p });
  }

  burst(x, y, n, opts) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = opts.speed * (0.4 + Math.random() * 0.8);
      this.add({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.7,
        vz: opts.up ? opts.up * (0.5 + Math.random()) : 0,
        g: opts.g || 0,
        color: opts.colors[Math.floor(Math.random() * opts.colors.length)],
        life: opts.life * (0.6 + Math.random() * 0.6),
        size: opts.size || 2,
        kind: opts.kind || 'sq',
      });
    }
  }

  update(dt) {
    const keep = [];
    for (const p of this.list) {
      p.t += dt;
      if (p.t >= p.life) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.g) {
        p.vz -= p.g * dt;
        p.z += p.vz * dt;
        if (p.z < 0) { p.z = 0; p.vz *= -0.35; p.vx *= 0.6; p.vy *= 0.6; }
      }
      if (p.kind === 'smoke') { p.vx *= 0.95; p.vy *= 0.95; }
      keep.push(p);
    }
    this.list = keep;
  }

  draw(g) {
    for (const p of this.list) {
      const k = p.t / p.life;
      if (p.kind === 'smoke') {
        const r = Math.round(p.size * (0.6 + k * 1.4));
        g.globalAlpha = 0.55 * (1 - k);
        g.fillStyle = p.color;
        g.fillRect(Math.round(p.x - r), Math.round(p.y - r + 1), r * 2, r * 2 - 2);
        g.fillRect(Math.round(p.x - r + 1), Math.round(p.y - r), r * 2 - 2, r * 2);
      } else if (p.kind === 'ghost') {
        g.globalAlpha = 1 - k;
        const x = Math.round(p.x), y = Math.round(p.y - k * 18);
        g.fillStyle = '#ffffff';
        g.fillRect(x - 2, y - 3, 5, 5);
        g.fillRect(x - 3, y - 2, 7, 4);
        g.fillRect(x - 3, y + 2, 1, 1); g.fillRect(x - 1, y + 2, 1, 1); g.fillRect(x + 1, y + 2, 1, 1); g.fillRect(x + 3, y + 2, 1, 1);
        g.fillStyle = '#140c1e';
        g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 1, y - 1, 1, 1);
      } else if (p.kind === 'star') {
        g.globalAlpha = 1 - k * k;
        g.fillStyle = p.color;
        const x = Math.round(p.x), y = Math.round(p.y - p.z);
        g.fillRect(x - 1, y, 3, 1);
        g.fillRect(x, y - 1, 1, 3);
      } else {
        g.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        g.fillStyle = p.color;
        g.fillRect(Math.round(p.x), Math.round(p.y - p.z), p.size, p.size);
      }
    }
    g.globalAlpha = 1;
  }
}

// Controllers translate some input (touch, AI, network) into player.input.
import { canEnter, tryKick, effectiveDir } from '../game/player.js';
import { DIRS, FEAT_TELE } from '../config.js';

export class HumanController {
  constructor(game, player, source) {
    this.game = game;
    this.p = player;
    this.src = source;
  }

  update() {
    const p = this.p;
    p.input.dir = effectiveDir(p, this.src.dir);
    if (this.src.consumeBomb()) p.input.bomb = true;
    if (this.src.consumeDet()) p.input.detonate = true;
  }
}

// Host-side controller for the guest's player. The guest predicts its own
// movement and reports its position; the host validates and applies it,
// and handles bomb / detonator presses via sequence counters.
export class RemoteController {
  constructor(game, player) {
    this.game = game;
    this.p = player;
    this.latest = null;
    this.bombSeq = 0;
    this.detSeq = 0;
  }

  receive(msg) {
    if (!this.latest) {
      // counters keep growing across rounds; start from where the guest is
      this.bombSeq = msg.bomb;
      this.detSeq = msg.det;
    }
    this.latest = msg;
  }

  update() {
    const m = this.latest;
    const g = this.game, p = this.p;
    if (!m || !p.alive) return;
    if (g.isActive) {
      const x = m.x, y = m.y;
      const cx = Math.floor(x), cy = Math.floor(y);
      const sameCell = cx === p.cellX && cy === p.cellY;
      // a jump is fine when the guest just used a teleport
      const board = g.board;
      const teleported = board.features[board.idx(p.cellX, p.cellY)] === FEAT_TELE;
      const plausible = Math.hypot(x - p.x, y - p.y) < 1.2 || teleported;
      if (plausible && (sameCell || canEnter(g, p, cx, cy))) {
        if (Math.abs(x - p.x) + Math.abs(y - p.y) > 1e-4) p.anim += 1 / 60;
        p.x = x;
        p.y = y;
      }
      p.dir = m.dir || p.dir;
      p.moving = !!m.moving;
      if (m.press && !m.moving) {
        const d = DIRS[m.press];
        const centered = Math.abs(p.x - (p.cellX + 0.5)) < 0.06 && Math.abs(p.y - (p.cellY + 0.5)) < 0.06;
        if (centered) tryKick(g, p, p.cellX + d.x, p.cellY + d.y, m.press);
      }
    }
    if (m.bomb > this.bombSeq) { this.bombSeq = m.bomb; p.input.bomb = true; }
    if (m.det > this.detSeq) { this.detSeq = m.det; p.input.detonate = true; }
  }
}

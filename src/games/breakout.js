import { clamp, rand, TAU } from '../util.js';
import { W, H, rr, Particles, glowText, scanlines, vignette } from './common.js';

const LEFT = 96;
const RIGHT = W - 96;
const TOP = 158;
const BOTTOM = H - 44;
const ROWS = 6;
const COLS = 12;

class Breakout {
  constructor(audio) {
    this.audio = audio;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.state = 'playing';
    this.overTitle = 'GAME OVER';
    this.overSub = 'The wall held. One more run?';
    this.time = 0;
    this.shake = 0;
    this.particles = new Particles();
    this.paddle = { x: W / 2, y: H - 96, w: 132, h: 15, target: W / 2, wide: 0 };
    this.balls = [];
    this.powerups = [];
    this.bricks = [];
    this.buildLevel();
    this.resetBall();
  }

  buildLevel() {
    this.bricks = [];
    const gap = 7;
    const bw = (RIGHT - LEFT - gap * (COLS - 1)) / COLS;
    const bh = 27;
    const colors = ['#ff4f9d', '#ff6b8b', '#ffb84f', '#ffe76a', '#6fe3ff', '#9d8bff'];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.bricks.push({
          x: LEFT + c * (bw + gap),
          y: TOP + r * (bh + gap),
          w: bw,
          h: bh,
          hp: r < 2 ? 2 : 1,
          max: r < 2 ? 2 : 1,
          color: colors[r],
          alive: true,
          flash: 0,
        });
      }
    }
  }

  resetBall() {
    this.balls = [{
      x: this.paddle.x,
      y: this.paddle.y - 18,
      vx: 0,
      vy: 0,
      r: 9,
      speed: 500 + (this.level - 1) * 40,
      stuck: true,
    }];
    this.trail = [];
    this.stuckTimer = 0;
  }

  launch() {
    const b = this.balls[0];
    if (!b || !b.stuck) return;
    b.stuck = false;
    const a = rand(-0.5, 0.5);
    b.vx = Math.sin(a) * b.speed;
    b.vy = -Math.cos(a) * b.speed;
    this.audio.tone(480, 0.1, { type: 'square', gain: 0.04, slide: 700 });
  }

  loseLife() {
    this.lives--;
    this.shake = 14;
    this.audio.hit();
    this.particles.burst(this.paddle.x, BOTTOM, '#ff6b8b', 22, 320, 0.7, 3);
    if (this.lives <= 0) {
      this.state = 'over';
      return;
    }
    this.paddle.wide = 0;
    this.resetBall();
  }

  update(dt, input) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 42);
    this.particles.update(dt, 300, 1.2);
    if (this.state !== 'playing') return;

    const p = this.paddle;
    p.wide = Math.max(0, p.wide - dt);
    p.w = 132 * (p.wide > 0 ? 1.55 : 1);
    if (input.tv.active) p.target = LEFT + input.tv.x * (RIGHT - LEFT);
    else p.target += input.axis.x * 900 * dt;
    p.target = clamp(p.target, LEFT + p.w / 2, RIGHT - p.w / 2);
    p.x += (p.target - p.x) * Math.min(1, dt * 16);
    p.x = clamp(p.x, LEFT + p.w / 2, RIGHT - p.w / 2);

    if (this.balls.length === 1 && this.balls[0].stuck) {
      this.balls[0].x = p.x;
      this.balls[0].y = p.y - 18;
      this.stuckTimer += dt;
      if (input.pressed('action') || input.pressed('up') || this.stuckTimer > 2.2) this.launch();
    }

    if (input.pressed('action') && !this.balls[0]?.stuck) {
      // nothing: action is launch only
    }

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      if (b.stuck) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x - b.r < LEFT) { b.x = LEFT + b.r; b.vx = Math.abs(b.vx); this.audio.tone(280, 0.04, { type: 'square', gain: 0.02 }); }
      if (b.x + b.r > RIGHT) { b.x = RIGHT - b.r; b.vx = -Math.abs(b.vx); this.audio.tone(280, 0.04, { type: 'square', gain: 0.02 }); }
      if (b.y - b.r < TOP) { b.y = TOP + b.r; b.vy = Math.abs(b.vy); this.audio.tone(280, 0.04, { type: 'square', gain: 0.02 }); }

      // paddle
      if (b.vy > 0 && b.y + b.r > p.y && b.y - b.r < p.y + p.h && b.x > p.x - p.w / 2 && b.x < p.x + p.w / 2) {
        b.y = p.y - b.r;
        const off = clamp((b.x - p.x) / (p.w / 2), -1, 1);
        const angle = off * 1.05;
        const speed = Math.min(1150, b.speed * 1.02);
        b.speed = speed;
        b.vx = Math.sin(angle) * speed;
        b.vy = -Math.cos(angle) * speed;
        this.audio.tone(560, 0.06, { type: 'square', gain: 0.04 });
        this.particles.burst(b.x, p.y, '#6fe3ff', 8, 160, 0.35, 2);
      }

      // bricks
      for (const br of this.bricks) {
        if (!br.alive) continue;
        const cx = br.x + br.w / 2;
        const cy = br.y + br.h / 2;
        const dx = Math.abs(b.x - cx);
        const dy = Math.abs(b.y - cy);
        if (dx < br.w / 2 + b.r && dy < br.h / 2 + b.r) {
          const ox = br.w / 2 + b.r - dx;
          const oy = br.h / 2 + b.r - dy;
          if (ox < oy) {
            b.vx = b.x < cx ? -Math.abs(b.vx) : Math.abs(b.vx);
            b.x += b.x < cx ? -ox : ox;
          } else {
            b.vy = b.y < cy ? -Math.abs(b.vy) : Math.abs(b.vy);
            b.y += b.y < cy ? -oy : oy;
          }
          br.hp--;
          br.flash = 0.14;
          if (br.hp <= 0) {
            br.alive = false;
            this.score += 100;
            this.audio.tone(700 + Math.random() * 300, 0.05, { type: 'triangle', gain: 0.035 });
            this.particles.burst(cx, cy, br.color, 14, 240, 0.6, 3);
            if (Math.random() < 0.075) {
              this.powerups.push({ x: cx, y: cy, vy: 120, kind: Math.random() < 0.55 ? 'wide' : 'multi', phase: 0 });
            }
          } else {
            this.audio.tone(420, 0.04, { type: 'square', gain: 0.025 });
          }
          break;
        }
      }

      if (b.y - b.r > BOTTOM) {
        this.balls.splice(i, 1);
      }
    }

    if (this.balls.length === 0) this.loseLife();

    // powerups
    for (let i = this.powerups.length - 1; i >= 0; i--) {
      const pk = this.powerups[i];
      pk.y += pk.vy * dt;
      pk.phase += dt * 4;
      if (pk.y > H + 20) { this.powerups.splice(i, 1); continue; }
      if (pk.y > p.y - 10 && pk.y < p.y + 20 && Math.abs(pk.x - p.x) < p.w / 2 + 14) {
        this.powerups.splice(i, 1);
        this.audio.coin();
        if (pk.kind === 'wide') {
          p.wide = 10;
        } else {
          const src = this.balls[0];
          if (src) {
            for (let k = 0; k < 2; k++) {
              const ang = (k ? 1 : -1) * 0.45;
              this.balls.push({
                x: src.x, y: src.y,
                vx: Math.sin(ang) * src.speed, vy: -Math.cos(ang) * src.speed,
                r: src.r, speed: src.speed, stuck: false,
              });
            }
          }
        }
        this.particles.burst(pk.x, pk.y, '#6fe3ff', 12, 180, 0.5, 2.5);
      }
    }

    // level clear
    if (!this.bricks.some((b) => b.alive)) {
      this.level++;
      this.score += 1000;
      this.audio.launch();
      this.buildLevel();
      this.resetBall();
      this.shake = 6;
    }

    for (const br of this.bricks) br.flash = Math.max(0, br.flash - dt);
  }

  draw(ctx) {
    const shx = this.shake ? rand(-this.shake, this.shake) : 0;
    const shy = this.shake ? rand(-this.shake, this.shake) : 0;
    ctx.save();
    ctx.translate(shx, shy);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a0d1e');
    bg.addColorStop(0.55, '#0a0a22');
    bg.addColorStop(1, '#04060f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // glow blobs
    for (const [x, y, c] of [[W * 0.2, H * 0.3, '255,79,157'], [W * 0.8, H * 0.2, '111,227,255']]) {
      const g = ctx.createRadialGradient(x, y, 10, x, y, 340);
      g.addColorStop(0, `rgba(${c},0.12)`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // playfield frame
    ctx.save();
    ctx.strokeStyle = 'rgba(130,160,255,0.16)';
    ctx.lineWidth = 1;
    ctx.strokeRect(LEFT - 12, TOP - 12, RIGHT - LEFT + 24, BOTTOM - TOP + 24);
    ctx.restore();

    // bricks
    for (const br of this.bricks) {
      if (!br.alive) continue;
      const g = ctx.createLinearGradient(br.x, br.y, br.x, br.y + br.h);
      g.addColorStop(0, br.color);
      g.addColorStop(1, 'rgba(10,12,24,0.9)');
      ctx.save();
      ctx.shadowColor = br.color;
      ctx.shadowBlur = br.flash > 0 ? 30 : 12;
      ctx.fillStyle = br.flash > 0 ? '#ffffff' : g;
      rr(ctx, br.x, br.y, br.w, br.h, 6);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (br.max > 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(br.x + 8, br.y + br.h - 6, (br.w - 16) * (br.hp / br.max), 2);
      }
      ctx.restore();
    }

    // powerups
    for (const pk of this.powerups) {
      ctx.save();
      ctx.translate(pk.x, pk.y + Math.sin(pk.phase) * 3);
      ctx.rotate(pk.phase * 0.4);
      ctx.shadowColor = '#6fe3ff';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#6fe3ff';
      ctx.lineWidth = 2;
      rr(ctx, -13, -9, 26, 18, 5);
      ctx.stroke();
      ctx.fillStyle = '#dff8ff';
      ctx.font = '700 11px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'wide' ? 'W' : 'M', 0, 4);
      ctx.restore();
    }

    // paddle
    const p = this.paddle;
    ctx.save();
    ctx.shadowColor = '#6fe3ff';
    ctx.shadowBlur = 26;
    const pg = ctx.createLinearGradient(p.x - p.w / 2, 0, p.x + p.w / 2, 0);
    pg.addColorStop(0, 'rgba(111,227,255,0.35)');
    pg.addColorStop(0.5, '#eaffff');
    pg.addColorStop(1, 'rgba(111,227,255,0.35)');
    ctx.fillStyle = pg;
    rr(ctx, p.x - p.w / 2, p.y, p.w, p.h, 7);
    ctx.fill();
    ctx.restore();

    // balls
    for (const b of this.balls) {
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 24;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.restore();
    }

    this.particles.draw(ctx);

    if (this.balls[0]?.stuck) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(220,235,255,0.7)';
      ctx.font = '600 13px "Inter", sans-serif';
      ctx.letterSpacing = '3px';
      ctx.fillText('SPACE / A TO LAUNCH', W / 2, H - 148);
      ctx.restore();
    }

    ctx.restore();
    vignette(ctx, W, H, 0.5);
    scanlines(ctx, W, H, 0.035);

    // HUD
    ctx.save();
    ctx.font = '700 11px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(150,190,255,0.6)';
    ctx.letterSpacing = '4px';
    ctx.fillText('SCORE', 54, 62);
    glowText(ctx, String(this.score).padStart(7, '0'), 54, 102, 32, '#eaf4ff', { blur: 14 });
    ctx.fillStyle = 'rgba(150,190,255,0.6)';
    ctx.letterSpacing = '4px';
    ctx.fillText('LEVEL', 262, 62);
    glowText(ctx, String(this.level).padStart(2, '0'), 262, 102, 32, '#6fe3ff', { blur: 14 });
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = i < this.lives ? 1 : 0.16;
      ctx.fillStyle = '#6fe3ff';
      ctx.beginPath(); ctx.arc(W - 64 - i * 28, 82, 7, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (this.paddle.wide > 0) {
      ctx.textAlign = 'right';
      ctx.font = '600 10px "Inter", sans-serif';
      ctx.fillStyle = '#ffd76a';
      ctx.fillText(`WIDE ${this.paddle.wide.toFixed(1)}s`, W - 54, 116);
    }
    ctx.restore();
  }
}

export default {
  id: 'breakout',
  title: 'BLOCK BUSTER',
  subtitle: 'NEON BRICK ARCADE',
  accent: '#ffe76a',
  accent2: '#3a1c5c',
  tagline: 'Break the wall. Keep the ball alive.',
  drawCover(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a0f2e');
    g.addColorStop(0.6, '#0b0a1e');
    g.addColorStop(1, '#04060f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const colors = ['#ff4f9d', '#ffb84f', '#ffe76a', '#6fe3ff', '#9d8bff'];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        ctx.fillStyle = colors[r];
        ctx.globalAlpha = 0.85;
        rr(ctx, w * 0.08 + c * w * 0.17, h * 0.16 + r * h * 0.075, w * 0.14, h * 0.048, 3);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.shadowColor = '#6fe3ff';
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#eaffff';
    rr(ctx, w * 0.3, h * 0.82, w * 0.4, 10, 5);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(w * 0.62, h * 0.72, 9, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(w * 0.125)}px "Space Grotesk", sans-serif`;
    ctx.fillText('BLOCK', w * 0.07, h * 0.9);
    ctx.fillStyle = '#ffe76a';
    ctx.fillText('BUSTER', w * 0.07, h * 0.96);
    ctx.fillStyle = 'rgba(255,240,170,0.6)';
    ctx.font = `600 ${Math.round(w * 0.04)}px "Inter", sans-serif`;
    ctx.fillText('NEON BRICK ARCADE', w * 0.07, h * 0.99);
  },
  create({ audio }) {
    return new Breakout(audio);
  },
};

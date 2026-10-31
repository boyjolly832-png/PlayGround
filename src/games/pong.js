import { clamp, rand, TAU } from '../util.js';
import { W, H, rr, Particles, glowText, scanlines, vignette } from './common.js';

const LEFT = 74;
const RIGHT = W - 74;
const TOP = 126;
const BOTTOM = H - 58;
const PW = 15;
const PH = 112;

class Pong {
  constructor(audio) {
    this.audio = audio;
    this.reset();
  }

  reset() {
    this.playerY = H / 2;
    this.aiY = H / 2;
    this.playerScore = 0;
    this.aiScore = 0;
    this.rally = 0;
    this.state = 'ready';
    this.overTitle = 'VICTORY';
    this.overSub = 'First to seven. The night is yours.';
    this.time = 0;
    this.serveTimer = 0;
    this.ball = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 10, speed: 540 };
    this.trail = [];
    this.particles = new Particles();
    this.shake = 0;
    this.aiTarget = H / 2;
    this.aiError = 0;
    this.lastHit = 0;
  }

  serve(dir = 0) {
    const angle = rand(-0.34, 0.34);
    const d = dir || (Math.random() > 0.5 ? 1 : -1);
    this.ball.x = W / 2;
    this.ball.y = H / 2 + rand(-80, 80);
    this.ball.speed = 540;
    this.ball.vx = Math.cos(angle) * this.ball.speed * d;
    this.ball.vy = Math.sin(angle) * this.ball.speed;
    this.rally = 0;
    this.trail.length = 0;
    this.serveTimer = 0;
    this.audio.tone(420, 0.12, { type: 'sine', gain: 0.05, slide: 620 });
  }

  point(playerWon) {
    if (playerWon) this.playerScore++; else this.aiScore++;
    this.audio.tone(playerWon ? 660 : 220, 0.35, { type: 'triangle', gain: 0.08, slide: playerWon ? 880 : 140 });
    this.particles.burst(this.ball.x, this.ball.y, playerWon ? '#6fe3ff' : '#ff6b8b', 26, 380, 0.8, 3.5);
    this.shake = 8;
    if (this.playerScore >= 7 || this.aiScore >= 7) {
      this.state = 'over';
      this.overTitle = this.playerScore >= 7 ? 'VICTORY' : 'DEFEAT';
      this.overSub = this.playerScore >= 7 ? 'First to seven. The night is yours.' : 'The machine takes the set. Run it back.';
      return;
    }
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.x = W / 2;
    this.ball.y = H / 2;
    this.serveTimer = 1.0;
  }

  update(dt, input) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 40);
    this.particles.update(dt, 0, 1.4);
    if (this.state === 'ready') {
      if (input.pressed('action')) {
        this.state = 'playing';
        this.serve();
      }
      return;
    }
    if (this.state !== 'playing') return;

    // player paddle
    let target = this.playerY;
    if (input.tv.active) target = input.tv.y * H;
    else if (input.axis.y) target += input.axis.y * 780 * dt;
    this.playerY += (target - this.playerY) * Math.min(1, dt * 18);
    this.playerY = clamp(this.playerY, TOP + PH / 2, BOTTOM - PH / 2);

    // AI
    const ball = this.ball;
    if (ball.vx > 0) {
      const travel = (RIGHT - 30 - ball.x) / Math.max(1, ball.vx);
      this.aiTarget = ball.y + ball.vy * travel * 0.72;
    }
    this.aiError += (rand(-1, 1) * 30 - this.aiError) * Math.min(1, dt * 2);
    const aiSpeed = 420 + Math.min(260, this.rally * 22);
    const diff = this.aiTarget + this.aiError - this.aiY;
    this.aiY += clamp(diff, -aiSpeed * dt, aiSpeed * dt);
    this.aiY = clamp(this.aiY, TOP + PH / 2, BOTTOM - PH / 2);

    if (this.serveTimer > 0) {
      this.serveTimer -= dt;
      if (this.serveTimer <= 0) this.serve(this.lastHit === 0 ? 0 : this.lastHit);
      return;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    this.trail.push({ x: ball.x, y: ball.y });
    if (this.trail.length > 14) this.trail.shift();

    if (ball.y < TOP + ball.r) {
      ball.y = TOP + ball.r;
      ball.vy = Math.abs(ball.vy);
      this.audio.tone(300, 0.05, { type: 'square', gain: 0.03 });
      this.particles.burst(ball.x, TOP, '#6fe3ff', 6, 120, 0.35, 2);
    }
    if (ball.y > BOTTOM - ball.r) {
      ball.y = BOTTOM - ball.r;
      ball.vy = -Math.abs(ball.vy);
      this.audio.tone(300, 0.05, { type: 'square', gain: 0.03 });
      this.particles.burst(ball.x, BOTTOM, '#6fe3ff', 6, 120, 0.35, 2);
    }

    const hitPaddle = (px, py) => {
      if (Math.abs(ball.y - py) > PH / 2 + ball.r) return false;
      if (Math.abs(ball.x - px) > PW / 2 + ball.r) return false;
      return true;
    };

    if (ball.vx < 0 && hitPaddle(LEFT, this.playerY)) {
      ball.x = LEFT + PW / 2 + ball.r;
      const off = clamp((ball.y - this.playerY) / (PH / 2), -1, 1);
      const angle = off * 0.85;
      ball.speed = Math.min(1150, ball.speed * 1.055);
      ball.vx = Math.cos(angle) * ball.speed;
      ball.vy = Math.sin(angle) * ball.speed;
      this.rally++;
      this.lastHit = 1;
      this.shake = 5;
      this.audio.tone(520 + this.rally * 14, 0.07, { type: 'square', gain: 0.045 });
      this.particles.burst(ball.x, ball.y, '#6fe3ff', 10, 200, 0.4, 2.5);
    }
    if (ball.vx > 0 && hitPaddle(RIGHT, this.aiY)) {
      ball.x = RIGHT - PW / 2 - ball.r;
      const off = clamp((ball.y - this.aiY) / (PH / 2), -1, 1);
      const angle = off * 0.85 + Math.PI;
      ball.speed = Math.min(1150, ball.speed * 1.055);
      ball.vx = Math.cos(angle) * ball.speed;
      ball.vy = Math.sin(angle) * ball.speed;
      this.rally++;
      this.lastHit = -1;
      this.audio.tone(440, 0.07, { type: 'square', gain: 0.04 });
      this.particles.burst(ball.x, ball.y, '#ff8fc4', 10, 200, 0.4, 2.5);
    }

    if (ball.x < LEFT - 40) this.point(false);
    else if (ball.x > RIGHT + 40) this.point(true);
  }

  draw(ctx) {
    const shx = this.shake ? rand(-this.shake, this.shake) : 0;
    ctx.save();
    ctx.translate(shx, 0);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#050a18');
    bg.addColorStop(0.55, '#081026');
    bg.addColorStop(1, '#03060f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // perspective grid
    ctx.save();
    ctx.strokeStyle = 'rgba(80,140,230,0.12)';
    ctx.lineWidth = 1;
    const t = this.time;
    for (let i = 0; i < 12; i++) {
      const y = TOP + ((i * 64 + t * 26) % (BOTTOM - TOP));
      ctx.beginPath(); ctx.moveTo(LEFT, y); ctx.lineTo(RIGHT, y); ctx.stroke();
    }
    for (let x = LEFT; x <= RIGHT; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, TOP); ctx.lineTo(x, BOTTOM); ctx.stroke();
    }
    ctx.restore();

    // border
    ctx.save();
    ctx.strokeStyle = 'rgba(110,200,255,0.5)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#4f9dff';
    ctx.shadowBlur = 18;
    ctx.strokeRect(LEFT, TOP, RIGHT - LEFT, BOTTOM - TOP);
    ctx.restore();

    // center line
    ctx.save();
    ctx.strokeStyle = 'rgba(140,180,255,0.18)';
    ctx.setLineDash([12, 18]);
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W / 2, TOP + 10); ctx.lineTo(W / 2, BOTTOM - 10); ctx.stroke();
    ctx.restore();

    // scores
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '700 92px "Space Grotesk", sans-serif';
    ctx.fillStyle = 'rgba(111,227,255,0.62)';
    ctx.fillText(String(this.playerScore), W / 2 - 190, 108);
    ctx.fillStyle = 'rgba(255,143,196,0.62)';
    ctx.fillText(String(this.aiScore), W / 2 + 190, 108);
    ctx.font = '600 10px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(190,214,255,0.75)';
    ctx.fillText('PLAYER', W / 2 - 190, 126);
    ctx.fillText('CPU', W / 2 + 190, 126);
    ctx.restore();

    // trails
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.trail.length; i++) {
      const p = this.trail[i];
      const a = (i / this.trail.length) * 0.5;
      ctx.fillStyle = `rgba(111,227,255,${a})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, this.ball.r * (0.3 + i / this.trail.length * 0.6), 0, TAU); ctx.fill();
    }
    ctx.restore();

    // paddles
    const drawPaddle = (x, y, color) => {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 24;
      const g = ctx.createLinearGradient(x - PW / 2, 0, x + PW / 2, 0);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, color);
      ctx.fillStyle = g;
      rr(ctx, x - PW / 2, y - PH / 2, PW, PH, 7);
      ctx.fill();
      ctx.restore();
    };
    drawPaddle(LEFT, this.playerY, '#6fe3ff');
    drawPaddle(RIGHT, this.aiY, '#ff8fc4');

    // ball
    ctx.save();
    ctx.shadowColor = '#6fe3ff';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(this.ball.x, this.ball.y, this.ball.r, 0, TAU); ctx.fill();
    ctx.restore();

    this.particles.draw(ctx);

    if (this.serveTimer > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(220,235,255,0.75)';
      ctx.font = '600 15px "Inter", sans-serif';
      ctx.letterSpacing = '4px';
      ctx.fillText('SERVE', W / 2, H / 2 + 8);
      ctx.restore();
    }

    if (this.state === 'ready') {
      ctx.save();
      ctx.fillStyle = 'rgba(2, 5, 12, 0.58)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(111, 227, 255, 0.7)';
      ctx.font = '600 10px "Inter", sans-serif';
      ctx.letterSpacing = '6px';
      ctx.fillText('FIRST TO SEVEN', W / 2, H / 2 - 70);
      glowText(ctx, 'READY', W / 2, H / 2 - 6, 58, '#f2f8ff', { align: 'center', blur: 24 });
      ctx.fillStyle = 'rgba(200, 220, 250, 0.75)';
      ctx.font = '500 12px "Inter", sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillText('PRESS ENTER / A TO SERVE', W / 2, H / 2 + 40);
      ctx.fillStyle = 'rgba(150, 180, 225, 0.6)';
      ctx.font = '400 11px "Inter", sans-serif';
      ctx.letterSpacing = '0px';
      ctx.fillText('Move with the mouse, finger, or the left stick', W / 2, H / 2 + 68);
      ctx.restore();
    }

    ctx.restore();
    vignette(ctx, W, H, 0.5);
    scanlines(ctx, W, H, 0.035);
  }
}

export default {
  id: 'pong',
  title: 'HYPER PONG',
  subtitle: 'ARCADE CLASSIC',
  accent: '#6fe3ff',
  accent2: '#0e2b5c',
  tagline: 'First to seven. Keep the rally alive.',
  drawCover(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#071227');
    g.addColorStop(1, '#03060f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(80,140,230,0.15)';
    for (let y = 0; y < h; y += 24) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(140,180,255,0.2)';
    ctx.setLineDash([8, 12]);
    ctx.beginPath(); ctx.moveTo(w / 2, h * 0.12); ctx.lineTo(w / 2, h * 0.8); ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.shadowColor = '#6fe3ff';
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#6fe3ff';
    rr(ctx, w * 0.08, h * 0.3, 10, h * 0.26, 5); ctx.fill();
    ctx.fillStyle = '#ff8fc4';
    rr(ctx, w * 0.9, h * 0.42, 10, h * 0.26, 5); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(w * 0.55, h * 0.46, 14, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(111,227,255,0.16)';
    ctx.font = `700 ${Math.round(w * 0.3)}px "Space Grotesk", sans-serif`;
    ctx.fillText('3', w * 0.18, h * 0.24);
    ctx.fillStyle = 'rgba(255,143,196,0.16)';
    ctx.fillText('5', w * 0.72, h * 0.24);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(w * 0.13)}px "Space Grotesk", sans-serif`;
    ctx.fillText('HYPER', w * 0.07, h * 0.84);
    ctx.fillStyle = '#6fe3ff';
    ctx.fillText('PONG', w * 0.07 + w * 0.5, h * 0.84);
    ctx.fillStyle = 'rgba(170,210,255,0.65)';
    ctx.font = `600 ${Math.round(w * 0.045)}px "Inter", sans-serif`;
    ctx.fillText('ARCADE CLASSIC', w * 0.07, h * 0.9);
  },
  create({ audio }) {
    return new Pong(audio);
  },
};

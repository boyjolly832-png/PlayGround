import { clamp, rand, TAU } from '../util.js';
import { W, H, rr, Particles, glowText, scanlines, vignette } from './common.js';

const COLS = 30;
const ROWS = 18;
const CELL = 29;
const GX = (W - COLS * CELL) / 2;
const GY = 168;

class Snake {
  constructor(audio) {
    this.audio = audio;
    this.reset();
  }

  reset() {
    this.snake = [];
    for (let i = 4; i >= 0; i--) this.snake.push({ x: 14 - i, y: 9 });
    this.prev = this.snake.map((s) => ({ ...s }));
    this.dir = { x: 1, y: 0 };
    this.queue = [];
    this.food = { x: 22, y: 9, phase: 0 };
    this.score = 0;
    this.state = 'ready';
    this.overTitle = 'SYSTEM CRASH';
    this.overSub = 'The snake ate itself. Classic.';
    this.time = 0;
    this.acc = 0;
    this.step = 0.135;
    this.shake = 0;
    this.particles = new Particles();
    this.grow = 0;
    this.flash = 0;
    this.spawnFood();
  }

  spawnFood() {
    let x, y, tries = 0;
    do {
      x = (Math.random() * COLS) | 0;
      y = (Math.random() * ROWS) | 0;
      tries++;
    } while (this.snake.some((s) => s.x === x && s.y === y) && tries < 200);
    this.food = { x, y, phase: rand(0, TAU) };
  }

  pushDir(x, y) {
    const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
    if (last.x === -x && last.y === -y) return;
    if (last.x === x && last.y === y) return;
    if (this.queue.length < 2) this.queue.push({ x, y });
  }

  update(dt, input) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt);
    this.particles.update(dt, 0, 1);
    if (this.state === 'ready') {
      if (input.pressed('action')) {
        this.state = 'playing';
        this.audio.click();
      }
      return;
    }
    if (this.state !== 'playing') return;

    if (input.pressed('up')) this.pushDir(0, -1);
    if (input.pressed('down')) this.pushDir(0, 1);
    if (input.pressed('left')) this.pushDir(-1, 0);
    if (input.pressed('right')) this.pushDir(1, 0);

    if (!this.queue.length && (Math.abs(input.axis.x) > 0.6 || Math.abs(input.axis.y) > 0.6)) {
      if (Math.abs(input.axis.x) > Math.abs(input.axis.y)) this.pushDir(Math.sign(input.axis.x), 0);
      else this.pushDir(0, Math.sign(input.axis.y));
    }

    this.acc += dt;
    while (this.acc >= this.step) {
      this.acc -= this.step;
      this.stepGame();
      if (this.state !== 'playing') break;
    }
  }

  stepGame() {
    if (this.queue.length) this.dir = this.queue.shift();
    const head = this.snake[0];
    const nx = head.x + this.dir.x;
    const ny = head.y + this.dir.y;
    this.prev = this.snake.map((s) => ({ ...s }));

    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) {
      this.die();
      return;
    }
    if (this.snake.some((s, i) => i < this.snake.length - 1 && s.x === nx && s.y === ny)) {
      this.die();
      return;
    }

    this.snake.unshift({ x: nx, y: ny });
    if (this.grow > 0) {
      this.grow--;
    } else {
      this.snake.pop();
    }

    if (nx === this.food.x && ny === this.food.y) {
      this.score += 25;
      this.grow += 2;
      this.step = Math.max(0.062, this.step * 0.975);
      this.shake = 4;
      this.flash = 0.18;
      this.audio.coin();
      const px = GX + nx * CELL + CELL / 2;
      const py = GY + ny * CELL + CELL / 2;
      this.particles.burst(px, py, '#ffd76a', 20, 260, 0.7, 3);
      this.spawnFood();
    }
  }

  die() {
    this.state = 'over';
    this.audio.hit();
    this.shake = 18;
    const head = this.snake[0];
    this.particles.burst(GX + head.x * CELL + CELL / 2, GY + head.y * CELL + CELL / 2, '#ff6b8b', 32, 380, 0.9, 4);
  }

  draw(ctx) {
    const shx = this.shake ? rand(-this.shake, this.shake) : 0;
    const shy = this.shake ? rand(-this.shake, this.shake) : 0;
    ctx.save();
    ctx.translate(shx, shy);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#030d0b');
    bg.addColorStop(0.55, '#04141a');
    bg.addColorStop(1, '#02070c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const g1 = ctx.createRadialGradient(W * 0.3, H * 0.35, 10, W * 0.3, H * 0.35, 420);
    g1.addColorStop(0, 'rgba(50,255,180,0.09)');
    g1.addColorStop(1, 'rgba(50,255,180,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(W * 0.75, H * 0.65, 10, W * 0.75, H * 0.65, 380);
    g2.addColorStop(0, 'rgba(80,150,255,0.08)');
    g2.addColorStop(1, 'rgba(80,150,255,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);

    // grid
    ctx.save();
    ctx.strokeStyle = 'rgba(70,230,190,0.09)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(GX + c * CELL, GY); ctx.lineTo(GX + c * CELL, GY + ROWS * CELL); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(GX, GY + r * CELL); ctx.lineTo(GX + COLS * CELL, GY + r * CELL); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(90,255,200,0.35)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#4fffc4';
    ctx.shadowBlur = 18;
    ctx.strokeRect(GX, GY, COLS * CELL, ROWS * CELL);
    ctx.restore();

    const t = clamp(this.acc / this.step, 0, 1);
    const cellPos = (s, i) => {
      const p = this.prev[i] || s;
      const x = p.x + (s.x - p.x) * t;
      const y = p.y + (s.y - p.y) * t;
      return { x: GX + x * CELL + CELL / 2, y: GY + y * CELL + CELL / 2 };
    };

    // food
    const fx = GX + this.food.x * CELL + CELL / 2;
    const fy = GY + this.food.y * CELL + CELL / 2;
    ctx.save();
    ctx.translate(fx, fy);
    const pulse = 1 + Math.sin(this.time * 6 + this.food.phase) * 0.12;
    ctx.shadowColor = '#ffd76a';
    ctx.shadowBlur = 28;
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.arc(0, 0, CELL * 0.3 * pulse, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(-2, -3, CELL * 0.1, 0, TAU); ctx.fill();
    ctx.restore();

    // snake
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let i = this.snake.length - 1; i >= 0; i--) {
      const p = cellPos(this.snake[i], i);
      const f = i / Math.max(1, this.snake.length);
      const r = CELL * (0.34 - f * 0.1);
      const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 1, p.x, p.y, r * 1.4);
      if (i === 0) {
        g.addColorStop(0, '#eaffff');
        g.addColorStop(0.45, '#6fe3ff');
        g.addColorStop(1, 'rgba(20,120,160,0.5)');
      } else {
        g.addColorStop(0, `rgba(${90 - f * 40}, ${255 - f * 80}, ${210 - f * 30}, 1)`);
        g.addColorStop(1, 'rgba(10,90,100,0.6)');
      }
      ctx.shadowColor = i === 0 ? '#6fe3ff' : '#2fe0a8';
      ctx.shadowBlur = i === 0 ? 26 : 10;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    // eyes
    const head = cellPos(this.snake[0], 0);
    const dx = this.dir.x, dy = this.dir.y;
    const ex = dy !== 0 ? 5 : dx * 4;
    const ey = dx !== 0 ? 5 : dy * 4;
    ctx.fillStyle = '#041014';
    ctx.beginPath(); ctx.arc(head.x + ex, head.y + ey, 2.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(head.x - ex, head.y - ey, 2.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(head.x + ex, head.y + ey, 1.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(head.x - ex, head.y - ey, 1.1, 0, TAU); ctx.fill();
    ctx.restore();

    this.particles.draw(ctx);

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(120,255,220,${this.flash * 0.4})`;
      ctx.fillRect(0, 0, W, H);
    }

    ctx.restore();
    vignette(ctx, W, H, 0.5);
    scanlines(ctx, W, H, 0.035);

    if (this.state === 'ready') {
      ctx.save();
      ctx.fillStyle = 'rgba(2, 7, 12, 0.62)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(120, 240, 200, 0.7)';
      ctx.font = '600 10px "Inter", sans-serif';
      ctx.letterSpacing = '6px';
      ctx.fillText('SYNTHWAVE PROTOCOL', W / 2, H / 2 - 74);
      glowText(ctx, 'READY', W / 2, H / 2 - 8, 58, '#eafff7', { align: 'center', blur: 24 });
      ctx.fillStyle = 'rgba(190, 220, 245, 0.72)';
      ctx.font = '500 12px "Inter", sans-serif';
      ctx.letterSpacing = '2px';
      ctx.fillText('PRESS ENTER / A TO START', W / 2, H / 2 + 38);
      ctx.fillStyle = 'rgba(120, 240, 200, 0.55)';
      ctx.font = '400 11px "Inter", sans-serif';
      ctx.letterSpacing = '0px';
      ctx.fillText('Arrow keys, WASD, or the left stick to steer', W / 2, H / 2 + 68);
      ctx.restore();
    }

    // HUD
    ctx.save();
    ctx.font = '700 11px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(120,240,200,0.6)';
    ctx.letterSpacing = '4px';
    ctx.fillText('SCORE', 54, 62);
    glowText(ctx, String(this.score).padStart(6, '0'), 54, 102, 32, '#eafff7', { blur: 14 });
    ctx.fillStyle = 'rgba(120,240,200,0.6)';
    ctx.letterSpacing = '4px';
    ctx.fillText('LENGTH', 262, 62);
    glowText(ctx, String(this.snake.length).padStart(2, '0'), 262, 102, 32, '#6fe3ff', { blur: 14 });
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(120,240,200,0.55)';
    ctx.font = '600 10px "Inter", sans-serif';
    ctx.fillText('SPEED', W - 54, 62);
    ctx.fillStyle = '#4fffc4';
    ctx.font = '700 22px "Space Grotesk", sans-serif';
    ctx.fillText(`${(0.135 / this.step).toFixed(1)}×`, W - 54, 90);
    ctx.restore();
  }
}

export default {
  id: 'snake',
  title: 'SNAKE.EXE',
  subtitle: 'SYNTHWAVE PROTOCOL',
  accent: '#4fffc4',
  accent2: '#04312e',
  tagline: 'Eat. Grow. Don’t bite yourself.',
  drawCover(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#04140f');
    g.addColorStop(0.6, '#04141a');
    g.addColorStop(1, '#02070c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(70,230,190,0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 26) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 26) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    // snake path
    ctx.save();
    ctx.shadowColor = '#4fffc4';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = '#4fffc4';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(w * 0.2, h * 0.62);
    ctx.lineTo(w * 0.38, h * 0.62);
    ctx.lineTo(w * 0.38, h * 0.44);
    ctx.lineTo(w * 0.62, h * 0.44);
    ctx.lineTo(w * 0.62, h * 0.58);
    ctx.lineTo(w * 0.8, h * 0.58);
    ctx.stroke();
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.arc(w * 0.8, h * 0.58, 10, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(w * 0.15)}px "Space Grotesk", sans-serif`;
    ctx.fillText('SNAKE', w * 0.07, h * 0.84);
    ctx.fillStyle = '#4fffc4';
    ctx.fillText('.EXE', w * 0.07 + w * 0.48, h * 0.84);
    ctx.fillStyle = 'rgba(150,255,220,0.65)';
    ctx.font = `600 ${Math.round(w * 0.043)}px "Inter", sans-serif`;
    ctx.fillText('SYNTHWAVE PROTOCOL', w * 0.07, h * 0.9);
  },
  create({ audio }) {
    return new Snake(audio);
  },
};

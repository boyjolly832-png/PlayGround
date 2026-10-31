import { clamp, rand, TAU } from '../util.js';
import { W, H, rr, Particles, makeStars, drawStars, glowText, scanlines, vignette } from './common.js';

class Astro {
  constructor(audio) {
    this.audio = audio;
    this.reset();
  }

  reset() {
    this.platforms = [{ x: -260, w: 820, y: 592 }];
    this.nextX = 560;
    this.bolts = [];
    this.drones = [];
    this.particles = new Particles();
    this.player = { x: 150, y: 592, vx: 0, vy: 0, onGround: true, face: 1, anim: 0 };
    this.camX = 0;
    this.score = 0;
    this.boltsCollected = 0;
    this.lives = 3;
    this.state = 'playing';
    this.overTitle = 'SIGNAL LOST';
    this.overSub = 'The little astro bot ran out of juice.';
    this.time = 0;
    this.lastSafe = this.platforms[0];
    this.shake = 0;
    this.stars = makeStars(150);
    this.genAhead();
  }

  genAhead() {
    while (this.nextX < this.camX + W + 1100) this.addPlatform();
  }

  addPlatform() {
    const prev = this.platforms[this.platforms.length - 1];
    const gap = rand(70, 170);
    const w = rand(190, 360);
    const y = clamp(prev.y + rand(-85, 55), 350, 612);
    const p = { x: prev.x + prev.w + gap, w, y };
    this.platforms.push(p);
    const n = 1 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      this.bolts.push({
        x: p.x + (w * (i + 1)) / (n + 1),
        y: p.y - 60 - rand(0, 70),
        got: false,
        phase: rand(0, TAU),
      });
    }
    if (Math.random() < 0.34 && this.platforms.length > 2) {
      this.drones.push({
        x: p.x + w * rand(0.25, 0.75),
        baseY: p.y - 90 - rand(0, 40),
        y: 0,
        phase: rand(0, TAU),
        dead: false,
      });
    }
    this.nextX = p.x + p.w;
  }

  loseLife() {
    if (this.state !== 'playing') return;
    this.lives--;
    this.shake = 14;
    this.audio.hit();
    this.particles.burst(this.player.x, this.player.y - 18, '#ff6b8b', 26, 320, 0.8, 4);
    if (this.lives <= 0) {
      this.state = 'over';
      return;
    }
    const safe = this.lastSafe || this.platforms[0];
    this.player.x = safe.x + safe.w * 0.5;
    this.player.y = safe.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.onGround = true;
  }

  update(dt, input) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 40);
    this.particles.update(dt, 900, 1.2);
    if (this.state !== 'playing') return;

    const p = this.player;
    const ax = input.axis.x;
    if (ax) p.face = ax > 0 ? 1 : -1;
    p.vx += (ax * 370 - p.vx) * Math.min(1, dt * 11);
    if (Math.abs(ax) < 0.05) p.vx *= 1 - dt * 4;

    if ((input.pressed('action') || input.pressed('up')) && p.onGround) {
      p.vy = -900;
      p.onGround = false;
      this.audio.tone(320, 0.12, { type: 'square', gain: 0.03, slide: 620 });
      this.particles.burst(p.x, p.y, '#7fe3ff', 10, 130, 0.4, 2.5);
    }
    p.vy += 2350 * dt;
    p.x += p.vx * dt;
    const prevY = p.y;
    p.y += p.vy * dt;

    p.onGround = false;
    for (const plat of this.platforms) {
      if (p.x > plat.x - 8 && p.x < plat.x + plat.w + 8) {
        if (p.vy >= 0 && prevY <= plat.y + 2 && p.y >= plat.y) {
          p.y = plat.y;
          p.vy = 0;
          p.onGround = true;
          this.lastSafe = plat;
          break;
        }
      }
    }
    if (p.onGround) {
      p.anim += Math.abs(p.vx) * dt * 0.05;
    } else {
      p.anim += dt * 8;
      if (Math.random() < dt * 30) {
        this.particles.list.push({
          x: p.x + rand(-6, 6), y: p.y - 6, vx: rand(-30, 30), vy: rand(30, 120),
          life: 0.35, max: 0.35, color: '#5fd8ff', size: 2,
        });
      }
    }

    if (p.y > 860) this.loseLife();

    // bolts
    for (const b of this.bolts) {
      if (b.got) continue;
      const bob = Math.sin(this.time * 3 + b.phase) * 6;
      if (Math.hypot(p.x - b.x, p.y - 24 - (b.y + bob)) < 30) {
        b.got = true;
        this.boltsCollected++;
        this.score += 50;
        this.audio.coin();
        this.particles.burst(b.x, b.y + bob, '#ffd76a', 14, 220, 0.6, 3);
      }
    }

    // drones
    for (const d of this.drones) {
      if (d.dead) continue;
      d.y = d.baseY + Math.sin(this.time * 2.2 + d.phase) * 34;
      if (Math.hypot(p.x - d.x, p.y - 22 - d.y) < 30) {
        d.dead = true;
        this.particles.burst(d.x, d.y, '#ff7d9c', 22, 260, 0.7, 3.5);
        this.loseLife();
      }
    }

    this.camX += (p.x - 370 - this.camX) * Math.min(1, dt * 5);
    this.genAhead();

    // cleanup
    const cutoff = this.camX - 400;
    if (this.platforms.length > 8) this.platforms = this.platforms.filter((pl) => pl.x + pl.w > cutoff);
    this.bolts = this.bolts.filter((b) => !b.got && b.x > cutoff);
    this.drones = this.drones.filter((d) => !d.dead && d.x > cutoff);

    this.score += dt * 10;
  }

  draw(ctx) {
    const shx = this.shake ? rand(-this.shake, this.shake) : 0;
    const shy = this.shake ? rand(-this.shake, this.shake) : 0;
    ctx.save();
    ctx.translate(shx, shy);

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#050a1a');
    sky.addColorStop(0.45, '#0a1633');
    sky.addColorStop(0.78, '#172a4e');
    sky.addColorStop(1, '#0a1020');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    drawStars(ctx, this.stars, W, H, this.camX * 0.06, 0);

    // planet
    const px = 980 - this.camX * 0.03;
    const py = 170;
    const pg = ctx.createRadialGradient(px - 30, py - 30, 10, px, py, 130);
    pg.addColorStop(0, '#9fd0ff');
    pg.addColorStop(0.4, '#3b6fd6');
    pg.addColorStop(1, '#0a1a3a');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(px, py, 120, 0, TAU); ctx.fill();
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.35);
    ctx.strokeStyle = 'rgba(130,190,255,0.45)';
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.ellipse(0, 0, 180, 42, 0, 0, TAU); ctx.stroke();
    ctx.restore();

    // distant skyline
    const skyline = (offset, color, base, scale) => {
      ctx.fillStyle = color;
      const start = -((this.camX * offset) % 320) - 320;
      for (let x = start; x < W + 320; x += 320) {
        for (let i = 0; i < 8; i++) {
          const bw = 34 + ((i * 37) % 54);
          const bh = (60 + ((i * 53) % 130)) * scale;
          ctx.fillRect(x + i * 40, base - bh, bw, bh);
        }
      }
    };
    skyline(0.1, 'rgba(16,28,54,0.8)', 600, 1.2);
    skyline(0.22, 'rgba(8,16,32,0.9)', 660, 1);

    ctx.save();
    ctx.translate(-this.camX, 0);

    // platforms
    for (const plat of this.platforms) {
      if (plat.x + plat.w < this.camX - 100 || plat.x > this.camX + W + 100) continue;
      const g = ctx.createLinearGradient(0, plat.y, 0, plat.y + 70);
      g.addColorStop(0, '#1a2947');
      g.addColorStop(1, '#070c17');
      ctx.fillStyle = g;
      rr(ctx, plat.x, plat.y, plat.w, 54, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(90,140,230,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.save();
      ctx.shadowColor = '#5fd8ff';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#6fe3ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(plat.x + 6, plat.y + 1.5);
      ctx.lineTo(plat.x + plat.w - 6, plat.y + 1.5);
      ctx.stroke();
      ctx.restore();
      // support struts
      ctx.strokeStyle = 'rgba(80,120,190,0.12)';
      for (let sx = plat.x + 30; sx < plat.x + plat.w - 20; sx += 60) {
        ctx.beginPath();
        ctx.moveTo(sx, plat.y + 40);
        ctx.lineTo(sx + 20, plat.y + 120);
        ctx.stroke();
      }
    }

    // bolts
    for (const b of this.bolts) {
      if (b.got) continue;
      const bob = Math.sin(this.time * 3 + b.phase) * 6;
      ctx.save();
      ctx.translate(b.x, b.y + bob);
      ctx.rotate(this.time * 2 + b.phase);
      ctx.shadowColor = '#ffd76a';
      ctx.shadowBlur = 20;
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(9, 0); ctx.lineTo(0, 12); ctx.lineTo(-9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff6cf';
      ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // drones
    for (const d of this.drones) {
      if (d.dead) continue;
      const y = d.baseY + Math.sin(this.time * 2.2 + d.phase) * 34;
      ctx.save();
      ctx.translate(d.x, y);
      ctx.shadowColor = '#ff5f8a';
      ctx.shadowBlur = 22;
      ctx.fillStyle = '#ff5f8a';
      ctx.beginPath();
      ctx.moveTo(0, -16); ctx.lineTo(18, 0); ctx.lineTo(0, 16); ctx.lineTo(-18, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1a0a12';
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffd0dd';
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill();
      // rotor
      ctx.strokeStyle = 'rgba(255,150,180,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-24, -14); ctx.lineTo(24, -14); ctx.stroke();
      ctx.restore();
    }

    // player
    this.drawBot(ctx);

    this.particles.draw(ctx);
    ctx.restore();

    vignette(ctx, W, H, 0.45);
    scanlines(ctx, W, H, 0.035);

    // HUD
    ctx.save();
    ctx.font = '700 11px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(150,180,235,0.6)';
    ctx.letterSpacing = '4px';
    ctx.fillText('SCORE', 54, 62);
    glowText(ctx, String(Math.floor(this.score)).padStart(7, '0'), 54, 104, 34, '#dff1ff', { blur: 14 });
    ctx.fillStyle = 'rgba(150,180,235,0.6)';
    ctx.letterSpacing = '4px';
    ctx.fillText('BOLTS', 260, 62);
    glowText(ctx, String(this.boltsCollected).padStart(2, '0'), 260, 104, 34, '#ffd76a', { blur: 14 });
    // lives
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = i < this.lives ? 1 : 0.18;
      ctx.fillStyle = i < this.lives ? '#6fe3ff' : '#5a6a86';
      ctx.beginPath();
      ctx.arc(W - 66 - i * 30, 82, 8, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'right';
    ctx.font = '600 10px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(160,185,235,0.55)';
    ctx.fillText('LIVES', W - 60, 112);
    ctx.restore();
  }

  drawBot(ctx) {
    const p = this.player;
    const bob = p.onGround ? Math.sin(p.anim * 2) * 1.5 : 0;
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.scale(p.face, 1);
    if (!p.onGround) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const fl = ctx.createLinearGradient(0, -6, 0, 26);
      fl.addColorStop(0, 'rgba(120,220,255,0.9)');
      fl.addColorStop(1, 'rgba(80,140,255,0)');
      ctx.fillStyle = fl;
      ctx.beginPath();
      ctx.moveTo(-7, -4); ctx.lineTo(7, -4); ctx.lineTo(0, 26); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // legs
    ctx.strokeStyle = '#c9d6ee';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const stride = p.onGround ? Math.sin(p.anim * 2) * 5 : 3;
    ctx.beginPath(); ctx.moveTo(-5, -7); ctx.lineTo(-5 - stride, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, -7); ctx.lineTo(5 + stride, 0); ctx.stroke();
    // body
    ctx.shadowColor = '#5fd8ff';
    ctx.shadowBlur = 22;
    const bg = ctx.createLinearGradient(0, -40, 0, 0);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(1, '#b9cbe8');
    ctx.fillStyle = bg;
    rr(ctx, -14, -40, 28, 34, 12);
    ctx.fill();
    ctx.shadowBlur = 0;
    // visor
    ctx.fillStyle = '#0a1220';
    rr(ctx, -10, -34, 20, 15, 7);
    ctx.fill();
    ctx.fillStyle = '#6fe3ff';
    ctx.shadowColor = '#6fe3ff';
    ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(-4, -27, 2.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -27, 2.2, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // antenna
    ctx.strokeStyle = '#c9d6ee';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(0, -50); ctx.stroke();
    ctx.fillStyle = '#ffd76a';
    ctx.shadowColor = '#ffd76a';
    ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(0, -52, 3.5, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // arm
    ctx.strokeStyle = '#c9d6ee';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(12, -26); ctx.lineTo(18, -16 + (p.onGround ? Math.sin(p.anim * 2 + 1) * 3 : -4)); ctx.stroke();
    ctx.restore();
  }
}

export default {
  id: 'astro',
  title: 'ASTRO HOP',
  subtitle: 'PLAYROOM ORIGINAL',
  accent: '#6fe3ff',
  accent2: '#2f6bff',
  tagline: 'Hop the neon rooftops and grab every bolt.',
  drawCover(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#10275c');
    g.addColorStop(0.55, '#0a1633');
    g.addColorStop(1, '#050a16');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const rg = ctx.createRadialGradient(w * 0.7, h * 0.24, 4, w * 0.7, h * 0.24, w * 0.5);
    rg.addColorStop(0, 'rgba(120,200,255,0.55)');
    rg.addColorStop(1, 'rgba(20,60,140,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgba(220,240,255,${0.2 + Math.random() * 0.6})`;
      ctx.fillRect(Math.random() * w, Math.random() * h * 0.7, Math.random() > 0.9 ? 2 : 1, 1);
    }
    // planet
    ctx.fillStyle = '#4d86e8';
    ctx.beginPath(); ctx.arc(w * 0.74, h * 0.25, w * 0.18, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(150,210,255,0.55)';
    ctx.lineWidth = 4;
    ctx.save();
    ctx.translate(w * 0.74, h * 0.25);
    ctx.rotate(-0.4);
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.28, w * 0.07, 0, 0, TAU); ctx.stroke();
    ctx.restore();
    // platforms
    ctx.fillStyle = '#111d33';
    rr(ctx, w * 0.08, h * 0.68, w * 0.5, 26, 6); ctx.fill();
    ctx.fillStyle = '#1a2c4d';
    rr(ctx, w * 0.58, h * 0.56, w * 0.34, 22, 6); ctx.fill();
    ctx.strokeStyle = '#6fe3ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#6fe3ff';
    ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.68 + 1); ctx.lineTo(w * 0.55, h * 0.68 + 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * 0.6, h * 0.56 + 1); ctx.lineTo(w * 0.9, h * 0.56 + 1); ctx.stroke();
    ctx.shadowBlur = 0;
    // bot
    ctx.save();
    ctx.translate(w * 0.34, h * 0.68);
    ctx.shadowColor = '#6fe3ff';
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#e8f2ff';
    rr(ctx, -34, -78, 68, 76, 26); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#081020';
    rr(ctx, -25, -68, 50, 34, 16); ctx.fill();
    ctx.fillStyle = '#6fe3ff';
    ctx.beginPath(); ctx.arc(-10, -51, 5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(10, -51, 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath(); ctx.arc(0, -92, 7, 0, TAU); ctx.fill();
    ctx.restore();
    // title
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(w * 0.15)}px "Space Grotesk", sans-serif`;
    ctx.fillText('ASTRO', w * 0.08, h * 0.86);
    ctx.fillStyle = '#6fe3ff';
    ctx.fillText('HOP', w * 0.08 + w * 0.44, h * 0.86);
    ctx.fillStyle = 'rgba(170,205,255,0.6)';
    ctx.font = `600 ${Math.round(w * 0.045)}px "Inter", sans-serif`;
    ctx.fillText('PLAYROOM ORIGINAL', w * 0.08, h * 0.92);
  },
  create({ audio }) {
    return new Astro(audio);
  },
};

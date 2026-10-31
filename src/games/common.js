export { clamp, rand, pick, TAU } from '../util.js';

export const W = 1280;
export const H = 720;

export function rr(ctx, x, y, w, h, r) {
  const rr2 = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr2, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr2);
  ctx.arcTo(x + w, y + h, x, y + h, rr2);
  ctx.arcTo(x, y + h, x, y, rr2);
  ctx.arcTo(x, y, x + w, y, rr2);
  ctx.closePath();
}

export function glowText(ctx, text, x, y, size, color, { align = 'left', weight = 700, family = '"Space Grotesk", sans-serif', blur = 18 } = {}) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${family}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.9;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function scanlines(ctx, w, h, alpha = 0.05) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);
  ctx.restore();
}

export function vignette(ctx, w, h, strength = 0.5) {
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.85);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export class Particles {
  constructor() { this.list = []; }
  burst(x, y, color, count = 14, speed = 260, life = 0.7, size = 3) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.25 + Math.random() * 0.9);
      this.list.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * (0.5 + Math.random() * 0.8),
        max: life,
        color,
        size: size * (0.5 + Math.random()),
      });
    }
  }
  update(dt, gravity = 0, drag = 1.6) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.vy += gravity * dt;
      p.vx *= 1 - drag * dt;
      p.vy *= 1 - drag * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
  draw(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

export function drawStars(ctx, stars, w, h, camX = 0, camY = 0) {
  ctx.save();
  for (const s of stars) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = s.c;
    ctx.fillRect(((s.x - camX * s.p) % w + w) % w, ((s.y - camY * s.p) % h + h) % h, s.s, s.s);
  }
  ctx.restore();
}

export function makeStars(count = 140, w = W, h = H) {
  const colors = ['#ffffff', '#cfe0ff', '#9fc4ff', '#ffe6c0'];
  return Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    s: Math.random() > 0.9 ? 2.2 : 1.2,
    a: 0.25 + Math.random() * 0.7,
    p: 0.04 + Math.random() * 0.3,
    c: colors[(Math.random() * colors.length) | 0],
  }));
}

export function roundRectPath(ctx, x, y, w, h, r) {
  rr(ctx, x, y, w, h, r);
}

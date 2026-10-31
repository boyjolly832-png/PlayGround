import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function canvas2d(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function textureFromCanvas(canvas, { repeat = null, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

export function makeTexture(w, h, draw, opts) {
  const { canvas, ctx } = canvas2d(w, h);
  draw(ctx, w, h);
  return textureFromCanvas(canvas, opts);
}

/* ── procedural room textures ─────────────────────────────────────── */

export function woodTexture() {
  return makeTexture(512, 512, (ctx, w, h) => {
    const r = seeded(77);
    ctx.fillStyle = '#4a3324';
    ctx.fillRect(0, 0, w, h);
    const plank = 64;
    for (let x = 0; x < w; x += plank) {
      const shade = 0.72 + r() * 0.5;
      ctx.fillStyle = `rgb(${Math.round(66 * shade)}, ${Math.round(44 * shade)}, ${Math.round(29 * shade)})`;
      ctx.fillRect(x, 0, plank - 2, h);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(x + plank - 2, 0, 2, h);
      // grain
      for (let i = 0; i < 26; i++) {
        const gx = x + 4 + r() * (plank - 8);
        ctx.strokeStyle = `rgba(${r() > 0.5 ? '30,18,10' : '120,86,56'},${0.05 + r() * 0.1})`;
        ctx.lineWidth = 0.5 + r() * 1.4;
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        for (let y = 0; y <= h; y += 32) ctx.lineTo(gx + Math.sin(y * 0.03 + i) * 2.2, y);
        ctx.stroke();
      }
      // knots
      if (r() > 0.55) {
        const ky = r() * h, kx = x + plank * 0.5;
        const g = ctx.createRadialGradient(kx, ky, 0, kx, ky, 9);
        g.addColorStop(0, 'rgba(28,16,9,0.55)');
        g.addColorStop(1, 'rgba(28,16,9,0)');
        ctx.fillStyle = g;
        ctx.fillRect(kx - 10, ky - 10, 20, 20);
      }
    }
    // horizontal plank ends
    for (let y = 0; y < h; y += 256) {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0, y, w, 2);
    }
  }, { repeat: [3.2, 3.2] });
}

export function wallTexture() {
  return makeTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#232a3a';
    ctx.fillRect(0, 0, w, h);
    const r = seeded(19);
    for (let i = 0; i < 14000; i++) {
      const a = r() * 0.05;
      ctx.fillStyle = r() > 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a * 1.4})`;
      ctx.fillRect(r() * w, r() * h, 1.5, 1.5);
    }
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(10,14,24,0.28)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.02)');
    g.addColorStop(1, 'rgba(6,9,16,0.34)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }, { repeat: [2, 1] });
}

export function rugTexture() {
  return makeTexture(1024, 640, (ctx, w, h) => {
    ctx.fillStyle = '#151c2c';
    ctx.fillRect(0, 0, w, h);
    const r = seeded(4);
    ctx.strokeStyle = 'rgba(110,150,220,0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = `rgba(${r() > 0.5 ? '120,150,210' : '30,40,60'},${0.04 + r() * 0.06})`;
      ctx.fillRect(r() * w, r() * h, 2, 2);
    }
    // border
    ctx.strokeStyle = 'rgba(126,164,238,0.35)';
    ctx.lineWidth = 5;
    ctx.strokeRect(46, 46, w - 92, h - 92);
    ctx.strokeStyle = 'rgba(126,164,238,0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(66, 66, w - 132, h - 132);
    // diamond lattice
    ctx.strokeStyle = 'rgba(96,135,205,0.2)';
    ctx.lineWidth = 2;
    const step = 96;
    for (let x = -h; x < w + h; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + h, 0); ctx.stroke();
    }
    // medallion
    const cx = w / 2, cy = h / 2;
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = `rgba(${i % 2 ? '110,160,240' : '200,170,120'},${0.16 - i * 0.02})`;
      ctx.lineWidth = 3 - i * 0.4;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 190 - i * 28, 120 - i * 18, 0, 0, TAU);
      ctx.stroke();
    }
  });
}

export function cityTexture() {
  return makeTexture(1024, 640, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#040814');
    sky.addColorStop(0.45, '#0a1730');
    sky.addColorStop(0.72, '#16305a');
    sky.addColorStop(1, '#2b4a72');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const r = seeded(31);
    // stars
    for (let i = 0; i < 220; i++) {
      const a = 0.15 + r() * 0.7;
      ctx.fillStyle = `rgba(210,230,255,${a})`;
      const s = r() > 0.92 ? 2 : 1;
      ctx.fillRect(r() * w, r() * h * 0.55, s, s);
    }
    // moon
    const mx = w * 0.76, my = h * 0.19;
    const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 120);
    mg.addColorStop(0, 'rgba(220,235,255,0.95)');
    mg.addColorStop(0.12, 'rgba(190,215,255,0.55)');
    mg.addColorStop(0.4, 'rgba(120,160,240,0.13)');
    mg.addColorStop(1, 'rgba(120,160,240,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(mx - 130, my - 130, 260, 260);
    ctx.fillStyle = '#e8f1ff';
    ctx.beginPath(); ctx.arc(mx, my, 22, 0, TAU); ctx.fill();
    // haze
    const hz = ctx.createLinearGradient(0, h * 0.55, 0, h);
    hz.addColorStop(0, 'rgba(90,130,200,0)');
    hz.addColorStop(1, 'rgba(120,160,220,0.22)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);
    // skyline back
    const drawSkyline = (baseY, color, minH, maxH, lit) => {
      ctx.fillStyle = color;
      let x = -20;
      while (x < w + 20) {
        const bw = 26 + r() * 70;
        const bh = minH + r() * (maxH - minH);
        ctx.fillRect(x, baseY - bh, bw, bh);
        if (r() > 0.55) ctx.fillRect(x + bw * 0.4, baseY - bh - 20, bw * 0.2, 20);
        if (lit) {
          const cols = Math.max(1, Math.floor(bw / 14));
          const rows = Math.max(1, Math.floor(bh / 20));
          for (let c = 0; c < cols; c++) {
            for (let rr = 0; rr < rows; rr++) {
              if (r() > 0.62) {
                ctx.fillStyle = `rgba(${190 + r() * 50},${190 + r() * 40},${150 + r() * 60},${0.25 + r() * 0.55})`;
                ctx.fillRect(x + 6 + c * 14, baseY - bh + 10 + rr * 20, 4, 6);
              }
            }
          }
          ctx.fillStyle = color;
        }
        x += bw + 4 + r() * 10;
      }
    };
    drawSkyline(h * 0.9, '#0a1222', 80, 240, false);
    drawSkyline(h * 0.98, '#060c18', 60, 190, true);
    // foreground rooftops
    ctx.fillStyle = '#03070e';
    ctx.fillRect(0, h * 0.94, w, h * 0.06);
    // atmospheric glow
    const gl = ctx.createLinearGradient(0, h * 0.7, 0, h);
    gl.addColorStop(0, 'rgba(70,110,190,0)');
    gl.addColorStop(1, 'rgba(90,140,220,0.16)');
    ctx.fillStyle = gl;
    ctx.fillRect(0, h * 0.7, w, h * 0.3);
  });
}

export function posterTexture(variant = 0) {
  return makeTexture(512, 720, (ctx, w, h) => {
    const r = seeded(variant * 97 + 5);
    if (variant === 0) {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1b2a52');
      g.addColorStop(0.55, '#2f4d8f');
      g.addColorStop(1, '#0a1020');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // planet
      const pg = ctx.createRadialGradient(190, 250, 10, 210, 280, 170);
      pg.addColorStop(0, '#9ec7ff');
      pg.addColorStop(0.5, '#4d7ed6');
      pg.addColorStop(1, '#16264a');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(240, 300, 140, 0, TAU); ctx.fill();
      // ring
      ctx.save();
      ctx.translate(240, 300);
      ctx.rotate(-0.35);
      ctx.strokeStyle = 'rgba(180,215,255,0.7)';
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.ellipse(0, 0, 225, 58, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = 'rgba(120,170,255,0.35)';
      ctx.lineWidth = 26;
      ctx.beginPath(); ctx.ellipse(0, 0, 245, 70, 0, 0, TAU); ctx.stroke();
      ctx.restore();
      // stars
      for (let i = 0; i < 130; i++) {
        ctx.fillStyle = `rgba(220,235,255,${0.2 + r() * 0.6})`;
        ctx.fillRect(r() * w, r() * h, r() > 0.9 ? 2 : 1, 1);
      }
      ctx.fillStyle = '#f2f7ff';
      ctx.font = '700 54px "Space Grotesk", sans-serif';
      ctx.fillText('ASTRO', 46, 610);
      ctx.fillStyle = 'rgba(190,215,255,0.75)';
      ctx.font = '600 20px "Inter", sans-serif';
      ctx.letterSpacing = '8px';
      ctx.fillText('A PLAYROOM ORIGINAL', 48, 648);
      ctx.strokeStyle = 'rgba(180,210,255,0.3)';
      ctx.lineWidth = 3;
      ctx.strokeRect(24, 24, w - 48, h - 48);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1a0a24');
      g.addColorStop(0.5, '#5c1550');
      g.addColorStop(1, '#0a0714');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      const sun = ctx.createLinearGradient(0, h * 0.35, 0, h * 0.65);
      sun.addColorStop(0, '#ffd27a');
      sun.addColorStop(1, '#ff4d8d');
      ctx.fillStyle = sun;
      ctx.beginPath(); ctx.arc(w / 2, h * 0.46, 92, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0a0714';
      for (let i = 0; i < 7; i++) ctx.fillRect(w / 2 - 95, h * 0.45 + i * 13, 190, 4 + i * 1.2);
      // grid
      ctx.strokeStyle = 'rgba(120,230,255,0.55)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 12; i++) {
        const y = h * 0.62 + Math.pow(i / 11, 2) * h * 0.38;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      for (let i = -8; i <= 8; i++) {
        ctx.beginPath(); ctx.moveTo(w / 2 + i * 18, h * 0.62); ctx.lineTo(w / 2 + i * 88, h); ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.font = '700 52px "Space Grotesk", sans-serif';
      ctx.fillText('NEON', 46, 610);
      ctx.fillStyle = '#ff7ec8';
      ctx.fillText('DRIFT', 196, 610);
      ctx.fillStyle = 'rgba(255,190,235,0.7)';
      ctx.font = '600 18px "Inter", sans-serif';
      ctx.fillText('NIGHT CIRCUIT · 2088', 48, 646);
      ctx.strokeStyle = 'rgba(255,130,210,0.3)';
      ctx.lineWidth = 3;
      ctx.strokeRect(24, 24, w - 48, h - 48);
    }
  });
}

export function neonTexture(text, color = '#6fe3ff') {
  return makeTexture(512, 180, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = '700 104px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    for (let i = 0; i < 4; i++) {
      ctx.shadowBlur = 40 - i * 8;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.fillText(text, w / 2, h / 2);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, w / 2, h / 2);
  }, { srgb: true });
}

export function glowTexture(color = '#6fe3ff', inner = 0.9) {
  const { canvas, ctx } = canvas2d(256, 256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, color);
  g.addColorStop(0.18, color);
  g.addColorStop(0.45, 'rgba(40,80,180,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = inner;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return textureFromCanvas(canvas);
}

export function softShadowTexture() {
  const { canvas, ctx } = canvas2d(256, 256);
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.28)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return textureFromCanvas(canvas);
}

export function drawWifi(ctx, x, y, size, color = '#dfe8ff') {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(x, y + size * 0.35, size * (0.18 + i * 0.16), -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y + size * 0.35, size * 0.05, 0, TAU);
  ctx.fill();
}

export function drawBattery(ctx, x, y, w, h, level = 0.8, color = '#dfe8ff') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, y, w, h, 2);
  ctx.stroke();
  ctx.fillStyle = color;
  roundRect(ctx, x + 2, y + 2, (w - 4) * level, h - 4, 1);
  ctx.fill();
  ctx.fillRect(x + w + 1, y + h * 0.3, 2, h * 0.4);
}

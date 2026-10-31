import { clamp, rand, TAU } from '../util.js';
import { W, H, rr, Particles, makeStars, glowText, scanlines, vignette } from './common.js';

const FOCAL = 430;
const HORIZON = H * 0.44;
const CAM_Y = 1.18;
const ROAD_HALF = 2.6;
const MAX_Z = 110;

class Drift {
  constructor(audio) {
    this.audio = audio;
    this.reset();
  }

  reset() {
    this.playerX = 0;
    this.speed = 28;
    this.distance = 0;
    this.lives = 3;
    this.traffic = [];
    this.particles = new Particles();
    this.state = 'playing';
    this.overTitle = 'WRECKED';
    this.overSub = 'The night circuit claims another driver.';
    this.time = 0;
    this.shake = 0;
    this.invuln = 0;
    this.spawnTimer = 0.8;
    this.boost = 0;
    this.stars = makeStars(110);
    this.roadCenter = (z) => {
      const d = z + this.distance;
      return 2.6 * Math.sin(d * 0.021) + 1.3 * Math.sin(d * 0.0065) + 0.5 * Math.sin(d * 0.05);
    };
  }

  project(z, lane = 0) {
    const c = this.roadCenter(z);
    const x = W / 2 + (FOCAL * (c - this.playerX + lane)) / z;
    const y = HORIZON + (FOCAL * CAM_Y) / z;
    return { x, y, scale: FOCAL / z, c };
  }

  crash() {
    if (this.invuln > 0) return;
    this.lives--;
    this.invuln = 1.7;
    this.shake = 20;
    this.speed = 18;
    this.audio.hit();
    this.particles.burst(W / 2 + rand(-120, 120), H - 160, '#ff6b8b', 30, 420, 0.8, 4);
    if (this.lives <= 0) this.state = 'over';
  }

  update(dt, input) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 46);
    this.invuln = Math.max(0, this.invuln - dt);
    this.particles.update(dt, 200, 0.6);
    if (this.state !== 'playing') return;

    const steer = input.axis.x;
    this.playerX += steer * dt * (1.5 + this.speed * 0.028);
    this.playerX = clamp(this.playerX, -ROAD_HALF - 0.4, ROAD_HALF + 0.4);
    if (Math.abs(steer) < 0.1) this.playerX *= 1 - dt * 0.35;

    const boosting = input.down('action') || input.down('action2');
    this.boost += ((boosting ? 1 : 0) - this.boost) * Math.min(1, dt * 3.5);
    const target = (boosting ? 68 : 42) + Math.min(18, this.distance * 0.0009);
    this.speed += (target - this.speed) * Math.min(1, dt * 0.8);
    if (input.down('down')) this.speed -= 26 * dt;
    this.speed = clamp(this.speed, 10, 88);

    const offRoad = Math.abs(this.playerX) > ROAD_HALF - 0.15;
    if (offRoad) {
      this.shake = Math.max(this.shake, 5);
      this.speed *= 1 - dt * 0.9;
    }

    this.distance += this.speed * dt;

    this.spawnTimer -= dt * (0.7 + this.speed / 55);
    if (this.spawnTimer <= 0) {
      this.spawnTimer = rand(0.5, 1.15);
      const lane = rand(-1.9, 1.9);
      this.traffic.push({
        z: rand(55, 100),
        lane,
        color: ['#ff4f7d', '#ffb84f', '#5fd8ff', '#b48cff'][(Math.random() * 4) | 0],
        wobble: rand(0, TAU),
      });
    }

    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const car = this.traffic[i];
      car.z -= this.speed * dt * 0.82;
      if (car.z < 2.0) {
        if (Math.abs(car.lane - this.playerX) < 0.55) this.crash();
        this.traffic.splice(i, 1);
      }
    }

    if (Math.random() < dt * 14 && this.speed > 30) {
      this.particles.list.push({
        x: W / 2 + rand(-W * 0.45, W * 0.45), y: H * 0.55 + rand(0, H * 0.4),
        vx: rand(-30, 30), vy: rand(250, 600), life: 0.35, max: 0.35,
        color: boosting ? '#8fe9ff' : 'rgba(150,180,255,0.7)', size: rand(1, 2.6),
      });
    }
  }

  drawSky(ctx) {
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 80);
    sky.addColorStop(0, '#060815');
    sky.addColorStop(0.4, '#1b1035');
    sky.addColorStop(0.75, '#5c1c56');
    sky.addColorStop(1, '#b3405d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, HORIZON + 80);
    // stars
    ctx.save();
    for (const s of this.stars) {
      ctx.globalAlpha = s.a * 0.7;
      ctx.fillStyle = s.c;
      ctx.fillRect(s.x - this.playerX * 6 * s.p, s.y, s.s, s.s);
    }
    ctx.restore();
    // sun
    const sx = W * 0.5 - this.playerX * 40;
    const sy = HORIZON - 30;
    const sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 260);
    sg.addColorStop(0, 'rgba(255,190,120,0.95)');
    sg.addColorStop(0.3, 'rgba(255,90,150,0.45)');
    sg.addColorStop(1, 'rgba(255,60,140,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 270, sy - 270, 540, 540);
    ctx.fillStyle = '#ffb45e';
    ctx.beginPath(); ctx.arc(sx, sy, 74, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(70,10,60,0.75)';
    for (let i = 0; i < 7; i++) ctx.fillRect(sx - 78, sy + 6 + i * 10, 156, 3 + i * 1.2);

    // mountains
    ctx.fillStyle = '#1a0d2e';
    ctx.beginPath();
    ctx.moveTo(0, HORIZON);
    for (let x = 0; x <= W; x += 80) {
      ctx.lineTo(x, HORIZON - 40 - Math.abs(Math.sin(x * 0.006 + 1.2)) * 90);
    }
    ctx.lineTo(W, HORIZON + 20);
    ctx.lineTo(0, HORIZON + 20);
    ctx.closePath();
    ctx.fill();

    // city skyline
    ctx.fillStyle = '#0d0819';
    const off = this.playerX * 30;
    for (let i = 0; i < 30; i++) {
      const bw = 24 + ((i * 41) % 46);
      const bh = 20 + ((i * 67) % 95);
      const x = i * 48 - off - 40;
      ctx.fillRect(x, HORIZON - bh + 18, bw, bh);
      ctx.fillStyle = 'rgba(255,120,190,0.5)';
      for (let wy = 0; wy < bh; wy += 14) {
        if ((i * 7 + wy) % 3 === 0) ctx.fillRect(x + 6, HORIZON - bh + 24 + wy, 3, 5);
      }
      ctx.fillStyle = '#0d0819';
    }
    // horizon glow
    const hg = ctx.createLinearGradient(0, HORIZON - 20, 0, HORIZON + 50);
    hg.addColorStop(0, 'rgba(255,90,170,0)');
    hg.addColorStop(0.5, 'rgba(255,90,170,0.22)');
    hg.addColorStop(1, 'rgba(80,220,255,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, HORIZON - 20, W, 70);
  }

  drawRoad(ctx) {
    ctx.fillStyle = '#04060d';
    ctx.fillRect(0, HORIZON, W, H - HORIZON);
    // distant grid
    ctx.save();
    ctx.strokeStyle = 'rgba(80,220,255,0.09)';
    ctx.lineWidth = 1;
    for (let z = 8; z < 120; z += 6) {
      const p = this.project(z, 0);
      ctx.beginPath();
      ctx.moveTo(0, p.y);
      ctx.lineTo(W, p.y);
      ctx.stroke();
    }
    ctx.restore();

    const step = 1.4;
    for (let z = MAX_Z; z >= 2; z -= step) {
      const zf = z + step;
      const near = this.project(z);
      const far = this.project(zf);
      if (near.y < HORIZON) continue;
      const nearL = this.project(z, -ROAD_HALF);
      const nearR = this.project(z, ROAD_HALF);
      const farL = this.project(zf, -ROAD_HALF);
      const farR = this.project(zf, ROAD_HALF);
      const band = Math.floor((z + this.distance) / (step * 3)) % 2;
      ctx.fillStyle = band ? '#11162a' : '#0c1020';
      ctx.beginPath();
      ctx.moveTo(farL.x, farL.y);
      ctx.lineTo(farR.x, farR.y);
      ctx.lineTo(nearR.x, nearR.y);
      ctx.lineTo(nearL.x, nearL.y);
      ctx.closePath();
      ctx.fill();

      // neon edges
      ctx.strokeStyle = band ? 'rgba(95,216,255,0.55)' : 'rgba(255,79,160,0.5)';
      ctx.lineWidth = Math.max(1, 3.2 / (z * 0.1 + 1));
      ctx.beginPath();
      ctx.moveTo(farL.x, farL.y);
      ctx.lineTo(nearL.x, nearL.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(farR.x, farR.y);
      ctx.lineTo(nearR.x, nearR.y);
      ctx.stroke();

      // center dashes
      if (Math.floor((z + this.distance) / (step * 3)) % 2 === 0) {
        const cN = this.project(z, 0);
        const cF = this.project(zf, 0);
        const wN = Math.max(1.2, FOCAL * 0.07 / z);
        const wF = Math.max(1, FOCAL * 0.07 / zf);
        ctx.fillStyle = 'rgba(255,214,106,0.7)';
        ctx.beginPath();
        ctx.moveTo(cF.x - wF, cF.y);
        ctx.lineTo(cF.x + wF, cF.y);
        ctx.lineTo(cN.x + wN, cN.y);
        ctx.lineTo(cN.x - wN, cN.y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawTraffic(ctx) {
    const sorted = [...this.traffic].sort((a, b) => b.z - a.z);
    for (const car of sorted) {
      if (car.z < 2) continue;
      const p = this.project(car.z, car.lane + Math.sin(this.time * 1.3 + car.wobble) * 0.08);
      const scale = p.scale;
      const w = Math.max(8, 1.35 * scale);
      const h = Math.max(6, 0.78 * scale);
      if (p.y < HORIZON + 2) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.ellipse(0, 0, w * 0.6, h * 0.18, 0, 0, TAU); ctx.fill();
      // body
      const g = ctx.createLinearGradient(0, -h, 0, 0);
      g.addColorStop(0, '#232a3e');
      g.addColorStop(1, '#070a12');
      ctx.fillStyle = g;
      rr(ctx, -w / 2, -h, w, h, Math.max(2, w * 0.08));
      ctx.fill();
      ctx.strokeStyle = car.color;
      ctx.lineWidth = Math.max(1, w * 0.03);
      ctx.globalAlpha = 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1;
      // roof
      ctx.fillStyle = '#0b0f1a';
      rr(ctx, -w * 0.32, -h * 1.25, w * 0.64, h * 0.5, Math.max(1, w * 0.04));
      ctx.fill();
      // tail lights
      ctx.shadowColor = car.color;
      ctx.shadowBlur = Math.max(4, w * 0.5);
      ctx.fillStyle = car.color;
      ctx.fillRect(-w * 0.4, -h * 0.55, w * 0.16, Math.max(1.5, h * 0.1));
      ctx.fillRect(w * 0.24, -h * 0.55, w * 0.16, Math.max(1.5, h * 0.1));
      ctx.restore();
    }
  }

  drawHood(ctx) {
    ctx.save();
    const tilt = -this.playerX * 12;
    ctx.translate(W / 2 + tilt, H);
    const g = ctx.createLinearGradient(0, -180, 0, 0);
    g.addColorStop(0, '#1a2238');
    g.addColorStop(1, '#05070d');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-330, 0);
    ctx.lineTo(-210, -120);
    ctx.quadraticCurveTo(0, -158, 210, -120);
    ctx.lineTo(330, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(95,216,255,0.55)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#5fd8ff';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(-212, -118);
    ctx.quadraticCurveTo(0, -156, 212, -118);
    ctx.stroke();
    // cockpit reflection
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,79,160,0.55)';
    ctx.fillRect(-250, -34, 500, 2);
    ctx.restore();
  }

  draw(ctx) {
    const shx = this.shake ? rand(-this.shake, this.shake) : 0;
    const shy = this.shake ? rand(-this.shake, this.shake) : 0;
    ctx.save();
    ctx.translate(shx, shy);
    this.drawSky(ctx);
    this.drawRoad(ctx);
    this.drawTraffic(ctx);
    this.particles.draw(ctx);
    this.drawHood(ctx);
    ctx.restore();

    // speed streaks
    if (this.boost > 0.25) {
      ctx.save();
      ctx.globalAlpha = this.boost * 0.5;
      ctx.strokeStyle = '#9fe9ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < 16; i++) {
        const x = (i * 97 + this.time * 900) % W;
        const y = HORIZON + ((i * 53) % (H - HORIZON));
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 30 + this.boost * 60, y); ctx.stroke();
      }
      ctx.restore();
    }

    vignette(ctx, W, H, 0.55);
    scanlines(ctx, W, H, 0.04);

    // HUD
    const kmh = Math.round(this.speed * 3.6);
    ctx.save();
    ctx.font = '700 11px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,150,205,0.65)';
    ctx.letterSpacing = '4px';
    ctx.fillText('DISTANCE', 54, 62);
    glowText(ctx, `${Math.floor(this.distance).toLocaleString('en-US')}m`, 54, 102, 32, '#ffe9f7', { blur: 14 });
    ctx.fillStyle = 'rgba(255,150,205,0.65)';
    ctx.letterSpacing = '4px';
    ctx.fillText('SPEED', W - 210, 62);
    glowText(ctx, String(kmh), W - 210, 102, 36, '#ffd76a', { blur: 16 });
    ctx.font = '600 11px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(255,220,180,0.6)';
    ctx.fillText('KM/H', W - 210, 120);
    // lives
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = i < this.lives ? 1 : 0.16;
      ctx.fillStyle = '#ff6b9d';
      ctx.beginPath();
      ctx.moveTo(W - 64 - i * 26, 88);
      ctx.bezierCurveTo(W - 74 - i * 26, 76, W - 54 - i * 26, 74, W - 64 - i * 26, 88);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}

export default {
  id: 'drift',
  title: 'NEON DRIFT',
  subtitle: 'NIGHT CIRCUIT · 2088',
  accent: '#ff4f9d',
  accent2: '#5c1c56',
  tagline: 'Chase the horizon. Thread the traffic. Don’t blink.',
  drawCover(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1a0a24');
    g.addColorStop(0.5, '#5c1550');
    g.addColorStop(1, '#0a0714');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const sx = w / 2, sy = h * 0.4;
    const sg = ctx.createRadialGradient(sx, sy, 4, sx, sy, w * 0.42);
    sg.addColorStop(0, 'rgba(255,210,122,0.9)');
    sg.addColorStop(0.5, 'rgba(255,77,141,0.35)');
    sg.addColorStop(1, 'rgba(255,77,141,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffcf7a';
    ctx.beginPath(); ctx.arc(sx, sy, w * 0.16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0a0714';
    for (let i = 0; i < 6; i++) ctx.fillRect(sx - w * 0.17, sy + 6 + i * 9, w * 0.34, 3 + i);
    ctx.strokeStyle = 'rgba(120,230,255,0.5)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      const y = h * 0.56 + Math.pow(i / 9, 2) * h * 0.4;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = -7; i <= 7; i++) {
      ctx.beginPath(); ctx.moveTo(w / 2 + i * 14, h * 0.56); ctx.lineTo(w / 2 + i * 70, h); ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(w * 0.16)}px "Space Grotesk", sans-serif`;
    ctx.fillText('NEON', w * 0.07, h * 0.84);
    ctx.fillStyle = '#ff7ec8';
    ctx.fillText('DRIFT', w * 0.07 + w * 0.43, h * 0.84);
    ctx.fillStyle = 'rgba(255,190,235,0.65)';
    ctx.font = `600 ${Math.round(w * 0.045)}px "Inter", sans-serif`;
    ctx.fillText('NIGHT CIRCUIT · 2088', w * 0.07, h * 0.9);
  },
  create({ audio }) {
    return new Drift(audio);
  },
};

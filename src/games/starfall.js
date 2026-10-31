import { clamp, rand, TAU } from '../util.js';
import { W, H, rr, Particles, makeStars, drawStars, glowText, scanlines, vignette } from './common.js';

class Starfall {
  constructor(audio) {
    this.audio = audio;
    this.reset();
  }

  reset() {
    this.player = { x: W / 2, y: H - 130, vx: 0, vy: 0, invuln: 2, fireCd: 0, tilt: 0 };
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.pickups = [];
    this.particles = new Particles();
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.time = 0;
    this.spawnTimer = 0.6;
    this.waveTimer = 0;
    this.state = 'playing';
    this.overTitle = 'SIGNAL LOST';
    this.overSub = 'The starfall swallowed your ship.';
    this.shake = 0;
    this.empCd = 0;
    this.empFx = 0;
    this.weapon = 0;
    this.weaponTimer = 0;
    this.stars = makeStars(180);
    this.stars2 = makeStars(70);
  }

  fire() {
    const p = this.player;
    const speed = -1050;
    const mk = (dx, ang = 0) => {
      this.bullets.push({ x: p.x + dx, y: p.y - 22, vx: Math.sin(ang) * 260, vy: speed, life: 2, dmg: 1 });
    };
    if (this.weapon > 0) {
      mk(-16, -0.12); mk(0, 0); mk(16, 0.12);
    } else {
      mk(-8); mk(8);
    }
    this.audio.tone(880 + Math.random() * 80, 0.04, { type: 'square', gain: 0.018 });
  }

  spawnEnemy() {
    const diff = Math.min(1, this.time / 90);
    const roll = Math.random();
    let type = 'grunt';
    if (roll > 0.82 - diff * 0.1) type = 'tank';
    else if (roll > 0.5) type = 'zig';
    const hp = type === 'tank' ? 6 : type === 'zig' ? 2 : 1;
    const radius = type === 'tank' ? 30 : 20;
    this.enemies.push({
      x: rand(70, W - 70),
      y: -50,
      type,
      hp,
      maxHp: hp,
      r: radius,
      speed: (type === 'tank' ? 42 : type === 'zig' ? 100 : 85) + diff * 40,
      phase: rand(0, TAU),
      baseX: rand(70, W - 70),
      shootCd: rand(1.2, 2.6),
      flash: 0,
    });
  }

  hitPlayer() {
    const p = this.player;
    if (p.invuln > 0) return;
    this.lives--;
    this.shake = 18;
    this.audio.hit();
    this.particles.burst(p.x, p.y, '#ff7d9c', 30, 420, 0.9, 4);
    p.invuln = 2.2;
    this.weapon = 0;
    this.weaponTimer = 0;
    if (this.lives <= 0) this.state = 'over';
  }

  update(dt, input) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt * 45);
    this.empFx = Math.max(0, this.empFx - dt);
    this.empCd = Math.max(0, this.empCd - dt);
    this.particles.update(dt, 0, 0.8);
    if (this.state !== 'playing') return;

    const p = this.player;
    p.invuln = Math.max(0, p.invuln - dt);
    const focus = input.down('action') ? 0.55 : 1;
    const speed = 460 * focus;
    const ax = input.axis.x;
    const ay = input.axis.y;
    p.vx += (ax * speed - p.vx) * Math.min(1, dt * 12);
    p.vy += (ay * speed - p.vy) * Math.min(1, dt * 12);
    p.x = clamp(p.x + p.vx * dt, 50, W - 50);
    p.y = clamp(p.y + p.vy * dt, H * 0.38, H - 64);
    p.tilt += (p.vx / 460 - p.tilt) * Math.min(1, dt * 8);

    p.fireCd -= dt;
    if (p.fireCd <= 0) {
      this.fire();
      p.fireCd = this.weapon > 0 ? 0.085 : 0.13;
    }

    if (input.pressed('action') && this.empCd <= 0) {
      this.empCd = 5;
      this.empFx = 0.7;
      this.shake = 10;
      this.audio.tone(120, 0.5, { type: 'sine', gain: 0.09, slide: 520 });
      this.audio.noise(0.4, { gain: 0.05, freq: 1400 });
      for (const b of this.enemyBullets) this.particles.burst(b.x, b.y, '#8fe9ff', 2, 90, 0.35, 2);
      this.enemyBullets.length = 0;
      for (const e of this.enemies) {
        e.hp -= 2;
        e.flash = 0.15;
        this.particles.burst(e.x, e.y, '#8fe9ff', 6, 150, 0.4, 2);
      }
    }

    this.weaponTimer = Math.max(0, this.weaponTimer - dt);
    if (this.weaponTimer <= 0) this.weapon = 0;

    // waves
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(0.22, 0.8 - this.time * 0.006);
      this.spawnEnemy();
      if (this.time > 30 && Math.random() < 0.35) this.spawnEnemy();
    }
    this.waveTimer += dt;
    if (this.waveTimer > 20) {
      this.waveTimer = 0;
      this.wave++;
    }

    // player bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.y < -20) { this.bullets.splice(i, 1); continue; }
      for (const e of this.enemies) {
        if (e.hp > 0 && Math.hypot(b.x - e.x, b.y - e.y) < e.r + 5) {
          e.hp -= b.dmg;
          e.flash = 0.12;
          this.particles.burst(b.x, b.y, '#a8f0ff', 5, 130, 0.3, 2);
          this.bullets.splice(i, 1);
          if (e.hp <= 0) {
            this.score += e.type === 'tank' ? 150 : e.type === 'zig' ? 80 : 50;
            this.audio.tone(220, 0.16, { type: 'sawtooth', gain: 0.03, slide: 90 });
            this.particles.burst(e.x, e.y, e.type === 'tank' ? '#ffb84f' : '#ff7d9c', 24, 300, 0.7, 3.5);
            if (Math.random() < (e.type === 'tank' ? 0.55 : 0.1)) {
              this.pickups.push({ x: e.x, y: e.y, vy: 60, kind: Math.random() < 0.5 ? 'rapid' : 'shield', phase: rand(0, TAU) });
            }
          }
          break;
        }
      }
    }

    // enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp <= 0) { this.enemies.splice(i, 1); continue; }
      e.flash = Math.max(0, e.flash - dt);
      if (e.type === 'zig') {
        e.phase += dt * 2.2;
        e.x = e.baseX + Math.sin(e.phase) * 130;
        e.y += e.speed * dt * 0.75;
      } else {
        e.y += e.speed * dt;
      }
      e.x = clamp(e.x, 40, W - 40);
      if (e.y > H + 60) { this.enemies.splice(i, 1); continue; }
      if (e.y > 0 && e.y < H * 0.7) {
        e.shootCd -= dt;
        if (e.shootCd <= 0) {
          e.shootCd = rand(1.4, 2.8);
          const ang = Math.atan2(p.y - e.y, p.x - e.x);
          const sp = 250 + Math.min(160, this.time * 2);
          this.enemyBullets.push({ x: e.x, y: e.y + e.r * 0.6, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 5 });
        }
      }
      if (Math.hypot(p.x - e.x, p.y - e.y) < e.r + 16) {
        e.hp = 0;
        this.particles.burst(e.x, e.y, '#ffb84f', 18, 260, 0.6, 3);
        this.hitPlayer();
      }
    }

    // enemy bullets
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.y > H + 20 || b.x < -20 || b.x > W + 20) { this.enemyBullets.splice(i, 1); continue; }
      if (Math.hypot(p.x - b.x, p.y - b.y) < 17) {
        this.enemyBullets.splice(i, 1);
        this.hitPlayer();
      }
    }

    // pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.y += pk.vy * dt;
      pk.phase += dt * 4;
      if (pk.y > H + 20) { this.pickups.splice(i, 1); continue; }
      if (Math.hypot(p.x - pk.x, p.y - pk.y) < 30) {
        this.pickups.splice(i, 1);
        if (pk.kind === 'rapid') { this.weapon = 1; this.weaponTimer = 12; }
        else { p.invuln = Math.max(p.invuln, 4.5); }
        this.audio.coin();
        this.particles.burst(pk.x, pk.y, '#8fe9ff', 16, 200, 0.5, 3);
      }
    }

    this.score += dt * 8;
  }

  drawShip(ctx, x, y, tilt) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt * 0.22);
    // engine flame
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const fl = ctx.createLinearGradient(0, 12, 0, 54);
    fl.addColorStop(0, 'rgba(120,225,255,0.9)');
    fl.addColorStop(1, 'rgba(60,120,255,0)');
    ctx.fillStyle = fl;
    ctx.beginPath(); ctx.moveTo(-8, 14); ctx.lineTo(8, 14); ctx.lineTo(0, 54); ctx.closePath(); ctx.fill();
    ctx.restore();
    // wings
    ctx.shadowColor = '#5fd8ff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#cfe3ff';
    ctx.beginPath();
    ctx.moveTo(0, -30);
    ctx.lineTo(30, 18);
    ctx.lineTo(10, 12);
    ctx.lineTo(0, 20);
    ctx.lineTo(-10, 12);
    ctx.lineTo(-30, 18);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#23375c';
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(13, 10);
    ctx.lineTo(0, 6);
    ctx.lineTo(-13, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6fe3ff';
    ctx.shadowColor = '#6fe3ff';
    ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(0, -6, 5, 0, TAU); ctx.fill();
    ctx.restore();
  }

  draw(ctx) {
    const shx = this.shake ? rand(-this.shake, this.shake) : 0;
    const shy = this.shake ? rand(-this.shake, this.shake) : 0;
    ctx.save();
    ctx.translate(shx, shy);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#03060f');
    bg.addColorStop(0.5, '#071027');
    bg.addColorStop(1, '#040711');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const neb = ctx.createRadialGradient(W * 0.22, H * 0.28, 10, W * 0.22, H * 0.28, 420);
    neb.addColorStop(0, 'rgba(60,120,220,0.22)');
    neb.addColorStop(1, 'rgba(60,120,220,0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, W, H);
    const neb2 = ctx.createRadialGradient(W * 0.78, H * 0.62, 10, W * 0.78, H * 0.62, 380);
    neb2.addColorStop(0, 'rgba(190,60,150,0.14)');
    neb2.addColorStop(1, 'rgba(190,60,150,0)');
    ctx.fillStyle = neb2;
    ctx.fillRect(0, 0, W, H);
    drawStars(ctx, this.stars, W, H, 0, -this.time * 18);
    drawStars(ctx, this.stars2, W, H, 0, -this.time * 50);

    // grid
    ctx.save();
    ctx.strokeStyle = 'rgba(80,140,230,0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = (this.time * 20) % 64; y < H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();

    // pickups
    for (const pk of this.pickups) {
      ctx.save();
      ctx.translate(pk.x, pk.y + Math.sin(pk.phase) * 4);
      ctx.rotate(pk.phase * 0.5);
      ctx.shadowColor = '#6fe3ff';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = '#6fe3ff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-10, -10, 20, 20);
      ctx.fillStyle = pk.kind === 'rapid' ? '#ffd76a' : '#6fe3ff';
      ctx.font = '700 12px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'rapid' ? 'R' : 'S', 0, 4);
      ctx.restore();
    }

    // enemies
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);
      const col = e.type === 'tank' ? '#ffb84f' : e.type === 'zig' ? '#c78bff' : '#ff6b8b';
      ctx.shadowColor = col;
      ctx.shadowBlur = 18;
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : col;
      ctx.beginPath();
      if (e.type === 'tank') {
        ctx.moveTo(0, e.r); ctx.lineTo(e.r, 0); ctx.lineTo(e.r * 0.6, -e.r * 0.8);
        ctx.lineTo(-e.r * 0.6, -e.r * 0.8); ctx.lineTo(-e.r, 0); ctx.closePath();
      } else {
        ctx.moveTo(0, e.r); ctx.lineTo(e.r * 0.9, -e.r * 0.7); ctx.lineTo(0, -e.r * 0.2);
        ctx.lineTo(-e.r * 0.9, -e.r * 0.7); ctx.closePath();
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#120612';
      ctx.beginPath(); ctx.arc(0, e.type === 'tank' ? 0 : 2, e.r * 0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffe2ec';
      ctx.beginPath(); ctx.arc(0, e.type === 'tank' ? 0 : 2, e.r * 0.12, 0, TAU); ctx.fill();
      if (e.hp < e.maxHp) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-e.r, -e.r - 12, e.r * 2, 4);
        ctx.fillStyle = col;
        ctx.fillRect(-e.r, -e.r - 12, (e.r * 2 * e.hp) / e.maxHp, 4);
      }
      ctx.restore();
    }

    // bullets
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of this.bullets) {
      ctx.strokeStyle = 'rgba(140,240,255,0.9)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#6fe3ff';
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(b.x, b.y + 10); ctx.lineTo(b.x, b.y - 14); ctx.stroke();
    }
    for (const b of this.enemyBullets) {
      ctx.strokeStyle = 'rgba(255,130,180,0.9)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff5f9c';
      ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.restore();

    if (this.player.invuln <= 0 || Math.sin(this.time * 30) > 0) {
      this.drawShip(ctx, this.player.x, this.player.y, this.player.tilt);
    }

    // emp ring
    if (this.empFx > 0) {
      const t = 1 - this.empFx / 0.7;
      ctx.save();
      ctx.strokeStyle = `rgba(140,235,255,${1 - t})`;
      ctx.lineWidth = 6 * (1 - t) + 1;
      ctx.beginPath(); ctx.arc(this.player.x, this.player.y, t * 620, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    this.particles.draw(ctx);
    ctx.restore();

    vignette(ctx, W, H, 0.55);
    scanlines(ctx, W, H, 0.035);

    // HUD
    ctx.save();
    ctx.font = '700 11px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(150,190,255,0.6)';
    ctx.letterSpacing = '4px';
    ctx.fillText('SCORE', 54, 62);
    glowText(ctx, String(Math.floor(this.score)).padStart(7, '0'), 54, 102, 32, '#e6f4ff', { blur: 14 });
    ctx.fillStyle = 'rgba(150,190,255,0.6)';
    ctx.letterSpacing = '4px';
    ctx.fillText('WAVE', 262, 62);
    glowText(ctx, String(this.wave).padStart(2, '0'), 262, 102, 32, '#8fe9ff', { blur: 14 });
    // lives
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = i < this.lives ? 1 : 0.16;
      ctx.fillStyle = '#ff7d9c';
      ctx.beginPath();
      ctx.moveTo(W - 64 - i * 28, 92);
      ctx.lineTo(W - 74 - i * 28, 74);
      ctx.lineTo(W - 84 - i * 28, 92);
      ctx.closePath(); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // emp cooldown
    ctx.fillStyle = 'rgba(150,190,255,0.5)';
    ctx.font = '600 10px "Inter", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('EMP', W - 54, 124);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    rr(ctx, W - 132, 132, 78, 6, 3); ctx.fill();
    ctx.fillStyle = this.empCd <= 0 ? '#6fe3ff' : '#4a6fa0';
    rr(ctx, W - 132, 132, 78 * (1 - this.empCd / 5), 6, 3); ctx.fill();
    if (this.weapon > 0) {
      ctx.fillStyle = '#ffd76a';
      ctx.fillText(`RAPID ${this.weaponTimer.toFixed(1)}s`, W - 54, 158);
    }
    ctx.restore();
  }
}

export default {
  id: 'starfall',
  title: 'STARFALL',
  subtitle: 'DEEP SPACE DEFENSE',
  accent: '#8fe9ff',
  accent2: '#173f6b',
  tagline: 'Hold the line. Light up the dark.',
  drawCover(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#040b1c');
    g.addColorStop(0.6, '#0a1b3a');
    g.addColorStop(1, '#02040a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const neb = ctx.createRadialGradient(w * 0.3, h * 0.35, 4, w * 0.3, h * 0.35, w * 0.6);
    neb.addColorStop(0, 'rgba(80,180,255,0.4)');
    neb.addColorStop(1, 'rgba(20,60,140,0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(220,240,255,${0.2 + Math.random() * 0.7})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, Math.random() > 0.9 ? 2 : 1, 1);
    }
    // ship
    ctx.save();
    ctx.translate(w * 0.5, h * 0.55);
    ctx.scale(w / 320, w / 320);
    ctx.shadowColor = '#6fe3ff';
    ctx.shadowBlur = 30;
    ctx.fillStyle = '#d7e9ff';
    ctx.beginPath();
    ctx.moveTo(0, -110); ctx.lineTo(90, 60); ctx.lineTo(26, 34); ctx.lineTo(0, 62);
    ctx.lineTo(-26, 34); ctx.lineTo(-90, 60); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#18305a';
    ctx.beginPath();
    ctx.moveTo(0, -86); ctx.lineTo(38, 40); ctx.lineTo(0, 18); ctx.lineTo(-38, 40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6fe3ff';
    ctx.beginPath(); ctx.arc(0, -30, 12, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 ${Math.round(w * 0.16)}px "Space Grotesk", sans-serif`;
    ctx.fillText('STAR', w * 0.07, h * 0.84);
    ctx.fillStyle = '#8fe9ff';
    ctx.fillText('FALL', w * 0.07 + w * 0.4, h * 0.84);
    ctx.fillStyle = 'rgba(170,220,255,0.65)';
    ctx.font = `600 ${Math.round(w * 0.045)}px "Inter", sans-serif`;
    ctx.fillText('DEEP SPACE DEFENSE', w * 0.07, h * 0.9);
  },
  create({ audio }) {
    return new Starfall(audio);
  },
};

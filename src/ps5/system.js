import * as THREE from 'three';
import { games } from '../games/index.js';
import { W, H, rr, glowText, vignette, scanlines } from '../games/common.js';
import { clamp, damp, drawWifi, drawBattery, TAU } from '../util.js';

const TILE_W = 178;
const TILE_H = 238;
const GAP = 24;
const ROW_Y = 196;
const START_X = 90;

export class PS5System {
  constructor({ audio, onVault, onStand }) {
    this.audio = audio;
    this.onVault = onVault;
    this.onStand = onStand;

    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 8;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;

    this.state = 'off';
    this.time = 0;
    this.bootT = 0;
    this.homeEnter = 0;
    this.launchT = 0;
    this.selected = 0;
    this.scroll = 0;
    this.pointer = { x: -1, y: -1, over: false };
    this.hoverCooldown = 0;
    this.navTimer = 0;
    this.game = null;
    this.paused = false;
    this.active = false;
    this.accent = '#2f6bff';
    this.flash = 0;

    this.covers = [];
    this.vaultCover = null;
    this.buildCovers();
    if (document.fonts?.ready) document.fonts.ready.then(() => this.buildCovers());
  }

  buildCovers() {
    this.covers = games.map((g) => {
      const c = document.createElement('canvas');
      c.width = 360;
      c.height = 480;
      const ctx = c.getContext('2d');
      try { g.drawCover(ctx, 360, 480); } catch (e) { console.error(e); }
      return c;
    });
    const c = document.createElement('canvas');
    c.width = 360;
    c.height = 480;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 360, 480);
    g.addColorStop(0, '#0a1020');
    g.addColorStop(1, '#05070d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 360, 480);
    ctx.save();
    ctx.strokeStyle = 'rgba(120,170,255,0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    rr(ctx, 24, 24, 312, 432, 18);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(120,190,255,0.6)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(180, 170); ctx.lineTo(180, 260);
    ctx.moveTo(135, 215); ctx.lineTo(225, 215);
    ctx.stroke();
    ctx.fillStyle = '#dbeaff';
    ctx.font = '700 26px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME VAULT', 180, 320);
    ctx.fillStyle = 'rgba(160,190,240,0.6)';
    ctx.font = '500 12px "Inter", sans-serif';
    ctx.fillText('LOAD ANY HTML5 GAME', 180, 344);
    ctx.fillText('ONTO THE BIG SCREEN', 180, 362);
    ctx.strokeStyle = 'rgba(120,190,255,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(44, 404, 272, 1);
    ctx.fillStyle = 'rgba(120,190,255,0.5)';
    ctx.font = '600 10px "Inter", sans-serif';
    ctx.fillText('PASTE URL · DROP FILE', 180, 428);
    this.vaultCover = c;
  }

  get isOn() { return this.state !== 'off'; }

  get accentColor() {
    if (this.state === 'game' && this.game) return this.game.accent || '#2f6bff';
    if (this.state === 'launch' && this.launchGameRef) return this.launchGameRef.accent || '#2f6bff';
    if (this.state === 'off') return '#0a1020';
    return '#2f6bff';
  }

  get statusLabel() {
    if (this.state === 'off') return 'Powered off';
    if (this.state === 'boot') return 'Starting up…';
    if (this.state === 'launch') return 'Loading game…';
    if (this.state === 'game') return this.game ? this.game.title : 'Game';
    return 'Home';
  }

  powerOn() {
    if (this.state !== 'off') return;
    this.state = 'boot';
    this.bootT = 0;
    this.flash = 1;
    this.audio.boot();
  }

  powerOff() {
    if (this.state === 'off') return;
    this.state = 'off';
    this.game = null;
    this.paused = false;
    this.audio.powerDown();
  }

  wake() {
    if (this.state === 'off') this.powerOn();
  }

  setActive(active) {
    this.active = active;
    if (this.state === 'game') this.paused = !active;
  }

  resumeHome() {
    this.state = 'home';
    this.game = null;
    this.paused = false;
    this.homeEnter = 0;
    this.launchGameRef = null;
  }

  goHome() {
    if (this.state === 'game' || this.state === 'launch') {
      this.audio.back();
      this.state = 'home';
      this.game = null;
      this.paused = false;
      this.homeEnter = 0;
      this.launchGameRef = null;
    }
  }

  moveSelection(dir) {
    const n = games.length + 1;
    this.selected = (this.selected + dir + n) % n;
    this.audio.hover();
  }

  activateSelection() {
    if (this.selected >= games.length) {
      this.audio.click();
      this.onVault?.();
      return;
    }
    this.audio.launch();
    this.launchGameRef = games[this.selected];
    this.state = 'launch';
    this.launchT = 0;
  }

  pointerAt(x, y) {
    if (this.state !== 'home') return null;
    const localY = y - ROW_Y;
    if (localY < -12 || localY > TILE_H + 24) return null;
    for (let i = 0; i < games.length + 1; i++) {
      const tx = START_X + i * (TILE_W + GAP) - this.scroll;
      if (x > tx && x < tx + TILE_W) return i;
    }
    return null;
  }

  pointerMove(x, y) {
    this.pointer.x = x;
    this.pointer.y = y;
    if (this.state !== 'home') { this.pointer.over = false; return; }
    const idx = this.pointerAt(x, y);
    this.pointer.over = idx !== null;
    if (idx !== null && idx !== this.selected) {
      this.selected = idx;
      this.hoverCooldown = 0.04;
    }
    // tabs
    if (y > 100 && y < 134 && x > 84 && x < 340) this.pointer.over = true;
  }

  click(x, y) {
    if (this.state === 'home') {
      if (y > 100 && y < 136 && x > 84 && x < 232) {
        this.selected = 0;
        return;
      }
      if (y > 100 && y < 136 && x > 240 && x < 420) {
        this.audio.click();
        this.onVault?.();
        return;
      }
      const idx = this.pointerAt(x, y);
      if (idx !== null) {
        this.selected = idx;
        this.activateSelection();
      }
      return;
    }
    if (this.state === 'game' && this.game?.state === 'over') {
      this.audio.click();
      this.game.reset();
      return;
    }
    if (this.state === 'game' && y < 60 && x > W - 170) {
      this.goHome();
    }
  }

  update(dt, input) {
    this.time += dt;
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.hoverCooldown = Math.max(0, this.hoverCooldown - dt);
    if (this.state === 'off') return;

    if (this.state === 'boot') {
      this.bootT += dt;
      if (this.bootT > 3.5) {
        this.state = 'home';
        this.homeEnter = 0;
      }
      return;
    }

    if (this.state === 'home') {
      this.homeEnter = Math.min(1, this.homeEnter + dt * 1.6);
      const totalW = (games.length + 1) * TILE_W + games.length * GAP;
      const maxScroll = Math.max(0, START_X + totalW - W + 90);
      const targetScroll = clamp(this.selected * (TILE_W + GAP) + START_X - (W - TILE_W) / 2, 0, maxScroll);
      this.scroll = damp(this.scroll, targetScroll, 8, dt);
      if (!this.active) return;

      this.navTimer -= dt;
      let moved = 0;
      if (input.pressed('left')) moved = -1;
      else if (input.pressed('right')) moved = 1;
      else if (Math.abs(input.axis.x) > 0.62 && this.navTimer <= 0) moved = Math.sign(input.axis.x);
      if (moved) {
        this.moveSelection(moved);
        this.navTimer = 0.34;
      }
      if (Math.abs(input.axis.x) < 0.2) this.navTimer = Math.min(this.navTimer, 0);
      if (input.pressed('up') && this.selected !== 0) { this.selected = 0; this.audio.hover(); }
      if (input.pressed('down') && this.selected === 0) { this.selected = 1; this.audio.hover(); }
      if (input.pressed('action')) this.activateSelection();
      if (input.pressed('back')) this.onStand?.();
      if (input.pressed('pause')) this.onStand?.();
      return;
    }

    if (this.state === 'launch') {
      this.launchT += dt;
      if (this.launchT > 1.2) {
        this.state = 'game';
        this.game = this.launchGameRef.create({ audio: this.audio });
        this.paused = !this.active;
      }
      return;
    }

    if (this.state === 'game') {
      if (input.pressed('back')) { this.goHome(); return; }
      if (input.pressed('pause')) { this.onStand?.(); return; }
      if (this.paused) return;
      if (this.game.state === 'over') {
        if (input.pressed('action')) {
          this.audio.click();
          this.game.reset();
          if (typeof this.game.serve === 'function') {
            this.game.state = 'playing';
            this.game.serve();
          }
        }
        return;
      }
      this.game.update(dt, input);
    }
  }

  draw() {
    const ctx = this.ctx;
    if (this.state === 'off') this.drawOff(ctx);
    else if (this.state === 'boot') this.drawBoot(ctx);
    else if (this.state === 'home') this.drawHome(ctx);
    else if (this.state === 'launch') this.drawLaunch(ctx);
    else if (this.state === 'game') this.drawGame(ctx);
    this.texture.needsUpdate = true;
  }

  drawOff(ctx) {
    ctx.fillStyle = '#020307';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, 600);
    g.addColorStop(0, 'rgba(20,35,70,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(120,150,210,0.06)';
    ctx.font = '700 22px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PS5', W / 2, H / 2 + 8);
    // standby light
    ctx.fillStyle = '#ff5a3c';
    ctx.shadowColor = '#ff5a3c';
    ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(W - 34, H - 28, 3, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
  }

  drawBackground(ctx, tint = '#2f6bff') {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#050a17');
    bg.addColorStop(0.45, '#071127');
    bg.addColorStop(1, '#03060f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const t = this.time;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const blobs = [
      [W * 0.22 + Math.sin(t * 0.11) * 120, H * 0.28 + Math.cos(t * 0.09) * 60, 460, '47,107,255', 0.3],
      [W * 0.82 + Math.cos(t * 0.08) * 90, H * 0.6 + Math.sin(t * 0.12) * 70, 420, '0,180,255', 0.16],
      [W * 0.55 + Math.sin(t * 0.05) * 180, H * 0.9, 380, '90,40,200', 0.14],
    ];
    for (const [x, y, r, c, a] of blobs) {
      const g = ctx.createRadialGradient(x, y, 10, x, y, r);
      g.addColorStop(0, `rgba(${c},${a})`);
      g.addColorStop(0.5, `rgba(${c},${a * 0.35})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();

    // light beams
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.strokeStyle = '#9fc4ff';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const x = (i * 197 + t * 8) % (W + 300) - 150;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 220, H);
      ctx.stroke();
    }
    ctx.restore();

    // faint PlayStation symbols
    ctx.save();
    ctx.globalAlpha = 0.035;
    ctx.fillStyle = '#cfe0ff';
    ctx.font = '700 120px "Inter", sans-serif';
    const syms = ['△', '○', '✕', '□'];
    for (let i = 0; i < 4; i++) {
      const x = W * (0.15 + i * 0.24) + Math.sin(t * 0.15 + i) * 18;
      const y = H * (0.2 + (i % 2) * 0.55) + Math.cos(t * 0.12 + i) * 14;
      ctx.fillText(syms[i], x, y);
    }
    ctx.restore();

    // drifting dust
    ctx.save();
    ctx.fillStyle = 'rgba(170,205,255,0.4)';
    for (let i = 0; i < 36; i++) {
      const x = ((i * 137 + t * (6 + (i % 5) * 2)) % W);
      const y = ((i * 83 + Math.sin(t * 0.3 + i) * 30) % H + H) % H;
      ctx.globalAlpha = 0.1 + (i % 4) * 0.06;
      ctx.fillRect(x, y, 1.4, 1.4);
    }
    ctx.restore();
  }

  drawTopBar(ctx, title = 'PLAYER 1') {
    // PS mark
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 26px "Space Grotesk", sans-serif';
    ctx.fillText('PS5', 54, 58);
    ctx.fillStyle = '#4f9dff';
    ctx.fillRect(54, 68, 46, 2.5);

    // time
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    const date = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(235,243,255,0.95)';
    ctx.font = '600 18px "Inter", sans-serif';
    ctx.fillText(time, W / 2, 50);
    ctx.fillStyle = 'rgba(150,175,220,0.55)';
    ctx.font = '600 9px "Inter", sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText(date, W / 2, 68);

    // avatar
    const ax = W - 238;
    const ag = ctx.createLinearGradient(ax - 16, 34, ax + 16, 66);
    ag.addColorStop(0, '#6fe3ff');
    ag.addColorStop(1, '#2f6bff');
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(ax, 50, 16, 0, TAU); ctx.fill();
    ctx.fillStyle = '#07101f';
    ctx.font = '700 13px "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('P1', ax, 55);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#eef4ff';
    ctx.font = '600 12px "Inter", sans-serif';
    ctx.fillText(title, ax + 26, 48);
    ctx.fillStyle = 'rgba(150,175,220,0.55)';
    ctx.font = '500 9px "Inter", sans-serif';
    ctx.fillText('SIGNED IN', ax + 26, 63);

    drawWifi(ctx, W - 80, 38, 16, 'rgba(210,225,255,0.8)');
    drawBattery(ctx, W - 54, 42, 20, 10, 0.82, 'rgba(210,225,255,0.8)');
    ctx.restore();
  }

  drawHome(ctx) {
    this.drawBackground(ctx);
    this.drawTopBar(ctx);

    // tabs
    ctx.save();
    ctx.font = '600 11px "Inter", sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('GAMES', 90, 122);
    ctx.fillStyle = '#4f9dff';
    ctx.fillRect(90, 132, 42, 2.5);
    ctx.fillStyle = 'rgba(160,185,225,0.5)';
    ctx.fillText('GAME VAULT', 244, 122);
    ctx.fillStyle = 'rgba(160,185,225,0.28)';
    ctx.fillText('MEDIA', 402, 122);
    ctx.restore();

    const enter = this.homeEnter;
    const slide = (1 - enter) * 40;

    // section label
    ctx.save();
    ctx.globalAlpha = enter;
    ctx.fillStyle = 'rgba(170,195,235,0.55)';
    ctx.font = '600 10px "Inter", sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText('YOUR LIBRARY', 90, 176 + slide);
    ctx.restore();

    // tiles
    const tiles = games.length + 1;
    for (let i = 0; i < tiles; i++) {
      const tx = START_X + i * (TILE_W + GAP) - this.scroll;
      if (tx > W + 40 || tx + TILE_W < -40) continue;
      const isSel = i === this.selected;
      const cover = i < games.length ? this.covers[i] : this.vaultCover;
      const scale = isSel ? 1.055 : 1;
      const cx = tx + TILE_W / 2;
      const cy = ROW_Y + TILE_H / 2 + slide - (isSel ? 7 : 0);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.globalAlpha = enter * (isSel ? 1 : 0.72);

      if (isSel) {
        ctx.shadowColor = i < games.length ? games[i].accent : '#6fe3ff';
        ctx.shadowBlur = 42;
        ctx.fillStyle = 'rgba(80,140,255,0.35)';
        rr(ctx, -TILE_W / 2 - 6, -TILE_H / 2 - 6, TILE_W + 12, TILE_H + 12, 14);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      rr(ctx, -TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 11);
      ctx.save();
      ctx.clip();
      if (cover) ctx.drawImage(cover, -TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H);
      const shade = ctx.createLinearGradient(0, TILE_H * 0.35, 0, TILE_H / 2);
      shade.addColorStop(0, 'rgba(3,6,14,0)');
      shade.addColorStop(1, 'rgba(3,6,14,0.85)');
      ctx.fillStyle = shade;
      ctx.fillRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '700 13px "Space Grotesk", sans-serif';
      const label = i < games.length ? games[i].title : 'GAME VAULT';
      ctx.fillText(label, -TILE_W / 2 + 14, TILE_H / 2 - 16);
      ctx.restore();

      if (isSel) {
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = 3;
        rr(ctx, -TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 11);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        rr(ctx, -TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 11);
        ctx.stroke();
      }
      // PS5 badge
      ctx.fillStyle = 'rgba(4,8,16,0.7)';
      rr(ctx, -TILE_W / 2 + 10, -TILE_H / 2 + 10, 40, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 8px "Space Grotesk", sans-serif';
      ctx.fillText('PS5', -TILE_W / 2 + 18, -TILE_H / 2 + 22);
      ctx.restore();
    }

    // selected info
    const infoY = 500 + slide;
    ctx.save();
    ctx.globalAlpha = enter;
    if (this.selected < games.length) {
      const g = games[this.selected];
      ctx.fillStyle = 'rgba(140,175,235,0.55)';
      ctx.font = '600 10px "Inter", sans-serif';
      ctx.letterSpacing = '3px';
      ctx.fillText(g.subtitle, 90, infoY);
      glowText(ctx, g.title, 90, infoY + 44, 42, '#f2f7ff', { blur: 16 });
      ctx.fillStyle = 'rgba(185,205,240,0.72)';
      ctx.font = '400 14px "Inter", sans-serif';
      ctx.letterSpacing = '0px';
      ctx.fillText(g.tagline, 92, infoY + 72);
      // accent line
      ctx.fillStyle = g.accent;
      ctx.fillRect(90, infoY + 90, 44, 2.5);
      ctx.fillStyle = 'rgba(160,185,225,0.45)';
      ctx.font = '500 10px "Inter", sans-serif';
      ctx.fillText('INSTALLED · 1 PLAYER · GAMEPAD READY', 146, infoY + 94);
    } else {
      ctx.fillStyle = 'rgba(140,175,235,0.55)';
      ctx.font = '600 10px "Inter", sans-serif';
      ctx.letterSpacing = '3px';
      ctx.fillText('OPEN PLATFORM', 90, infoY);
      glowText(ctx, 'GAME VAULT', 90, infoY + 44, 42, '#f2f7ff', { blur: 16 });
      ctx.fillStyle = 'rgba(185,205,240,0.72)';
      ctx.font = '400 14px "Inter", sans-serif';
      ctx.letterSpacing = '0px';
      ctx.fillText('Paste a URL or drop a game file. Any HTML5 game runs on the TV.', 92, infoY + 72);
      ctx.fillStyle = '#6fe3ff';
      ctx.fillRect(90, infoY + 90, 44, 2.5);
    }
    ctx.restore();

    // hint bar
    ctx.save();
    ctx.globalAlpha = enter * 0.95;
    ctx.fillStyle = 'rgba(6,10,20,0.55)';
    rr(ctx, 54, H - 74, W - 108, 40, 10);
    ctx.fill();
    const key = (x, label) => {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      rr(ctx, x, H - 65, 24, 22, 5);
      ctx.fill();
      ctx.fillStyle = '#e9f0ff';
      ctx.font = '700 10px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + 12, H - 50);
      ctx.textAlign = 'left';
      return x + 32;
    };
    let kx = 74;
    kx = key(kx, '←');
    kx = key(kx, '→');
    ctx.fillStyle = 'rgba(190,210,245,0.6)';
    ctx.font = '500 10px "Inter", sans-serif';
    ctx.fillText('BROWSE', kx + 2, H - 50);
    kx += 76;
    kx = key(kx, '↵');
    ctx.fillStyle = 'rgba(190,210,245,0.6)';
    ctx.fillText('PLAY', kx + 2, H - 50);
    kx += 62;
    kx = key(kx, 'Esc');
    ctx.fillStyle = 'rgba(190,210,245,0.6)';
    ctx.fillText('STAND UP', kx + 2, H - 50);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(130,170,235,0.45)';
    ctx.fillText('CLICK A GAME OR USE THE CONTROLLER', W - 74, H - 50);
    ctx.restore();

    // boot flash
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(180,215,255,${this.flash * 0.6})`;
      ctx.fillRect(0, 0, W, H);
    }
    vignette(ctx, W, H, 0.42);
    scanlines(ctx, W, H, 0.025);
  }

  drawBoot(ctx) {
    ctx.fillStyle = '#020409';
    ctx.fillRect(0, 0, W, H);
    const t = this.bootT;
    const cx = W / 2, cy = H / 2 - 20;
    const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 480);
    glow.addColorStop(0, 'rgba(47,107,255,0.28)');
    glow.addColorStop(0.5, 'rgba(20,50,140,0.1)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // expanding rings
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const p = ((t * 0.5 + i * 0.33) % 1);
      ctx.globalAlpha = (1 - p) * 0.22;
      ctx.strokeStyle = '#6fa8ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 40 + p * 340, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    // logo
    const reveal = clamp((t - 0.25) / 0.8, 0, 1);
    const fadeOut = t > 2.9 ? clamp(1 - (t - 2.9) / 0.6, 0, 1) : 1;
    ctx.save();
    ctx.globalAlpha = reveal * fadeOut;
    ctx.translate(cx, cy);
    const s = 0.92 + reveal * 0.08;
    ctx.scale(s, s);
    ctx.shadowColor = '#3f7bff';
    ctx.shadowBlur = 50;
    ctx.fillStyle = '#f2f7ff';
    ctx.font = '700 118px "Space Grotesk", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PS', -22, 30);
    ctx.fillStyle = '#6fa8ff';
    ctx.font = '700 54px "Space Grotesk", sans-serif';
    ctx.fillText('5', 82, 30);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(190,215,255,0.8)';
    ctx.font = '600 12px "Inter", sans-serif';
    ctx.letterSpacing = '12px';
    ctx.fillText('PLAYSTATION', 4, 92);
    ctx.restore();

    // loading line
    if (t > 0.7) {
      const p = clamp((t - 0.7) / 2.4, 0, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      rr(ctx, cx - 90, cy + 150, 180, 2, 1);
      ctx.fill();
      ctx.fillStyle = '#6fa8ff';
      rr(ctx, cx - 90, cy + 150, 180 * p, 2, 1);
      ctx.fill();
      ctx.fillStyle = 'rgba(150,185,245,0.45)';
      ctx.font = '500 9px "Inter", sans-serif';
      ctx.textAlign = 'center';
      ctx.letterSpacing = '3px';
      ctx.fillText('PLEASE WAIT', cx, cy + 176);
    }

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(200,225,255,${this.flash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
    scanlines(ctx, W, H, 0.05);
  }

  drawLaunch(ctx) {
    const g = this.launchGameRef;
    const cover = this.covers[games.indexOf(g)];
    const t = clamp(this.launchT / 1.2, 0, 1);
    const zoom = 1 + t * 0.55;
    ctx.save();
    ctx.fillStyle = '#02040a';
    ctx.fillRect(0, 0, W, H);
    if (cover) {
      const cw = 360 * zoom * 2.0;
      const ch = 480 * zoom * 2.0;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(cover, W / 2 - cw / 2, H / 2 - ch / 2, cw, ch);
    }
    const shade = ctx.createLinearGradient(0, 0, 0, H);
    shade.addColorStop(0, 'rgba(2,4,10,0.35)');
    shade.addColorStop(0.55, 'rgba(2,4,10,0.72)');
    shade.addColorStop(1, 'rgba(2,4,10,0.95)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(170,200,245,0.6)';
    ctx.font = '600 10px "Inter", sans-serif';
    ctx.letterSpacing = '6px';
    ctx.fillText('NOW LAUNCHING', W / 2, H / 2 + 18);
    glowText(ctx, g.title, W / 2, H / 2 + 72, 52, '#f4f8ff', { align: 'center', blur: 24 });
    // spinner
    const a = this.time * 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(W / 2, H / 2 + 128, 18, 0, TAU); ctx.stroke();
    ctx.strokeStyle = g.accent;
    ctx.shadowColor = g.accent;
    ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(W / 2, H / 2 + 128, 18, a, a + 1.4); ctx.stroke();
    ctx.restore();
  }

  drawGame(ctx) {
    const g = this.game;
    if (!g) return;
    ctx.save();
    g.draw(ctx);
    ctx.restore();

    // top chrome
    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, 54);
    grad.addColorStop(0, 'rgba(2,5,12,0.65)');
    grad.addColorStop(1, 'rgba(2,5,12,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, 54);
    ctx.fillStyle = 'rgba(230,240,255,0.5)';
    ctx.font = '600 9px "Inter", sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText(g.title, 30, 30);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(220,235,255,0.35)';
    ctx.fillText('ESC · HOME', W - 30, 30);
    ctx.restore();

    if (this.paused) {
      ctx.fillStyle = 'rgba(2,5,12,0.72)';
      ctx.fillRect(0, 0, W, H);
      glowText(ctx, 'PAUSED', W / 2, H / 2 - 8, 56, '#f2f7ff', { align: 'center', blur: 20 });
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(180,205,245,0.65)';
      ctx.font = '500 13px "Inter", sans-serif';
      ctx.fillText('Sit back down to continue', W / 2, H / 2 + 32);
    }

    if (g.state === 'over') {
      const og = ctx.createLinearGradient(0, 0, 0, H);
      og.addColorStop(0, 'rgba(2,5,12,0.5)');
      og.addColorStop(0.5, 'rgba(2,5,12,0.82)');
      og.addColorStop(1, 'rgba(2,5,12,0.94)');
      ctx.fillStyle = og;
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.fillStyle = g.accent;
      ctx.font = '600 10px "Inter", sans-serif';
      ctx.letterSpacing = '6px';
      ctx.fillText('RUN COMPLETE', W / 2, H / 2 - 96);
      glowText(ctx, g.overTitle || 'GAME OVER', W / 2, H / 2 - 28, 62, '#f5f9ff', { align: 'center', blur: 26 });
      ctx.fillStyle = 'rgba(185,205,240,0.75)';
      ctx.font = '400 14px "Inter", sans-serif';
      ctx.letterSpacing = '0px';
      ctx.fillText(g.overSub || '', W / 2, H / 2 + 12);
      const hasSets = g.playerScore !== undefined;
      const scoreText = hasSets ? `${g.playerScore} — ${g.aiScore}` : String(Math.floor(g.score || 0)).padStart(6, '0');
      ctx.fillStyle = 'rgba(150,180,225,0.6)';
      ctx.font = '600 10px "Inter", sans-serif';
      ctx.letterSpacing = '3px';
      ctx.fillText(hasSets ? 'SET SCORE' : 'SCORE', W / 2, H / 2 + 64);
      glowText(ctx, scoreText, W / 2, H / 2 + 110, 38, g.accent, { align: 'center', blur: 18 });
      ctx.fillStyle = 'rgba(220,235,255,0.7)';
      ctx.font = '500 11px "Inter", sans-serif';
      ctx.letterSpacing = '1px';
      ctx.fillText('Press Enter / A to play again   ·   Esc to return home', W / 2, H / 2 + 164);
    }

    // subtle screen vignette
    vignette(ctx, W, H, 0.25);
  }
}

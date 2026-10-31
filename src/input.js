import { clamp } from './util.js';

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'action', Enter: 'action', NumpadEnter: 'action',
  Escape: 'back', Backspace: 'back',
  KeyE: 'interact',
  KeyM: 'mute',
  KeyF: 'focus',
  KeyR: 'action2',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

export class Input {
  constructor() {
    this.held = new Set();
    this.edge = new Set();
    this.keys = new Set();
    this.axis = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.pad = {
      connected: false,
      name: '',
      moveX: 0,
      moveY: 0,
      lookX: 0,
      lookY: 0,
      prev: [],
    };
    this.tv = { x: 0.5, y: 0.5, active: false, down: false, downEdge: false };
    this.touchLookDX = 0;
    this.touchLookDY = 0;
    this.stick = { x: 0, y: 0, active: false };
    this.isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
    this._bindKeyboard();
    this._bindGamepad();
    this._bindTouch();
    if (this.isTouch) document.body.classList.add('touch');
    window.addEventListener('gamepadconnected', (e) => {
      this.pad.connected = true;
      this.pad.name = e.gamepad.id.replace(/\(.*?\)/g, '').trim().slice(0, 28);
      document.dispatchEvent(new CustomEvent('padchange', { detail: { connected: true, name: this.pad.name } }));
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.pad.connected = false;
      document.dispatchEvent(new CustomEvent('padchange', { detail: { connected: false } }));
    });
  }

  _bindKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const action = KEYMAP[e.code];
      if (!action) return;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      this.held.add(action);
      this.edge.add(action);
    });
    window.addEventListener('keyup', (e) => {
      const action = KEYMAP[e.code];
      if (!action) return;
      this.keys.delete(e.code);
      // don't clear a held action still provided by another key/gamepad
      const still = [...this.keys].some((code) => KEYMAP[code] === action);
      if (!still) this.held.delete(action);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.held.clear();
      this.stick.active = false;
      this.stick.x = this.stick.y = 0;
    });
  }

  _bindGamepad() {
    const DEAD = 0.18;
    this.pollGamepad = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      let gp = null;
      for (const p of pads) if (p && p.connected) { gp = p; break; }
      if (!gp) {
        if (this.pad.connected) {
          this.pad.connected = false;
          document.dispatchEvent(new CustomEvent('padchange', { detail: { connected: false } }));
        }
        this.pad.moveX = this.pad.moveY = this.pad.lookX = this.pad.lookY = 0;
        return;
      }
      if (!this.pad.connected) {
        this.pad.connected = true;
        this.pad.name = gp.id.replace(/\(.*?\)/g, '').trim().slice(0, 28);
        document.dispatchEvent(new CustomEvent('padchange', { detail: { connected: true, name: this.pad.name } }));
      }
      const ax = gp.axes;
      const lx = Math.abs(ax[0] || 0) > DEAD ? ax[0] : 0;
      const ly = Math.abs(ax[1] || 0) > DEAD ? ax[1] : 0;
      const rx = Math.abs(ax[2] || 0) > DEAD ? ax[2] : 0;
      const ry = Math.abs(ax[3] || 0) > DEAD ? ax[3] : 0;
      this.pad.moveX = lx;
      this.pad.moveY = ly;
      this.pad.lookX = rx;
      this.pad.lookY = ry;

      const b = gp.buttons;
      const down = (i) => !!(b[i] && (b[i].pressed || b[i].value > 0.5));
      const prev = this.pad.prev;
      const edgeIf = (i, name) => {
        if (down(i) && !prev[i]) this.edge.add(name);
      };
      edgeIf(0, 'action');
      edgeIf(1, 'back');
      edgeIf(2, 'action2');
      edgeIf(3, 'action2');
      edgeIf(9, 'pause');
      edgeIf(8, 'mute');
      edgeIf(12, 'up');
      edgeIf(13, 'down');
      edgeIf(14, 'left');
      edgeIf(15, 'right');

      const mapHeld = (name, on) => { if (on) this.held.add(name); else if (![...this.keys].some((code) => KEYMAP[code] === name)) this.held.delete(name); };
      mapHeld('up', down(12) || ly < -0.5);
      mapHeld('down', down(13) || ly > 0.5);
      mapHeld('left', down(14) || lx < -0.5);
      mapHeld('right', down(15) || lx > 0.5);
      mapHeld('action', down(0));
      mapHeld('action2', down(2) || down(3));
      mapHeld('sprint', down(10) || down(11));

      this.pad.prev = b.map((x) => x.pressed || x.value > 0.5);
    };
  }

  _bindTouch() {
    const stick = document.getElementById('mobileStick');
    const knob = stick?.querySelector('.stick-knob');
    const look = document.getElementById('mobileLook');
    const interact = document.getElementById('mobileInteract');

    if (stick) {
      let id = null;
      const rectCenter = () => {
        const r = stick.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width * 0.36 };
      };
      const move = (e) => {
        if (id !== e.pointerId) return;
        const c = rectCenter();
        let dx = (e.clientX - c.x) / c.r;
        let dy = (e.clientY - c.y) / c.r;
        const len = Math.hypot(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }
        this.stick.x = dx;
        this.stick.y = dy;
        this.stick.active = true;
        if (knob) knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
      };
      const end = (e) => {
        if (id !== e.pointerId) return;
        id = null;
        this.stick.x = this.stick.y = 0;
        this.stick.active = false;
        if (knob) knob.style.transform = 'translate(0, 0)';
      };
      stick.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        id = e.pointerId;
        stick.setPointerCapture(e.pointerId);
        move(e);
      });
      stick.addEventListener('pointermove', move);
      stick.addEventListener('pointerup', end);
      stick.addEventListener('pointercancel', end);
    }

    if (look) {
      let id = null, lx = 0, ly = 0;
      look.addEventListener('pointerdown', (e) => {
        id = e.pointerId;
        lx = e.clientX; ly = e.clientY;
        look.setPointerCapture(e.pointerId);
      });
      look.addEventListener('pointermove', (e) => {
        if (id !== e.pointerId) return;
        this.touchLookDX += e.clientX - lx;
        this.touchLookDY += e.clientY - ly;
        lx = e.clientX; ly = e.clientY;
      });
      const end = (e) => { if (id === e.pointerId) id = null; };
      look.addEventListener('pointerup', end);
      look.addEventListener('pointercancel', end);
    }

    if (interact) {
      interact.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.edge.add('interact');
      });
    }

    document.querySelectorAll('[data-nav]').forEach((btn) => {
      const dir = btn.dataset.nav;
      const press = (e) => {
        e.preventDefault();
        this.held.add(dir);
        this.edge.add(dir);
        btn.classList.add('active');
      };
      const release = (e) => {
        e.preventDefault();
        this.held.delete(dir);
        btn.classList.remove('active');
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
    });
    document.querySelectorAll('[data-act]').forEach((btn) => {
      const act = btn.dataset.act;
      const press = (e) => {
        e.preventDefault();
        this.held.add(act);
        this.edge.add(act);
      };
      const release = (e) => {
        e.preventDefault();
        this.held.delete(act);
      };
      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
    });
  }

  update(dt) {
    this.pollGamepad();
    let x = 0, y = 0;
    if (this.held.has('left')) x -= 1;
    if (this.held.has('right')) x += 1;
    if (this.held.has('up')) y -= 1;
    if (this.held.has('down')) y += 1;
    if (this.stick.active) { x += this.stick.x; y += this.stick.y; }
    if (this.pad.connected) { x += this.pad.moveX; y += this.pad.moveY; }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    this.axis.x = clamp(x, -1, 1);
    this.axis.y = clamp(y, -1, 1);
  }

  pressed(name) { return this.edge.has(name); }
  down(name) { return this.held.has(name); }
  clearEdges() {
    this.edge.clear();
    this.tv.downEdge = false;
    this.touchLookDX = 0;
    this.touchLookDY = 0;
  }
}

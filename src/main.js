import * as THREE from 'three';
import { buildRoom } from './room.js';
import { PS5System } from './ps5/system.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { clamp, damp, easeInOutCubic, lerp, TAU } from './util.js';

const $ = (id) => document.getElementById(id);
const ui = {
  scene: $('scene'),
  hud: $('hud'),
  enter: $('enter'),
  enterBtn: $('enterBtn'),
  reticle: $('reticle'),
  prompt: $('prompt'),
  promptKey: $('promptKey'),
  promptText: $('promptText'),
  hintbar: $('hintbar'),
  seatbar: $('seatbar'),
  seatTitle: $('seatTitle'),
  standBtn: $('standBtn'),
  soundBtn: $('soundBtn'),
  padChip: $('padChip'),
  padName: $('padName'),
  mobileStick: $('mobileStick'),
  mobileLook: $('mobileLook'),
  mobileInteract: $('mobileInteract'),
  touchpadUI: $('touchpadUI'),
  vault: $('vault'),
  vaultClose: $('vaultClose'),
  gameUrl: $('gameUrl'),
  launchUrl: $('launchUrl'),
  launchTab: $('launchTab'),
  dropzone: $('dropzone'),
  gameFile: $('gameFile'),
  webgame: $('webgame'),
  webgameName: $('webgameName'),
  webgameExit: $('webgameExit'),
  webgameTab: $('webgameTab'),
  webgameHelp: $('webgameHelp'),
  webgameFallback: $('webgameFallback'),
  webgameFallbackTab: $('webgameFallbackTab'),
  gameFrame: $('gameFrame'),
  toast: $('toast'),
};

const audio = new AudioEngine();
const input = new Input();
let system = null;

if (input.isTouch) {
  const controls = document.querySelector('.enter-controls');
  if (controls) {
    controls.innerHTML =
      '<span><b>Joystick</b> move</span><i></i>' +
      '<span><b>Drag</b> look</span><i></i>' +
      '<span><b>Tap PLAY</b> sit</span>';
  }
  const note = document.querySelector('.enter-note');
  if (note) note.textContent = 'Tap to begin · best in landscape';
}

// ── Renderer / scene ────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
const gl = renderer.getContext();
const dbg = gl.getExtension('WEBGL_debug_renderer_info');
const gpuName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : '';
const softwareGL = /swiftshader|llvmpipe|software/i.test(gpuName || '');
renderer.setPixelRatio(softwareGL ? 1 : Math.min(window.devicePixelRatio || 1, 1.6));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-label', 'First person playroom');
ui.scene.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);
scene.fog = new THREE.Fog(0x05070d, 12, 30);

const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 60);
camera.rotation.order = 'YXZ';

system = new PS5System({
  audio,
  onVault: () => openVault(),
  onStand: () => standUp(),
});

const room = buildRoom(scene, system.texture);
system.draw();

// ── Player / camera state ───────────────────────────────────────────
const player = {
  pos: new THREE.Vector3(1.15, 1.65, 3.35),
  yaw: 0.2,
  pitch: 0.02,
  vel: new THREE.Vector2(),
  bob: 0,
  radius: 0.3,
};
let mode = 'title'; // title | walk | tween | seated | vault | webgame
let tween = null;
let locked = false;
let lastTime = performance.now();
let elapsed = 0;
let tvAccum = 0;
let pointerLockWarned = false;
let webgameUrl = '';
let webgameBlob = '';
let muted = false;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const clock = new THREE.Clock();

camera.position.copy(player.pos);
camera.rotation.set(0, 0, 0);

// ── Helpers ─────────────────────────────────────────────────────────
function toast(text, ms = 3200) {
  ui.toast.textContent = text;
  ui.toast.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => ui.toast.classList.remove('show'), ms);
}

function setHud(visible) {
  ui.hud.classList.toggle('hidden', !visible);
}

function refreshTouchUI() {
  const touch = input.isTouch;
  const walk = mode === 'walk';
  const seated = mode === 'seated';
  ui.mobileStick.classList.toggle('hidden', !(touch && walk));
  ui.mobileLook.classList.toggle('hidden', !(touch && walk));
  ui.mobileInteract.classList.toggle('hidden', !(touch && walk && canInteract()));
  ui.touchpadUI.classList.toggle('hidden', !(touch && seated));
}

function canInteract() {
  if (mode !== 'walk') return false;
  // The action belongs to the sofa, not the TV: stand anywhere on the
  // seating side of the coffee table and face the screen to sit down.
  const seatX = 0;
  const seatZ = 1.9;
  const dx = seatX - player.pos.x;
  const dz = seatZ - player.pos.z;
  const dist = Math.hypot(dx, dz);
  const tvX = -0.65 - player.pos.x;
  const tvZ = -3.9 - player.pos.z;
  const tvDist = Math.hypot(tvX, tvZ);
  const fwdX = -Math.sin(player.yaw);
  const fwdZ = -Math.cos(player.yaw);
  const facing = tvDist > 0.001 ? (tvX / tvDist) * fwdX + (tvZ / tvDist) * fwdZ : 1;
  return dist < 2.35 && player.pos.z < 3.08 && player.pos.z > 1.5 && facing > -0.1;
}

function blocked(x, z) {
  const r = player.radius;
  const b = room.bounds;
  if (x < b.minX + r || x > b.maxX - r || z < b.minZ + r || z > b.maxZ - r) return true;
  for (const c of room.colliders) {
    if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
  }
  return false;
}

function requestLock() {
  if (input.isTouch) return;
  const el = renderer.domElement;
  if (!el.requestPointerLock) return;
  try {
    const p = el.requestPointerLock();
    if (p && p.catch) p.catch(() => {});
  } catch {}
}

function shortestAngle(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return a + d;
}

function startTween(to, duration, onDone) {
  tween = {
    t: 0,
    duration,
    fromPos: camera.position.clone(),
    fromYaw: player.yaw,
    fromPitch: player.pitch,
    fromFov: camera.fov,
    toPos: to.pos.clone(),
    toYaw: shortestAngle(player.yaw, to.yaw),
    toPitch: to.pitch,
    toFov: to.fov,
    onDone,
  };
  mode = 'tween';
  ui.seatbar.classList.add('hidden');
  ui.touchpadUI.classList.add('hidden');
  ui.prompt.classList.add('hidden');
  ui.reticle.classList.add('hidden');
  ui.mobileStick.classList.add('hidden');
  ui.mobileLook.classList.add('hidden');
  ui.mobileInteract.classList.add('hidden');
}

function updateTween(dt) {
  if (!tween) return;
  tween.t += dt;
  const raw = clamp(tween.t / tween.duration, 0, 1);
  const e = easeInOutCubic(raw);
  camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
  player.yaw = lerp(tween.fromYaw, tween.toYaw, e);
  player.pitch = lerp(tween.fromPitch, tween.toPitch, e);
  camera.fov = lerp(tween.fromFov, tween.toFov, e);
  camera.updateProjectionMatrix();
  camera.rotation.set(player.pitch, player.yaw, 0);
  if (raw >= 1) {
    const done = tween.onDone;
    tween = null;
    done?.();
  }
}

function sitDown() {
  if (mode !== 'walk') return;
  if (system.state === 'off') system.powerOn();
  if (document.pointerLockElement) document.exitPointerLock();
  audio.click();
  input.clearEdges();
  const to = {
    pos: new THREE.Vector3(0, 1.2, 0.56),
    yaw: 0.145,
    pitch: 0.112,
    fov: 50,
  };
  startTween(to, 1.15, () => {
    mode = 'seated';
    system.setActive(true);
    setHud(true);
    ui.seatbar.classList.remove('hidden');
    ui.seatTitle.textContent = system.statusLabel;
    ui.reticle.classList.add('hidden');
    ui.hintbar.classList.add('hidden');
    ui.prompt.classList.add('hidden');
    refreshTouchUI();
    ui.standBtn.textContent = 'Stand up';
  });
}

function standUp() {
  if (mode !== 'seated') return;
  system.setActive(false);
  audio.back();
  ui.seatbar.classList.add('hidden');
  ui.touchpadUI.classList.add('hidden');
  const to = {
    pos: new THREE.Vector3(0, 1.65, 1.92),
    yaw: 0.145,
    pitch: 0.02,
    fov: 68,
  };
  startTween(to, 0.9, () => {
    mode = 'walk';
    player.pos.copy(to.pos);
    setHud(true);
    ui.reticle.classList.remove('hidden');
    ui.hintbar.classList.remove('hidden');
    refreshTouchUI();
    if (!input.isTouch) toast('Click to capture the mouse', 2400);
  });
}

// ── Vault / web game ────────────────────────────────────────────────
function openVault() {
  if (mode !== 'seated') return;
  mode = 'vault';
  system.setActive(false);
  ui.vault.classList.remove('hidden');
  ui.seatbar.classList.add('hidden');
  ui.touchpadUI.classList.add('hidden');
  ui.gameUrl.focus();
  audio.click();
  input.clearEdges();
}

function closeVault() {
  if (mode !== 'vault') return;
  ui.vault.classList.add('hidden');
  mode = 'seated';
  system.setActive(true);
  ui.seatbar.classList.remove('hidden');
  refreshTouchUI();
  audio.back();
  input.clearEdges();
}

function launchWebGame(url, name) {
  if (!url) return;
  webgameUrl = url;
  ui.gameFrame.src = url;
  ui.webgameName.textContent = name || 'GAME VAULT';
  ui.webgameFallback.classList.add('hidden');
  ui.vault.classList.add('hidden');
  ui.webgame.classList.remove('hidden');
  ui.seatbar.classList.add('hidden');
  ui.touchpadUI.classList.add('hidden');
  mode = 'webgame';
  system.setActive(false);
  toast('Loaded in the vault. Press “Exit to PS5” to come back.', 4200);
}

function exitWebGame() {
  if (mode !== 'webgame') return;
  ui.gameFrame.src = 'about:blank';
  ui.webgame.classList.add('hidden');
  if (webgameBlob) {
    URL.revokeObjectURL(webgameBlob);
    webgameBlob = '';
  }
  mode = 'seated';
  system.resumeHome();
  system.setActive(true);
  ui.seatbar.classList.remove('hidden');
  refreshTouchUI();
  ui.seatTitle.textContent = 'Home';
  audio.back();
  input.clearEdges();
}

function normalizeUrl(raw) {
  let url = raw.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url) && !/^blob:/i.test(url)) url = 'https://' + url;
  try { return new URL(url).href; } catch { return ''; }
}

ui.launchUrl.addEventListener('click', () => {
  const url = normalizeUrl(ui.gameUrl.value);
  if (!url) { toast('That URL doesn’t look right. Try https://…'); audio.error(); return; }
  launchWebGame(url, new URL(url).hostname);
});
ui.gameUrl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') ui.launchUrl.click();
});
ui.launchTab.addEventListener('click', () => {
  const url = normalizeUrl(ui.gameUrl.value);
  if (url) window.open(url, '_blank', 'noopener');
});
const demoBtn = $('launchDemo');
demoBtn?.addEventListener('click', () => {
  audio.click();
  launchWebGame(new URL('./assets/vault-demo.html', location.href).href, 'NEON BREAKOUT · DEMO');
});
ui.vaultClose.addEventListener('click', closeVault);
ui.vault.addEventListener('click', (e) => { if (e.target === ui.vault) closeVault(); });

ui.dropzone.addEventListener('click', () => ui.gameFile.click());
ui.dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ui.gameFile.click(); }
});
ui.gameFile.addEventListener('change', () => {
  const file = ui.gameFile.files?.[0];
  if (file) loadGameFile(file);
});
['dragenter', 'dragover'].forEach((ev) => ui.dropzone.addEventListener(ev, (e) => {
  e.preventDefault();
  ui.dropzone.classList.add('drag');
}));
['dragleave', 'drop'].forEach((ev) => ui.dropzone.addEventListener(ev, (e) => {
  e.preventDefault();
  ui.dropzone.classList.remove('drag');
}));
ui.dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file) loadGameFile(file);
});

function loadGameFile(file) {
  if (!/\.html?$/i.test(file.name)) {
    toast('Load a single .html game file. Unzip packs and pick their index.html.');
    audio.error();
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    if (webgameBlob) URL.revokeObjectURL(webgameBlob);
    webgameBlob = URL.createObjectURL(new Blob([reader.result], { type: 'text/html' }));
    launchWebGame(webgameBlob, file.name.replace(/\.html?$/i, ''));
  };
  reader.readAsText(file);
}

ui.webgameExit.addEventListener('click', exitWebGame);
ui.webgameHelp.addEventListener('click', () => ui.webgameFallback.classList.toggle('hidden'));
ui.webgameTab.addEventListener('click', () => { if (webgameUrl) window.open(webgameUrl, '_blank', 'noopener'); });
ui.webgameFallbackTab.addEventListener('click', () => { if (webgameUrl) window.open(webgameUrl, '_blank', 'noopener'); });

// ── Title / enter ───────────────────────────────────────────────────
ui.enterBtn.addEventListener('click', () => {
  if (mode !== 'title') return;
  audio.init();
  mode = 'walk';
  ui.enter.classList.add('leaving');
  setTimeout(() => ui.enter.classList.add('hidden'), 800);
  setHud(true);
  refreshTouchUI();
  if (!input.isTouch) requestLock();
  else toast('Drag the right side to look · joystick to move', 4200);
});

// ── Sound ───────────────────────────────────────────────────────────
ui.soundBtn.addEventListener('click', () => {
  audio.init();
  muted = !muted;
  audio.setMuted(muted);
  ui.soundBtn.style.opacity = muted ? '0.45' : '1';
  toast(muted ? 'Sound off' : 'Sound on', 1400);
});

// ── Gamepad chip ────────────────────────────────────────────────────
document.addEventListener('padchange', (e) => {
  const { connected, name } = e.detail;
  ui.padChip.classList.toggle('hidden', !connected);
  if (connected) ui.padName.textContent = (name || 'CONTROLLER').toUpperCase();
});

// ── Pointer lock / mouse ────────────────────────────────────────────
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === renderer.domElement;
  if (!locked && mode === 'walk' && !pointerLockWarned && !input.isTouch) {
    pointerLockWarned = true;
    toast('Mouse released — click the room to look around', 2800);
  }
  if (locked) pointerLockWarned = false;
});

document.addEventListener('mousemove', (e) => {
  if (mode === 'walk' && locked) {
    player.yaw -= e.movementX * 0.0022;
    player.pitch = clamp(player.pitch - e.movementY * 0.0021, -1.3, 1.3);
    return;
  }
  if (mode === 'seated' && !input.isTouch) hoverScreen(e.clientX, e.clientY);
});

renderer.domElement.addEventListener('click', (e) => {
  if (mode === 'walk') {
    if (!input.isTouch && !locked) requestLock();
    return;
  }
  if (mode === 'seated') clickScreen(e.clientX, e.clientY);
});

renderer.domElement.addEventListener('touchstart', (e) => {
  if (mode === 'seated' && e.touches[0]) {
    clickScreen(e.touches[0].clientX, e.touches[0].clientY);
  }
}, { passive: true });

function screenHit(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObject(room.screenMesh, false);
  if (!hits.length) return null;
  const uv = hits[0].uv;
  return { x: uv.x * 1280, y: (1 - uv.y) * 720, u: uv.x, v: 1 - uv.y };
}

function hoverScreen(clientX, clientY) {
  const hit = screenHit(clientX, clientY);
  if (hit) {
    input.tv.active = true;
    input.tv.x = hit.u;
    input.tv.y = hit.v;
    system.pointerMove(hit.x, hit.y);
  } else {
    input.tv.active = false;
    system.pointerMove(-1, -1);
  }
}

function clickScreen(clientX, clientY) {
  const hit = screenHit(clientX, clientY);
  if (!hit) return;
  input.tv.active = true;
  input.tv.x = hit.u;
  input.tv.y = hit.v;
  system.pointerMove(hit.x, hit.y);
  system.click(hit.x, hit.y);
}

// ── Keyboard extras ─────────────────────────────────────────────────
let hintState = '';
function updateSeatHints() {
  const next = system.state === 'game' ? 'game' : 'home';
  if (next === hintState) return;
  hintState = next;
  const keys = ui.seatbar.querySelector('.seatbar-keys');
  if (!keys) return;
  keys.innerHTML = next === 'game'
    ? '<span><kbd>Esc</kbd> Home</span><span><kbd>Options</kbd> Stand up</span>'
    : '<span><kbd>←</kbd><kbd>→</kbd> Browse</span><span><kbd>↵</kbd> Select</span><span><kbd>Esc</kbd> Stand up</span>';
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' && mode === 'title') {
    ui.enterBtn.click();
    return;
  }
  if (e.code === 'KeyM') {
    ui.soundBtn.click();
  }
  if (e.code === 'Escape' && mode === 'vault') closeVault();
  if (e.code === 'Escape' && mode === 'webgame' && document.activeElement !== ui.gameFrame) exitWebGame();
});

// ── Main loop ───────────────────────────────────────────────────────
function updateWalk(dt) {
  if (mode !== 'walk') return;
  if (input.isTouch) {
    player.yaw -= input.touchLookDX * 0.0042;
    player.pitch = clamp(player.pitch - input.touchLookDY * 0.0036, -1.3, 1.3);
  }
  const sprint = input.down('sprint');
  const speed = sprint ? 4.5 : 2.7;
  const ax = input.axis.x;
  const ay = input.axis.y;
  const sin = Math.sin(player.yaw);
  const cos = Math.cos(player.yaw);
  const wishX = (ax * cos + ay * sin) * speed;
  const wishZ = (-ax * sin + ay * cos) * speed;
  player.vel.x = damp(player.vel.x, wishX, 12, dt);
  player.vel.y = damp(player.vel.y, wishZ, 12, dt);
  if (Math.abs(player.vel.x) < 0.005) player.vel.x = 0;
  if (Math.abs(player.vel.y) < 0.005) player.vel.y = 0;

  let nx = player.pos.x + player.vel.x * dt;
  if (blocked(nx, player.pos.z)) nx = player.pos.x;
  let nz = player.pos.z + player.vel.y * dt;
  if (blocked(nx, nz)) nz = player.pos.z;
  player.pos.x = nx;
  player.pos.z = nz;

  const spd = Math.hypot(player.vel.x, player.vel.y);
  player.bob += spd * dt * 2.6;
  const bob = Math.sin(player.bob * 2.1) * 0.016 * Math.min(1, spd / 2.2);
  camera.position.set(player.pos.x, 1.65 + bob, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
  if (camera.fov !== 68) {
    camera.fov = damp(camera.fov, 68, 8, dt);
    camera.updateProjectionMatrix();
  }
}

function updateSeated(dt) {
  const t = elapsed;
  camera.position.set(Math.sin(t * 0.4) * 0.008, 1.2 + Math.sin(t * 1.1) * 0.0035, 0.56);
  camera.rotation.set(0.112 + Math.sin(t * 0.7) * 0.0015, 0.145 + Math.sin(t * 0.3) * 0.004, 0);
  // Portrait phones need a wider vertical FOV so the whole TV fits.
  const minHorizontal = THREE.MathUtils.degToRad(17);
  const fitFov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(minHorizontal) / Math.max(0.2, camera.aspect)));
  const targetFov = clamp(Math.max(50, fitFov), 50, 82);
  if (Math.abs(camera.fov - targetFov) > 0.01) {
    camera.fov = targetFov;
    camera.updateProjectionMatrix();
  }
  updateSeatHints();
}

function updateScreenLight(dt) {
  const on = system.isOn;
  const accent = new THREE.Color(system.accentColor);
  room.tvLight.color.lerp(accent, 1 - Math.exp(-dt * 2.5));
  room.tvLight.intensity = damp(room.tvLight.intensity, on ? 5.2 : 0.35, 3, dt);
  room.mediaGlow.color.lerp(accent, 1 - Math.exp(-dt * 2.5));
  room.mediaGlow.intensity = damp(room.mediaGlow.intensity, on ? 2.6 : 1.4, 3, dt);

  const led = room.ps5.userData.ledMat;
  led.emissive.lerp(accent, 1 - Math.exp(-dt * 3));
  led.color.lerp(accent, 1 - Math.exp(-dt * 3));
  led.emissiveIntensity = damp(led.emissiveIntensity, on ? 3.4 : 0.25, 4, dt);
  room.ps5.userData.glow.material.color.lerp(accent, 1 - Math.exp(-dt * 3));
  room.ps5.userData.glow.material.opacity = damp(room.ps5.userData.glow.material.opacity, on ? 0.6 : 0.12, 4, dt);
  room.ps5.userData.underGlow.material.color.lerp(accent, 1 - Math.exp(-dt * 3));

  const cl = room.controller.userData.lightMat;
  cl.emissive.lerp(accent, 1 - Math.exp(-dt * 3));
  cl.color.lerp(accent, 1 - Math.exp(-dt * 3));
  cl.emissiveIntensity = damp(cl.emissiveIntensity, on ? 2.8 : 1.1, 4, dt);
  room.controller.userData.glow.material.color.lerp(accent, 1 - Math.exp(-dt * 3));

  const tvGlow = room.tv.userData.glow;
  tvGlow.material.color.lerp(accent, 1 - Math.exp(-dt * 2));
  tvGlow.material.opacity = damp(tvGlow.material.opacity, on ? 0.5 : 0.06, 3, dt);
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  elapsed += dt;

  input.update(dt);

  if (mode === 'title') {
    camera.position.set(1.05 + Math.sin(elapsed * 0.14) * 0.14, 1.66, 3.4 + Math.cos(elapsed * 0.1) * 0.08);
    camera.rotation.set(0.02 + Math.sin(elapsed * 0.08) * 0.008, 0.18 + Math.sin(elapsed * 0.11) * 0.025, 0);
    camera.fov = 66;
    camera.updateProjectionMatrix();
  } else if (mode === 'walk') {
    updateWalk(dt);
  } else if (mode === 'tween') {
    updateTween(dt);
  } else if (mode === 'seated') {
    updateSeated(dt);
  }

  // interaction
  if (mode === 'walk') {
    const near = canInteract();
    ui.reticle.classList.toggle('focus', near);
    ui.prompt.classList.toggle('hidden', !near);
    if (near) {
      ui.promptKey.textContent = input.isTouch ? 'TAP' : 'E';
      if (system.state === 'off') ui.promptText.textContent = 'Power on PlayStation 5';
      else if (system.state === 'game') ui.promptText.textContent = `Resume ${system.statusLabel}`;
      else ui.promptText.textContent = 'Sit down & play';
    }
    ui.mobileInteract.classList.toggle('hidden', !(input.isTouch && near));
    if (near && (input.pressed('interact') || input.pressed('action'))) sitDown();
  }

  // mute shortcut
  if (input.pressed('mute')) ui.soundBtn.click();

  if (mode === 'seated') {
    system.update(dt, input);
    ui.seatTitle.textContent = system.statusLabel;
  } else {
    system.update(dt, input, false);
  }

  room.update(dt);

  // TV texture
  tvAccum += dt;
  const interval = system.isOn ? 1 / 30 : 1 / 6;
  if (tvAccum >= interval) {
    system.draw();
    tvAccum = 0;
  }

  updateScreenLight(dt);
  refreshTouchUI();
  renderer.render(scene, camera);
  input.clearEdges();
}

// ── Resize / start ──────────────────────────────────────────────────
function resize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);

document.addEventListener('visibilitychange', () => {
  lastTime = performance.now();
  if (document.hidden && mode === 'seated') system.setActive(false);
  else if (!document.hidden && mode === 'seated') system.setActive(true);
});

// Small public hook for automated visual checks and curious tinkerers.
window.playroom = {
  get mode() { return mode; },
  get player() { return player; },
  get system() { return system; },
  enter() { if (mode === 'title') ui.enterBtn.click(); },
  sit() { if (mode === 'walk') sitDown(); },
  launch(index = 0) {
    if (mode !== 'seated') return;
    system.goHome();
    system.selected = Math.max(0, Math.min(index, system.covers.length));
    system.activateSelection();
  },
  vault() { if (mode === 'seated') openVault(); },
};

requestAnimationFrame(animate);

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/addons/RoundedBoxGeometry.js';
import { canvas2d, textureFromCanvas, glowTexture, TAU } from './util.js';

const plasticWhite = () => new THREE.MeshPhysicalMaterial({
  color: 0xf3f5f9,
  roughness: 0.28,
  metalness: 0.02,
  clearcoat: 0.75,
  clearcoatRoughness: 0.28,
});
const plasticBlack = () => new THREE.MeshStandardMaterial({
  color: 0x0a0c11,
  roughness: 0.4,
  metalness: 0.5,
});
const matteBlack = () => new THREE.MeshStandardMaterial({
  color: 0x05060a,
  roughness: 0.85,
  metalness: 0.2,
});

function panelShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.118, -0.186);
  s.bezierCurveTo(-0.132, -0.09, -0.13, 0.06, -0.112, 0.158);
  s.bezierCurveTo(-0.098, 0.198, -0.02, 0.202, 0.035, 0.188);
  s.bezierCurveTo(0.1, 0.174, 0.128, 0.14, 0.128, 0.055);
  s.lineTo(0.126, -0.062);
  s.bezierCurveTo(0.123, -0.138, 0.112, -0.176, 0.096, -0.187);
  s.lineTo(0.02, -0.192);
  s.closePath();
  return s;
}

export function createPS5() {
  const group = new THREE.Group();
  group.name = 'PS5';

  const baseMat = matteBlack();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.115, 0.014, 40), baseMat);
  base.position.y = 0.007;
  base.castShadow = true;
  group.add(base);

  const foot = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.03, 0.16, 2, 0.01), baseMat);
  foot.position.set(0, 0.025, 0);
  group.add(foot);

  // black core
  const core = new THREE.Mesh(new RoundedBoxGeometry(0.084, 0.372, 0.236, 4, 0.014), plasticBlack());
  core.position.y = 0.2;
  core.castShadow = true;
  group.add(core);

  // white side panels
  const panelGeo = new THREE.ExtrudeGeometry(panelShape(), {
    depth: 0.015,
    bevelEnabled: true,
    bevelSize: 0.0022,
    bevelThickness: 0.0022,
    bevelSegments: 2,
    curveSegments: 18,
  });
  panelGeo.rotateY(-Math.PI / 2);
  panelGeo.translate(0.0075, 0, 0);
  panelGeo.computeVertexNormals();

  const panelMat = plasticWhite();
  for (const side of [-1, 1]) {
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(side * 0.05, 0.2, 0);
    panel.castShadow = true;
    group.add(panel);
  }

  // top vent / dark inset
  const vent = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.006, 0.19), matteBlack());
  vent.position.set(0, 0.388, 0);
  group.add(vent);

  // front details
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.043, 0.0035, 0.003), matteBlack());
  slot.position.set(-0.014, 0.15, 0.1195);
  group.add(slot);

  const eject = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.003, 0.002), new THREE.MeshStandardMaterial({ color: 0x3a3f4c, roughness: 0.6 }));
  eject.position.set(-0.052, 0.15, 0.119);
  group.add(eject);

  // USB ports
  const portMat = matteBlack();
  for (let i = 0; i < 2; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.003), portMat);
    p.position.set(0.016 + i * 0.018, 0.075, 0.1195);
    group.add(p);
  }

  // glowing LED strip
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0x1c4dff,
    emissive: 0x2f7bff,
    emissiveIntensity: 3.2,
    roughness: 0.3,
  });
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.0025, 0.12, 0.004), ledMat);
  led.position.set(0.0435, 0.255, 0.119);
  group.add(led);

  // subtle PS logo plate
  const { canvas, ctx } = canvas2d(128, 128);
  ctx.clearRect(0, 0, 128, 128);
  ctx.fillStyle = '#e9edf5';
  ctx.font = '700 44px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PS', 64, 60);
  ctx.font = '500 12px "Inter", sans-serif';
  ctx.fillStyle = 'rgba(220,230,255,0.7)';
  ctx.fillText('5', 64, 92);
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.016, 0.016),
    new THREE.MeshBasicMaterial({ map: textureFromCanvas(canvas), transparent: true, toneMapped: false })
  );
  logo.position.set(-0.032, 0.31, 0.1195);
  group.add(logo);

  // glow sprite at LED
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('#4f8dff'),
    color: 0x6fa8ff,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  glow.scale.set(0.16, 0.26, 1);
  glow.position.set(0.045, 0.255, 0.125);
  group.add(glow);

  // under glow
  const under = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('#2f6bff'),
    color: 0x3f7bff,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  under.scale.set(0.34, 0.16, 1);
  under.position.set(0, 0.01, 0);
  group.add(under);

  group.userData.ledMat = ledMat;
  group.userData.glow = glow;
  group.userData.underGlow = under;
  return group;
}

export function createController() {
  const group = new THREE.Group();
  group.name = 'DualSense';

  const white = plasticWhite();
  const black = plasticBlack();

  const body = new THREE.Mesh(new RoundedBoxGeometry(0.165, 0.052, 0.098, 4, 0.024), white);
  body.position.y = 0.045;
  body.castShadow = true;
  group.add(body);

  // grips
  for (const side of [-1, 1]) {
    const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.072, 6, 12), white);
    grip.rotation.x = Math.PI / 2.35;
    grip.rotation.z = side * 0.24;
    grip.position.set(side * 0.064, 0.032, 0.062);
    grip.scale.set(1, 1, 0.9);
    grip.castShadow = true;
    group.add(grip);
  }

  // black face plate
  const face = new THREE.Mesh(new RoundedBoxGeometry(0.086, 0.012, 0.066, 3, 0.012), black);
  face.position.set(0, 0.072, -0.004);
  group.add(face);

  // touchpad
  const touch = new THREE.Mesh(new RoundedBoxGeometry(0.058, 0.008, 0.042, 3, 0.008), new THREE.MeshStandardMaterial({ color: 0x171b24, roughness: 0.35, metalness: 0.3 }));
  touch.position.set(0, 0.078, -0.014);
  group.add(touch);

  // light bar
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0x3b8cff,
    emissive: 0x4f9dff,
    emissiveIntensity: 2.6,
    roughness: 0.25,
  });
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.004, 0.004), lightMat);
  bar.position.set(0, 0.079, 0.008);
  group.add(bar);

  // sticks
  for (const side of [-1, 1]) {
    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.016, 0.004, 20), new THREE.MeshStandardMaterial({ color: 0x0b0e14, roughness: 0.7 }));
    well.position.set(side * 0.033, 0.074, 0.018);
    group.add(well);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.012, 20), black);
    stick.position.set(side * 0.033, 0.081, 0.018);
    group.add(stick);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.012, 0.004, 20), new THREE.MeshStandardMaterial({ color: 0x1a1e27, roughness: 0.55 }));
    cap.position.set(side * 0.033, 0.088, 0.018);
    group.add(cap);
  }

  // d-pad
  const dpadMat = new THREE.MeshStandardMaterial({ color: 0x121620, roughness: 0.5 });
  const dpad = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.005, 0.019), dpadMat);
    b.position.z = 0.0105;
    b.rotation.y = (i * Math.PI) / 2;
    dpad.add(b);
  }
  dpad.position.set(-0.058, 0.078, 0.002);
  group.add(dpad);

  // face buttons
  const btnColors = [0x8bd17c, 0xf06a7a, 0x6fa8ff, 0xf2a0d0];
  const btnPos = [[0.012, -0.006], [0.006, 0.006], [0.018, 0.006], [0.012, 0.018]];
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.005, 16), new THREE.MeshStandardMaterial({ color: btnColors[i], roughness: 0.45 }));
    b.position.set(0.058 + (btnPos[i][0] - 0.012), 0.078, 0.002 + btnPos[i][1] - 0.006);
    group.add(b);
  }

  // PS button
  const ps = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.003, 16), new THREE.MeshStandardMaterial({ color: 0xd7dce8, roughness: 0.4 }));
  ps.position.set(0, 0.078, 0.012);
  group.add(ps);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('#4f9dff'),
    color: 0x5fa8ff,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  glow.scale.set(0.16, 0.06, 1);
  glow.position.set(0, 0.085, 0.012);
  group.add(glow);

  group.userData.lightMat = lightMat;
  group.userData.glow = glow;
  return group;
}

export function createTV(screenTexture) {
  const group = new THREE.Group();
  group.name = 'TV';

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x07080c, roughness: 0.5, metalness: 0.55 });
  const frame = new THREE.Mesh(new RoundedBoxGeometry(2.7, 1.5, 0.055, 4, 0.012), frameMat);
  frame.castShadow = true;
  group.add(frame);

  const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.58, 1.42), screenMat);
  screen.position.z = 0.029;
  screen.name = 'TVScreen';
  group.add(screen);

  // glossy reflection sheen
  const sheenCanvas = canvas2d(512, 288);
  const sc = sheenCanvas.ctx;
  const lg = sc.createLinearGradient(0, 0, 512, 288);
  lg.addColorStop(0, 'rgba(180,210,255,0.10)');
  lg.addColorStop(0.35, 'rgba(180,210,255,0.015)');
  lg.addColorStop(0.5, 'rgba(255,255,255,0)');
  sc.fillStyle = lg;
  sc.fillRect(0, 0, 512, 288);
  const sheen = new THREE.Mesh(
    new THREE.PlaneGeometry(2.58, 1.42),
    new THREE.MeshBasicMaterial({ map: textureFromCanvas(sheenCanvas.canvas), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false })
  );
  sheen.position.z = 0.031;
  group.add(sheen);

  // stand
  const neck = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.34, 0.06, 2, 0.01), frameMat);
  neck.position.set(0, -0.9, -0.03);
  group.add(neck);
  const foot = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.026, 0.3, 3, 0.012), frameMat);
  foot.position.set(0, -1.08, 0.01);
  foot.castShadow = true;
  group.add(foot);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('#2f6bff'),
    color: 0x3f7bff,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }));
  glow.scale.set(3.8, 2.5, 1);
  glow.position.set(0, 0, -0.12);
  group.add(glow);

  group.userData.screen = screen;
  group.userData.glow = glow;
  return group;
}

export function createGameCase(title, accent, coverCanvas) {
  const group = new THREE.Group();
  const caseMat = new THREE.MeshStandardMaterial({ color: 0x0b0e16, roughness: 0.4, metalness: 0.2 });
  const shell = new THREE.Mesh(new RoundedBoxGeometry(0.135, 0.17, 0.016, 2, 0.004), caseMat);
  shell.castShadow = true;
  group.add(shell);
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(0.115, 0.135),
    new THREE.MeshBasicMaterial({ map: textureFromCanvas(coverCanvas), toneMapped: false })
  );
  art.position.z = 0.0085;
  group.add(art);
  const spine = new THREE.Mesh(
    new THREE.BoxGeometry(0.01, 0.17, 0.017),
    new THREE.MeshBasicMaterial({ color: accent, toneMapped: false })
  );
  spine.position.x = -0.063;
  group.add(spine);
  return group;
}

export function createMug(color = 0xd9d3c7) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.034, 0.09, 24), mat);
  body.position.y = 0.045;
  body.castShadow = true;
  group.add(body);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.006, 24), new THREE.MeshStandardMaterial({ color: 0x2b1a10, roughness: 0.3 }));
  inner.position.y = 0.089;
  group.add(inner);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.007, 8, 20, Math.PI * 1.25), mat);
  handle.position.set(0.042, 0.05, 0);
  handle.rotation.z = -0.4;
  group.add(handle);
  return group;
}

export function createPlant(scale = 1) {
  const group = new THREE.Group();
  const potMat = new THREE.MeshStandardMaterial({ color: 0x2c2f38, roughness: 0.8 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.24, 20), potMat);
  pot.position.y = 0.12;
  pot.castShadow = true;
  group.add(pot);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.01, 20), new THREE.MeshStandardMaterial({ color: 0x18120d, roughness: 1 }));
  soil.position.y = 0.24;
  group.add(soil);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b46, roughness: 0.7, side: THREE.DoubleSide });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3f8256, roughness: 0.7, side: THREE.DoubleSide });
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * TAU + 0.4;
    const h = 0.45 + Math.random() * 0.4;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), i % 2 ? leafMat : leafMat2);
    leaf.scale.set(0.55, 1.7, 0.14);
    leaf.position.set(Math.cos(a) * 0.13, 0.28 + h * 0.5, Math.sin(a) * 0.13);
    leaf.rotation.set(Math.cos(a) * 0.45, -a, Math.sin(a) * 0.55);
    group.add(leaf);
  }
  group.scale.setScalar(scale);
  return group;
}

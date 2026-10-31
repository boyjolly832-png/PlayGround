import * as THREE from 'three';
import { RoundedBoxGeometry } from '../vendor/addons/RoundedBoxGeometry.js';
import { createPS5, createController, createTV, createGameCase, createMug, createPlant } from './models.js';
import {
  woodTexture, wallTexture, rugTexture, cityTexture, posterTexture, neonTexture,
  textureFromCanvas, softShadowTexture, canvas2d, seeded, TAU,
} from './util.js';

const ROOM = { minX: -4.3, maxX: 4.3, minZ: -4.3, maxZ: 4.3, height: 3.25 };

function shadowPlane(texture, w, d, x, z, opacity = 0.75) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity, depthWrite: false, toneMapped: false })
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.016, z);
  mesh.renderOrder = 1;
  return mesh;
}

function makeCaseCover(title, sub, accent, accent2, motif) {
  const { canvas, ctx } = canvas2d(256, 340);
  const g = ctx.createLinearGradient(0, 0, 256, 340);
  g.addColorStop(0, accent);
  g.addColorStop(1, accent2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 340);
  ctx.globalAlpha = 0.28;
  for (let i = 0; i < 7; i++) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(128, 150, 30 + i * 26, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(4,8,16,0.28)';
  ctx.fillRect(0, 0, 256, 340);
  if (motif === 'orb') {
    const rg = ctx.createRadialGradient(128, 138, 4, 128, 138, 58);
    rg.addColorStop(0, '#ffffff');
    rg.addColorStop(0.35, accent2);
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(128, 138, 58, 0, TAU); ctx.fill();
  } else if (motif === 'grid') {
    ctx.strokeStyle = 'rgba(130,235,255,0.8)';
    for (let i = 0; i < 6; i++) {
      const y = 170 + Math.pow(i / 5, 2) * 90;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
  } else if (motif === 'ship') {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.moveTo(128, 96); ctx.lineTo(158, 168); ctx.lineTo(128, 152); ctx.lineTo(98, 168); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 30px "Space Grotesk", sans-serif';
  ctx.fillText(title, 18, 280);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '600 11px "Inter", sans-serif';
  ctx.fillText(sub, 19, 300);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(18, 310, 42, 2);
  return canvas;
}

export function buildRoom(scene, screenTexture) {
  const colliders = [];
  const interactive = [];
  const tex = {
    wood: woodTexture(),
    wall: wallTexture(),
    rug: rugTexture(),
    city: cityTexture(),
    posterA: posterTexture(0),
    posterB: posterTexture(1),
    shadow: softShadowTexture(),
  };

  const floorMat = new THREE.MeshStandardMaterial({
    map: tex.wood,
    color: 0xd6c0a4,
    roughness: 0.48,
    metalness: 0.06,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 8.6), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ map: tex.wall, color: 0xe2e8f5, roughness: 0.94, metalness: 0.02 });
  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x10141d, roughness: 0.95 });

  // walls
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(8.6, ROOM.height), wallMat);
  backWall.position.set(0, ROOM.height / 2, -4.3);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(8.6, ROOM.height), wallMat);
  frontWall.position.set(0, ROOM.height / 2, 4.3);
  frontWall.rotation.y = Math.PI;
  frontWall.receiveShadow = true;
  scene.add(frontWall);

  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(8.6, ROOM.height), wallMat);
  leftWall.position.set(-4.3, ROOM.height / 2, 0);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  scene.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(8.6, ROOM.height), wallMat);
  rightWall.position.set(4.3, ROOM.height / 2, 0);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  scene.add(rightWall);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 8.6), ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM.height;
  scene.add(ceiling);

  // baseboards
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x161a22, roughness: 0.6, metalness: 0.15 });
  const trim = (w, d, x, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.11, d), trimMat);
    m.position.set(x, 0.055, z);
    m.rotation.y = ry;
    scene.add(m);
  };
  trim(8.55, 0.03, 0, -4.27);
  trim(8.55, 0.03, 0, 4.27);
  trim(0.03, 8.55, -4.27, 0);
  trim(0.03, 8.55, 4.27, 0);

  // rug
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(4.4, 3.0),
    new THREE.MeshStandardMaterial({ map: tex.rug, roughness: 0.95, metalness: 0.02 })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.012, -1.0);
  rug.receiveShadow = true;
  scene.add(rug);

  // slat feature wall
  const slatBack = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 2.55), new THREE.MeshStandardMaterial({ color: 0x0c0f16, roughness: 1 }));
  slatBack.position.set(0, 1.62, -4.285);
  scene.add(slatBack);
  const slatMat = new THREE.MeshStandardMaterial({ color: 0x463222, roughness: 0.78, metalness: 0.03 });
  const slatCount = 47;
  const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.042, 2.5, 0.026), slatMat, slatCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < slatCount; i++) {
    dummy.position.set(-2.72 + i * 0.118, 1.62, -4.265);
    dummy.updateMatrix();
    slats.setMatrixAt(i, dummy.matrix);
  }
  scene.add(slats);

  // media unit
  const mediaMat = new THREE.MeshStandardMaterial({ color: 0x3c2b1f, roughness: 0.42, metalness: 0.12 });
  const mediaFrontMat = new THREE.MeshStandardMaterial({ color: 0x2e2118, roughness: 0.38, metalness: 0.18 });
  const media = new THREE.Group();
  const addMediaBox = (w, h, d, x, y, z, mat = mediaMat) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.008), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    media.add(m);
    return m;
  };
  addMediaBox(4.25, 0.06, 0.5, 0, 0.53, 0);
  addMediaBox(4.25, 0.05, 0.5, 0, 0.075, 0);
  addMediaBox(0.06, 0.45, 0.5, -2.09, 0.3, 0);
  addMediaBox(0.06, 0.45, 0.5, 2.09, 0.3, 0);
  addMediaBox(1.9, 0.42, 0.04, -1.08, 0.3, -0.23);
  addMediaBox(1.9, 0.42, 0.04, 1.08, 0.3, -0.23);
  // doors with seams
  for (const side of [-1, 1]) {
    const door = addMediaBox(1.95, 0.42, 0.035, side * 1.04, 0.3, 0.235, mediaFrontMat);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.012), new THREE.MeshStandardMaterial({ color: 0x6b6258, metalness: 0.8, roughness: 0.3 }));
    handle.position.set(side * 0.12, 0.42, 0.26);
    media.add(handle);
  }
  // under-unit LED
  const underLed = new THREE.Mesh(
    new THREE.BoxGeometry(4.1, 0.008, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x2b6bff, emissive: 0x2f6bff, emissiveIntensity: 2.2, toneMapped: true })
  );
  underLed.position.set(0, 0.07, 0.253);
  media.add(underLed);
  // feet
  for (const x of [-1.9, 1.9]) {
    for (const z of [-0.18, 0.18]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.014, 0.06, 10), trimMat);
      leg.position.set(x, 0.03, z);
      media.add(leg);
    }
  }
  media.position.set(0, 0, -3.96);
  scene.add(media);
  colliders.push({ minX: -2.18, maxX: 2.18, minZ: -4.3, maxZ: -3.64, label: 'media unit' });

  // TV
  const tv = createTV(screenTexture);
  tv.position.set(-0.65, 1.68, -3.9);
  scene.add(tv);
  const screenMesh = tv.userData.screen;
  interactive.push({ mesh: screenMesh, label: 'TV' });

  // soundbar
  const soundbar = new THREE.Mesh(
    new RoundedBoxGeometry(1.9, 0.085, 0.1, 3, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.65, metalness: 0.3 })
  );
  soundbar.position.set(-0.65, 0.6, -3.62);
  scene.add(soundbar);
  const sbGlow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.006, 0.006), new THREE.MeshStandardMaterial({ color: 0x2f6bff, emissive: 0x2f6bff, emissiveIntensity: 1.2 }));
  sbGlow.position.set(-0.65, 0.63, -3.57);
  scene.add(sbGlow);

  // PS5 + controller
  const ps5 = createPS5();
  ps5.position.set(1.85, 0.56, -3.79);
  ps5.rotation.y = -0.46;
  ps5.scale.setScalar(1.66);
  scene.add(ps5);
  interactive.push({ mesh: ps5, label: 'PS5' });

  const controller = createController();
  controller.position.set(0.12, 0.425, -1.02);
  controller.rotation.y = 0.42;
  scene.add(controller);

  // game cases on media unit
  const caseData = [
    ['ASTRO', 'PLAYROOM', '#2b4d8f', '#0b1430', 'orb'],
    ['NEON', 'DRIFT', '#a3266b', '#200a3a', 'grid'],
    ['STAR', 'FALL', '#173f6b', '#050b18', 'ship'],
  ];
  caseData.forEach(([t, s, a, b, m], i) => {
    const c = createGameCase(t, new THREE.Color(a).getHex(), makeCaseCover(t, s, a, b, m));
    c.position.set(-1.55 + i * 0.17, 0.65, -3.86);
    c.rotation.y = -0.08 + i * 0.02;
    scene.add(c);
  });

  // sofa
  const sofaMat = new THREE.MeshStandardMaterial({ color: 0x414d67, roughness: 0.92, metalness: 0.02 });
  const sofaDark = new THREE.MeshStandardMaterial({ color: 0x2c3549, roughness: 0.95 });
  const sofa = new THREE.Group();
  const addSofa = (w, h, d, x, y, z, mat = sofaMat) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(0.06, h / 2.5)), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    sofa.add(m);
    return m;
  };
  addSofa(2.72, 0.3, 1.02, 0, 0.16, 0);
  addSofa(1.28, 0.2, 0.82, -0.67, 0.4, -0.02);
  addSofa(1.28, 0.2, 0.82, 0.67, 0.4, -0.02);
  addSofa(2.72, 0.66, 0.24, 0, 0.63, 0.4);
  addSofa(0.24, 0.56, 1.02, -1.3, 0.35, 0);
  addSofa(0.24, 0.56, 1.02, 1.3, 0.35, 0);
  // pillows
  const pillowMats = [
    new THREE.MeshStandardMaterial({ color: 0x38425c, roughness: 0.98 }),
    new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.98 }),
  ];
  for (let i = 0; i < 2; i++) {
    const p = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.4, 0.14, 3, 0.06), pillowMats[i]);
    p.position.set(i ? 0.78 : -0.78, 0.62, 0.26);
    p.rotation.set(0.22, i ? -0.16 : 0.16, i ? -0.12 : 0.12);
    p.castShadow = true;
    sofa.add(p);
  }
  // throw blanket
  const blanket = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.06, 0.66, 3, 0.03), new THREE.MeshStandardMaterial({ color: 0x5b3f2c, roughness: 1 }));
  blanket.position.set(0.95, 0.51, -0.18);
  blanket.rotation.z = 0.03;
  blanket.castShadow = true;
  sofa.add(blanket);
  const throwBack = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.045, 0.3, 3, 0.02), new THREE.MeshStandardMaterial({ color: 0x6b4a33, roughness: 1 }));
  throwBack.position.set(-0.45, 0.98, 0.4);
  throwBack.rotation.z = 0.015;
  throwBack.castShadow = true;
  sofa.add(throwBack);
  // legs
  for (const x of [-1.2, 1.2]) {
    for (const z of [-0.38, 0.38]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.08, 10), trimMat);
      leg.position.set(x, 0.02, z);
      sofa.add(leg);
    }
  }
  sofa.position.set(0, 0, 0.92);
  scene.add(sofa);
  colliders.push({ minX: -1.46, maxX: 1.46, minZ: 0.38, maxZ: 1.46, label: 'sofa' });

  // coffee table
  const tableTopMat = new THREE.MeshStandardMaterial({ color: 0x33251a, roughness: 0.3, metalness: 0.08 });
  const table = new THREE.Group();
  const top = new THREE.Mesh(new RoundedBoxGeometry(1.62, 0.055, 0.72, 3, 0.012), tableTopMat);
  top.position.y = 0.4;
  top.castShadow = true;
  top.receiveShadow = true;
  table.add(top);
  for (const x of [-0.7, 0.7]) {
    for (const z of [-0.27, 0.27]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, 0.38, 12), new THREE.MeshStandardMaterial({ color: 0x171a20, metalness: 0.7, roughness: 0.35 }));
      leg.position.set(x, 0.19, z);
      leg.castShadow = true;
      table.add(leg);
    }
  }
  const lower = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.03, 0.55, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0x1c1510, roughness: 0.6 }));
  lower.position.y = 0.14;
  table.add(lower);
  table.position.set(0, 0, -1.02);
  scene.add(table);
  colliders.push({ minX: -0.83, maxX: 0.83, minZ: -1.4, maxZ: -0.64, label: 'coffee table' });

  // mug + remote + extra case on table
  const mug = createMug(0xcfc7b8);
  mug.position.set(-0.56, 0.428, -1.16);
  scene.add(mug);
  const remote = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.025, 0.19, 2, 0.01), new THREE.MeshStandardMaterial({ color: 0x0c0f16, roughness: 0.5 }));
  remote.position.set(0.58, 0.44, -0.9);
  remote.rotation.y = 0.4;
  scene.add(remote);
  const extraCase = createGameCase('PONG', 0xf2c14e, makeCaseCover('PONG', 'ROYALE', '#7a5b12', '#1a1204', 'orb'));
  extraCase.position.set(0.48, 0.455, -1.22);
  extraCase.rotation.set(-Math.PI / 2, 0, 0.3);
  scene.add(extraCase);

  // shelf
  const shelf = new THREE.Group();
  const shelfMat = new THREE.MeshStandardMaterial({ color: 0x2a1e15, roughness: 0.55, metalness: 0.05 });
  const shelfW = 0.34, shelfH = 2.25, shelfD = 2.9;
  const side1 = new THREE.Mesh(new RoundedBoxGeometry(shelfW, shelfH, 0.04, 2, 0.005), shelfMat);
  side1.position.set(0, shelfH / 2, -shelfD / 2);
  shelf.add(side1);
  const side2 = side1.clone();
  side2.position.z = shelfD / 2;
  shelf.add(side2);
  for (let i = 0; i < 5; i++) {
    const y = 0.1 + i * 0.53;
    const board = new THREE.Mesh(new RoundedBoxGeometry(shelfW, 0.04, shelfD, 2, 0.006), shelfMat);
    board.position.set(0, y, 0);
    board.castShadow = true;
    board.receiveShadow = true;
    shelf.add(board);
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(shelfD, shelfH), new THREE.MeshStandardMaterial({ color: 0x120e0a, roughness: 1 }));
  back.rotation.y = Math.PI / 2;
  back.position.set(0.16, shelfH / 2, 0);
  shelf.add(back);

  // books
  const bookColors = [0x8c3b3b, 0x2f5f7a, 0x7a6a35, 0x3e5a3c, 0x6a3f6a, 0xa06a3a];
  const rnd = seeded(12);
  for (let row = 0; row < 4; row++) {
    const y = 0.13 + row * 0.53;
    let z = -1.1 + rnd() * 0.3;
    const count = 5 + Math.floor(rnd() * 5);
    for (let i = 0; i < count; i++) {
      const h = 0.18 + rnd() * 0.12;
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, h, 0.035 + rnd() * 0.03),
        new THREE.MeshStandardMaterial({ color: bookColors[(rnd() * bookColors.length) | 0], roughness: 0.85 })
      );
      b.position.set(0, y + h / 2, z);
      b.rotation.y = Math.PI / 2;
      shelf.add(b);
      z += 0.055 + rnd() * 0.02;
    }
  }
  // decor on shelf
  const smallPlant = createPlant(0.55);
  smallPlant.position.set(0, 1.19, 0.85);
  shelf.add(smallPlant);
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 16), new THREE.MeshStandardMaterial({ color: 0xd8c9ad, roughness: 0.8 }));
  candle.position.set(0, 1.79, -0.7);
  shelf.add(candle);
  const candleLight = new THREE.PointLight(0xffb46b, 1.4, 1.4, 2);
  candleLight.position.set(0, 1.92, -0.7);
  shelf.add(candleLight);
  const miniPS = createPS5();
  miniPS.scale.setScalar(0.26);
  miniPS.position.set(0, 2.2, 0.55);
  miniPS.rotation.y = -0.3;
  shelf.add(miniPS);
  shelf.position.set(-4.05, 0, 0.7);
  scene.add(shelf);
  colliders.push({ minX: -4.3, maxX: -3.84, minZ: -0.8, maxZ: 2.2, label: 'shelf' });

  // posters
  const makePoster = (map, x, y, z, rot = 0) => {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new RoundedBoxGeometry(0.96, 1.34, 0.04, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.45, metalness: 0.4 }));
    g.add(frame);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 1.26), new THREE.MeshBasicMaterial({ map, toneMapped: false }));
    art.position.z = 0.023;
    g.add(art);
    g.position.set(x, y, z);
    g.rotation.y = rot;
    scene.add(g);
  };
  makePoster(tex.posterA, -3.35, 1.82, -4.265);
  makePoster(tex.posterB, 3.35, 1.82, -4.265);

  // neon sign
  const neon = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 0.51),
    new THREE.MeshBasicMaterial({ map: neonTexture('PLAY', '#6fe3ff'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
  );
  neon.position.set(-0.65, 2.83, -4.24);
  scene.add(neon);
  const neonGlow = new THREE.PointLight(0x4fd4ff, 2.2, 3.2, 2);
  neonGlow.position.set(-0.65, 2.8, -4.0);
  scene.add(neonGlow);

  // window
  const winW = 2.55, winH = 1.72;
  const win = new THREE.Mesh(
    new THREE.PlaneGeometry(winW, winH),
    new THREE.MeshBasicMaterial({ map: tex.city, toneMapped: false })
  );
  win.position.set(4.285, 1.78, -0.9);
  win.rotation.y = -Math.PI / 2;
  scene.add(win);
  const winFrameMat = new THREE.MeshStandardMaterial({ color: 0x0a0d14, roughness: 0.5, metalness: 0.4 });
  const winFrame = new THREE.Group();
  const fw = 0.055;
  const bars = [
    [0.03, winH + 0.12, fw, 0, 0, -winW / 2 - 0.02],
    [0.03, winH + 0.12, fw, 0, 0, winW / 2 + 0.02],
    [0.03, fw, winW + 0.1, 0, winH / 2 + 0.02, 0],
    [0.03, fw, winW + 0.1, 0, -winH / 2 - 0.02, 0],
    [0.03, fw, 0.035, 0, 0, 0],
  ];
  for (const [w, h, d, x, y, z] of bars) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), winFrameMat);
    bar.position.set(x, y, z);
    winFrame.add(bar);
  }
  winFrame.position.set(4.27, 1.78, -0.9);
  winFrame.rotation.y = -Math.PI / 2;
  scene.add(winFrame);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, winW + 0.3), new THREE.MeshStandardMaterial({ color: 0x2b2a2a, roughness: 0.5 }));
  sill.position.set(4.24, 0.9, -0.9);
  scene.add(sill);
  // curtain panels
  const curtainMat = new THREE.MeshStandardMaterial({ color: 0x1c2536, roughness: 0.98, side: THREE.DoubleSide });
  for (const z of [-2.45, 0.65]) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 2.3, 1, 8), curtainMat);
    c.position.set(4.17, 1.55, z);
    c.rotation.y = -Math.PI / 2;
    scene.add(c);
  }
  // city glow light
  const windowLight = new THREE.PointLight(0x6f9bff, 11, 9, 2);
  windowLight.position.set(3.7, 1.9, -0.9);
  scene.add(windowLight);

  // door on front wall
  const door = new THREE.Group();
  const doorPanel = new THREE.Mesh(new RoundedBoxGeometry(1.04, 2.18, 0.06, 2, 0.01), new THREE.MeshStandardMaterial({ color: 0x1a1f2a, roughness: 0.55, metalness: 0.15 }));
  doorPanel.position.y = 1.09;
  door.add(doorPanel);
  const doorTrim = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.3, 0.03), new THREE.MeshStandardMaterial({ color: 0x0b0e14, roughness: 0.5 }));
  doorTrim.position.set(0, 1.15, 0.04);
  door.add(doorTrim);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.18, 12), new THREE.MeshStandardMaterial({ color: 0x9a8f7a, metalness: 0.8, roughness: 0.3 }));
  handle.position.set(0.38, 1.06, -0.07);
  handle.rotation.z = Math.PI / 2;
  door.add(handle);
  door.position.set(2.7, 0, 4.26);
  door.rotation.y = Math.PI;
  scene.add(door);

  // floor lamp
  const lamp = new THREE.Group();
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x16181f, metalness: 0.6, roughness: 0.4 });
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.03, 24), lampMat);
  lampBase.position.y = 0.015;
  lamp.add(lampBase);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.55, 10), lampMat);
  pole.position.y = 0.79;
  lamp.add(pole);
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xd8c7ab, roughness: 0.85, side: THREE.DoubleSide, emissive: 0xff9a55, emissiveIntensity: 0.18 });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.3, 28, 1, true), shadeMat);
  shade.position.y = 1.64;
  shade.rotation.x = Math.PI;
  lamp.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd7a0, toneMapped: false }));
  bulb.position.y = 1.6;
  lamp.add(bulb);
  const lampLight = new THREE.PointLight(0xffb47a, 18, 9, 2);
  lampLight.position.y = 1.56;
  lamp.add(lampLight);
  lamp.position.set(-2.85, 0, 2.05);
  scene.add(lamp);
  colliders.push({ minX: -3.08, maxX: -2.62, minZ: 1.82, maxZ: 2.28, label: 'lamp' });

  // pendant light
  const pendant = new THREE.Group();
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.55, 6), lampMat);
  cord.position.y = 0.28;
  pendant.add(cord);
  const pShade = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.24, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x1b1d24, roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide }));
  pShade.position.y = 0;
  pShade.rotation.x = Math.PI;
  pendant.add(pShade);
  const pBulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd7a0, toneMapped: false }));
  pBulb.position.y = 0.01;
  pendant.add(pBulb);
  const pLight = new THREE.PointLight(0xffc38a, 12, 6.5, 2);
  pLight.position.y = -0.04;
  pendant.add(pLight);
  pendant.position.set(0, 2.92, -1.02);
  scene.add(pendant);

  // plants
  const plant = createPlant(1.45);
  plant.position.set(-3.55, 0, -3.2);
  scene.add(plant);
  colliders.push({ minX: -3.85, maxX: -3.25, minZ: -3.5, maxZ: -2.9, label: 'plant' });
  const plant2 = createPlant(0.9);
  plant2.position.set(3.55, 0, 2.95);
  scene.add(plant2);
  colliders.push({ minX: 3.3, maxX: 3.8, minZ: 2.7, maxZ: 3.2, label: 'plant' });

  // wall shelf right with small items
  const wallShelf = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.045, 0.26), shelfMat);
  wallShelf.position.set(3.55, 2.72, -3.9);
  scene.add(wallShelf);
  for (let i = 0; i < 3; i++) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.12), new THREE.MeshStandardMaterial({ color: [0x2b4d8f, 0x8c3b3b, 0x3e5a3c][i], roughness: 0.8 }));
    box.position.set(3.25 + i * 0.25, 2.81, -3.9);
    box.rotation.y = 0.1 * i;
    scene.add(box);
  }

  // contact shadows
  scene.add(shadowPlane(tex.shadow, 3.6, 2.2, 0, 0.92, 0.85));
  scene.add(shadowPlane(tex.shadow, 2.4, 1.4, 0, -1.02, 0.7));
  scene.add(shadowPlane(tex.shadow, 5.2, 1.4, 0, -3.96, 0.9));
  scene.add(shadowPlane(tex.shadow, 1.2, 3.2, -4.0, 0.7, 0.7));
  scene.add(shadowPlane(tex.shadow, 1.2, 1.2, -3.55, -3.2, 0.6));
  scene.add(shadowPlane(tex.shadow, 0.7, 0.7, -2.85, 2.05, 0.55));

  // dust motes
  const dustGeo = new THREE.BufferGeometry();
  const dustCount = 180;
  const pos = new Float32Array(dustCount * 3);
  const speeds = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 8;
    pos[i * 3 + 1] = 0.4 + Math.random() * 2.4;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    speeds[i] = 0.01 + Math.random() * 0.035;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0xa8c4ff,
    size: 0.012,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  // lighting
  const hemi = new THREE.HemisphereLight(0x9fb5ee, 0x2b1d12, 0.85);
  scene.add(hemi);

  const moon = new THREE.DirectionalLight(0xa8c2ff, 1.9);
  moon.position.set(6, 5.5, -0.6);
  moon.target.position.set(-1, 0.4, -1);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  moon.shadow.camera.left = -6;
  moon.shadow.camera.right = 6;
  moon.shadow.camera.top = 6;
  moon.shadow.camera.bottom = -6;
  moon.shadow.camera.near = 0.5;
  moon.shadow.camera.far = 18;
  moon.shadow.bias = -0.0012;
  moon.shadow.normalBias = 0.02;
  scene.add(moon);
  scene.add(moon.target);

  const ambient = new THREE.AmbientLight(0x4c5a80, 0.55);
  scene.add(ambient);

  // TV bias light
  const tvLight = new THREE.PointLight(0x2f6bff, 3.2, 6, 2);
  tvLight.position.set(0, 1.7, -3.35);
  scene.add(tvLight);

  // under-media glow
  const mediaGlow = new THREE.PointLight(0x2f6bff, 2.2, 3.2, 2);
  mediaGlow.position.set(0, 0.2, -3.4);
  scene.add(mediaGlow);

  // warm fill
  const warmFill = new THREE.PointLight(0xff9a5c, 5.5, 7, 2);
  warmFill.position.set(-1.5, 1.4, 2.6);
  scene.add(warmFill);

  // soft ceiling fill
  for (const x of [-2.1, 2.1]) {
    const fill = new THREE.PointLight(0xcfe0ff, 7, 8, 2);
    fill.position.set(x, 2.95, 0.8);
    scene.add(fill);
  }
  // media-unit accent light
  const consoleLight = new THREE.PointLight(0xdfeaff, 2.6, 2.2, 2);
  consoleLight.position.set(1.85, 1.25, -3.25);
  scene.add(consoleLight);

  let t = 0;
  const update = (dt) => {
    t += dt;
    const arr = dust.geometry.attributes.position.array;
    for (let i = 0; i < dustCount; i++) {
      arr[i * 3 + 1] += speeds[i] * dt;
      arr[i * 3] += Math.sin(t * 0.2 + i) * 0.0009;
      if (arr[i * 3 + 1] > 3.0) arr[i * 3 + 1] = 0.35;
    }
    dust.geometry.attributes.position.needsUpdate = true;
    const flicker = 0.92 + Math.sin(t * 17) * 0.03 + Math.sin(t * 5.3) * 0.05;
    neonGlow.intensity = 2.2 * flicker;
    candleLight.intensity = 1.3 + Math.sin(t * 9) * 0.12;
  };

  return {
    colliders,
    interactive,
    tv,
    screenMesh,
    ps5,
    controller,
    tvLight,
    windowLight,
    mediaGlow,
    update,
    bounds: ROOM,
  };
}

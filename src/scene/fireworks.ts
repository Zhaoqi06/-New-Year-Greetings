import * as THREE from 'three';
import type { FireworkSoundStyle } from '../audio/festiveAudio';
import type { ProceduralTextureSet } from './textures';

export interface FireworksCallbacks {
  onLaunch?: () => void;
  onBurst?: (style: FireworkSoundStyle, intensity: number) => void;
}

export interface FireworksSystem {
  group: THREE.Group;
  launchAt: (target: THREE.Vector3, style?: FireworkSoundStyle, scale?: number) => void;
  launchRandomHero: () => void;
  syncTimelineSeek: (showTime: number) => void;
  update: (elapsed: number, showTime: number, dt: number, reducedMotion: boolean) => number;
  dispose: () => void;
}

interface RocketSlot {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  targetY: number;
  style: FireworkSoundStyle;
  scale: number;
  colorA: THREE.Color;
  colorB: THREE.Color;
  trailAccum: number;
}

interface SmokeSlot {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  active: boolean;
  age: number;
  life: number;
  startScale: number;
  endScale: number;
  velX: number;
  velY: number;
  baseOpacity: number;
}

interface ChoreoCue {
  time: number;
  x: number;
  y: number;
  z: number;
  style: FireworkSoundStyle;
  scale: number;
}

interface SkyLanternItem {
  angle: number;
  radius: number;
  y: number;
  speed: number;
  swayPhase: number;
  scale: number;
}

// 60-second Four-Act Firework Choreography Script
const CHOREO_CUES: ChoreoCue[] = [
  // Act I subtle herald near end of awakening
  { time: 12.6, x: 7.8, y: 15.8, z: -13, style: 'chrysanthemum', scale: 0.9 },

  // Act II graceful herald fireworks framing the orbit
  { time: 15.8, x: -9.5, y: 16.8, z: -14, style: 'peony', scale: 1.0 },
  { time: 19.6, x: 9.8, y: 18.2, z: -14, style: 'willow', scale: 1.12 },
  { time: 23.4, x: -6.8, y: 18.6, z: -16, style: 'doubleRing', scale: 1.08 },
  { time: 26.8, x: 7.0, y: 17.2, z: -15, style: 'chrysanthemum', scale: 1.1 },

  // Act III GRAND FIREWORKS CLIMAX (28s - 48s)
  { time: 28.6, x: -10.8, y: 17.8, z: -15, style: 'peony', scale: 1.18 },
  { time: 29.0, x: 10.8, y: 18.0, z: -15, style: 'peony', scale: 1.18 },
  { time: 30.8, x: 0.0, y: 20.8, z: -17, style: 'willow', scale: 1.34 },

  { time: 32.8, x: -12.0, y: 16.8, z: -15, style: 'doubleRing', scale: 1.16 },
  { time: 33.4, x: 11.8, y: 17.4, z: -15, style: 'chrysanthemum', scale: 1.16 },
  { time: 34.8, x: -4.4, y: 19.6, z: -15, style: 'chrysanthemum', scale: 1.2 },
  { time: 35.4, x: 4.8, y: 20.0, z: -15, style: 'peony', scale: 1.2 },

  { time: 37.2, x: -8.8, y: 21.4, z: -18, style: 'willow', scale: 1.32 },
  { time: 37.8, x: 8.8, y: 21.6, z: -18, style: 'willow', scale: 1.32 },
  { time: 39.5, x: 0.2, y: 19.2, z: -16, style: 'doubleRing', scale: 1.25 },

  { time: 41.2, x: -13.2, y: 17.4, z: -16, style: 'peony', scale: 1.18 },
  { time: 41.7, x: 13.0, y: 17.8, z: -16, style: 'chrysanthemum', scale: 1.18 },
  { time: 42.6, x: -5.6, y: 20.4, z: -16, style: 'doubleRing', scale: 1.22 },
  { time: 43.1, x: 5.6, y: 20.8, z: -16, style: 'peony', scale: 1.22 },

  // Act III Finale Volley (44.8s - 46.6s)
  { time: 44.8, x: -11.2, y: 18.8, z: -16, style: 'chrysanthemum', scale: 1.28 },
  { time: 45.1, x: 11.2, y: 19.0, z: -16, style: 'chrysanthemum', scale: 1.28 },
  { time: 45.6, x: -4.8, y: 21.8, z: -17, style: 'willow', scale: 1.34 },
  { time: 45.9, x: 4.8, y: 21.8, z: -17, style: 'willow', scale: 1.34 },
  { time: 46.4, x: 0.0, y: 23.0, z: -18, style: 'doubleRing', scale: 1.38 },

  // Act IV Poetic Lingering Echoes (48s - 60s)
  { time: 50.6, x: -8.8, y: 18.8, z: -16, style: 'willow', scale: 1.15 },
  { time: 54.4, x: 8.8, y: 19.6, z: -16, style: 'peony', scale: 1.1 },
  { time: 57.6, x: -2.2, y: 20.4, z: -17, style: 'willow', scale: 1.2 },
];

// Realistic pyrotechnic mineral-salt chemistry palettes (strontium crimson, charcoal gold, sodium amber, titanium silver-gold)
const PALETTES: Array<[number, number]> = [
  [0xffe08a, 0xb85314], // Brocade Charcoal Gold -> Deep Ember
  [0xff5238, 0xd8882c], // Strontium Crimson -> Warm Gold
  [0xffd0a4, 0xc22f3c], // Peach Titanium -> Ruby Ember
  [0xfff2cc, 0xb67a22], // Ivory Gold -> Weeping Brocade
  [0xff7a34, 0xd6a64e], // Sodium Amber -> Antique Gold
];

const MAX_PARTICLES = 9000;
const MAX_ROCKETS = 18;
const MAX_SMOKE = 26;
const SKY_LANTERN_COUNT = 46;
const SNOW_COUNT = 580;

const _dummy = new THREE.Object3D();
const _tempColor = new THREE.Color();
const _hotCore = new THREE.Color(0xfff7e2);
const _tailColA = new THREE.Color();
const _tailColB = new THREE.Color();
const _vAxis = new THREE.Vector3();
const _vOrtho1 = new THREE.Vector3();
const _vOrtho2 = new THREE.Vector3();
const _vDir = new THREE.Vector3();

export function createFireworksSystem(
  textures: ProceduralTextureSet,
  callbacks: FireworksCallbacks,
): FireworksSystem {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  // =========================================================================
  // 1. Pre-allocated Photorealistic Blackbody-Cooling Pyrotechnic Pool
  // =========================================================================
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  const sizes = new Float32Array(MAX_PARTICLES);
  const alphas = new Float32Array(MAX_PARTICLES);

  const velX = new Float32Array(MAX_PARTICLES);
  const velY = new Float32Array(MAX_PARTICLES);
  const velZ = new Float32Array(MAX_PARTICLES);
  const age = new Float32Array(MAX_PARTICLES);
  const life = new Float32Array(MAX_PARTICLES);
  const drag = new Float32Array(MAX_PARTICLES);
  const gravity = new Float32Array(MAX_PARTICLES);
  const baseSize = new Float32Array(MAX_PARTICLES);
  const shedsTrail = new Uint8Array(MAX_PARTICLES);
  const trailTimer = new Float32Array(MAX_PARTICLES);
  const colAR = new Float32Array(MAX_PARTICLES);
  const colAG = new Float32Array(MAX_PARTICLES);
  const colAB = new Float32Array(MAX_PARTICLES);
  const colBR = new Float32Array(MAX_PARTICLES);
  const colBG = new Float32Array(MAX_PARTICLES);
  const colBB = new Float32Array(MAX_PARTICLES);

  let particleCursor = 0;

  const pGeo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3);
  const colAttr = new THREE.BufferAttribute(colors, 3);
  const sizeAttr = new THREE.BufferAttribute(sizes, 1);
  const alphaAttr = new THREE.BufferAttribute(alphas, 1);

  posAttr.setUsage(THREE.DynamicDrawUsage);
  colAttr.setUsage(THREE.DynamicDrawUsage);
  sizeAttr.setUsage(THREE.DynamicDrawUsage);
  alphaAttr.setUsage(THREE.DynamicDrawUsage);

  pGeo.setAttribute('position', posAttr);
  pGeo.setAttribute('color', colAttr);
  pGeo.setAttribute('aSize', sizeAttr);
  pGeo.setAttribute('aAlpha', alphaAttr);
  geometries.push(pGeo);

  const pMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uMap: { value: textures.sparkGlow },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    vertexShader: `
      attribute float aSize;
      attribute float aAlpha;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uPixelRatio;

      void main() {
        vColor = color;
        vAlpha = aAlpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * uPixelRatio * (210.0 / max(2.0, -mvPosition.z)), 1.5, 38.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        if (vAlpha <= 0.004) discard;
        vec4 tex = texture2D(uMap, gl_PointCoord);
        gl_FragColor = vec4(vColor * tex.rgb * 1.24, tex.a * vAlpha);
      }
    `,
  });
  materials.push(pMat);

  const particlePoints = new THREE.Points(pGeo, pMat);
  particlePoints.frustumCulled = false;
  group.add(particlePoints);

  // =========================================================================
  // 2. Illuminated Pyrotechnic Smoke Plume Pool (真实烟花硝烟微光云团)
  // =========================================================================
  const smokePool: SmokeSlot[] = [];
  let smokeCursor = 0;
  for (let i = 0; i < MAX_SMOKE; i++) {
    const mat = new THREE.SpriteMaterial({
      map: textures.smokePuff,
      color: 0xffc896,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    materials.push(mat);
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    group.add(sprite);
    smokePool.push({
      sprite,
      mat,
      active: false,
      age: 0,
      life: 3.4,
      startScale: 4.5,
      endScale: 13.5,
      velX: 0,
      velY: 0.45,
      baseOpacity: 0.11,
    });
  }

  const spawnSmokePlume = (pos: THREE.Vector3, tint: THREE.Color, scale: number) => {
    for (let k = 0; k < 2; k++) {
      const slot = smokePool[smokeCursor];
      smokeCursor = (smokeCursor + 1) % MAX_SMOKE;
      slot.active = true;
      slot.age = 0;
      slot.life = 3.2 + Math.random() * 1.4;
      slot.startScale = (4.2 + k * 1.8) * scale;
      slot.endScale = (12.0 + k * 3.5) * scale;
      slot.velX = (Math.random() - 0.5) * 0.45 + 0.18;
      slot.velY = 0.35 + Math.random() * 0.32;
      slot.baseOpacity = 0.085 + k * 0.025;
      slot.sprite.position.set(
        pos.x + (Math.random() - 0.5) * 1.6,
        pos.y + (Math.random() - 0.5) * 1.2,
        pos.z - 0.4,
      );
      slot.sprite.scale.setScalar(slot.startScale);
      slot.mat.color.copy(tint).lerp(new THREE.Color(0x6e6270), 0.42);
      slot.mat.opacity = 0;
      slot.sprite.visible = true;
    }
  };

  // =========================================================================
  // 3. Smooth Non-Jarring Sky Glow PointLights (Gentle warm bounce on wet stone)
  // =========================================================================
  const flashLights: Array<{ light: THREE.PointLight; current: number; target: number }> = [];
  for (let i = 0; i < 2; i++) {
    const pl = new THREE.PointLight(0xffb454, 0, 56, 2);
    pl.position.set(0, 18, -15);
    group.add(pl);
    flashLights.push({ light: pl, current: 0, target: 0 });
  }
  let flashCursor = 0;

  // =========================================================================
  // 4. Rocket Pool
  // =========================================================================
  const rockets: RocketSlot[] = [];
  for (let i = 0; i < MAX_ROCKETS; i++) {
    rockets.push({
      active: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      targetY: 16,
      style: 'chrysanthemum',
      scale: 1,
      colorA: new THREE.Color(0xffd46e),
      colorB: new THREE.Color(0xb85314),
      trailAccum: 0,
    });
  }

  const spawnParticle = (
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    maxLife: number,
    size: number,
    pDrag: number,
    pGrav: number,
    cA: THREE.Color,
    cB: THREE.Color,
    hasTrail = false,
  ) => {
    const idx = particleCursor;
    particleCursor = (particleCursor + 1) % MAX_PARTICLES;

    const i3 = idx * 3;
    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;

    velX[idx] = vx;
    velY[idx] = vy;
    velZ[idx] = vz;

    age[idx] = 0.0001;
    life[idx] = maxLife;
    drag[idx] = pDrag;
    gravity[idx] = pGrav;
    baseSize[idx] = size;
    shedsTrail[idx] = hasTrail ? 1 : 0;
    trailTimer[idx] = Math.random() * 0.025;

    colAR[idx] = cA.r;
    colAG[idx] = cA.g;
    colAB[idx] = cA.b;
    colBR[idx] = cB.r;
    colBG[idx] = cB.g;
    colBB[idx] = cB.b;

    colors[i3] = cA.r;
    colors[i3 + 1] = cA.g;
    colors[i3 + 2] = cA.b;
    sizes[idx] = size;
    alphas[idx] = 1;
  };

  const triggerExplosion = (rocket: RocketSlot) => {
    const { pos, style, scale, colorA, colorB } = rocket;

    const fl = flashLights[flashCursor];
    flashCursor = (flashCursor + 1) % flashLights.length;
    fl.light.position.copy(pos);
    fl.light.color.copy(colorA);
    fl.target = 24 * scale;

    spawnSmokePlume(pos, colorA, scale);
    callbacks.onBurst?.(style, scale);

    if (style === 'chrysanthemum') {
      const count = Math.floor(118 * Math.min(1.25, scale));
      const baseSpeed = 9.2 * scale;
      for (let i = 0; i < count; i++) {
        const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
        const theta = Math.PI * (1 + Math.sqrt(5)) * i;
        const speed = baseSpeed * (0.82 + Math.random() * 0.26);
        const sinPhi = Math.sin(phi);
        spawnParticle(
          pos.x,
          pos.y,
          pos.z,
          Math.cos(theta) * sinPhi * speed,
          Math.cos(phi) * speed,
          Math.sin(theta) * sinPhi * speed,
          1.8 + Math.random() * 0.55,
          1.12 + Math.random() * 0.3,
          1.52,
          2.65,
          colorA,
          colorB,
          true,
        );
      }
      for (let i = 0; i < 36; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const spd = baseSpeed * (0.22 + Math.random() * 0.24);
        spawnParticle(
          pos.x,
          pos.y,
          pos.z,
          Math.sin(phi) * Math.cos(theta) * spd,
          Math.cos(phi) * spd,
          Math.sin(phi) * Math.sin(theta) * spd,
          0.95 + Math.random() * 0.35,
          1.18,
          2.05,
          1.8,
          _hotCore,
          colorA,
          false,
        );
      }
    } else if (style === 'willow') {
      const count = Math.floor(104 * Math.min(1.25, scale));
      const baseSpeed = 7.8 * scale;
      const goldHead = _tempColor.setHex(0xfff1c6);
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = baseSpeed * (0.55 + Math.random() * 0.55);
        spawnParticle(
          pos.x,
          pos.y,
          pos.z,
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.cos(phi) * speed + 1.4,
          Math.sin(phi) * Math.sin(theta) * speed,
          2.85 + Math.random() * 0.9,
          1.02 + Math.random() * 0.28,
          1.12,
          3.45,
          goldHead,
          colorB,
          true,
        );
      }
    } else if (style === 'doubleRing') {
      _vAxis.set((Math.random() - 0.5) * 0.65, 0.85, (Math.random() - 0.5) * 0.65).normalize();
      _vOrtho1.set(1, 0, 0).cross(_vAxis).normalize();
      if (_vOrtho1.lengthSq() < 0.01) _vOrtho1.set(0, 0, 1);
      _vOrtho2.copy(_vAxis).cross(_vOrtho1).normalize();

      const outerN = 80;
      const outerSpd = 9.5 * scale;
      for (let i = 0; i < outerN; i++) {
        const a = (i / outerN) * Math.PI * 2;
        _vDir
          .copy(_vOrtho1)
          .multiplyScalar(Math.cos(a))
          .addScaledVector(_vOrtho2, Math.sin(a))
          .multiplyScalar(outerSpd * (0.95 + Math.random() * 0.1));
        spawnParticle(
          pos.x,
          pos.y,
          pos.z,
          _vDir.x,
          _vDir.y,
          _vDir.z,
          2.0 + Math.random() * 0.45,
          1.14,
          1.58,
          2.4,
          colorA,
          colorB,
          true,
        );
      }

      const innerN = 48;
      const innerSpd = 5.5 * scale;
      for (let i = 0; i < innerN; i++) {
        const a = (i / innerN) * Math.PI * 2;
        _vDir
          .copy(_vOrtho1)
          .multiplyScalar(Math.cos(a))
          .addScaledVector(_vOrtho2, Math.sin(a))
          .multiplyScalar(innerSpd * (0.94 + Math.random() * 0.12));
        spawnParticle(
          pos.x,
          pos.y,
          pos.z,
          _vDir.x,
          _vDir.y,
          _vDir.z,
          1.6 + Math.random() * 0.4,
          1.16,
          1.7,
          2.1,
          _hotCore,
          colorA,
          false,
        );
      }
    } else {
      const count = Math.floor(126 * Math.min(1.25, scale));
      const baseSpeed = 8.5 * scale;
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = baseSpeed * (0.58 + Math.random() * 0.52);
        spawnParticle(
          pos.x,
          pos.y,
          pos.z,
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.cos(phi) * speed,
          Math.sin(phi) * Math.sin(theta) * speed,
          1.85 + Math.random() * 0.65,
          1.14 + Math.random() * 0.36,
          1.72,
          2.55,
          colorA,
          colorB,
          i % 2 === 0,
        );
      }
    }
  };

  const launchAt = (target: THREE.Vector3, style?: FireworkSoundStyle, scale = 1.05) => {
    const slot = rockets.find((r) => !r.active);
    if (!slot) return;

    const styles: FireworkSoundStyle[] = ['chrysanthemum', 'willow', 'doubleRing', 'peony'];
    const chosenStyle = style ?? styles[Math.floor(Math.random() * styles.length)];
    const pair = PALETTES[Math.floor(Math.random() * PALETTES.length)];

    const launchY = 0.8;
    const clampedTargetY = THREE.MathUtils.clamp(target.y, 12.2, 25.5);
    const flightDuration = 0.78 + Math.random() * 0.24;
    const g = 8.0;

    slot.active = true;
    slot.pos.set(target.x + (Math.random() - 0.5) * 1.2, launchY, target.z + (Math.random() - 0.5) * 1.2);
    slot.targetY = clampedTargetY;
    slot.vel.set(
      (target.x - slot.pos.x) / flightDuration,
      (clampedTargetY - launchY + 0.5 * g * flightDuration * flightDuration) / flightDuration,
      (target.z - slot.pos.z) / flightDuration,
    );
    slot.style = chosenStyle;
    slot.scale = scale;
    slot.colorA.setHex(pair[0]);
    slot.colorB.setHex(pair[1]);
    slot.trailAccum = 0;

    callbacks.onLaunch?.();
  };

  const launchRandomHero = () => {
    const side = Math.random() > 0.5 ? 1 : -1;
    const target = new THREE.Vector3(
      side * (4.5 + Math.random() * 8.5),
      15.5 + Math.random() * 6.5,
      -13 - Math.random() * 6,
    );
    launchAt(target, undefined, 1.06 + Math.random() * 0.2);
  };

  // =========================================================================
  // 5. Realistic Translucent Oiled-Paper Sky Lanterns (孔明灯)
  // =========================================================================
  const skyLanternPts = [
    new THREE.Vector2(0.14, 0.0),
    new THREE.Vector2(0.24, 0.24),
    new THREE.Vector2(0.29, 0.58),
    new THREE.Vector2(0.22, 0.78),
    new THREE.Vector2(0.0, 0.85),
  ];
  const skyLanternGeo = new THREE.LatheGeometry(skyLanternPts, 10);
  geometries.push(skyLanternGeo);

  const slCanvas = document.createElement('canvas');
  slCanvas.width = 64;
  slCanvas.height = 128;
  const slCtx = slCanvas.getContext('2d')!;
  const slGrad = slCtx.createLinearGradient(0, 0, 0, 128);
  slGrad.addColorStop(0, '#5a1a0a');
  slGrad.addColorStop(0.38, '#b84b14');
  slGrad.addColorStop(0.76, '#f2922e');
  slGrad.addColorStop(1, '#ffe49e');
  slCtx.fillStyle = slGrad;
  slCtx.fillRect(0, 0, 64, 128);
  const slTex = new THREE.CanvasTexture(slCanvas);
  slTex.colorSpace = THREE.SRGBColorSpace;

  const skyLanternMat = new THREE.MeshStandardMaterial({
    color: 0xffb366,
    map: slTex,
    emissive: new THREE.Color(0xff7824),
    emissiveMap: slTex,
    emissiveIntensity: 1.08,
    roughness: 0.9,
    metalness: 0.0,
    transparent: true,
    opacity: 0.9,
  });
  materials.push(skyLanternMat);

  const skyLanternMesh = new THREE.InstancedMesh(skyLanternGeo, skyLanternMat, SKY_LANTERN_COUNT);
  skyLanternMesh.frustumCulled = false;

  const skyLanterns: SkyLanternItem[] = [];
  for (let i = 0; i < SKY_LANTERN_COUNT; i++) {
    skyLanterns.push({
      angle: Math.random() * Math.PI * 2,
      radius: 17 + Math.random() * 28,
      y: 2.2 + Math.random() * 28,
      speed: 0.4 + Math.random() * 0.44,
      swayPhase: Math.random() * Math.PI * 2,
      scale: 0.72 + Math.random() * 0.56,
    });
  }
  group.add(skyLanternMesh);

  // =========================================================================
  // 6. Natural Soft Winter Snowfall
  // =========================================================================
  const snowPositions = new Float32Array(SNOW_COUNT * 3);
  const snowSpeeds = new Float32Array(SNOW_COUNT);
  const snowPhases = new Float32Array(SNOW_COUNT);

  for (let i = 0; i < SNOW_COUNT; i++) {
    const i3 = i * 3;
    snowPositions[i3] = (Math.random() - 0.5) * 44;
    snowPositions[i3 + 1] = Math.random() * 24;
    snowPositions[i3 + 2] = (Math.random() - 0.5) * 44;
    snowSpeeds[i] = 0.42 + Math.random() * 0.5;
    snowPhases[i] = Math.random() * Math.PI * 2;
  }

  const snowGeo = new THREE.BufferGeometry();
  const snowPosAttr = new THREE.BufferAttribute(snowPositions, 3);
  snowPosAttr.setUsage(THREE.DynamicDrawUsage);
  snowGeo.setAttribute('position', snowPosAttr);
  geometries.push(snowGeo);

  const snowMat = new THREE.PointsMaterial({
    size: 0.125,
    color: 0xe6e8f0,
    map: textures.snowflake,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  materials.push(snowMat);

  const snowPoints = new THREE.Points(snowGeo, snowMat);
  snowPoints.frustumCulled = false;
  group.add(snowPoints);

  let nextCueIdx = 0;
  let lastShowTime = 0;

  const syncTimelineSeek = (showTime: number) => {
    lastShowTime = showTime;
    nextCueIdx = CHOREO_CUES.findIndex((c) => c.time >= showTime);
    if (nextCueIdx === -1) nextCueIdx = CHOREO_CUES.length;
  };

  const update = (elapsed: number, showTime: number, dt: number, _reducedMotion: boolean): number => {
    const safeDt = Math.min(dt, 0.05);

    if (showTime < lastShowTime - 5) {
      nextCueIdx = 0;
    }
    lastShowTime = showTime;

    while (nextCueIdx < CHOREO_CUES.length && CHOREO_CUES[nextCueIdx].time <= showTime) {
      const cue = CHOREO_CUES[nextCueIdx];
      nextCueIdx++;
      launchAt(_vDir.set(cue.x, cue.y, cue.z), cue.style, cue.scale);
    }

    // 1. Ascending rockets
    for (let i = 0; i < MAX_ROCKETS; i++) {
      const r = rockets[i];
      if (!r.active) continue;

      r.vel.y -= 8.0 * safeDt;
      r.pos.addScaledVector(r.vel, safeDt);
      r.trailAccum += safeDt;

      if (r.trailAccum >= 0.014) {
        r.trailAccum = 0;
        spawnParticle(
          r.pos.x + (Math.random() - 0.5) * 0.05,
          r.pos.y,
          r.pos.z + (Math.random() - 0.5) * 0.05,
          (Math.random() - 0.5) * 0.45,
          -1.5 - Math.random() * 0.7,
          (Math.random() - 0.5) * 0.45,
          0.38 + Math.random() * 0.18,
          0.7,
          2.4,
          1.6,
          _hotCore,
          r.colorB,
          false,
        );
      }

      if (r.pos.y >= r.targetY || r.vel.y <= 0.6) {
        r.active = false;
        triggerExplosion(r);
      }
    }

    // 2. Photorealistic blackbody-cooling pyrotechnic sparks & dense ember trails
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (age[i] <= 0) continue;

      age[i] += safeDt;
      const t = age[i] / life[i];
      if (t >= 1) {
        age[i] = 0;
        alphas[i] = 0;
        shedsTrail[i] = 0;
        continue;
      }

      const damp = Math.exp(-drag[i] * safeDt);
      velX[i] *= damp;
      velY[i] = velY[i] * damp - gravity[i] * safeDt;
      velZ[i] *= damp;

      const i3 = i * 3;
      positions[i3] += velX[i] * safeDt;
      positions[i3 + 1] += velY[i] * safeDt;
      positions[i3 + 2] += velZ[i] * safeDt;

      // Early white-hot incandescent core cooling smoothly into rich colorA -> deep ember colorB
      const hotFactor = Math.max(0, 1 - t * 5.2);
      const baseR = colAR[i] + (colBR[i] - colAR[i]) * t;
      const baseG = colAG[i] + (colBG[i] - colAG[i]) * t;
      const baseB = colAB[i] + (colBB[i] - colAB[i]) * t;
      const curR = baseR + (1.0 - baseR) * hotFactor * 0.45;
      const curG = baseG + (0.96 - baseG) * hotFactor * 0.45;
      const curB = baseB + (0.86 - baseB) * hotFactor * 0.45;
      colors[i3] = curR;
      colors[i3 + 1] = curG;
      colors[i3 + 2] = curB;

      if (shedsTrail[i] === 1 && t < 0.82) {
        trailTimer[i] += safeDt;
        if (trailTimer[i] >= 0.036) {
          trailTimer[i] = 0;
          _tailColA.setRGB(curR * 0.84, curG * 0.72, curB * 0.56);
          _tailColB.setRGB(curR * 0.42, curG * 0.22, curB * 0.08);
          spawnParticle(
            positions[i3],
            positions[i3 + 1],
            positions[i3 + 2],
            velX[i] * 0.06 + (Math.random() - 0.5) * 0.18,
            velY[i] * 0.06 - 0.32,
            velZ[i] * 0.06 + (Math.random() - 0.5) * 0.18,
            0.38 + Math.random() * 0.24,
            baseSize[i] * 0.48,
            2.7,
            1.4,
            _tailColA,
            _tailColB,
            false,
          );
        }
      }

      alphas[i] = Math.pow(1 - t, 1.48);
      sizes[i] = baseSize[i] * (0.42 + 0.58 * (1 - t));
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;

    // 3. Expanding illuminated smoke plumes
    for (let i = 0; i < MAX_SMOKE; i++) {
      const sm = smokePool[i];
      if (!sm.active) continue;
      sm.age += safeDt;
      const t = sm.age / sm.life;
      if (t >= 1) {
        sm.active = false;
        sm.sprite.visible = false;
        continue;
      }
      sm.sprite.position.x += sm.velX * safeDt;
      sm.sprite.position.y += sm.velY * safeDt;
      const sc = THREE.MathUtils.lerp(sm.startScale, sm.endScale, 1 - Math.pow(1 - t, 2));
      sm.sprite.scale.setScalar(sc);
      const env = Math.sin(Math.min(1, t * 4.5) * (Math.PI / 2)) * Math.pow(1 - t, 1.4);
      sm.mat.opacity = sm.baseOpacity * env;
    }

    // 4. Smooth damped atmospheric sky glow
    let totalFlash = 0;
    for (let i = 0; i < flashLights.length; i++) {
      const fl = flashLights[i];
      fl.target *= Math.exp(-2.4 * safeDt);
      fl.current = THREE.MathUtils.damp(fl.current, fl.target, 6.5, safeDt);
      fl.light.intensity = fl.current;
      totalFlash += fl.current / 40;
    }

    // 5. Rising Sky Lanterns
    const lanternReveal = THREE.MathUtils.smoothstep(showTime, 6, 28);
    skyLanternMat.emissiveIntensity = 0.8 + lanternReveal * 0.7;

    for (let i = 0; i < SKY_LANTERN_COUNT; i++) {
      const sl = skyLanterns[i];
      sl.y += sl.speed * safeDt * (0.6 + lanternReveal * 0.62);
      if (sl.y > 31) sl.y = 1.2;

      const driftAngle = sl.angle + elapsed * 0.016 + Math.sin(elapsed * 0.34 + sl.swayPhase) * 0.022;
      const x = Math.cos(driftAngle) * sl.radius;
      const z = Math.sin(driftAngle) * sl.radius;

      const activeFactor = i < 18 ? 1 : lanternReveal;
      const sc = sl.scale * activeFactor * (sl.y < 3.5 ? sl.y / 3.5 : 1) * (sl.y > 27 ? (31 - sl.y) / 4 : 1);

      _dummy.position.set(x, sl.y, z);
      _dummy.rotation.set(
        Math.sin(elapsed * 0.65 + sl.swayPhase) * 0.04,
        driftAngle,
        Math.cos(elapsed * 0.55 + sl.swayPhase) * 0.04,
      );
      _dummy.scale.setScalar(Math.max(0.001, sc));
      _dummy.updateMatrix();
      skyLanternMesh.setMatrixAt(i, _dummy.matrix);
    }
    skyLanternMesh.instanceMatrix.needsUpdate = true;

    // 6. Gentle winter snowfall
    for (let i = 0; i < SNOW_COUNT; i++) {
      const i3 = i * 3;
      snowPositions[i3 + 1] -= snowSpeeds[i] * safeDt;
      snowPositions[i3] += Math.sin(elapsed * 0.45 + snowPhases[i]) * 0.22 * safeDt;
      snowPositions[i3 + 2] += Math.cos(elapsed * 0.38 + snowPhases[i]) * 0.18 * safeDt;
      if (snowPositions[i3 + 1] < 0.2) {
        snowPositions[i3 + 1] = 24;
      }
    }
    snowPosAttr.needsUpdate = true;

    return Math.min(0.55, totalFlash);
  };

  const dispose = () => {
    slTex.dispose();
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
  };

  return {
    group,
    launchAt,
    launchRandomHero,
    syncTimelineSeek,
    update,
    dispose,
  };
}

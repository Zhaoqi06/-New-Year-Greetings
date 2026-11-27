import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { FireworkSoundStyle } from '../audio/festiveAudio';
import {
  getActForTime,
  SHOW_DURATION,
  type ActId,
  type CameraMode,
  type EngineTelemetry,
} from '../types/festival';
import { createFireworksSystem, type FireworksSystem } from './fireworks';
import { createProceduralTextures, type ProceduralTextureSet } from './textures';
import { createWishTree, type WishTreeSystem } from './wishTree';

export interface SceneControllerCallbacks {
  onTelemetry: (telemetry: EngineTelemetry) => void;
  onActChange: (act: ActId) => void;
  onFireworkLaunch: () => void;
  onFireworkBurst: (style: FireworkSoundStyle, intensity: number) => void;
}

interface CameraPose {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
}

interface MistCard {
  sprite: THREE.Sprite;
  baseAngle: number;
  radius: number;
  baseY: number;
  driftSpeed: number;
}

const _desiredCamPos = new THREE.Vector3();
const _desiredLookAt = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();
const _pointerNdc = new THREE.Vector2();
const _skyPlane = new THREE.Plane();
const _camForward = new THREE.Vector3();
const _planePoint = new THREE.Vector3();
const _hitPoint = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

/**
 * Builds a custom nocturnal Chinese night-market PMREM environment scene (deep moonlit indigo sky above,
 * warm amber/crimson lantern glow rings at the horizon) so metals, lacquered timber, and wet flagstones
 * reflect authentic night colors instead of a bright white daytime studio box!
 */
function createNocturnalEnvironmentScene(): THREE.Scene {
  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x070a14);

  // Subtle cool moonlit zenith glow
  const moonPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 18),
    new THREE.MeshBasicMaterial({ color: 0x364a78, side: THREE.DoubleSide }),
  );
  moonPanel.position.set(-10, 18, -10);
  moonPanel.lookAt(0, 0, 0);
  envScene.add(moonPanel);

  // Warm amber & crimson lantern bounce light cards encircling the horizon
  const warmAmber = new THREE.MeshBasicMaterial({ color: 0xd67c32, side: THREE.DoubleSide });
  const warmRed = new THREE.MeshBasicMaterial({ color: 0xaa2818, side: THREE.DoubleSide });
  const cardGeo = new THREE.PlaneGeometry(10, 4.5);

  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const card = new THREE.Mesh(cardGeo, i % 2 === 0 ? warmAmber : warmRed);
    card.position.set(Math.cos(a) * 16, 2.5, Math.sin(a) * 16);
    card.lookAt(0, 2.5, 0);
    envScene.add(card);
  }

  return envScene;
}

/**
 * Creates an authentic concave curved Chinese hip-and-gable roof (歇山飞檐翘角)
 * with upturned sweeping corner eaves and clean UVs for glazed barrel roof tile textures.
 */
function createCurvedChineseRoofGeometry(
  width: number,
  depth: number,
  height: number,
  ridgeRatio = 0.56,
): THREE.BufferGeometry {
  const segX = 16;
  const segZ = 10;
  const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const halfW = width * 0.5;
  const halfD = depth * 0.5;
  const halfRidge = halfW * ridgeRatio;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const nx = Math.abs(x) / halfW; // 0..1
    const nz = Math.abs(z) / halfD; // 0..1

    // Hip-and-gable distance from top central ridge line
    const dxFromRidge = Math.max(0, Math.abs(x) - halfRidge) / Math.max(0.001, halfW - halfRidge);
    const slopeDist = Math.max(nz, dxFromRidge);

    // Classic Chinese concave swooping roof curve (steep near ridge, graceful flare at eaves)
    const concaveH = Math.pow(Math.max(0, 1 - slopeDist), 1.68) * height;

    // Authentic upturned flying corner eaves (飞檐翘角)
    const cornerFlare = Math.pow(nx * nz, 2.2) * (height * 0.44);
    const eaveLift = Math.pow(slopeDist, 4.0) * (height * 0.08);

    // Subtle flare outward at outer corner tips
    const flareOut = 1 + Math.pow(nx * nz, 2.4) * 0.08;
    pos.setXYZ(i, x * flareOut, concaveH + cornerFlare + eaveLift, z * flareOut);
  }

  geo.computeVertexNormals();
  return geo;
}

function createDistantMountainRidge(
  radius: number,
  maxPeakHeight: number,
  seedOffset: number,
  radialSegs = 128,
): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(radius, radius + 14, 22, radialSegs, 5, true);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const angle = Math.atan2(z, x);

    const hNorm = (y + 11) / 22;
    const ridge =
      Math.sin(angle * 3.0 + seedOffset) * (maxPeakHeight * 0.34) +
      Math.sin(angle * 7.0 - seedOffset * 1.6) * (maxPeakHeight * 0.2) +
      Math.cos(angle * 13.0 + seedOffset * 2.1) * (maxPeakHeight * 0.1) +
      Math.sin(angle * 23.0 + seedOffset) * (maxPeakHeight * 0.045);

    const newY = hNorm <= 0.04 ? -2.0 : -2.0 + hNorm * Math.max(4.0, maxPeakHeight + ridge);
    pos.setXYZ(i, x, newY, z);
  }

  geo.computeVertexNormals();
  return geo;
}

function sampleCinematicPose(
  showTime: number,
  elapsed: number,
  outPos: THREE.Vector3,
  outLook: THREE.Vector3,
): number {
  const t = ((showTime % SHOW_DURATION) + SHOW_DURATION) % SHOW_DURATION;

  if (t < 14) {
    // Act I: Hero low-angle dolly showcasing the grand lush pine Christmas tree lighting from gift-box base to golden star
    const u = t / 14;
    const smooth = u * u * (3 - 2 * u);
    const angle = THREE.MathUtils.lerp(-0.34, 0.54, smooth);
    const radius = THREE.MathUtils.lerp(11.6, 14.6, smooth);
    const height = THREE.MathUtils.lerp(2.4, 5.6, smooth);
    outPos.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
    outLook.set(0, THREE.MathUtils.lerp(3.2, 5.8, smooth), 0);
    return THREE.MathUtils.lerp(44, 47, smooth);
  }

  if (t < 28) {
    // Act II: Sweeping crane orbit showcasing the full blazing golden-crimson Christmas tree, curved-eave archways & 万家灯火 town
    const u = (t - 14) / 14;
    const smooth = u * u * (3 - 2 * u);
    const angle = 0.54 + smooth * (Math.PI * 1.48);
    const radius = THREE.MathUtils.lerp(14.6, 17.2, Math.sin(u * Math.PI * 0.75)) + Math.sin(u * Math.PI) * 0.8;
    const height = 5.6 + Math.sin(u * Math.PI) * 3.1;
    outPos.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
    outLook.set(0, THREE.MathUtils.lerp(5.8, 6.4, Math.sin(u * Math.PI)), 0);
    return THREE.MathUtils.lerp(47, 49, smooth);
  }

  if (t < 48) {
    // Act III: Grand low-angle cinema vista framing the Christmas Tree, archways, hillside 万家灯火 & firework canopy
    const u = (t - 28) / 20;
    const pull = Math.min(1, u * 2.4);
    const easePull = 1 - Math.pow(1 - pull, 3);
    const startAngle = 0.54 + Math.PI * 1.48;
    const endAngle = Math.PI * 2 + 0.14;
    const angle = THREE.MathUtils.lerp(startAngle, endAngle, u) + Math.sin(u * Math.PI * 2) * 0.07;
    const radius = THREE.MathUtils.lerp(17.2, 24.4, easePull);
    const height = THREE.MathUtils.lerp(5.6, 4.6, easePull) + Math.sin(u * Math.PI) * 1.1;
    outPos.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
    outLook.set(0, THREE.MathUtils.lerp(6.2, 8.8, easePull), -1.5);
    return THREE.MathUtils.lerp(49, 53, easePull);
  }

  // Act IV: Serene golden-ratio composition framing the complete tree, star topper & custom New Year greeting
  const u = (t - 48) / 12;
  const settle = 1 - Math.pow(1 - Math.min(1, u * 1.8), 3);
  const breath = Math.sin(elapsed * 0.42);
  const angle = 0.14 + breath * 0.065;
  const radius = THREE.MathUtils.lerp(24.4, 20.6, settle) + Math.cos(elapsed * 0.34) * 0.32;
  const height = THREE.MathUtils.lerp(4.6, 5.5, settle) + breath * 0.15;
  outPos.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
  outLook.set(0, THREE.MathUtils.lerp(8.8, 6.3, settle), 0);
  return THREE.MathUtils.lerp(53, 47, settle);
}

export class FestiveSceneController {
  private container: HTMLElement;
  private callbacks: SceneControllerCallbacks;
  private isSoftwareGl: boolean;
  private reducedMotion: boolean;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private envMapTexture: THREE.Texture | null = null;
  private reflector: Reflector | null = null;

  private textures: ProceduralTextureSet;
  private wishTree: WishTreeSystem;
  private fireworks: FireworksSystem;
  private envGeometries: THREE.BufferGeometry[] = [];
  private envMaterials: THREE.Material[] = [];
  private mistCards: MistCard[] = [];

  private frameId = 0;
  private disposed = false;
  private lastPerfTime = 0;
  private elapsedTime = 0;
  private showTime = 0;
  private isPlaying = true;
  private cameraMode: CameraMode = 'cinematic';
  private activeAct: ActId = 1;
  private contextLost = false;
  private lastTelemetryPush = 0;

  private pointerDownX = 0;
  private pointerDownY = 0;
  private pointerDownTime = 0;

  private handleResizeBound: () => void;
  private handlePointerDownBound: (e: PointerEvent) => void;
  private handlePointerUpBound: (e: PointerEvent) => void;
  private handleContextLostBound: (e: Event) => void;
  private handleContextRestoredBound: () => void;

  constructor(container: HTMLElement, callbacks: SceneControllerCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const width = Math.max(1, container.clientWidth || window.innerWidth);
    const height = Math.max(1, container.clientHeight || window.innerHeight);

    // 1. Renderer setup with cinema ACES filmic tone mapping
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.cursor = 'grab';
    container.appendChild(this.renderer.domElement);

    // 2. Natural Winter Night Atmosphere + Custom Nocturnal Night-Market IBL
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070912);
    this.scene.fog = new THREE.FogExp2(0x100d15, 0.0118);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const nightEnv = createNocturnalEnvironmentScene();
    this.envMapTexture = pmremGenerator.fromScene(nightEnv, 0.05).texture;
    this.scene.environment = this.envMapTexture;
    this.scene.environmentIntensity = 0.72;
    nightEnv.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    pmremGenerator.dispose();

    // 3. Camera & OrbitControls
    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.25, 220);
    const initialPose: CameraPose = {
      pos: new THREE.Vector3(),
      look: new THREE.Vector3(),
      fov: 42,
    };
    initialPose.fov = sampleCinematicPose(0, 0, initialPose.pos, initialPose.look);
    this.camera.position.copy(initialPose.pos);
    this.camera.fov = initialPose.fov;
    this.camera.updateProjectionMatrix();

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.055;
    this.controls.enablePan = false;
    this.controls.minDistance = 6.5;
    this.controls.maxDistance = 35;
    this.controls.minPolarAngle = 0.22;
    this.controls.maxPolarAngle = Math.PI * 0.485;
    this.controls.target.copy(initialPose.look);
    this.controls.update();

    this.controls.addEventListener('start', () => {
      if (this.cameraMode !== 'free') {
        this.cameraMode = 'free';
        this.pushTelemetry(true);
      }
      this.renderer.domElement.style.cursor = 'grabbing';
    });
    this.controls.addEventListener('end', () => {
      this.renderer.domElement.style.cursor = 'grab';
    });

    // 4. Procedural PBR Textures, Cinema Lighting, Wet Courtyard & 万家灯火 Townscape
    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());
    this.setupLighting();
    this.setupPhotorealisticCourtyardAndTown();

    this.wishTree = createWishTree(this.textures);
    this.scene.add(this.wishTree.group);

    this.fireworks = createFireworksSystem(this.textures, {
      onLaunch: () => this.callbacks.onFireworkLaunch(),
      onBurst: (style, intensity) => this.callbacks.onFireworkBurst(style, intensity),
    });
    this.scene.add(this.fireworks.group);

    // 5. Cinema HDR Lens Halation Bloom (only true emissive light sources bloom)
    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.36,
        0.68,
        0.92,
      );
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
      this.renderer.compile(this.scene, this.camera);
    }

    // 6. Bind DOM Events
    this.handleResizeBound = this.handleResize.bind(this);
    this.handlePointerDownBound = this.handlePointerDown.bind(this);
    this.handlePointerUpBound = this.handlePointerUp.bind(this);
    this.handleContextLostBound = this.handleContextLost.bind(this);
    this.handleContextRestoredBound = this.handleContextRestored.bind(this);

    window.addEventListener('resize', this.handleResizeBound);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDownBound);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUpBound);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLostBound, false);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestoredBound, false);

    this.lastPerfTime = performance.now();
    this.pushTelemetry(true);
    this.scheduleNextFrame();
  }

  private setupLighting(): void {
    // Realistic warm-vs-cool cinema night lighting: cool moonlight sky + warm amber lantern earth bounce
    const hemi = new THREE.HemisphereLight(0x526a9c, 0x2a1812, 0.44);
    this.scene.add(hemi);

    // Crisp silver-blue winter moonlight grazing snow-dusted pine boughs, tile roofs & wet stone
    const moonKey = new THREE.DirectionalLight(0x9ab8f0, 0.82);
    moonKey.position.set(-15, 22, -12);
    moonKey.castShadow = !this.isSoftwareGl;
    moonKey.shadow.mapSize.width = 1024;
    moonKey.shadow.mapSize.height = 1024;
    moonKey.shadow.camera.near = 2;
    moonKey.shadow.camera.far = 56;
    const d = 16;
    moonKey.shadow.camera.left = -d;
    moonKey.shadow.camera.right = d;
    moonKey.shadow.camera.top = d;
    moonKey.shadow.camera.bottom = -d;
    moonKey.shadow.bias = -0.0005;
    moonKey.shadow.normalBias = 0.025;
    this.scene.add(moonKey);

    // Warm festival tungsten courtyard key from front-right illuminating carved stone & vermilion timber
    const festivalWarm = new THREE.DirectionalLight(0xffb86c, 0.68);
    festivalWarm.position.set(14, 15, 16);
    this.scene.add(festivalWarm);

    // Subtle warm low-angle rim bounce from surrounding lantern streets
    const streetBounce = new THREE.DirectionalLight(0xff7e3a, 0.34);
    streetBounce.position.set(0, 7, 18);
    this.scene.add(streetBounce);
  }

  private setupPhotorealisticCourtyardAndTown(): void {
    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      this.envGeometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      this.envMaterials.push(m);
      return m;
    };

    // 1. Natural Photographed Winter Night Sky Dome
    const skyGeo = trackGeo(new THREE.SphereGeometry(135, 32, 20));
    const skyMat = trackMat(
      new THREE.MeshBasicMaterial({
        map: this.textures.skyDome,
        side: THREE.BackSide,
        fog: false,
      }),
    );
    this.scene.add(new THREE.Mesh(skyGeo, skyMat));

    // 2. Real-Time Wet Bluestone Planar Reflections (雨雪微湿青石板真实倒影)
    if (!this.isSoftwareGl) {
      const reflGeo = trackGeo(new THREE.CircleGeometry(21.5, 64));
      this.reflector = new Reflector(reflGeo, {
        clipBias: 0.004,
        textureWidth: 512,
        textureHeight: 512,
        color: 0x524a44, // dark damp basalt tint so reflections feel naturally attenuated
      });
      this.reflector.rotation.x = -Math.PI / 2;
      this.reflector.position.y = 0.0;
      this.scene.add(this.reflector);
    }

    // Inner damp weathered bluestone courtyard with organic rain-puddle alpha mask revealing subtle reflections
    const innerPlazaGeo = trackGeo(new THREE.CircleGeometry(22.5, 72));
    const innerPlazaMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: this.textures.courtyardAlbedo,
        roughnessMap: this.textures.courtyardRoughness,
        bumpMap: this.textures.courtyardBump,
        bumpScale: 0.045,
        alphaMap: this.isSoftwareGl ? null : this.textures.courtyardPuddleAlpha,
        transparent: !this.isSoftwareGl,
        roughness: 0.86,
        metalness: 0.08,
        envMapIntensity: 0.72,
      }),
    );
    const innerPlaza = new THREE.Mesh(innerPlazaGeo, innerPlazaMat);
    innerPlaza.rotation.x = -Math.PI / 2;
    innerPlaza.position.y = 0.015;
    innerPlaza.receiveShadow = true;
    this.scene.add(innerPlaza);

    // Outer solid ground surround extending seamlessly under the hillside town
    const outerGroundGeo = trackGeo(new THREE.RingGeometry(21.8, 78, 72, 2));
    const outerGroundMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x101116,
        roughness: 0.94,
        metalness: 0.02,
      }),
    );
    const outerGround = new THREE.Mesh(outerGroundGeo, outerGroundMat);
    outerGround.rotation.x = -Math.PI / 2;
    outerGround.position.y = 0.008;
    this.scene.add(outerGround);

    // =========================================================================
    // 3. Four Authentic Curved-Eave Chinese Timber Archways (真实歇山飞檐木构牌楼)
    // =========================================================================
    const agedVermilionMat = trackMat(
      new THREE.MeshPhysicalMaterial({
        color: 0x6f1114,
        roughness: 0.36,
        metalness: 0.04,
        clearcoat: 0.45,
        clearcoatRoughness: 0.28,
        envMapIntensity: 0.7,
      }),
    );
    const glazedTileRoofMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x8e95a6,
        map: this.textures.roofTileAlbedo,
        bumpMap: this.textures.roofTileBump,
        bumpScale: 0.065,
        roughness: 0.56,
        metalness: 0.16,
        envMapIntensity: 0.85,
      }),
    );
    const darkTimberMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x281812,
        roughness: 0.82,
        metalness: 0.04,
        envMapIntensity: 0.35,
      }),
    );
    const antiqueBronzeMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xc99c4e,
        roughness: 0.34,
        metalness: 0.85,
        envMapIntensity: 1.15,
      }),
    );
    const carvedStoneBaseMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xa49e94,
        map: this.textures.stoneCarvedAlbedo,
        bumpMap: this.textures.stoneCarvedBump,
        bumpScale: 0.03,
        roughness: 0.78,
        metalness: 0.03,
      }),
    );
    // Warm architectural uplight glow tucked realistically beneath the dark timber eaves
    const eaveWashMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xd98a3c,
      }),
    );
    const bannerMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: this.textures.archBanner,
        emissive: new THREE.Color(0xffa444),
        emissiveMap: this.textures.archBanner,
        emissiveIntensity: 0.16,
        roughness: 0.38,
        metalness: 0.18,
      }),
    );
    const coupletLeftMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: this.textures.coupletLeft,
        emissive: new THREE.Color(0xff9234),
        emissiveMap: this.textures.coupletLeft,
        emissiveIntensity: 0.14,
        roughness: 0.48,
      }),
    );
    const coupletRightMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: this.textures.coupletRight,
        emissive: new THREE.Color(0xff9234),
        emissiveMap: this.textures.coupletRight,
        emissiveIntensity: 0.14,
        roughness: 0.48,
      }),
    );
    const archLanternMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xc41e20,
        map: this.textures.lanternSilk,
        emissive: new THREE.Color(0xff5a1e),
        emissiveMap: this.textures.lanternEmissive,
        emissiveIntensity: 1.25,
        roughness: 0.62,
      }),
    );

    const archPillarGeo = trackGeo(new THREE.CylinderGeometry(0.21, 0.24, 4.95, 16));
    const archDrumBaseGeo = trackGeo(new THREE.CylinderGeometry(0.32, 0.44, 0.56, 8));
    const archBeamGeo = trackGeo(new THREE.BoxGeometry(5.5, 0.36, 0.42));
    const archDouGongGeo = trackGeo(new THREE.BoxGeometry(6.1, 0.26, 0.72));
    const archRoofMainGeo = trackGeo(createCurvedChineseRoofGeometry(7.6, 2.35, 1.38, 0.58));
    const archRidgeBeamGeo = trackGeo(new THREE.BoxGeometry(4.4, 0.18, 0.18));
    const archRidgeFinialGeo = trackGeo(new THREE.ConeGeometry(0.14, 0.36, 6));
    const archBannerGeo = trackGeo(new THREE.BoxGeometry(2.55, 0.78, 0.1));
    const coupletGeo = trackGeo(new THREE.PlaneGeometry(0.38, 2.28));

    const archLanternLathe = trackGeo(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.0, -0.34),
          new THREE.Vector2(0.16, -0.31),
          new THREE.Vector2(0.31, -0.15),
          new THREE.Vector2(0.36, 0.0),
          new THREE.Vector2(0.31, 0.15),
          new THREE.Vector2(0.16, 0.31),
          new THREE.Vector2(0.0, 0.34),
        ],
        20,
      ),
    );
    const archLanternCapGeo = trackGeo(new THREE.CylinderGeometry(0.17, 0.19, 0.08, 8));
    const archLanternTasselGeo = trackGeo(new THREE.ConeGeometry(0.055, 0.36, 8));

    const archRadius = 12.8;
    const archCorners: THREE.Vector3[] = [];

    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const archGroup = new THREE.Group();
      archGroup.position.set(Math.sin(a) * archRadius, 0, Math.cos(a) * archRadius);
      archGroup.rotation.y = a + Math.PI;

      for (const side of [-1, 1]) {
        const px = side * 2.32;
        const base = new THREE.Mesh(archDrumBaseGeo, carvedStoneBaseMat);
        base.position.set(px, 0.28, 0);
        base.receiveShadow = true;
        base.castShadow = true;
        archGroup.add(base);

        const col = new THREE.Mesh(archPillarGeo, agedVermilionMat);
        col.position.set(px, 2.78, 0);
        col.castShadow = true;
        archGroup.add(col);

        // Carved timber lintel brackets flanking each column
        const bracket = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.65, 0.22, 0.56)), darkTimberMat);
        bracket.position.set(px, 4.78, 0);
        archGroup.add(bracket);

        // Vertical Spring Couplets mounted cleanly on front & back of columns
        const cMat = side === -1 ? coupletLeftMat : coupletRightMat;
        const coupletFront = new THREE.Mesh(coupletGeo, cMat);
        coupletFront.position.set(px, 2.52, 0.245);
        archGroup.add(coupletFront);

        const coupletBack = new THREE.Mesh(coupletGeo, cMat);
        coupletBack.position.set(px, 2.52, -0.245);
        coupletBack.rotation.y = Math.PI;
        archGroup.add(coupletBack);

        // Detailed silk lanterns hanging under outer sweeping eaves
        const lx = side * 3.05;
        const lanternCord = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 6)), darkTimberMat);
        lanternCord.position.set(lx, 4.92, 0);
        archGroup.add(lanternCord);

        const topCap = new THREE.Mesh(archLanternCapGeo, darkTimberMat);
        topCap.position.set(lx, 4.62, 0);
        archGroup.add(topCap);

        const lantern = new THREE.Mesh(archLanternLathe, archLanternMat);
        lantern.position.set(lx, 4.28, 0);
        archGroup.add(lantern);

        const botCap = new THREE.Mesh(archLanternCapGeo, darkTimberMat);
        botCap.position.set(lx, 3.94, 0);
        archGroup.add(botCap);

        const tassel = new THREE.Mesh(archLanternTasselGeo, agedVermilionMat);
        tassel.position.set(lx, 3.72, 0);
        archGroup.add(tassel);
      }

      // Crossbeams & traditional layered timber Dougong cornice
      const beamLow = new THREE.Mesh(archBeamGeo, agedVermilionMat);
      beamLow.position.y = 4.32;
      archGroup.add(beamLow);

      const dougong = new THREE.Mesh(archDouGongGeo, darkTimberMat);
      dougong.position.y = 4.96;
      archGroup.add(dougong);

      // Subtle concealed warm architectural wash strip under eave rafters
      const washStrip = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(5.9, 0.05, 0.78)), eaveWashMat);
      washStrip.position.y = 5.1;
      archGroup.add(washStrip);

      // Sweeping concave tiled roof with flying corner eaves + central ridge beam
      const mainRoof = new THREE.Mesh(archRoofMainGeo, glazedTileRoofMat);
      mainRoof.position.y = 5.14;
      mainRoof.castShadow = true;
      mainRoof.receiveShadow = true;
      archGroup.add(mainRoof);

      const ridge = new THREE.Mesh(archRidgeBeamGeo, darkTimberMat);
      ridge.position.y = 6.54;
      archGroup.add(ridge);

      for (const side of [-1, 1]) {
        const finial = new THREE.Mesh(archRidgeFinialGeo, antiqueBronzeMat);
        finial.position.set(side * 2.15, 6.72, 0);
        archGroup.add(finial);
      }

      // Carved Gold-Leaf Calligraphy Plaque ("恭贺新禧") on both sides
      const banner = new THREE.Mesh(archBannerGeo, bannerMat);
      banner.position.set(0, 4.58, 0.24);
      archGroup.add(banner);

      const bannerBack = new THREE.Mesh(archBannerGeo, bannerMat);
      bannerBack.position.set(0, 4.58, -0.24);
      bannerBack.rotation.y = Math.PI;
      archGroup.add(bannerBack);

      // Dedicated subtle warm architectural light illuminating each archway's front face & wet ground
      const archWarmLight = new THREE.PointLight(0xff8e3c, 5.2, 11, 2);
      archWarmLight.position.set(0, 4.1, 1.35);
      archGroup.add(archWarmLight);

      this.scene.add(archGroup);

      const leftAnchor = new THREE.Vector3(-2.75, 4.88, 0)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), a + Math.PI)
        .add(archGroup.position);
      const rightAnchor = new THREE.Vector3(2.75, 4.88, 0)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), a + Math.PI)
        .add(archGroup.position);
      archCorners.push(leftAnchor, rightAnchor);
    }

    // =========================================================================
    // 4. Detailed Silk Lantern Garlands Draped Between Archways (张灯结彩)
    // =========================================================================
    const stringLanternGeo = trackGeo(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.0, -0.21),
          new THREE.Vector2(0.1, -0.19),
          new THREE.Vector2(0.21, -0.09),
          new THREE.Vector2(0.24, 0.0),
          new THREE.Vector2(0.21, 0.09),
          new THREE.Vector2(0.1, 0.19),
          new THREE.Vector2(0.0, 0.21),
        ],
        14,
      ),
    );
    const stringCapGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.12, 0.05, 8));
    const stringTasselGeo = trackGeo(new THREE.ConeGeometry(0.035, 0.22, 6));
    const cableMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x1e1612, roughness: 0.9 }));

    const garlandPositions: THREE.Vector3[] = [];
    for (let i = 0; i < 4; i++) {
      const pStart = archCorners[i * 2];
      const pEnd = archCorners[((i + 1) % 4) * 2 + 1];
      const mid = new THREE.Vector3().addVectors(pStart, pEnd).multiplyScalar(0.5);
      const midDir = new THREE.Vector3(mid.x, 0, mid.z).normalize();
      mid.x = midDir.x * (archRadius + 0.68);
      mid.z = midDir.z * (archRadius + 0.68);
      mid.y = 3.6;

      const curve = new THREE.QuadraticBezierCurve3(pStart, mid, pEnd);
      const cableGeo = trackGeo(new THREE.TubeGeometry(curve, 28, 0.014, 6, false));
      this.scene.add(new THREE.Mesh(cableGeo, cableMat));

      const countOnSpan = 9;
      for (let k = 1; k <= countOnSpan; k++) {
        const pt = curve.getPoint(k / (countOnSpan + 1));
        pt.y -= 0.22;
        garlandPositions.push(pt);
      }
    }

    const stringLanterns = new THREE.InstancedMesh(stringLanternGeo, archLanternMat, garlandPositions.length);
    const stringTopCaps = new THREE.InstancedMesh(stringCapGeo, darkTimberMat, garlandPositions.length * 2);
    const stringTassels = new THREE.InstancedMesh(stringTasselGeo, agedVermilionMat, garlandPositions.length);
    const slDummy = new THREE.Object3D();

    for (let i = 0; i < garlandPositions.length; i++) {
      const p = garlandPositions[i];
      slDummy.position.copy(p);
      slDummy.rotation.set(0, i * 0.7, 0);
      slDummy.scale.setScalar(1);
      slDummy.updateMatrix();
      stringLanterns.setMatrixAt(i, slDummy.matrix);

      slDummy.position.set(p.x, p.y + 0.21, p.z);
      slDummy.updateMatrix();
      stringTopCaps.setMatrixAt(i * 2, slDummy.matrix);

      slDummy.position.set(p.x, p.y - 0.21, p.z);
      slDummy.updateMatrix();
      stringTopCaps.setMatrixAt(i * 2 + 1, slDummy.matrix);

      slDummy.position.set(p.x, p.y - 0.34, p.z);
      slDummy.updateMatrix();
      stringTassels.setMatrixAt(i, slDummy.matrix);
    }
    stringLanterns.instanceMatrix.needsUpdate = true;
    stringTopCaps.instanceMatrix.needsUpdate = true;
    stringTassels.instanceMatrix.needsUpdate = true;
    this.scene.add(stringLanterns, stringTopCaps, stringTassels);

    // =========================================================================
    // 5. Layered Misty Mountain Silhouettes & Terraced Valley Hillside
    // =========================================================================
    const nearMountainMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0f1019,
        roughness: 0.96,
        metalness: 0.0,
        side: THREE.BackSide,
        envMapIntensity: 0.1,
      }),
    );
    const farMountainMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x171420,
        roughness: 0.98,
        metalness: 0.0,
        side: THREE.BackSide,
        envMapIntensity: 0.08,
      }),
    );
    this.scene.add(new THREE.Mesh(trackGeo(createDistantMountainRidge(70, 10.5, 0.4, 128)), nearMountainMat));
    this.scene.add(new THREE.Mesh(trackGeo(createDistantMountainRidge(96, 17.5, 2.2, 128)), farMountainMat));

    const hillsideGeo = trackGeo(new THREE.RingGeometry(22.5, 74, 96, 12));
    hillsideGeo.rotateX(-Math.PI / 2);
    const hsPos = hillsideGeo.attributes.position;
    const hillsideHeightAt = (x: number, z: number): number => {
      const dist = Math.hypot(x, z);
      const a = Math.atan2(z, x);
      const t = THREE.MathUtils.clamp((dist - 22.5) / 49, 0, 1);
      const slopeY =
        Math.pow(t, 1.38) * 8.6 +
        (Math.sin(a * 3.0 + 0.4) * 1.35 + Math.cos(a * 7.0) * 0.55) * t;
      return Math.max(-0.02, slopeY - 0.2);
    };
    for (let i = 0; i < hsPos.count; i++) {
      const x = hsPos.getX(i);
      const z = hsPos.getZ(i);
      hsPos.setY(i, hillsideHeightAt(x, z) + 0.06);
    }
    hillsideGeo.computeVertexNormals();
    const hillsideMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0e0f16,
        roughness: 0.95,
        metalness: 0.02,
        envMapIntensity: 0.1,
      }),
    );
    this.scene.add(new THREE.Mesh(hillsideGeo, hillsideMat));

    // =========================================================================
    // 6. Photorealistic 360° Curved-Roof Ancient Mountain Town (真实层叠古城万家灯火)
    // =========================================================================
    const houseConfigs: Array<{
      x: number;
      y: number;
      z: number;
      rotY: number;
      w: number;
      h: number;
      d: number;
      hasDoubleRoof: boolean;
      warmth: THREE.Color;
    }> = [];

    // Ring A: Near-courtyard historic timber-framed manses & pavilions (r = 24..34)
    const nearCount = 38;
    for (let i = 0; i < nearCount; i++) {
      const a = (i / nearCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.11;
      const dist = 24.5 + Math.random() * 9.5;
      const hx = Math.cos(a) * dist;
      const hz = Math.sin(a) * dist;
      const w = 3.5 + Math.random() * 2.4;
      const h = 2.5 + Math.random() * 1.8;
      const d = 2.7 + Math.random() * 1.4;
      houseConfigs.push({
        x: hx,
        y: hillsideHeightAt(hx, hz),
        z: hz,
        rotY: Math.atan2(-Math.cos(a), -Math.sin(a)) + (Math.random() - 0.5) * 0.28,
        w,
        h,
        d,
        hasDoubleRoof: i % 3 === 0,
        warmth: new THREE.Color().setHSL(0.082 + (Math.random() - 0.5) * 0.025, 0.82, 0.6 + Math.random() * 0.12),
      });
    }

    // Ring B: Hillside tiered clusters ascending naturally up the mountain slope (r = 35..56)
    const hillCount = 96;
    for (let i = 0; i < hillCount; i++) {
      const clusterAngle = (Math.floor(i / 4) / (hillCount / 4)) * Math.PI * 2;
      const a = clusterAngle + (Math.random() - 0.5) * 0.24;
      const dist = 35 + Math.random() * 20;
      const hx = Math.cos(a) * dist;
      const hz = Math.sin(a) * dist;
      const w = 2.9 + Math.random() * 2.4;
      const h = 2.2 + Math.random() * 2.3;
      const d = 2.4 + Math.random() * 1.4;
      houseConfigs.push({
        x: hx,
        y: hillsideHeightAt(hx, hz),
        z: hz,
        rotY: Math.atan2(-Math.cos(a), -Math.sin(a)) + (Math.random() - 0.5) * 0.42,
        w,
        h,
        d,
        hasDoubleRoof: i % 5 === 0,
        warmth: new THREE.Color().setHSL(0.08 + (Math.random() - 0.5) * 0.03, 0.86, 0.56 + Math.random() * 0.16),
      });
    }

    const wallGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
    const wallMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xc2b8ac,
        map: this.textures.townFacadeAlbedo,
        emissive: new THREE.Color(0xffb458),
        emissiveMap: this.textures.townFacadeEmissive,
        emissiveIntensity: 0.96,
        roughness: 0.88,
        metalness: 0.04,
        envMapIntensity: 0.25,
      }),
    );

    // Authentic curved concave Chinese tiled roofs for every single ancient building!
    const townRoofGeo = trackGeo(createCurvedChineseRoofGeometry(1.34, 1.34, 0.58, 0.54));
    const townRoofMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x7a8090,
        map: this.textures.roofTileAlbedo,
        bumpMap: this.textures.roofTileBump,
        bumpScale: 0.045,
        roughness: 0.64,
        metalness: 0.14,
        envMapIntensity: 0.55,
      }),
    );

    // Subtle recessed warm amber architectural wash right beneath the curved eaves (realistic brightness!)
    const townEaveWashGeo = trackGeo(new THREE.BoxGeometry(1.06, 0.06, 1.06));
    const townEaveWashMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xc97b32,
      }),
    );

    const doorLanternGeo = trackGeo(new THREE.SphereGeometry(0.14, 8, 6));
    const doorLanternMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xe84222,
      }),
    );

    const totalHouses = houseConfigs.length;
    const doubleRoofCount = houseConfigs.filter((c) => c.hasDoubleRoof).length;
    const houseWallMesh = new THREE.InstancedMesh(wallGeo, wallMat, totalHouses);
    const houseRoofMesh = new THREE.InstancedMesh(townRoofGeo, townRoofMat, totalHouses + doubleRoofCount);
    const houseWashMesh = new THREE.InstancedMesh(townEaveWashGeo, townEaveWashMat, totalHouses);
    const doorLanternMesh = new THREE.InstancedMesh(doorLanternGeo, doorLanternMat, totalHouses * 2);

    const hDummy = new THREE.Object3D();
    let roofIdx = 0;
    let lanternIdx = 0;

    for (let i = 0; i < totalHouses; i++) {
      const hc = houseConfigs[i];
      hDummy.position.set(hc.x, hc.y + hc.h * 0.5, hc.z);
      hDummy.rotation.set(0, hc.rotY, 0);
      hDummy.scale.set(hc.w, hc.h, hc.d);
      hDummy.updateMatrix();
      houseWallMesh.setMatrixAt(i, hDummy.matrix);
      houseWallMesh.setColorAt(i, hc.warmth);

      // Subtle architectural warm wash under eaves
      hDummy.position.set(hc.x, hc.y + hc.h - 0.04, hc.z);
      hDummy.rotation.set(0, hc.rotY, 0);
      hDummy.scale.set(hc.w, 1, hc.d);
      hDummy.updateMatrix();
      houseWashMesh.setMatrixAt(i, hDummy.matrix);

      // Curved concave tiled main roof
      const roofScaleY = Math.max(0.85, hc.h * 0.42);
      hDummy.position.set(hc.x, hc.y + hc.h - 0.02, hc.z);
      hDummy.rotation.set(0, hc.rotY, 0);
      hDummy.scale.set(hc.w, roofScaleY, hc.d);
      hDummy.updateMatrix();
      houseRoofMesh.setMatrixAt(roofIdx++, hDummy.matrix);

      if (hc.hasDoubleRoof) {
        hDummy.position.set(hc.x, hc.y + hc.h + roofScaleY * 0.46, hc.z);
        hDummy.rotation.set(0, hc.rotY, 0);
        hDummy.scale.set(hc.w * 0.68, roofScaleY * 0.72, hc.d * 0.68);
        hDummy.updateMatrix();
        houseRoofMesh.setMatrixAt(roofIdx++, hDummy.matrix);
      }

      const cosR = Math.cos(hc.rotY);
      const sinR = Math.sin(hc.rotY);
      for (const side of [-1, 1]) {
        const lx = side * hc.w * 0.42;
        const lz = hc.d * 0.56;
        const wx = hc.x + lx * cosR + lz * sinR;
        const wz = hc.z - lx * sinR + lz * cosR;
        hDummy.position.set(wx, hc.y + hc.h * 0.76, wz);
        hDummy.rotation.set(0, 0, 0);
        hDummy.scale.set(1, 1.15, 1);
        hDummy.updateMatrix();
        doorLanternMesh.setMatrixAt(lanternIdx++, hDummy.matrix);
      }
    }

    houseWallMesh.instanceMatrix.needsUpdate = true;
    if (houseWallMesh.instanceColor) houseWallMesh.instanceColor.needsUpdate = true;
    houseWallMesh.computeBoundingSphere();

    houseRoofMesh.instanceMatrix.needsUpdate = true;
    houseRoofMesh.computeBoundingSphere();

    houseWashMesh.instanceMatrix.needsUpdate = true;
    houseWashMesh.computeBoundingSphere();

    doorLanternMesh.instanceMatrix.needsUpdate = true;
    doorLanternMesh.computeBoundingSphere();

    this.scene.add(houseWallMesh, houseRoofMesh, houseWashMesh, doorLanternMesh);

    // 7. Soft Drifting Valley Night Mist Cards (山谷暮霭雾气 — 增强电影空气透视与真实感)
    const mistCount = 22;
    for (let i = 0; i < mistCount; i++) {
      const a = (i / mistCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.16;
      const radius = 21 + Math.random() * 20;
      const baseY = 2.4 + Math.random() * 4.2;
      const mat = trackMat(
        new THREE.SpriteMaterial({
          map: this.textures.smokePuff,
          color: i % 3 === 0 ? 0x3b2c2d : 0x262838,
          transparent: true,
          opacity: 0.11 + Math.random() * 0.06,
          depthWrite: false,
        }),
      );
      const sp = new THREE.Sprite(mat);
      const wScale = 18 + Math.random() * 14;
      sp.scale.set(wScale, wScale * 0.42, 1);
      sp.position.set(Math.cos(a) * radius, baseY, Math.sin(a) * radius);
      this.scene.add(sp);
      this.mistCards.push({
        sprite: sp,
        baseAngle: a,
        radius,
        baseY,
        driftSpeed: (0.005 + Math.random() * 0.006) * (i % 2 === 0 ? 1 : -1),
      });
    }

    // 8. 1,100 Distant Hillside Household Lights (远山万家灯火绵延星海)
    const townLightCount = 1100;
    const tlPositions = new Float32Array(townLightCount * 3);
    const tlColors = new Float32Array(townLightCount * 3);
    const tlCol = new THREE.Color();

    for (let i = 0; i < townLightCount; i++) {
      const hamlet = i % 20;
      const baseAngle = (hamlet / 20) * Math.PI * 2;
      const spread = (Math.random() - 0.5) * 0.34;
      const a = baseAngle + spread;
      const dist = 33 + Math.pow(Math.random(), 0.78) * 35;

      const lx = Math.cos(a) * dist;
      const lz = Math.sin(a) * dist;
      const y = hillsideHeightAt(lx, lz) + 0.65 + Math.random() * 2.2;

      const i3 = i * 3;
      tlPositions[i3] = lx;
      tlPositions[i3 + 1] = y;
      tlPositions[i3 + 2] = lz;

      const roll = Math.random();
      if (roll < 0.55) {
        tlCol.setHSL(0.085 + (Math.random() - 0.5) * 0.02, 0.85, 0.58 + Math.random() * 0.12);
      } else if (roll < 0.82) {
        tlCol.setHSL(0.11 + (Math.random() - 0.5) * 0.02, 0.78, 0.68 + Math.random() * 0.1);
      } else {
        tlCol.setHSL(0.025 + Math.random() * 0.02, 0.86, 0.52 + Math.random() * 0.1);
      }
      tlColors[i3] = tlCol.r;
      tlColors[i3 + 1] = tlCol.g;
      tlColors[i3 + 2] = tlCol.b;
    }

    const tlGeo = trackGeo(new THREE.BufferGeometry());
    tlGeo.setAttribute('position', new THREE.BufferAttribute(tlPositions, 3));
    tlGeo.setAttribute('color', new THREE.BufferAttribute(tlColors, 3));
    const tlMat = trackMat(
      new THREE.PointsMaterial({
        size: 0.88,
        map: this.textures.sparkGlow,
        vertexColors: true,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scene.add(new THREE.Points(tlGeo, tlMat));
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync === 'function') {
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (this.disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    } else {
      this.frameId = window.setTimeout(cb, 80);
    }
  }

  private scheduleNextFrame(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = window.requestAnimationFrame(this.tick);
    }
  }

  private tick = (): void => {
    if (this.disposed || this.contextLost) return;

    const now = performance.now();
    const rawDt = (now - this.lastPerfTime) / 1000;
    this.lastPerfTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.1);

    this.elapsedTime += dt;
    if (this.isPlaying) {
      this.showTime = (this.showTime + dt) % SHOW_DURATION;
    }

    const nextAct = getActForTime(this.showTime).id;
    if (nextAct !== this.activeAct) {
      this.activeAct = nextAct;
      this.callbacks.onActChange(nextAct);
      this.pushTelemetry(true);
    }

    const flashBoost = this.fireworks.update(this.elapsedTime, this.showTime, dt, this.reducedMotion);
    this.wishTree.update(this.elapsedTime, this.showTime, dt, flashBoost);

    // Subtle atmospheric valley mist drift
    for (let i = 0; i < this.mistCards.length; i++) {
      const m = this.mistCards[i];
      const a = m.baseAngle + this.elapsedTime * m.driftSpeed;
      m.sprite.position.set(
        Math.cos(a) * m.radius,
        m.baseY + Math.sin(this.elapsedTime * 0.25 + i) * 0.28,
        Math.sin(a) * m.radius,
      );
    }

    if (this.cameraMode === 'cinematic') {
      const desiredFov = sampleCinematicPose(this.showTime, this.elapsedTime, _desiredCamPos, _desiredLookAt);
      const lambda = 2.6;
      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _desiredCamPos.x, lambda, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _desiredCamPos.y, lambda, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _desiredCamPos.z, lambda, dt);

      this.controls.target.x = THREE.MathUtils.damp(this.controls.target.x, _desiredLookAt.x, lambda, dt);
      this.controls.target.y = THREE.MathUtils.damp(this.controls.target.y, _desiredLookAt.y, lambda, dt);
      this.controls.target.z = THREE.MathUtils.damp(this.controls.target.z, _desiredLookAt.z, lambda, dt);

      if (Math.abs(this.camera.fov - desiredFov) > 0.02) {
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, desiredFov, lambda, dt);
        this.camera.updateProjectionMatrix();
      }
      this.camera.lookAt(this.controls.target);
    } else {
      this.controls.update();
    }

    if (this.composer && !this.isSoftwareGl) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (now - this.lastTelemetryPush >= 100) {
      this.pushTelemetry(false);
    }

    this.scheduleNextFrame();
  };

  private pushTelemetry(force: boolean): void {
    const now = performance.now();
    if (!force && now - this.lastTelemetryPush < 90) return;
    this.lastTelemetryPush = now;
    this.callbacks.onTelemetry({
      currentTime: this.showTime,
      activeAct: this.activeAct,
      isPlaying: this.isPlaying,
      cameraMode: this.cameraMode,
      contextLost: this.contextLost,
    });
  }

  private handlePointerDown(event: PointerEvent): void {
    this.pointerDownX = event.clientX;
    this.pointerDownY = event.clientY;
    this.pointerDownTime = performance.now();
  }

  private handlePointerUp(event: PointerEvent): void {
    const dx = event.clientX - this.pointerDownX;
    const dy = event.clientY - this.pointerDownY;
    const elapsed = performance.now() - this.pointerDownTime;

    if (Math.hypot(dx, dy) > 7 || elapsed > 360) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    _pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    _raycaster.setFromCamera(_pointerNdc, this.camera);
    this.camera.getWorldDirection(_camForward);

    _planePoint.copy(_camForward).multiplyScalar(28).add(this.camera.position);
    _skyPlane.setFromNormalAndCoplanarPoint(_camForward.clone().negate(), _planePoint);

    if (_raycaster.ray.intersectPlane(_skyPlane, _hitPoint)) {
      _hitPoint.x = THREE.MathUtils.clamp(_hitPoint.x, -18, 18);
      _hitPoint.y = THREE.MathUtils.clamp(_hitPoint.y, 12.2, 24.5);
      _hitPoint.z = THREE.MathUtils.clamp(_hitPoint.z, -22, 16);
      this.fireworks.launchAt(_hitPoint, undefined, 1.14);
    } else {
      this.fireworks.launchRandomHero();
    }
  }

  private handleResize(): void {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth || window.innerWidth);
    const height = Math.max(1, this.container.clientHeight || window.innerHeight);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }
  }

  private handleContextLost(event: Event): void {
    event.preventDefault();
    this.contextLost = true;
    this.pushTelemetry(true);
  }

  private handleContextRestored(): void {
    this.contextLost = false;
    this.lastPerfTime = performance.now();
    this.pushTelemetry(true);
    this.scheduleNextFrame();
  }

  public setPlaying(playing: boolean): void {
    this.isPlaying = playing;
    this.pushTelemetry(true);
  }

  public togglePlay(): void {
    this.setPlaying(!this.isPlaying);
  }

  public seek(seconds: number): void {
    this.showTime = Math.max(0, Math.min(SHOW_DURATION - 0.05, seconds));
    this.fireworks.syncTimelineSeek(this.showTime);
    const act = getActForTime(this.showTime).id;
    if (act !== this.activeAct) {
      this.activeAct = act;
      this.callbacks.onActChange(act);
    }
    this.pushTelemetry(true);
  }

  public replay(): void {
    this.cameraMode = 'cinematic';
    this.isPlaying = true;
    this.seek(0);
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    if (mode === 'free') {
      this.controls.update();
    }
    this.pushTelemetry(true);
  }

  public launchCelebrationSalvo(): void {
    this.fireworks.launchRandomHero();
    window.setTimeout(() => {
      if (!this.disposed) this.fireworks.launchRandomHero();
    }, 240);
  }

  public dispose(): void {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResizeBound);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDownBound);
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointerUpBound);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLostBound);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestoredBound);

    this.controls.dispose();
    this.wishTree.dispose();
    this.fireworks.dispose();
    this.textures.dispose();
    this.envMapTexture?.dispose();
    this.reflector?.dispose();
    this.composer?.dispose();

    for (const g of this.envGeometries) g.dispose();
    for (const m of this.envMaterials) m.dispose();

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

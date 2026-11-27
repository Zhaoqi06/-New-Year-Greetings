import * as THREE from 'three';
import type { ProceduralTextureSet } from './textures';

export interface WishTreeSystem {
  group: THREE.Group;
  update: (elapsed: number, showTime: number, dt: number, flashBoost: number) => void;
  dispose: () => void;
}

interface LanternRecord {
  pivot: THREE.Group;
  silkMat: THREE.MeshStandardMaterial;
  coreMat: THREE.MeshBasicMaterial;
  tierNorm: number;
  phase: number;
}

interface WishRibbonRecord {
  pos: THREE.Vector3;
  angle: number;
  phase: number;
  scaleY: number;
}

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

/**
 * Builds a rich, 3D multi-layered feathery evergreen pine bough spray (立体松柏枝叶簇).
 * 100% solid opaque geometry (ZERO alphaTest shimmer!) with 7 overlapping tapered needle plumes
 * fanning outward and drooping naturally, with vertex colors transitioning from deep interior pine
 * to lush emerald and delicate moonlit snow-frosted needle tips.
 */
function createFeatheryPineSprayGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const cInner = new THREE.Color(0x06140d);
  const cMid = new THREE.Color(0x113222);
  const cOuter = new THREE.Color(0x1d4a32);
  const cSnowTip = new THREE.Color(0x9fb2bc); // subtle frosty winter snow dusting on very tips
  const tmpCol = new THREE.Color();

  // Helper: add a tapered, curved 3D 4-sided diamond-section pine frond plume
  const addPlume = (
    yaw: number,
    pitch: number,
    length: number,
    width: number,
    thickness: number,
    droop: number,
    frostWeight: number,
  ) => {
    const segs = 5;
    const baseVertex = positions.length / 3;
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    // Build ring vertices along plume spine (4 points around cross-section: top, right, bottom, left)
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      // Fullest width around t=0.28, tapering sharply to a real pine needle tip at t=1
      const profileW = Math.sin(Math.pow(t, 0.72) * Math.PI) * width * (1 - t * 0.18);
      const profileH = Math.sin(Math.pow(t, 0.75) * Math.PI) * thickness;

      const localZ = t * length;
      const localY = Math.sin(pitch) * localZ - Math.pow(t, 1.85) * droop;

      // Cross-section offsets: top, right, bottom, left
      const ringOffsets: Array<[number, number]> = [
        [0, profileH],
        [profileW, -profileH * 0.15],
        [0, -profileH * 0.75],
        [-profileW, -profileH * 0.15],
      ];

      for (let r = 0; r < 4; r++) {
        const [ox, oy] = ringOffsets[r];
        // Rotate by yaw around Y axis
        const wx = ox * cosY + localZ * sinY;
        const wz = -ox * sinY + localZ * cosY;
        const wy = localY + oy;
        positions.push(wx, wy, wz);

        // Approximate outward normal (recomputed smoothly later)
        normals.push(0, 1, 0);

        // Vertex color gradient: deep shadow inside -> rich evergreen -> frosted tips on top surface
        if (t < 0.45) {
          tmpCol.copy(cInner).lerp(cMid, t / 0.45);
        } else {
          tmpCol.copy(cMid).lerp(cOuter, (t - 0.45) / 0.55);
        }
        if (r === 0 && t > 0.58) {
          // Subtle frost/snow only on upper ridge near outer tips
          const f = ((t - 0.58) / 0.42) * frostWeight;
          tmpCol.lerp(cSnowTip, f);
        } else if (r === 2) {
          // Darker underside for rich volumetric depth
          tmpCol.multiplyScalar(0.55);
        }
        colors.push(tmpCol.r, tmpCol.g, tmpCol.b);
      }
    }

    // Stitch quad strips between consecutive rings
    for (let s = 0; s < segs; s++) {
      const r0 = baseVertex + s * 4;
      const r1 = baseVertex + (s + 1) * 4;
      for (let k = 0; k < 4; k++) {
        const kNext = (k + 1) % 4;
        const a = r0 + k;
        const b = r0 + kNext;
        const c = r1 + k;
        const d = r1 + kNext;
        indices.push(a, c, b, b, c, d);
      }
    }
  };

  // Central hero needle frond + 6 fanning feathery side & upper sub-fronds = lush natural spruce bough!
  addPlume(0.0, 0.08, 1.32, 0.24, 0.14, 0.28, 0.34);
  addPlume(0.36, 0.04, 1.12, 0.2, 0.12, 0.24, 0.28);
  addPlume(-0.36, 0.04, 1.12, 0.2, 0.12, 0.24, 0.28);
  addPlume(0.72, -0.02, 0.86, 0.18, 0.11, 0.2, 0.22);
  addPlume(-0.72, -0.02, 0.86, 0.18, 0.11, 0.2, 0.22);
  addPlume(0.18, 0.24, 0.96, 0.18, 0.12, 0.16, 0.38);
  addPlume(-0.18, 0.24, 0.96, 0.18, 0.12, 0.16, 0.38);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds an iconic 3D beveled 8-pointed Imperial Golden Starburst Topper (盛世鎏金八芒星冠).
 */
function createBeveledStarburstGeometry(
  outerR: number,
  midR: number,
  innerR: number,
  depth: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const points = 16; // 8 alternating long/medium star rays + 8 inner valleys

  // Front apex (0) and back apex (1)
  positions.push(0, 0, depth);
  positions.push(0, 0, -depth);

  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2 + Math.PI / 2;
    let r = innerR;
    if (i % 4 === 0) r = outerR;
    else if (i % 4 === 2) r = midR;
    positions.push(Math.cos(a) * r, Math.sin(a) * r, 0);
  }

  for (let i = 0; i < points; i++) {
    const curr = 2 + i;
    const next = 2 + ((i + 1) % points);
    // Front face
    indices.push(0, curr, next);
    // Back face
    indices.push(1, next, curr);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function createPagodaRoofCapGeometry(radius: number, height: number, sides = 6): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(radius, height, sides, 5, true);
  const pos = geo.attributes.position;
  const halfH = height * 0.5;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp((halfH - y) / height, 0, 1);
    const flare = 1 + Math.pow(t, 2.2) * 0.32;
    const curl = Math.pow(t, 3.0) * (height * 0.3);
    pos.setXYZ(i, x * flare, y + curl, z * flare);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createWishTree(textures: ProceduralTextureSet): WishTreeSystem {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // --- Luxury Real-World Holiday & Imperial New Year PBR Materials ---
  const carvedStoneMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb8b1a4,
      map: textures.stoneCarvedAlbedo,
      bumpMap: textures.stoneCarvedBump,
      bumpScale: 0.03,
      roughness: 0.76,
      metalness: 0.03,
      envMapIntensity: 0.48,
    }),
  );

  const darkGraniteMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x353840,
      map: textures.stoneCarvedAlbedo,
      bumpMap: textures.stoneCarvedBump,
      bumpScale: 0.025,
      roughness: 0.62,
      metalness: 0.08,
      envMapIntensity: 0.62,
    }),
  );

  const lacquerRedMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x9c1118,
      roughness: 0.16,
      metalness: 0.08,
      clearcoat: 0.95,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.15,
    }),
  );

  const velvetCrimsonMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x8d0f16,
      roughness: 0.82,
      metalness: 0.04,
      envMapIntensity: 0.38,
    }),
  );

  const champagneGoldMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xe6bc6a,
      roughness: 0.18,
      metalness: 0.94,
      clearcoat: 0.4,
      envMapIntensity: 1.45,
    }),
  );

  const antiqueBronzeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x423020,
      roughness: 0.4,
      metalness: 0.84,
      envMapIntensity: 1.0,
    }),
  );

  const barkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x462e22,
      map: textures.barkAlbedo,
      bumpMap: textures.barkBump,
      bumpScale: 0.075,
      roughness: 0.92,
      metalness: 0.02,
      envMapIntensity: 0.2,
    }),
  );

  // Rich spruce pine needle material using vertex colors for deep interior shadows + frosted outer tips
  const pineNeedleMat = trackMat(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.84,
      metalness: 0.04,
      envMapIntensity: 0.34,
    }),
  );

  const fuPlaqueMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.fuPlaque,
      emissive: new THREE.Color(0xff9234),
      emissiveMap: textures.fuPlaque,
      emissiveIntensity: 0.2,
      roughness: 0.38,
      metalness: 0.15,
    }),
  );

  // =========================================================================
  // 1. Carved Hanbaiyu Terrace, Balustrade, Stone Lamps & Luxury New Year Gift Boxes
  // =========================================================================
  const pedestalGroup = new THREE.Group();
  group.add(pedestalGroup);

  const shadowMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: textures.contactShadow,
      transparent: true,
      depthWrite: false,
      opacity: 0.84,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  );
  const contactShadow = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(13.4, 13.4)), shadowMat);
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.028;
  pedestalGroup.add(contactShadow);

  const step1 = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(4.2, 4.52, 0.26, 8)), darkGraniteMat);
  step1.position.y = 0.13;
  step1.receiveShadow = true;
  step1.castShadow = true;
  pedestalGroup.add(step1);

  const step2 = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(3.62, 3.78, 0.44, 8)), carvedStoneMat);
  step2.position.y = 0.48;
  step2.receiveShadow = true;
  step2.castShadow = true;
  pedestalGroup.add(step2);

  const wainscot = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(3.32, 3.38, 0.38, 8)), lacquerRedMat);
  wainscot.position.y = 0.89;
  wainscot.receiveShadow = true;
  pedestalGroup.add(wainscot);

  const coping = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(3.42, 3.32, 0.14, 8)), carvedStoneMat);
  coping.position.y = 1.15;
  coping.receiveShadow = true;
  pedestalGroup.add(coping);

  // 4 Cardinal Carved "福" Plaques on Terrace
  const fuGeo = trackGeo(new THREE.BoxGeometry(0.56, 0.56, 0.04));
  const fuFrameGeo = trackGeo(new THREE.BoxGeometry(0.64, 0.64, 0.03));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const holder = new THREE.Group();
    holder.position.set(Math.sin(a) * 3.3, 0.89, Math.cos(a) * 3.3);
    holder.rotation.y = a;

    const frame = new THREE.Mesh(fuFrameGeo, champagneGoldMat);
    frame.rotation.z = Math.PI / 4;
    holder.add(frame);

    const plaque = new THREE.Mesh(fuGeo, fuPlaqueMat);
    plaque.rotation.z = Math.PI / 4;
    plaque.position.z = 0.022;
    holder.add(plaque);
    pedestalGroup.add(holder);
  }

  // Connected Hanbaiyu Balustrade
  const balRadius = 3.68;
  const postGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.72, 0.18));
  const postCapGeo = trackGeo(new THREE.SphereGeometry(0.11, 12, 10));
  const postPositions: THREE.Vector3[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = Math.cos(a) * balRadius;
    const pz = Math.sin(a) * balRadius;
    postPositions.push(new THREE.Vector3(px, 0.7, pz));

    const post = new THREE.Mesh(postGeo, carvedStoneMat);
    post.position.set(px, 1.04, pz);
    post.rotation.y = -a;
    post.castShadow = true;
    pedestalGroup.add(post);

    const cap = new THREE.Mesh(postCapGeo, carvedStoneMat);
    cap.scale.set(1, 1.22, 1);
    cap.position.set(px, 1.46, pz);
    pedestalGroup.add(cap);
  }
  for (let i = 0; i < 8; i++) {
    const pA = postPositions[i];
    const pB = postPositions[(i + 1) % 8];
    const segLen = pA.distanceTo(pB) - 0.14;
    const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
    const rotY = Math.atan2(pB.x - pA.x, pB.z - pA.z);

    const topRail = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.08, segLen)), carvedStoneMat);
    topRail.position.set(mid.x, 1.28, mid.z);
    topRail.rotation.y = rotY;
    pedestalGroup.add(topRail);

    const panel = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.065, 0.4, segLen - 0.08)), carvedStoneMat);
    panel.position.set(mid.x, 0.98, mid.z);
    panel.rotation.y = rotY;
    pedestalGroup.add(panel);
  }

  // Luxury Red & Gold Silk-Wrapped New Year Gift Boxes clustered warmly around the tree skirt!
  const giftBoxSpecs = [
    { a: 0.25, r: 2.35, w: 0.68, h: 0.56, d: 0.62, red: true },
    { a: 0.65, r: 2.55, w: 0.52, h: 0.42, d: 0.52, red: false },
    { a: 1.35, r: 2.42, w: 0.74, h: 0.52, d: 0.58, red: true },
    { a: 1.9, r: 2.58, w: 0.48, h: 0.64, d: 0.48, red: false },
    { a: 2.55, r: 2.38, w: 0.66, h: 0.48, d: 0.66, red: true },
    { a: 3.18, r: 2.52, w: 0.54, h: 0.44, d: 0.54, red: false },
    { a: 3.85, r: 2.42, w: 0.72, h: 0.58, d: 0.6, red: true },
    { a: 4.5, r: 2.55, w: 0.5, h: 0.42, d: 0.5, red: false },
    { a: 5.15, r: 2.4, w: 0.68, h: 0.54, d: 0.58, red: true },
    { a: 5.75, r: 2.56, w: 0.56, h: 0.46, d: 0.56, red: false },
  ];
  for (const gb of giftBoxSpecs) {
    const gGroup = new THREE.Group();
    gGroup.position.set(Math.cos(gb.a) * gb.r, 1.22 + gb.h * 0.5, Math.sin(gb.a) * gb.r);
    gGroup.rotation.y = -gb.a + 0.35;

    const boxMat = gb.red ? velvetCrimsonMat : champagneGoldMat;
    const ribMat = gb.red ? champagneGoldMat : lacquerRedMat;
    const box = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(gb.w, gb.h, gb.d)), boxMat);
    box.castShadow = true;
    box.receiveShadow = true;
    gGroup.add(box);

    const band1 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(gb.w + 0.02, gb.h + 0.02, 0.085)), ribMat);
    const band2 = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.085, gb.h + 0.02, gb.d + 0.02)), ribMat);
    gGroup.add(band1, band2);
    pedestalGroup.add(gGroup);
  }

  // 4 Stone Courtyard Lantern Pillars around the terrace corners
  const stoneLampGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffd68e,
      emissive: new THREE.Color(0xff9634),
      emissiveIntensity: 1.35,
      roughness: 0.38,
    }),
  );
  const stoneLampRoofGeo = trackGeo(createPagodaRoofCapGeometry(0.46, 0.24, 6));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const lg = new THREE.Group();
    lg.position.set(Math.cos(a) * 5.05, 0, Math.sin(a) * 5.05);

    const base = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.28, 0.36, 0.28, 6)), darkGraniteMat);
    base.position.y = 0.14;
    base.castShadow = true;
    lg.add(base);

    const shaft = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.11, 0.14, 1.35, 6)), carvedStoneMat);
    shaft.position.y = 0.94;
    shaft.castShadow = true;
    lg.add(shaft);

    const chamber = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.22, 0.2, 0.38, 6)), stoneLampGlassMat);
    chamber.position.y = 1.76;
    lg.add(chamber);

    const roof = new THREE.Mesh(stoneLampRoofGeo, darkGraniteMat);
    roof.position.y = 2.04;
    roof.castShadow = true;
    lg.add(roof);

    pedestalGroup.add(lg);
  }

  // =========================================================================
  // 2. Central Furrowed Trunk + Deep Dark Interior Evergreen Core
  // =========================================================================
  const trunk = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.1, 0.42, 8.8, 14)), barkMat);
  trunk.position.y = 5.5;
  trunk.castShadow = true;
  group.add(trunk);

  // Subtle dark spruce inner silhouette core so there are never awkward see-through gaps between fronds
  const innerCoreMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x05120b,
      roughness: 0.96,
      metalness: 0.0,
    }),
  );
  const innerCore = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(2.55, 8.2, 24)), innerCoreMat);
  innerCore.position.y = 5.75;
  group.add(innerCore);

  // =========================================================================
  // 3. 460 Layered 3D Feathery Pine-Needle Bough Sprays (经典茂密雪松圣诞树冠!)
  // =========================================================================
  const pineSprayGeo = trackGeo(createFeatheryPineSprayGeometry());

  // 14 tightly shingled botanical whorls forming an iconic, grand, full-bodied Christmas tree silhouette
  const whorls = [
    { y: 1.85, count: 44, baseR: 1.75, reachScale: 1.72, pitch: -0.18 },
    { y: 2.38, count: 42, baseR: 1.62, reachScale: 1.62, pitch: -0.16 },
    { y: 2.94, count: 40, baseR: 1.48, reachScale: 1.52, pitch: -0.15 },
    { y: 3.52, count: 38, baseR: 1.34, reachScale: 1.42, pitch: -0.13 },
    { y: 4.1, count: 36, baseR: 1.2, reachScale: 1.32, pitch: -0.12 },
    { y: 4.68, count: 34, baseR: 1.06, reachScale: 1.22, pitch: -0.1 },
    { y: 5.26, count: 32, baseR: 0.92, reachScale: 1.12, pitch: -0.09 },
    { y: 5.84, count: 30, baseR: 0.78, reachScale: 1.02, pitch: -0.07 },
    { y: 6.42, count: 28, baseR: 0.64, reachScale: 0.92, pitch: -0.05 },
    { y: 7.0, count: 26, baseR: 0.5, reachScale: 0.82, pitch: -0.03 },
    { y: 7.58, count: 24, baseR: 0.38, reachScale: 0.72, pitch: 0.0 },
    { y: 8.14, count: 22, baseR: 0.26, reachScale: 0.6, pitch: 0.04 },
    { y: 8.68, count: 18, baseR: 0.16, reachScale: 0.48, pitch: 0.1 },
    { y: 9.22, count: 14, baseR: 0.08, reachScale: 0.36, pitch: 0.18 },
  ];

  // Add upper spire tips
  const totalSprays = whorls.reduce((acc, w) => acc + w.count, 0) + 12;
  const sprayMesh = new THREE.InstancedMesh(pineSprayGeo, pineNeedleMat, totalSprays);
  sprayMesh.castShadow = true;
  sprayMesh.receiveShadow = true;

  let sprayIdx = 0;
  whorls.forEach((wh, wIdx) => {
    for (let i = 0; i < wh.count; i++) {
      const hash = ((i * 73 + wIdx * 31) % 100) / 100;
      const a = (i / wh.count) * Math.PI * 2 + wIdx * 0.37 + (hash - 0.5) * 0.14;
      const rOffset = wh.baseR * (0.85 + hash * 0.25);
      const yOffset = wh.y + (hash - 0.5) * 0.22;

      _dummy.position.set(Math.cos(a) * rOffset, yOffset, Math.sin(a) * rOffset);
      // Point plume (+Z) directly outward radially from tree spine
      _dummy.rotation.set(0, Math.atan2(Math.cos(a), Math.sin(a)), 0);
      _dummy.rotateX(-wh.pitch + (hash - 0.5) * 0.14);
      _dummy.rotateZ((hash - 0.5) * 0.2);

      const sVar = 0.88 + hash * 0.26;
      _dummy.scale.set(
        wh.reachScale * sVar * 0.92,
        wh.reachScale * sVar * 0.88,
        wh.reachScale * sVar * 1.05,
      );
      _dummy.updateMatrix();
      sprayMesh.setMatrixAt(sprayIdx, _dummy.matrix);

      // Subtle organic emerald variation across branches
      const tint = 0.86 + hash * 0.28;
      _color.setRGB(tint * 0.95, tint * 1.04, tint * 0.96);
      sprayMesh.setColorAt(sprayIdx, _color);
      sprayIdx++;
    }
  });

  // Final crown tuft wrapping the top spire cleanly beneath the Star Topper
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    _dummy.position.set(Math.cos(a) * 0.06, 9.55 + (i % 3) * 0.12, Math.sin(a) * 0.06);
    _dummy.rotation.set(0, Math.atan2(Math.cos(a), Math.sin(a)), 0);
    _dummy.rotateX(-0.55);
    _dummy.scale.set(0.28, 0.28, 0.34);
    _dummy.updateMatrix();
    sprayMesh.setMatrixAt(sprayIdx, _dummy.matrix);
    sprayMesh.setColorAt(sprayIdx, _color.setRGB(0.95, 1.04, 0.98));
    sprayIdx++;
  }

  sprayMesh.instanceMatrix.needsUpdate = true;
  if (sprayMesh.instanceColor) sprayMesh.instanceColor.needsUpdate = true;
  sprayMesh.computeBoundingSphere();
  group.add(sprayMesh);

  // Helper returning exact outer pine silhouette radius at height y (y in 1.75..9.8)
  const treeOuterRadiusAt = (y: number): number => {
    const t = THREE.MathUtils.clamp((y - 1.75) / 8.05, 0, 1);
    return THREE.MathUtils.lerp(3.75, 0.18, Math.pow(t, 0.94));
  };

  // =========================================================================
  // 4. Sweeping Lush Golden Pearl & Crimson Velvet Garlands (华美红金缠绕花环)
  // =========================================================================
  const garlandBeadPositions: THREE.Vector3[] = [];
  for (let gIdx = 0; gIdx < 2; gIdx++) {
    const pts: THREE.Vector3[] = [];
    const totalPts = 140;
    const turns = 4.6;
    for (let i = 0; i <= totalPts; i++) {
      const t = i / totalPts;
      const y = 1.85 + t * 7.6;
      // Add graceful festoon scallops dipping between branches!
      const scallop = Math.abs(Math.sin(t * turns * Math.PI * 3)) * 0.18 * (1 - t * 0.5);
      const r = treeOuterRadiusAt(y) * 0.99 + 0.05;
      const a = t * Math.PI * 2 * turns + gIdx * Math.PI;
      const pt = new THREE.Vector3(Math.cos(a) * r, y - scallop, Math.sin(a) * r);
      pts.push(pt);
      if (gIdx === 0 && i % 2 === 0) {
        garlandBeadPositions.push(pt.clone());
      }
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tubeGeo = trackGeo(new THREE.TubeGeometry(curve, 180, gIdx === 0 ? 0.032 : 0.052, 8, false));
    group.add(new THREE.Mesh(tubeGeo, gIdx === 0 ? champagneGoldMat : velvetCrimsonMat));
  }

  // Shimmering champagne-gold pearl beads along the golden garland
  const beadGeo = trackGeo(new THREE.SphereGeometry(0.058, 10, 8));
  const beadMesh = new THREE.InstancedMesh(beadGeo, champagneGoldMat, garlandBeadPositions.length);
  for (let i = 0; i < garlandBeadPositions.length; i++) {
    _dummy.position.copy(garlandBeadPositions[i]);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.setScalar(1);
    _dummy.updateMatrix();
    beadMesh.setMatrixAt(i, _dummy.matrix);
  }
  beadMesh.instanceMatrix.needsUpdate = true;
  group.add(beadMesh);

  // =========================================================================
  // 5. 1,680 Soft Warm Golden Incandescent Bokeh Tree Lights (万点暖金星灯 — 零闪烁!)
  // =========================================================================
  const lightCount = 1680;
  const lightPositions = new Float32Array(lightCount * 3);
  const lightColors = new Float32Array(lightCount * 3);
  const lightSizes = new Float32Array(lightCount);
  const lightTiers = new Float32Array(lightCount);
  const lightPhases = new Float32Array(lightCount);

  const warmGoldA = new THREE.Color(0xffe096);
  const warmGoldB = new THREE.Color(0xffb852);
  const warmAmber = new THREE.Color(0xff963a);
  const warmIvory = new THREE.Color(0xfff1cc);

  const goldenAngle = 2.39996323;
  for (let i = 0; i < lightCount; i++) {
    // 70% wrapped gracefully in warm spiral strands; 30% tucked deep inside branches for rich inner glow!
    const isSpiral = i < lightCount * 0.72;
    let t: number;
    let y: number;
    let r: number;
    let a: number;

    if (isSpiral) {
      const strand = i % 6;
      const frac = Math.floor(i / 6) / Math.floor((lightCount * 0.72) / 6);
      t = Math.pow(frac, 0.82); // slightly denser on wider lower tiers
      y = 1.75 + t * 7.85;
      const baseR = treeOuterRadiusAt(y);
      const droop = Math.sin(frac * 42 + strand) * 0.11 * (1 - t * 0.45);
      y += droop;
      r = baseR * (0.86 + ((i * 19) % 10) * 0.017);
      a = frac * Math.PI * 2 * 5.2 + (strand / 6) * Math.PI * 2;
    } else {
      t = Math.pow(Math.random(), 0.78);
      y = 1.85 + t * 7.75;
      const baseR = treeOuterRadiusAt(y);
      r = baseR * (0.62 + Math.random() * 0.36);
      a = i * goldenAngle;
    }

    const i3 = i * 3;
    lightPositions[i3] = Math.cos(a) * r;
    lightPositions[i3 + 1] = y;
    lightPositions[i3 + 2] = Math.sin(a) * r;

    const paletteRoll = i % 10;
    const chosen =
      paletteRoll < 4
        ? warmGoldA
        : paletteRoll < 7
          ? warmGoldB
          : paletteRoll < 9
            ? warmIvory
            : warmAmber;
    lightColors[i3] = chosen.r;
    lightColors[i3 + 1] = chosen.g;
    lightColors[i3 + 2] = chosen.b;

    lightSizes[i] = (isSpiral ? 0.56 : 0.68) * (0.82 + ((i * 23) % 10) * 0.045);
    lightTiers[i] = t;
    lightPhases[i] = (i * 0.37) % (Math.PI * 2);
  }

  const lightGeo = trackGeo(new THREE.BufferGeometry());
  lightGeo.setAttribute('position', new THREE.BufferAttribute(lightPositions, 3));
  lightGeo.setAttribute('color', new THREE.BufferAttribute(lightColors, 3));
  lightGeo.setAttribute('aSize', new THREE.BufferAttribute(lightSizes, 1));
  lightGeo.setAttribute('aTier', new THREE.BufferAttribute(lightTiers, 1));
  lightGeo.setAttribute('aPhase', new THREE.BufferAttribute(lightPhases, 1));

  // Soft Gaussian bokeh shader — zero aliasing, zero sub-pixel flicker, pure cozy golden Christmas magic!
  const treeLightsMat = trackMat(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uMap: { value: textures.sparkGlow },
        uReveal: { value: 0.15 },
        uTime: { value: 0 },
        uBoost: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      vertexShader: `
        attribute float aSize;
        attribute float aTier;
        attribute float aPhase;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uReveal;
        uniform float uTime;
        uniform float uBoost;
        uniform float uPixelRatio;

        void main() {
          // Always keep warm base ambience (0.28) then sweep smoothly upward to 1.0 during Act I
          float lit = smoothstep(aTier * 0.88 - 0.04, aTier * 0.88 + 0.12, uReveal);
          float baseAmbient = 0.22 * (1.0 - aTier * 0.55);
          // Ultra-gentle, serene breathing (0.05 amplitude at 0.55 rad/s — zero flickering!)
          float breath = 0.95 + 0.05 * sin(uTime * 0.55 + aPhase);
          float energy = max(baseAmbient, lit) * breath * (1.0 + uBoost * 0.18);

          vColor = color * (0.95 + energy * 0.35);
          vAlpha = energy * 0.92;

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float ptSize = aSize * uPixelRatio * (190.0 / max(2.2, -mvPosition.z));
          gl_PointSize = clamp(ptSize * (0.75 + 0.25 * energy), 3.4, 24.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          if (vAlpha <= 0.01) discard;
          vec4 tex = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(vColor * tex.rgb, tex.a * vAlpha);
        }
      `,
    }),
  );

  const treeLightsPoints = new THREE.Points(lightGeo, treeLightsMat);
  treeLightsPoints.frustumCulled = false;
  group.add(treeLightsPoints);

  // =========================================================================
  // 6. 180 Luxury Clustered Crimson Lacquer & Champagne-Gold Baubles (红金奢华圣诞球群)
  // =========================================================================
  const baubleGeo = trackGeo(new THREE.SphereGeometry(0.145, 18, 14));
  const baubleCapGeo = trackGeo(new THREE.CylinderGeometry(0.038, 0.044, 0.055, 8));

  const redBaubles: Array<{ pos: THREE.Vector3; scale: number }> = [];
  const goldBaubles: Array<{ pos: THREE.Vector3; scale: number }> = [];

  for (let i = 0; i < 180; i++) {
    // Organic floral clustering: pair ornaments slightly offset around golden-angle anchors
    const clusterIdx = Math.floor(i / 2);
    const pairMember = i % 2;
    const t = Math.pow((clusterIdx + 0.5) / 90, 0.84);
    const y = 1.9 + t * 7.25 + (pairMember === 1 ? -0.14 : 0.05);
    const r = treeOuterRadiusAt(y) * (pairMember === 0 ? 0.93 : 0.89);
    const a = clusterIdx * goldenAngle + (pairMember === 1 ? 0.14 : 0);
    const scale = (pairMember === 0 ? 1.08 : 0.78) * THREE.MathUtils.lerp(1.18, 0.62, t);
    const rec = {
      pos: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r),
      scale,
    };
    if ((clusterIdx + pairMember) % 2 === 0) redBaubles.push(rec);
    else goldBaubles.push(rec);
  }

  const redBaubleMesh = new THREE.InstancedMesh(baubleGeo, lacquerRedMat, redBaubles.length);
  const goldBaubleMesh = new THREE.InstancedMesh(baubleGeo, champagneGoldMat, goldBaubles.length);
  const baubleCapMesh = new THREE.InstancedMesh(baubleCapGeo, champagneGoldMat, redBaubles.length + goldBaubles.length);

  let capIdx = 0;
  redBaubles.forEach((b, i) => {
    _dummy.position.copy(b.pos);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.setScalar(b.scale);
    _dummy.updateMatrix();
    redBaubleMesh.setMatrixAt(i, _dummy.matrix);

    _dummy.position.set(b.pos.x, b.pos.y + 0.145 * b.scale, b.pos.z);
    _dummy.updateMatrix();
    baubleCapMesh.setMatrixAt(capIdx++, _dummy.matrix);
  });
  goldBaubles.forEach((b, i) => {
    _dummy.position.copy(b.pos);
    _dummy.rotation.set(0, 0, 0);
    _dummy.scale.setScalar(b.scale);
    _dummy.updateMatrix();
    goldBaubleMesh.setMatrixAt(i, _dummy.matrix);

    _dummy.position.set(b.pos.x, b.pos.y + 0.145 * b.scale, b.pos.z);
    _dummy.updateMatrix();
    baubleCapMesh.setMatrixAt(capIdx++, _dummy.matrix);
  });
  redBaubleMesh.instanceMatrix.needsUpdate = true;
  goldBaubleMesh.instanceMatrix.needsUpdate = true;
  baubleCapMesh.instanceMatrix.needsUpdate = true;
  group.add(redBaubleMesh, goldBaubleMesh, baubleCapMesh);

  // =========================================================================
  // 7. 26 Harmoniously Scaled Woven-Silk Palace Lanterns & Hanging Wish Ribbons
  // =========================================================================
  const lanternRecords: LanternRecord[] = [];
  const lanternLathePts = [
    new THREE.Vector2(0.0, -0.22),
    new THREE.Vector2(0.1, -0.2),
    new THREE.Vector2(0.19, -0.1),
    new THREE.Vector2(0.215, 0.0),
    new THREE.Vector2(0.19, 0.1),
    new THREE.Vector2(0.1, 0.2),
    new THREE.Vector2(0.0, 0.22),
  ];
  const lanternBodyGeo = trackGeo(new THREE.LatheGeometry(lanternLathePts, 20));
  const lanternMiniRoofGeo = trackGeo(createPagodaRoofCapGeometry(0.21, 0.1, 6));
  const lanternCollarGeo = trackGeo(new THREE.CylinderGeometry(0.105, 0.12, 0.05, 6));
  const lanternCordGeo = trackGeo(new THREE.CylinderGeometry(0.008, 0.008, 0.22, 6));
  const lanternKnotGeo = trackGeo(new THREE.SphereGeometry(0.028, 8, 8));
  const lanternTasselGeo = trackGeo(new THREE.ConeGeometry(0.036, 0.25, 8));
  const lanternCoreGeo = trackGeo(new THREE.SphereGeometry(0.05, 8, 8));

  const lanternTiers = [
    { tierIdx: 0, count: 8, y: 2.38, scale: 0.96 },
    { tierIdx: 1, count: 6, y: 3.68, scale: 0.88 },
    { tierIdx: 2, count: 5, y: 5.0, scale: 0.8 },
    { tierIdx: 3, count: 4, y: 6.32, scale: 0.72 },
    { tierIdx: 4, count: 3, y: 7.58, scale: 0.64 },
  ];

  lanternTiers.forEach((lt) => {
    const tierNorm = lt.tierIdx / 4;
    const r = treeOuterRadiusAt(lt.y) + 0.18;
    for (let i = 0; i < lt.count; i++) {
      const angle = (i / lt.count) * Math.PI * 2 + lt.tierIdx * 0.62;
      const pivot = new THREE.Group();
      pivot.position.set(Math.cos(angle) * r, lt.y, Math.sin(angle) * r);
      pivot.scale.setScalar(lt.scale);

      const cord = new THREE.Mesh(lanternCordGeo, antiqueBronzeMat);
      cord.position.y = -0.11;
      pivot.add(cord);

      const roof = new THREE.Mesh(lanternMiniRoofGeo, antiqueBronzeMat);
      roof.position.y = -0.22;
      pivot.add(roof);

      const topCollar = new THREE.Mesh(lanternCollarGeo, antiqueBronzeMat);
      topCollar.position.y = -0.25;
      pivot.add(topCollar);

      const botCollar = new THREE.Mesh(lanternCollarGeo, antiqueBronzeMat);
      botCollar.position.y = -0.68;
      pivot.add(botCollar);

      const silkMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xc21e20,
          map: textures.lanternSilk,
          roughness: 0.62,
          metalness: 0.04,
          emissive: new THREE.Color(0xff621e),
          emissiveMap: textures.lanternEmissive,
          emissiveIntensity: 0.35,
          envMapIntensity: 0.35,
        }),
      );
      const body = new THREE.Mesh(lanternBodyGeo, silkMat);
      body.position.y = -0.46;
      body.rotation.y = -angle;
      pivot.add(body);

      const coreMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xffd284,
          transparent: true,
          opacity: 0.75,
        }),
      );
      const core = new THREE.Mesh(lanternCoreGeo, coreMat);
      core.position.y = -0.7;
      pivot.add(core);

      const knot = new THREE.Mesh(lanternKnotGeo, champagneGoldMat);
      knot.position.y = -0.75;
      pivot.add(knot);

      const tassel = new THREE.Mesh(lanternTasselGeo, velvetCrimsonMat);
      tassel.position.y = -0.9;
      pivot.add(tassel);

      group.add(pivot);
      lanternRecords.push({
        pivot,
        silkMat,
        coreMat,
        tierNorm,
        phase: angle * 1.4 + lt.tierIdx * 0.9,
      });
    }
  });

  // 52 Subtle Hanging Red Silk New Year Wish Ribbons fluttering beneath lower pine boughs
  const ribbonGeo = trackGeo(new THREE.BoxGeometry(0.056, 0.44, 0.008));
  ribbonGeo.translate(0, -0.22, 0);
  const ribbonMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xa61518,
      emissive: new THREE.Color(0x360607),
      emissiveIntensity: 0.25,
      roughness: 0.72,
    }),
  );
  const ribbonCount = 52;
  const ribbonMesh = new THREE.InstancedMesh(ribbonGeo, ribbonMat, ribbonCount);
  ribbonMesh.frustumCulled = false;

  const wishRibbons: WishRibbonRecord[] = [];
  for (let i = 0; i < ribbonCount; i++) {
    const t = i / ribbonCount;
    const y = 2.0 + t * 3.8;
    const r = treeOuterRadiusAt(y) * 0.96;
    const a = i * goldenAngle + 0.35;
    wishRibbons.push({
      pos: new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r),
      angle: a,
      phase: Math.random() * Math.PI * 2,
      scaleY: 0.8 + Math.random() * 0.42,
    });
  }
  group.add(ribbonMesh);

  // =========================================================================
  // 8. Radiant Imperial 8-Pointed Golden Starburst Topper (盛世鎏金璀璨八芒星冠)
  // =========================================================================
  const topperGroup = new THREE.Group();
  topperGroup.position.set(0, 10.22, 0);
  group.add(topperGroup);

  const topperStem = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.06, 0.14, 0.55, 10)), champagneGoldMat);
  topperStem.position.y = -0.52;
  topperGroup.add(topperStem);

  const starMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf7d27a,
      emissive: new THREE.Color(0xffb444),
      emissiveIntensity: 0.55,
      roughness: 0.18,
      metalness: 0.88,
      envMapIntensity: 1.5,
    }),
  );

  // Dual crossed 3D beveled 8-pointed golden starbursts so it looks iconic from EVERY 360-degree camera angle!
  const starGeo = trackGeo(createBeveledStarburstGeometry(0.95, 0.62, 0.24, 0.16));
  const starFront = new THREE.Mesh(starGeo, starMat);
  const starCross = new THREE.Mesh(starGeo, starMat);
  starCross.rotation.y = Math.PI / 2;
  topperGroup.add(starFront, starCross);

  // Filigree golden halo rings framing the starburst
  const outerHalo = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.76, 0.024, 10, 48)), champagneGoldMat);
  const innerHalo = new THREE.Mesh(trackGeo(new THREE.TorusGeometry(0.46, 0.018, 10, 36)), champagneGoldMat);
  innerHalo.rotation.y = Math.PI / 2;
  topperGroup.add(outerHalo, innerHalo);

  // Warm radiant crystal core
  const starCoreMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xfff3cc,
    }),
  );
  const starCore = new THREE.Mesh(trackGeo(new THREE.SphereGeometry(0.18, 14, 12)), starCoreMat);
  topperGroup.add(starCore);

  // Soft warm golden halation aura around the tree topper
  const apexSpriteMat = trackMat(
    new THREE.SpriteMaterial({
      map: textures.sparkGlow,
      color: 0xffd076,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const apexSprite = new THREE.Sprite(apexSpriteMat);
  apexSprite.scale.set(3.4, 3.4, 1);
  topperGroup.add(apexSprite);

  // =========================================================================
  // 9. Layered Warm Internal Christmas Tree Lighting (深邃暖金内透光晕)
  // =========================================================================
  const skirtWarmLight = new THREE.PointLight(0xff9a3c, 6.0, 22, 2);
  skirtWarmLight.position.set(0, 2.6, 0);
  group.add(skirtWarmLight);

  const midWarmLight = new THREE.PointLight(0xffb24c, 4.0, 20, 2);
  midWarmLight.position.set(0, 5.4, 0);
  group.add(midWarmLight);

  const upperWarmLight = new THREE.PointLight(0xffc260, 2.5, 18, 2);
  upperWarmLight.position.set(0, 8.0, 0);
  group.add(upperWarmLight);

  const starTopLight = new THREE.PointLight(0xffd274, 2.0, 18, 2);
  starTopLight.position.set(0, 10.35, 0);
  group.add(starTopLight);

  // =========================================================================
  // Per-Frame Update (100% Steady, Lush Warm Christmas Glow, Zero Flicker)
  // =========================================================================
  const update = (elapsed: number, showTime: number, _dt: number, _flashBoost: number) => {
    // Starts partially aglow (0.14) so even Frame 0 feels unmistakably magical, sweeping to 1.0 across Act I!
    const rawProgress = THREE.MathUtils.clamp((showTime - 0.2) / 11.8, 0, 1);
    const easedReveal = 0.14 + 0.86 * (rawProgress * rawProgress * (3 - 2 * rawProgress));
    const crownIgnite = THREE.MathUtils.clamp((showTime - 10.8) / 2.8, 0, 1);

    const climaxLift =
      showTime >= 27 && showTime <= 49
        ? Math.sin(THREE.MathUtils.clamp((showTime - 27) / 22, 0, 1) * Math.PI) * 0.16
        : 0;

    // 1. 1,680 Soft Warm Golden Tree Lights
    treeLightsMat.uniforms.uReveal.value = easedReveal;
    treeLightsMat.uniforms.uTime.value = elapsed;
    treeLightsMat.uniforms.uBoost.value = climaxLift;

    // 2. Swaying silk palace lanterns
    for (let i = 0; i < lanternRecords.length; i++) {
      const lr = lanternRecords[i];
      lr.pivot.rotation.z = Math.sin(elapsed * 0.65 + lr.phase) * 0.04;
      lr.pivot.rotation.x = Math.cos(elapsed * 0.52 + lr.phase * 0.8) * 0.025;

      const lit = THREE.MathUtils.smoothstep(easedReveal, lr.tierNorm * 0.78, lr.tierNorm * 0.78 + 0.18);
      lr.silkMat.emissiveIntensity = 0.28 + lit * (1.2 + climaxLift * 0.18);
      lr.coreMat.opacity = 0.28 + lit * 0.65;
    }

    // 3. Fluttering red silk prayer ribbons
    for (let i = 0; i < ribbonCount; i++) {
      const wr = wishRibbons[i];
      _dummy.position.copy(wr.pos);
      _dummy.rotation.set(
        Math.cos(elapsed * 0.85 + wr.phase) * 0.065,
        -wr.angle + Math.PI / 2,
        Math.sin(elapsed * 1.05 + wr.phase) * 0.085,
      );
      _dummy.scale.set(1, wr.scaleY, 1);
      _dummy.updateMatrix();
      ribbonMesh.setMatrixAt(i, _dummy.matrix);
    }
    ribbonMesh.instanceMatrix.needsUpdate = true;

    // 4. Majestic slowly-revolving Radiant Golden Starburst Topper
    topperGroup.rotation.y = elapsed * 0.24;
    starMat.emissiveIntensity = 0.48 + crownIgnite * (1.15 + climaxLift * 0.25);
    apexSpriteMat.opacity = 0.22 + crownIgnite * (0.48 + climaxLift * 0.14);

    // 5. Layered warm interior tree lights
    const lowerLit = THREE.MathUtils.smoothstep(easedReveal, 0.08, 0.55);
    const midLit = THREE.MathUtils.smoothstep(easedReveal, 0.3, 0.82);
    const upperLit = THREE.MathUtils.smoothstep(easedReveal, 0.55, 0.96);

    skirtWarmLight.intensity = 6.5 + lowerLit * (18.0 + climaxLift * 3.0);
    midWarmLight.intensity = 4.0 + midLit * (15.0 + climaxLift * 2.5);
    upperWarmLight.intensity = 2.0 + upperLit * (11.5 + climaxLift * 2.0);
    starTopLight.intensity = 2.2 + crownIgnite * 12.0;
  };

  const dispose = () => {
    for (const g of geometries) g.dispose();
    for (const m of materials) m.dispose();
  };

  return { group, update, dispose };
}

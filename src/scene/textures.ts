import * as THREE from 'three';

export interface ProceduralTextureSet {
  courtyardAlbedo: THREE.CanvasTexture;
  courtyardRoughness: THREE.CanvasTexture;
  courtyardBump: THREE.CanvasTexture;
  courtyardPuddleAlpha: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  foliageAlbedo: THREE.CanvasTexture;
  foliageBump: THREE.CanvasTexture;
  foliageRoughness: THREE.CanvasTexture;
  roofTileAlbedo: THREE.CanvasTexture;
  roofTileBump: THREE.CanvasTexture;
  stoneCarvedAlbedo: THREE.CanvasTexture;
  stoneCarvedBump: THREE.CanvasTexture;
  barkAlbedo: THREE.CanvasTexture;
  barkBump: THREE.CanvasTexture;
  lanternSilk: THREE.CanvasTexture;
  lanternEmissive: THREE.CanvasTexture;
  fuPlaque: THREE.CanvasTexture;
  archBanner: THREE.CanvasTexture;
  coupletLeft: THREE.CanvasTexture;
  coupletRight: THREE.CanvasTexture;
  townFacadeAlbedo: THREE.CanvasTexture;
  townFacadeEmissive: THREE.CanvasTexture;
  sparkGlow: THREE.CanvasTexture;
  smokePuff: THREE.CanvasTexture;
  snowflake: THREE.CanvasTexture;
  skyDome: THREE.CanvasTexture;
  dispose: () => void;
}

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix, iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbm2D(x: number, y: number, octaves = 4): number {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * valueNoise2D(x * freq, y * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return val;
}

function createAgedCalligraphyTexture(
  width: number,
  height: number,
  bgTop: string,
  bgBot: string,
  borderColor: string,
  drawContent: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  aniso: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, bgTop);
  grad.addColorStop(1, bgBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Authentic Xuan-paper / aged lacquer wood grain + subtle gold-leaf flecks (洒金红纸)
  for (let i = 0; i < 240; i++) {
    const x = hash2(i, 3.1) * width;
    const y = hash2(i, 7.7) * height;
    const s = 1 + hash2(i, 11.3) * 3.5;
    ctx.fillStyle =
      i % 5 === 0 ? 'rgba(232, 188, 96, 0.22)' : 'rgba(28, 4, 4, 0.14)';
    ctx.fillRect(x, y, s, s * (i % 5 === 0 ? 1 : 2.5));
  }

  // Carved subtle gold-leaf border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = Math.max(4, Math.min(width, height) * 0.028);
  ctx.strokeRect(10, 10, width - 20, height - 20);
  ctx.lineWidth = Math.max(1.5, Math.min(width, height) * 0.01);
  ctx.strokeRect(20, 20, width - 40, height - 40);

  drawContent(ctx, width, height);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.max(1, Math.min(8, maxAnisotropy));

  // =========================================================================
  // 1. Weathered Wet Winter Bluestone Courtyard (雨雪微湿青石板 + 真实水洼反射遮罩)
  // =========================================================================
  const floorSize = 1024;
  const cCanvas = document.createElement('canvas');
  cCanvas.width = floorSize;
  cCanvas.height = floorSize;
  const cCtx = cCanvas.getContext('2d')!;

  const rCanvas = document.createElement('canvas');
  rCanvas.width = floorSize;
  rCanvas.height = floorSize;
  const rCtx = rCanvas.getContext('2d')!;

  const bCanvas = document.createElement('canvas');
  bCanvas.width = floorSize;
  bCanvas.height = floorSize;
  const bCtx = bCanvas.getContext('2d')!;

  const aCanvas = document.createElement('canvas');
  aCanvas.width = floorSize;
  aCanvas.height = floorSize;
  const aCtx = aCanvas.getContext('2d')!;

  // Deep recessed mortar base
  cCtx.fillStyle = '#0d0f13';
  cCtx.fillRect(0, 0, floorSize, floorSize);
  rCtx.fillStyle = '#c8c8c8';
  rCtx.fillRect(0, 0, floorSize, floorSize);
  bCtx.fillStyle = '#242424';
  bCtx.fillRect(0, 0, floorSize, floorSize);
  aCtx.fillStyle = '#e8e8e8';
  aCtx.fillRect(0, 0, floorSize, floorSize);

  const cx = floorSize / 2;
  const cy = floorSize / 2;
  const rings = [58, 96, 138, 184, 232, 282, 334, 388, 444, 502];

  for (let rIdx = 0; rIdx < rings.length - 1; rIdx++) {
    const r0 = rings[rIdx];
    const r1 = rings[rIdx + 1];
    const segs = 16 + rIdx * 8;
    for (let s = 0; s < segs; s++) {
      const a0 = (s / segs) * Math.PI * 2 + (rIdx % 2) * (Math.PI / segs);
      const a1 = ((s + 1) / segs) * Math.PI * 2 + (rIdx % 2) * (Math.PI / segs);
      const tone = hash2(rIdx * 31 + s, s * 17 + rIdx);
      const midA = (a0 + a1) * 0.5;
      const midR = (r0 + r1) * 0.5;
      const sx = cx + Math.cos(midA) * midR;
      const sy = cy + Math.sin(midA) * midR;
      const wetNoise = fbm2D(sx * 0.011 + 2.3, sy * 0.011 + 5.1, 3);
      const isWet = wetNoise > 0.51;

      // Natural cool weathered slate/bluestone palette (darker where damp)
      const wetDarken = isWet ? 0.68 : 1.0;
      const rVal = Math.floor((24 + tone * 18) * wetDarken);
      const gVal = Math.floor((26 + tone * 18) * wetDarken);
      const bVal = Math.floor((32 + tone * 20) * wetDarken);

      cCtx.beginPath();
      cCtx.arc(cx, cy, r1 - 2, a0 + 0.003, a1 - 0.003);
      cCtx.arc(cx, cy, r0 + 2, a1 - 0.003, a0 + 0.003, true);
      cCtx.closePath();
      cCtx.fillStyle = `rgb(${rVal}, ${gVal}, ${bVal})`;
      cCtx.fill();

      // Low roughness in damp rain puddles (catches crisp lantern reflections), higher on dry slate
      const roughVal = isWet
        ? Math.floor(24 + (1 - tone) * 32)
        : Math.floor(148 + (1 - tone) * 58);
      rCtx.beginPath();
      rCtx.arc(cx, cy, r1 - 2, a0 + 0.003, a1 - 0.003);
      rCtx.arc(cx, cy, r0 + 2, a1 - 0.003, a0 + 0.003, true);
      rCtx.closePath();
      rCtx.fillStyle = `rgb(${roughVal},${roughVal},${roughVal})`;
      rCtx.fill();

      const bumpVal = Math.floor(142 + tone * 58);
      bCtx.beginPath();
      bCtx.arc(cx, cy, r1 - 3, a0 + 0.005, a1 - 0.005);
      bCtx.arc(cx, cy, r0 + 3, a1 - 0.005, a0 + 0.005, true);
      bCtx.closePath();
      bCtx.fillStyle = `rgb(${bumpVal},${bumpVal},${bumpVal})`;
      bCtx.fill();
    }
  }

  // Fine mineral grain & subtle snow-frost dusting in crevices
  for (let i = 0; i < 6500; i++) {
    const x = hash2(i, 1.3) * floorSize;
    const y = hash2(i, 9.7) * floorSize;
    const frost = fbm2D(x * 0.015, y * 0.015, 3);
    if (frost < 0.34) {
      cCtx.fillStyle = 'rgba(185, 198, 218, 0.09)';
      cCtx.fillRect(x, y, 3, 3);
    } else {
      const dark = i % 2 === 0;
      cCtx.fillStyle = dark ? 'rgba(6, 8, 12, 0.25)' : 'rgba(95, 102, 116, 0.14)';
      cCtx.fillRect(x, y, 2, 2);
      bCtx.fillStyle = dark ? 'rgba(90, 90, 90, 0.35)' : 'rgba(215, 215, 215, 0.28)';
      bCtx.fillRect(x, y, 2, 2);
    }
  }

  // Organic smooth puddle alpha map (white = mostly opaque dry stone, mid-grey = reflective damp puddle)
  const aImg = aCtx.createImageData(floorSize, floorSize);
  for (let y = 0; y < floorSize; y++) {
    for (let x = 0; x < floorSize; x++) {
      const dx = (x - cx) / cx;
      const dy = (y - cy) / cy;
      const dist = Math.hypot(dx, dy);
      const n = fbm2D(x * 0.011 + 2.3, y * 0.011 + 5.1, 4);
      // Outside the inner courtyard ring, fade smoothly to 100% opaque stone
      const radialFade = THREE.MathUtils.smoothstep(dist, 0.72, 0.96);
      const puddleFactor = THREE.MathUtils.smoothstep(n, 0.44, 0.68) * (1 - radialFade);
      // Alpha range: ~0.62 in wet puddles (lets 38% crisp Reflector bleed through), ~0.91 on damp stone
      const alphaByte = Math.floor(THREE.MathUtils.lerp(236, 152, puddleFactor));
      const idx = (y * floorSize + x) * 4;
      aImg.data[idx] = alphaByte;
      aImg.data[idx + 1] = alphaByte;
      aImg.data[idx + 2] = alphaByte;
      aImg.data[idx + 3] = 255;
    }
  }
  aCtx.putImageData(aImg, 0, 0);

  // Subtle inlaid weathered antique bronze ring markers
  cCtx.strokeStyle = 'rgba(138, 108, 62, 0.36)';
  cCtx.lineWidth = 3;
  for (const r of [138, 282, 444]) {
    cCtx.beginPath();
    cCtx.arc(cx, cy, r, 0, Math.PI * 2);
    cCtx.stroke();
  }

  const courtyardAlbedo = new THREE.CanvasTexture(cCanvas);
  courtyardAlbedo.colorSpace = THREE.SRGBColorSpace;
  courtyardAlbedo.anisotropy = aniso;

  const courtyardRoughness = new THREE.CanvasTexture(rCanvas);
  courtyardRoughness.colorSpace = THREE.NoColorSpace;
  courtyardRoughness.anisotropy = aniso;

  const courtyardBump = new THREE.CanvasTexture(bCanvas);
  courtyardBump.colorSpace = THREE.NoColorSpace;
  courtyardBump.anisotropy = aniso;

  const courtyardPuddleAlpha = new THREE.CanvasTexture(aCanvas);
  courtyardPuddleAlpha.colorSpace = THREE.NoColorSpace;
  courtyardPuddleAlpha.anisotropy = aniso;

  // =========================================================================
  // 2. Soft Radial Contact Shadow
  // =========================================================================
  const sCanvas = document.createElement('canvas');
  sCanvas.width = 256;
  sCanvas.height = 256;
  const sCtx = sCanvas.getContext('2d')!;
  const sGrad = sCtx.createRadialGradient(128, 128, 28, 128, 128, 124);
  sGrad.addColorStop(0, 'rgba(2, 3, 6, 0.92)');
  sGrad.addColorStop(0.55, 'rgba(2, 3, 6, 0.56)');
  sGrad.addColorStop(1, 'rgba(2, 3, 6, 0)');
  sCtx.fillStyle = sGrad;
  sCtx.fillRect(0, 0, 256, 256);
  const contactShadow = new THREE.CanvasTexture(sCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;

  // =========================================================================
  // 3. Dense Layered Winter Pine-Needle Foliage PBR (Solid — Zero Alpha Shimmer!)
  // =========================================================================
  const fSize = 512;
  const fCanvas = document.createElement('canvas');
  fCanvas.width = fSize;
  fCanvas.height = fSize;
  const fCtx = fCanvas.getContext('2d')!;

  const fbCanvas = document.createElement('canvas');
  fbCanvas.width = fSize;
  fbCanvas.height = fSize;
  const fbCtx = fbCanvas.getContext('2d')!;

  const frCanvas = document.createElement('canvas');
  frCanvas.width = fSize;
  frCanvas.height = fSize;
  const frCtx = frCanvas.getContext('2d')!;

  fCtx.fillStyle = '#09150f';
  fCtx.fillRect(0, 0, fSize, fSize);
  fbCtx.fillStyle = '#383838';
  fbCtx.fillRect(0, 0, fSize, fSize);
  frCtx.fillStyle = '#d4d4d4';
  frCtx.fillRect(0, 0, fSize, fSize);

  // Paint thousands of organic overlapping pine-needle fans for tactile close-up realism
  const pinePalette = ['#0d2017', '#132c1f', '#193928', '#224530', '#0a1811'];
  for (let i = 0; i < 2400; i++) {
    const bx = hash2(i, 2.1) * fSize;
    const by = hash2(i, 6.7) * fSize;
    const angle = (hash2(i, 12.4) - 0.5) * 1.4 + Math.PI * 0.5;
    const len = 14 + hash2(i, 19.2) * 24;
    const col = pinePalette[i % pinePalette.length];

    fCtx.strokeStyle = col;
    fCtx.lineWidth = 2.1;
    fCtx.beginPath();
    fCtx.moveTo(bx, by);
    fCtx.lineTo(bx + Math.cos(angle) * len, by + Math.sin(angle) * len);
    fCtx.stroke();

    const bGray = 110 + (i % 5) * 26;
    fbCtx.strokeStyle = `rgb(${bGray},${bGray},${bGray})`;
    fbCtx.lineWidth = 2.0;
    fbCtx.beginPath();
    fbCtx.moveTo(bx, by);
    fbCtx.lineTo(bx + Math.cos(angle) * len, by + Math.sin(angle) * len);
    fbCtx.stroke();

    // Fine feathery side needles
    for (let k = -2; k <= 2; k++) {
      if (k === 0) continue;
      const sa = angle + k * 0.24;
      const sl = len * 0.62;
      fCtx.lineWidth = 1.25;
      fCtx.beginPath();
      fCtx.moveTo(bx + Math.cos(angle) * len * 0.35, by + Math.sin(angle) * len * 0.35);
      fCtx.lineTo(bx + Math.cos(sa) * sl, by + Math.sin(sa) * sl);
      fCtx.stroke();
    }
  }

  // Delicate winter snow/frost dusting along the outer/upper pine tips (UV y near 0..0.38)
  const frostGrad = fCtx.createLinearGradient(0, 0, 0, fSize);
  frostGrad.addColorStop(0, 'rgba(218, 228, 242, 0.42)');
  frostGrad.addColorStop(0.28, 'rgba(205, 218, 236, 0.14)');
  frostGrad.addColorStop(0.55, 'rgba(200, 215, 235, 0)');
  frostGrad.addColorStop(1, 'rgba(12, 18, 14, 0.28)');
  fCtx.fillStyle = frostGrad;
  fCtx.fillRect(0, 0, fSize, fSize);

  for (let i = 0; i < 420; i++) {
    const x = hash2(i, 41.2) * fSize;
    const y = hash2(i, 53.8) * fSize * 0.42;
    const r = 1.2 + hash2(i, 61.1) * 3.8;
    fCtx.fillStyle = 'rgba(224, 234, 246, 0.32)';
    fCtx.beginPath();
    fCtx.arc(x, y, r, 0, Math.PI * 2);
    fCtx.fill();

    frCtx.fillStyle = 'rgba(240, 240, 240, 0.5)';
    frCtx.beginPath();
    frCtx.arc(x, y, r, 0, Math.PI * 2);
    frCtx.fill();
  }

  const foliageAlbedo = new THREE.CanvasTexture(fCanvas);
  foliageAlbedo.colorSpace = THREE.SRGBColorSpace;
  foliageAlbedo.wrapS = THREE.RepeatWrapping;
  foliageAlbedo.wrapT = THREE.RepeatWrapping;
  foliageAlbedo.repeat.set(2, 2);
  foliageAlbedo.anisotropy = aniso;

  const foliageBump = new THREE.CanvasTexture(fbCanvas);
  foliageBump.colorSpace = THREE.NoColorSpace;
  foliageBump.wrapS = THREE.RepeatWrapping;
  foliageBump.wrapT = THREE.RepeatWrapping;
  foliageBump.repeat.set(2, 2);
  foliageBump.anisotropy = aniso;

  const foliageRoughness = new THREE.CanvasTexture(frCanvas);
  foliageRoughness.colorSpace = THREE.NoColorSpace;
  foliageRoughness.wrapS = THREE.RepeatWrapping;
  foliageRoughness.wrapT = THREE.RepeatWrapping;
  foliageRoughness.repeat.set(2, 2);
  foliageRoughness.anisotropy = aniso;

  // =========================================================================
  // 4. Chinese Glazed Barrel Roof Tiles (青灰筒瓦纹理 + 雪霜痕迹)
  // =========================================================================
  const rtSize = 512;
  const rtCanvas = document.createElement('canvas');
  rtCanvas.width = rtSize;
  rtCanvas.height = rtSize;
  const rtCtx = rtCanvas.getContext('2d')!;

  const rtbCanvas = document.createElement('canvas');
  rtbCanvas.width = rtSize;
  rtbCanvas.height = rtSize;
  const rtbCtx = rtbCanvas.getContext('2d')!;

  rtCtx.fillStyle = '#1b1d24';
  rtCtx.fillRect(0, 0, rtSize, rtSize);
  rtbCtx.fillStyle = '#505050';
  rtbCtx.fillRect(0, 0, rtSize, rtSize);

  const colCount = 24;
  const colW = rtSize / colCount;
  for (let c = 0; c < colCount; c++) {
    const x0 = c * colW;
    const tg = rtCtx.createLinearGradient(x0, 0, x0 + colW, 0);
    tg.addColorStop(0, '#101218');
    tg.addColorStop(0.25, '#292d38');
    tg.addColorStop(0.5, '#353a46');
    tg.addColorStop(0.75, '#222630');
    tg.addColorStop(1, '#0e1015');
    rtCtx.fillStyle = tg;
    rtCtx.fillRect(x0, 0, colW, rtSize);

    const bg = rtbCtx.createLinearGradient(x0, 0, x0 + colW, 0);
    bg.addColorStop(0, '#181818');
    bg.addColorStop(0.45, '#e8e8e8');
    bg.addColorStop(0.55, '#dcdcdc');
    bg.addColorStop(1, '#181818');
    rtbCtx.fillStyle = bg;
    rtbCtx.fillRect(x0, 0, colW, rtSize);
  }

  // Horizontal overlapping tile rows + subtle snow settled in tile troughs
  const rowCount = 16;
  const rowH = rtSize / rowCount;
  for (let r = 0; r < rowCount; r++) {
    const y0 = r * rowH;
    rtCtx.fillStyle = 'rgba(5, 6, 10, 0.55)';
    rtCtx.fillRect(0, y0, rtSize, 3);
    rtbCtx.fillStyle = 'rgba(20, 20, 20, 0.65)';
    rtbCtx.fillRect(0, y0, rtSize, 3);

    // Subtle frosty snow highlight along tile edges
    rtCtx.fillStyle = 'rgba(205, 218, 236, 0.12)';
    rtCtx.fillRect(0, y0 + 3, rtSize, 4);
  }

  const roofTileAlbedo = new THREE.CanvasTexture(rtCanvas);
  roofTileAlbedo.colorSpace = THREE.SRGBColorSpace;
  roofTileAlbedo.wrapS = THREE.RepeatWrapping;
  roofTileAlbedo.wrapT = THREE.RepeatWrapping;
  roofTileAlbedo.repeat.set(3, 2);
  roofTileAlbedo.anisotropy = aniso;

  const roofTileBump = new THREE.CanvasTexture(rtbCanvas);
  roofTileBump.colorSpace = THREE.NoColorSpace;
  roofTileBump.wrapS = THREE.RepeatWrapping;
  roofTileBump.wrapT = THREE.RepeatWrapping;
  roofTileBump.repeat.set(3, 2);
  roofTileBump.anisotropy = aniso;

  // =========================================================================
  // 5. Weathered Carved Hanbaiyu Stone & Deeply Furrowed Pine Bark
  // =========================================================================
  const stCanvas = document.createElement('canvas');
  stCanvas.width = 512;
  stCanvas.height = 512;
  const stCtx = stCanvas.getContext('2d')!;
  const stbCanvas = document.createElement('canvas');
  stbCanvas.width = 512;
  stbCanvas.height = 512;
  const stbCtx = stbCanvas.getContext('2d')!;

  stCtx.fillStyle = '#9c968b';
  stCtx.fillRect(0, 0, 512, 512);
  stbCtx.fillStyle = '#808080';
  stbCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 160; i++) {
    const shade = Math.floor(110 + hash2(i, 4.4) * 58);
    stCtx.strokeStyle = `rgba(${shade}, ${shade - 6}, ${shade - 14}, 0.16)`;
    stCtx.lineWidth = 1.5 + hash2(i, 8.8) * 4;
    stCtx.beginPath();
    let x = hash2(i, 1.2) * 512;
    let y = hash2(i, 2.3) * 512;
    stCtx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (hash2(i * 7 + s, 3.1) - 0.35) * 90;
      y += (hash2(i * 7 + s, 9.2) - 0.5) * 55;
      stCtx.lineTo(x, y);
    }
    stCtx.stroke();
  }

  // Carved horizontal classical cornice relief bands
  for (const bandY of [48, 456]) {
    stCtx.fillStyle = 'rgba(54, 48, 42, 0.35)';
    stCtx.fillRect(0, bandY, 512, 8);
    stbCtx.fillStyle = '#383838';
    stbCtx.fillRect(0, bandY, 512, 8);
    stbCtx.fillStyle = '#c8c8c8';
    stbCtx.fillRect(0, bandY + 8, 512, 6);
  }

  for (let i = 0; i < 3200; i++) {
    const x = hash2(i, 21.1) * 512;
    const y = hash2(i, 31.7) * 512;
    const dark = i % 2 === 0;
    stCtx.fillStyle = dark ? 'rgba(42, 38, 34, 0.16)' : 'rgba(225, 220, 212, 0.14)';
    stCtx.fillRect(x, y, 2, 2);
    stbCtx.fillStyle = dark ? 'rgba(60, 60, 60, 0.25)' : 'rgba(200, 200, 200, 0.25)';
    stbCtx.fillRect(x, y, 2, 2);
  }

  const stoneCarvedAlbedo = new THREE.CanvasTexture(stCanvas);
  stoneCarvedAlbedo.colorSpace = THREE.SRGBColorSpace;
  stoneCarvedAlbedo.wrapS = THREE.RepeatWrapping;
  stoneCarvedAlbedo.wrapT = THREE.RepeatWrapping;
  stoneCarvedAlbedo.anisotropy = aniso;

  const stoneCarvedBump = new THREE.CanvasTexture(stbCanvas);
  stoneCarvedBump.colorSpace = THREE.NoColorSpace;
  stoneCarvedBump.wrapS = THREE.RepeatWrapping;
  stoneCarvedBump.wrapT = THREE.RepeatWrapping;
  stoneCarvedBump.anisotropy = aniso;

  // Deeply furrowed ancient bark
  const bkCanvas = document.createElement('canvas');
  bkCanvas.width = 512;
  bkCanvas.height = 512;
  const bkCtx = bkCanvas.getContext('2d')!;
  const bkbCanvas = document.createElement('canvas');
  bkbCanvas.width = 512;
  bkbCanvas.height = 512;
  const bkbCtx = bkbCanvas.getContext('2d')!;

  bkCtx.fillStyle = '#2d1c15';
  bkCtx.fillRect(0, 0, 512, 512);
  bkbCtx.fillStyle = '#707070';
  bkbCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 820; i++) {
    const x = hash2(i, 5.1) * 512;
    const y = hash2(i, 8.9) * 512;
    const w = 2 + hash2(i, 12.1) * 7;
    const h = 26 + hash2(i, 16.3) * 95;
    const fissure = i % 3 === 0;
    bkCtx.fillStyle = fissure
      ? 'rgba(14, 8, 6, 0.68)'
      : i % 3 === 1
        ? 'rgba(72, 46, 33, 0.45)'
        : 'rgba(98, 72, 56, 0.28)';
    bkCtx.fillRect(x, y, w, h);

    bkbCtx.fillStyle = fissure ? 'rgba(20, 20, 20, 0.72)' : 'rgba(215, 215, 215, 0.48)';
    bkbCtx.fillRect(x, y, w, h);
  }

  const barkAlbedo = new THREE.CanvasTexture(bkCanvas);
  barkAlbedo.colorSpace = THREE.SRGBColorSpace;
  barkAlbedo.wrapS = THREE.RepeatWrapping;
  barkAlbedo.wrapT = THREE.RepeatWrapping;
  barkAlbedo.repeat.set(2, 4);
  barkAlbedo.anisotropy = aniso;

  const barkBump = new THREE.CanvasTexture(bkbCanvas);
  barkBump.colorSpace = THREE.NoColorSpace;
  barkBump.wrapS = THREE.RepeatWrapping;
  barkBump.wrapT = THREE.RepeatWrapping;
  barkBump.repeat.set(2, 4);
  barkBump.anisotropy = aniso;

  // =========================================================================
  // 6. Photorealistic Woven Red Silk Palace Lantern (真实丝绸纹理 + 内部暖烛光透射衰减)
  // =========================================================================
  const lCanvas = document.createElement('canvas');
  lCanvas.width = 1024;
  lCanvas.height = 512;
  const lCtx = lCanvas.getContext('2d')!;

  const leCanvas = document.createElement('canvas');
  leCanvas.width = 1024;
  leCanvas.height = 512;
  const leCtx = leCanvas.getContext('2d')!;

  const lGrad = lCtx.createLinearGradient(0, 0, 0, 512);
  lGrad.addColorStop(0, '#46070a');
  lGrad.addColorStop(0.18, '#8d1115');
  lGrad.addColorStop(0.5, '#be1a1d');
  lGrad.addColorStop(0.82, '#8b1014');
  lGrad.addColorStop(1, '#3e0609');
  lCtx.fillStyle = lGrad;
  lCtx.fillRect(0, 0, 1024, 512);

  // Authentic physical subsurface candle-core light falloff through red silk
  const leGrad = leCtx.createLinearGradient(0, 0, 0, 512);
  leGrad.addColorStop(0, '#140202');
  leGrad.addColorStop(0.18, '#661108');
  leGrad.addColorStop(0.46, '#eb5418');
  leGrad.addColorStop(0.58, '#ff7d24'); // warm tungsten filament core slightly below center
  leGrad.addColorStop(0.84, '#600f07');
  leGrad.addColorStop(1, '#120202');
  leCtx.fillStyle = leGrad;
  leCtx.fillRect(0, 0, 1024, 512);

  // Fine horizontal woven silk threads
  lCtx.fillStyle = 'rgba(255, 198, 128, 0.045)';
  for (let y = 0; y < 512; y += 3) {
    lCtx.fillRect(0, y, 1024, 1);
  }
  leCtx.fillStyle = 'rgba(0, 0, 0, 0.09)';
  for (let y = 0; y < 512; y += 3) {
    leCtx.fillRect(0, y, 1024, 1);
  }

  // 16 dark carved mahogany ribs casting soft internal occlusion shadow
  for (let i = 0; i < 16; i++) {
    const x = (i / 16) * 1024;
    lCtx.fillStyle = 'rgba(28, 5, 5, 0.82)';
    lCtx.fillRect(x, 0, 6, 512);
    lCtx.fillStyle = 'rgba(205, 158, 72, 0.35)';
    lCtx.fillRect(x + 6, 0, 2, 512);

    leCtx.fillStyle = '#080101';
    leCtx.fillRect(x - 1, 0, 9, 512);
  }

  // Woven gold-brocade top & bottom trim bands
  lCtx.fillStyle = '#b9893d';
  lCtx.fillRect(0, 26, 1024, 14);
  lCtx.fillRect(0, 472, 1024, 14);
  leCtx.fillStyle = '#180502';
  leCtx.fillRect(0, 24, 1024, 18);
  leCtx.fillRect(0, 470, 1024, 18);

  // Refined gold-brush calligraphy medallions ("福" "春" "吉" "喜")
  const lanternChars = ['福', '春', '吉', '喜'];
  for (let i = 0; i < 4; i++) {
    const mx = 128 + i * 256;
    const my = 256;

    lCtx.strokeStyle = 'rgba(235, 190, 104, 0.85)';
    lCtx.lineWidth = 4;
    lCtx.beginPath();
    lCtx.arc(mx, my, 68, 0, Math.PI * 2);
    lCtx.stroke();

    lCtx.lineWidth = 1.5;
    lCtx.beginPath();
    lCtx.arc(mx, my, 60, 0, Math.PI * 2);
    lCtx.stroke();

    lCtx.fillStyle = '#f5d280';
    lCtx.font = 'bold 82px "Noto Serif SC", "Songti SC", Georgia, serif';
    lCtx.textAlign = 'center';
    lCtx.textBaseline = 'middle';
    lCtx.fillText(lanternChars[i], mx, my + 4);

    // Subtle dark silhouette + warm edge around gold ink so characters read authentically backlit
    leCtx.fillStyle = '#d48d36';
    leCtx.font = 'bold 82px "Noto Serif SC", "Songti SC", Georgia, serif';
    leCtx.textAlign = 'center';
    leCtx.textBaseline = 'middle';
    leCtx.fillText(lanternChars[i], mx, my + 4);
  }

  const lanternSilk = new THREE.CanvasTexture(lCanvas);
  lanternSilk.colorSpace = THREE.SRGBColorSpace;
  lanternSilk.wrapS = THREE.RepeatWrapping;
  lanternSilk.anisotropy = aniso;

  const lanternEmissive = new THREE.CanvasTexture(leCanvas);
  lanternEmissive.colorSpace = THREE.SRGBColorSpace;
  lanternEmissive.wrapS = THREE.RepeatWrapping;
  lanternEmissive.anisotropy = aniso;

  // =========================================================================
  // 7. Carved Gold-Leaf Plaques & Aged Vermilion Spring Couplets
  // =========================================================================
  const fuPlaque = createAgedCalligraphyTexture(
    256,
    256,
    '#821014',
    '#5e090d',
    '#cfa14d',
    (ctx, w, h) => {
      ctx.fillStyle = '#f2cc78';
      ctx.font = 'bold 144px "Noto Serif SC", "Songti SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('福', w / 2, h / 2 + 8);
    },
    aniso,
  );

  const archBanner = createAgedCalligraphyTexture(
    512,
    160,
    '#340a0c',
    '#200507',
    '#cfa14d',
    (ctx, _w, h) => {
      ctx.fillStyle = '#f3ce7a';
      ctx.font = 'bold 72px "Noto Serif SC", "Songti SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const chars = ['恭', '贺', '新', '禧'];
      for (let i = 0; i < chars.length; i++) {
        ctx.fillText(chars[i], 96 + i * 106, h / 2 + 4);
      }
    },
    aniso,
  );

  const coupletLeft = createAgedCalligraphyTexture(
    128,
    512,
    '#871116',
    '#660b0f',
    '#cfa14d',
    (ctx, w) => {
      ctx.fillStyle = '#f2ce7c';
      ctx.font = 'bold 50px "Noto Serif SC", "Songti SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const chars = ['万', '象', '更', '新', '春', '满', '院'];
      for (let i = 0; i < chars.length; i++) {
        ctx.fillText(chars[i], w / 2, 62 + i * 64);
      }
    },
    aniso,
  );

  const coupletRight = createAgedCalligraphyTexture(
    128,
    512,
    '#871116',
    '#660b0f',
    '#cfa14d',
    (ctx, w) => {
      ctx.fillStyle = '#f2ce7c';
      ctx.font = 'bold 50px "Noto Serif SC", "Songti SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const chars = ['千', '门', '纳', '福', '岁', '平', '安'];
      for (let i = 0; i < chars.length; i++) {
        ctx.fillText(chars[i], w / 2, 62 + i * 64);
      }
    },
    aniso,
  );

  // =========================================================================
  // 8. Authentic Multi-Story Ancient Chinese Timber & Lattice Town Facade
  // =========================================================================
  const tfCanvas = document.createElement('canvas');
  tfCanvas.width = 512;
  tfCanvas.height = 256;
  const tfCtx = tfCanvas.getContext('2d')!;

  const tfeCanvas = document.createElement('canvas');
  tfeCanvas.width = 512;
  tfeCanvas.height = 256;
  const tfeCtx = tfeCanvas.getContext('2d')!;

  // Weathered plaster & dark charcoal timber base
  tfCtx.fillStyle = '#1b1920';
  tfCtx.fillRect(0, 0, 512, 256);
  tfeCtx.fillStyle = '#000000';
  tfeCtx.fillRect(0, 0, 512, 256);

  // Structural dark timber columns & horizontal floor beams
  tfCtx.fillStyle = '#120d0c';
  tfCtx.fillRect(0, 0, 512, 16);
  tfCtx.fillRect(0, 122, 512, 16);
  tfCtx.fillRect(0, 240, 512, 16);
  for (let c = 0; c <= 4; c++) {
    tfCtx.fillRect(c * 124, 0, 14, 256);
  }

  // 2 stories x 4 bays of realistic lived-in lattice windows (varied warmth + realistic unlit rooms!)
  const bayPattern = [
    [1, 0.85, 0.0, 0.95], // Upper floor: lit, cozy, unlit dark room, bright warm room
    [0.9, 1.0, 0.72, 0.0], // Lower floor: warm shopfront/living room mix
  ];
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      const litStrength = bayPattern[row][col];
      const wx = 26 + col * 124;
      const wy = row === 0 ? 30 : 152;
      const ww = 84;
      const wh = 76;

      if (litStrength > 0.05) {
        const wGrad = tfeCtx.createLinearGradient(wx, wy, wx, wy + wh);
        if ((row + col) % 3 === 0) {
          wGrad.addColorStop(0, `rgba(180, 92, 28, ${litStrength})`);
          wGrad.addColorStop(0.55, `rgba(244, 168, 76, ${litStrength})`);
          wGrad.addColorStop(1, `rgba(255, 224, 152, ${litStrength})`);
        } else if ((row + col) % 3 === 1) {
          wGrad.addColorStop(0, `rgba(165, 68, 22, ${litStrength})`);
          wGrad.addColorStop(0.6, `rgba(235, 138, 52, ${litStrength})`);
          wGrad.addColorStop(1, `rgba(255, 198, 112, ${litStrength})`);
        } else {
          wGrad.addColorStop(0, `rgba(155, 84, 34, ${litStrength})`);
          wGrad.addColorStop(0.5, `rgba(230, 176, 98, ${litStrength})`);
          wGrad.addColorStop(1, `rgba(255, 236, 184, ${litStrength})`);
        }
        tfeCtx.fillStyle = wGrad;
        tfeCtx.fillRect(wx, wy, ww, wh);
        tfCtx.fillStyle = wGrad;
        tfCtx.fillRect(wx, wy, ww, wh);
      } else {
        // Dark reflective night window
        tfCtx.fillStyle = '#0d1018';
        tfCtx.fillRect(wx, wy, ww, wh);
      }

      // Delicate carved dark wooden lattice mullions (花窗棂)
      for (const ctx of [tfCtx, tfeCtx]) {
        ctx.strokeStyle = ctx === tfeCtx ? '#000000' : '#180f0b';
        ctx.lineWidth = 4;
        ctx.strokeRect(wx, wy, ww, wh);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(wx + ww * 0.33, wy);
        ctx.lineTo(wx + ww * 0.33, wy + wh);
        ctx.moveTo(wx + ww * 0.67, wy);
        ctx.lineTo(wx + ww * 0.67, wy + wh);
        ctx.moveTo(wx, wy + wh * 0.35);
        ctx.lineTo(wx + ww, wy + wh * 0.35);
        ctx.moveTo(wx, wy + wh * 0.7);
        ctx.lineTo(wx + ww, wy + wh * 0.7);
        ctx.stroke();
      }
    }
  }

  const townFacadeAlbedo = new THREE.CanvasTexture(tfCanvas);
  townFacadeAlbedo.colorSpace = THREE.SRGBColorSpace;
  townFacadeAlbedo.anisotropy = aniso;

  const townFacadeEmissive = new THREE.CanvasTexture(tfeCanvas);
  townFacadeEmissive.colorSpace = THREE.SRGBColorSpace;
  townFacadeEmissive.anisotropy = aniso;

  // =========================================================================
  // 9. Photorealistic Spark Glow, Pyrotechnic Smoke/Mist Cloud, Snow & Sky Dome
  // =========================================================================
  const spCanvas = document.createElement('canvas');
  spCanvas.width = 128;
  spCanvas.height = 128;
  const spCtx = spCanvas.getContext('2d')!;
  const spGrad = spCtx.createRadialGradient(64, 64, 0, 64, 64, 64);
  spGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  spGrad.addColorStop(0.14, 'rgba(255, 250, 235, 0.96)');
  spGrad.addColorStop(0.36, 'rgba(255, 208, 140, 0.42)');
  spGrad.addColorStop(0.7, 'rgba(255, 145, 65, 0.08)');
  spGrad.addColorStop(1, 'rgba(255, 110, 40, 0)');
  spCtx.fillStyle = spGrad;
  spCtx.fillRect(0, 0, 128, 128);
  const sparkGlow = new THREE.CanvasTexture(spCanvas);
  sparkGlow.colorSpace = THREE.SRGBColorSpace;

  // Soft cloudy smoke / valley night mist texture
  const smCanvas = document.createElement('canvas');
  smCanvas.width = 256;
  smCanvas.height = 256;
  const smCtx = smCanvas.getContext('2d')!;
  const smImg = smCtx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const dx = (x - 128) / 128;
      const dy = (y - 128) / 128;
      const dist = Math.hypot(dx, dy);
      const radial = Math.max(0, 1 - dist);
      const n = fbm2D(x * 0.025 + 4.1, y * 0.025 + 8.3, 4);
      const alpha = Math.pow(radial, 1.75) * (0.55 + n * 0.65);
      const idx = (y * 256 + x) * 4;
      smImg.data[idx] = 255;
      smImg.data[idx + 1] = 248;
      smImg.data[idx + 2] = 238;
      smImg.data[idx + 3] = Math.min(255, Math.floor(alpha * 255));
    }
  }
  smCtx.putImageData(smImg, 0, 0);
  const smokePuff = new THREE.CanvasTexture(smCanvas);
  smokePuff.colorSpace = THREE.SRGBColorSpace;

  const snCanvas = document.createElement('canvas');
  snCanvas.width = 64;
  snCanvas.height = 64;
  const snCtx = snCanvas.getContext('2d')!;
  const snGrad = snCtx.createRadialGradient(32, 32, 0, 32, 32, 30);
  snGrad.addColorStop(0, 'rgba(248, 244, 238, 0.92)');
  snGrad.addColorStop(0.42, 'rgba(225, 228, 238, 0.42)');
  snGrad.addColorStop(1, 'rgba(200, 210, 228, 0)');
  snCtx.fillStyle = snGrad;
  snCtx.fillRect(0, 0, 64, 64);
  const snowflake = new THREE.CanvasTexture(snCanvas);
  snowflake.colorSpace = THREE.SRGBColorSpace;

  // Natural Photographed Winter Night Sky with Subtle Moonlit Clouds & Distant City Skyglow
  const skCanvas = document.createElement('canvas');
  skCanvas.width = 1024;
  skCanvas.height = 512;
  const skCtx = skCanvas.getContext('2d')!;
  const skGrad = skCtx.createLinearGradient(0, 0, 0, 512);
  skGrad.addColorStop(0, '#03050b');
  skGrad.addColorStop(0.32, '#070b16');
  skGrad.addColorStop(0.58, '#0f1422');
  skGrad.addColorStop(0.76, '#1c1824');
  skGrad.addColorStop(0.87, '#2d1c19'); // subtle authentic warm amber city-light pollution along mountain horizon
  skGrad.addColorStop(0.95, '#191114');
  skGrad.addColorStop(1, '#09090e');
  skCtx.fillStyle = skGrad;
  skCtx.fillRect(0, 0, 1024, 512);

  // Subtle realistic nocturnal clouds catching faint silver moonlight & amber city glow
  for (let i = 0; i < 42; i++) {
    const cxCloud = hash2(i, 17.3) * 1024;
    const cyCloud = 180 + hash2(i, 29.1) * 235;
    const rx = 65 + hash2(i, 41.7) * 150;
    const ry = 14 + hash2(i, 53.2) * 32;
    const isLow = cyCloud > 320;
    const cg = skCtx.createRadialGradient(cxCloud, cyCloud, 2, cxCloud, cyCloud, rx);
    if (isLow) {
      cg.addColorStop(0, 'rgba(84, 52, 42, 0.14)');
      cg.addColorStop(1, 'rgba(42, 26, 24, 0)');
    } else {
      cg.addColorStop(0, 'rgba(72, 92, 132, 0.08)');
      cg.addColorStop(1, 'rgba(20, 28, 48, 0)');
    }
    skCtx.save();
    skCtx.translate(cxCloud, cyCloud);
    skCtx.scale(1, ry / rx);
    skCtx.fillStyle = cg;
    skCtx.beginPath();
    skCtx.arc(0, 0, rx, 0, Math.PI * 2);
    skCtx.fill();
    skCtx.restore();
  }

  // Natural pinpoint winter stars (higher altitude only, subtle realistic magnitude distribution)
  for (let i = 0; i < 360; i++) {
    const x = hash2(i, 71.1) * 1024;
    const y = hash2(i, 83.7) * 270;
    const mag = Math.pow(hash2(i, 97.3), 2.4);
    const size = mag > 0.72 ? 1.5 : 0.9;
    const alpha = (0.1 + mag * 0.52) * (1 - y / 290);
    skCtx.fillStyle = `rgba(232, 240, 255, ${alpha})`;
    skCtx.fillRect(x, y, size, size);
  }
  const skyDome = new THREE.CanvasTexture(skCanvas);
  skyDome.colorSpace = THREE.SRGBColorSpace;

  return {
    courtyardAlbedo,
    courtyardRoughness,
    courtyardBump,
    courtyardPuddleAlpha,
    contactShadow,
    foliageAlbedo,
    foliageBump,
    foliageRoughness,
    roofTileAlbedo,
    roofTileBump,
    stoneCarvedAlbedo,
    stoneCarvedBump,
    barkAlbedo,
    barkBump,
    lanternSilk,
    lanternEmissive,
    fuPlaque,
    archBanner,
    coupletLeft,
    coupletRight,
    townFacadeAlbedo,
    townFacadeEmissive,
    sparkGlow,
    smokePuff,
    snowflake,
    skyDome,
    dispose: () => {
      courtyardAlbedo.dispose();
      courtyardRoughness.dispose();
      courtyardBump.dispose();
      courtyardPuddleAlpha.dispose();
      contactShadow.dispose();
      foliageAlbedo.dispose();
      foliageBump.dispose();
      foliageRoughness.dispose();
      roofTileAlbedo.dispose();
      roofTileBump.dispose();
      stoneCarvedAlbedo.dispose();
      stoneCarvedBump.dispose();
      barkAlbedo.dispose();
      barkBump.dispose();
      lanternSilk.dispose();
      lanternEmissive.dispose();
      fuPlaque.dispose();
      archBanner.dispose();
      coupletLeft.dispose();
      coupletRight.dispose();
      townFacadeAlbedo.dispose();
      townFacadeEmissive.dispose();
      sparkGlow.dispose();
      smokePuff.dispose();
      snowflake.dispose();
      skyDome.dispose();
    },
  };
}

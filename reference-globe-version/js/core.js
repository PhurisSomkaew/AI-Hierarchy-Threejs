import * as THREE from 'three';
export { THREE };

/* ---------------------------------------------------------------- palette */
/* Two skins: `anime` = daylight cel-shaded, `night` = the original dark void.
   Station code reads SK.* at BUILD time, so switching skins discards built
   stations and re-enters the chapter (see main.js setTheme). */
export const SKINS = {
  anime: {
    name: 'anime', toon: true,
    bg: 0xC6E8EE,
    skyTop: 0x3F9FD8, skyMid: 0xA6DDEA, skyLow: 0xF7EBD4,
    sun: 0xFFF6DC, sunPos: [130, 160, 95],
    hemiSky: 0xD2EDF4, hemiGround: 0xC8B597, hemiInt: .95, keyInt: 1.45,
    ground: 0xE7DECB, groundLine: 0xCCBDA3,
    fog: [150, 520],
    ai: 0x2F72C8, ml: 0x14957C, dl: 0x4E9B36, ga: 0xD08E14, llm: 0x6F52CC,
    cardFill: 'rgba(253,248,239,.98)', cardFillAlt: 'rgba(243,234,218,.98)',
    cardBorder: 'rgba(38,46,60,.85)', cardBorderSoft: 'rgba(38,46,60,.28)',
    ink: '#222A38', ink2: '#4A5466', ink3: '#7C8698',
    stand: 0xD8CAB3, standDark: 0xBCAA8E,
    bad: '#C93D28', ok: '#0E8F64', warm: '#C07610',
    dust: 0xFFFFFF, dustSize: .5, dustOpacity: .55,
    glowOpacity: .3, wireOpacity: 0, shellOpacity: .1, ringOpacity: .9
  },
  night: {
    name: 'night', toon: false,
    bg: 0x07080B,
    skyTop: 0x07080B, skyMid: 0x0A0D14, skyLow: 0x10141D,
    sun: 0xDCE6FF, sunPos: [14, 26, 20],
    hemiSky: 0x9FB6E0, hemiGround: 0x0A0C12, hemiInt: .55, keyInt: .5,
    ground: 0x080A0E, groundLine: 0x1B2130,
    fog: [50, 270],
    ai: 0x4F8FE0, ml: 0x3FC3A6, dl: 0x5CB85C, ga: 0xBFC94F, llm: 0x8B7BE8,
    cardFill: 'rgba(15,18,26,.94)', cardFillAlt: 'rgba(20,24,33,.96)',
    cardBorder: 'rgba(255,255,255,.17)', cardBorderSoft: 'rgba(255,255,255,.12)',
    ink: '#E9EBF2', ink2: '#A7ADBD', ink3: '#6E7488',
    stand: 0x161A24, standDark: 0x0D1017,
    bad: '#E58166', ok: '#3FC3A6', warm: '#E8A33D',
    dust: 0x9FB0D8, dustSize: .22, dustOpacity: .45,
    glowOpacity: 1, wireOpacity: 1, shellOpacity: .04, ringOpacity: .55
  }
};
export const SK = Object.assign({}, SKINS.anime);
export const COL = {
  get bg() { return SK.bg; },
  get ai() { return SK.ai; }, get ml() { return SK.ml; }, get dl() { return SK.dl; },
  get ga() { return SK.ga; }, get llm() { return SK.llm; },
  get ink() { return SK.ink; }, get ink2() { return SK.ink2; }, get ink3() { return SK.ink3; },
  get bad() { return SK.bad; }, get ok() { return SK.ok; }, get warm() { return SK.warm; }
};
export function setSkin(name) {
  Object.assign(SK, SKINS[name] || SKINS.anime);
  document.body.classList.toggle('skin-night', SK.name === 'night');
  return SK;
}
export const hex = n => typeof n === 'string' ? n : '#' + (n >>> 0).toString(16).padStart(6, '0');
const num = c2 => typeof c2 === 'string' ? parseInt(c2.replace('#', ''), 16) : c2;
const mix = (c2, t2, k) => {
  const a = num(c2), b = num(t2);
  const r = Math.round((a >> 16 & 255) + ((b >> 16 & 255) - (a >> 16 & 255)) * k);
  const g = Math.round((a >> 8 & 255) + ((b >> 8 & 255) - (a >> 8 & 255)) * k);
  const bl = Math.round((a & 255) + ((b & 255) - (a & 255)) * k);
  return (r << 16) | (g << 8) | bl;
};
export const darken = (c2, k) => mix(c2, 0x000000, k);
export const lighten = (c2, k) => mix(c2, 0xFFFFFF, k);
/* translucent wash of an accent, tuned per skin (paper needs more punch) */
export function rgba(c2, a) {
  const n = num(c2);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
}
export const wash = (c2, night, day) => rgba(c2, SK.toon ? (day ?? night * 1.5) : night);
/* accent used as TEXT: pale on the dark skin, deepened on paper */
export const accentInk = c2 => hex(SK.toon ? darken(c2, .22) : lighten(c2, .55));

/* WCAG relative luminance + contrast, so text colours can be SOLVED rather than guessed */
const lum = c2 => {
  const n = num(c2), ch = [n >> 16 & 255, n >> 8 & 255, n & 255].map(v => {
    const s = v / 255;
    return s <= .03928 ? s / 12.92 : Math.pow((s + .055) / 1.055, 2.4);
  });
  return .2126 * ch[0] + .7152 * ch[1] + .0722 * ch[2];
};
export const contrast = (a, b) => {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
};
/* darken an accent just until it clears `target` against the paper it sits on.
   On the night skin the accents already pass, so they are returned untouched. */
export function onPaper(c2, bg, target = 4.6) {
  if (!SK.toon) return hex(c2);
  const ground = bg ?? 0xFDF8EF;
  let out = num(c2);
  for (let i = 0; i < 24 && contrast(out, ground) < target; i++) out = darken(out, .06);
  return hex(out);
}

/* cel-shading: a 3-step ramp turns directional light into flat poster bands */
let _ramp = null;
export function ramp() {
  if (_ramp) return _ramp;
  const d = new Uint8Array([98, 170, 234, 255]);
  _ramp = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat);
  _ramp.minFilter = _ramp.magFilter = THREE.NearestFilter;
  _ramp.needsUpdate = true;
  return _ramp;
}
/* solid surface for the active skin */
export function solid(color, opt = {}) {
  return SK.toon
    ? new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: ramp() }, opt))
    : new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .6, metalness: .25 }, opt));
}
/* anime ink outline: a slightly larger back-facing shell wrapped around a mesh */
export function inked(mesh, thickness = .04, color = 0x232B38) {
  if (!SK.toon) return mesh;
  const o = new THREE.Mesh(mesh.geometry, new THREE.MeshBasicMaterial({ color, side: THREE.BackSide }));
  o.position.copy(mesh.position);
  o.rotation.copy(mesh.rotation);
  o.scale.copy(mesh.scale).multiplyScalar(1 + thickness);
  o.userData.noFit = true;
  const g = new THREE.Group();
  g.add(o, mesh);
  return g;
}
export const TH = '"IBM Plex Sans Thai","IBM Plex Sans",sans-serif';
export const MONO = '"IBM Plex Mono",monospace';
export const font = (w, s, mono) => `${w} ${s}px ${mono ? MONO : TH}`;

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (k, dt) => 1 - Math.exp(-k * dt);
export const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/* ------------------------------------------------------------- 2d surface */
export class Surface {
  constructor(w, h, dpr = 2) {
    this.w = w; this.h = h;
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(w * dpr)); c.height = Math.max(2, Math.round(h * dpr));
    this.canvas = c;
    this.ctx = c.getContext('2d');
    this.ctx.scale(dpr, dpr);
    this.tex = new THREE.CanvasTexture(c);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 8;
  }
  clear() { this.ctx.clearRect(0, 0, this.w, this.h); }
  done() { this.tex.needsUpdate = true; }
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const par of String(text).split('\n')) {
    if (par === '') { out.push(''); continue; }
    const chunks = par.match(/[^\s]+\s*/g) || [];
    let line = '';
    for (const ch of chunks) {
      const test = line + ch;
      if (ctx.measureText(test).width <= maxW) { line = test; continue; }
      if (line) { out.push(line.trimEnd()); line = ''; }
      if (ctx.measureText(ch).width <= maxW) { line = ch; continue; }
      let cur = '';
      for (const c of ch) {
        if (cur && ctx.measureText(cur + c).width > maxW) { out.push(cur); cur = ''; }
        cur += c;
      }
      line = cur;
    }
    if (line) out.push(line.trimEnd());
  }
  return out;
}

/* ------------------------------------------------------------------ cards */
/* a flat 3d "card" drawn on canvas — the shared UI atom of the whole world */
export function makeCard(opt) {
  const o = Object.assign({
    w: 4, h: 2, px: 90, pad: .3, radius: .26,
    fill: null, border: null, accent: hex(COL.ai),
    bar: false, kicker: '', title: '', titleSize: .4, titleWeight: 600,
    sub: '', body: '', bodySize: .29, foot: '', align: 'left', mono: false, glow: 0,
    titleColor: null, bodyColor: null, valign: 'top'
  }, opt);
  /* resolve skin-dependent defaults at build time */
  if (o.fill == null) o.fill = SK.cardFill;
  if (o.border == null) o.border = SK.cardBorder;
  if (o.titleColor == null) o.titleColor = SK.ink;
  if (o.bodyColor == null) o.bodyColor = SK.ink2;
  o.shadow = SK.toon && o.fill !== 'none';

  const S = new Surface(o.w * o.px, o.h * o.px);
  const geo = new THREE.PlaneGeometry(o.w, o.h);
  const mat = new THREE.MeshBasicMaterial({ map: S.tex, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.userData.opt = o;

  function paint() {
    const u = o.px, ctx = S.ctx, W = S.w, H = S.h;
    S.clear();
    if (o.shadow) {
      roundRect(ctx, 5, 7, W - 6, H - 6, o.radius * u);
      ctx.fillStyle = 'rgba(42,50,64,.26)'; ctx.fill();
    }
    if (o.glow > 0) {
      ctx.save();
      ctx.shadowColor = o.accent; ctx.shadowBlur = 26 * o.glow;
      roundRect(ctx, 3, 3, W - 6, H - 6, o.radius * u); ctx.fillStyle = o.fill; ctx.fill();
      ctx.restore();
    }
    if (o.fill !== 'none') {
      roundRect(ctx, 1.5, 1.5, W - 3, H - 3, o.radius * u);
      ctx.fillStyle = o.fill; ctx.fill();
    }
    if (o.border !== 'none') {
      roundRect(ctx, 1.5, 1.5, W - 3, H - 3, o.radius * u);
      ctx.strokeStyle = o.border; ctx.lineWidth = SK.toon ? 3.4 : 2.4; ctx.stroke();
    }
    const pad = o.pad * u;
    let x = pad, aw = W - pad * 2;
    ctx.textAlign = o.align;
    if (o.align === 'center') x = W / 2; else if (o.align === 'right') x = W - pad;

    /* measure block height for vertical centring */
    const blocks = [];
    if (o.bar) blocks.push({ t: 'bar', h: .16 * u });
    if (o.kicker) blocks.push({ t: 'kicker', h: .3 * u, lines: [o.kicker] });
    if (o.title) {
      ctx.font = font(o.titleWeight, o.titleSize * u, o.mono);
      const L = wrapLines(ctx, o.title, aw);
      blocks.push({ t: 'title', h: L.length * o.titleSize * 1.42 * u, lines: L });
    }
    if (o.sub) {
      ctx.font = font(400, .24 * u, true);
      const L = wrapLines(ctx, o.sub, aw);
      blocks.push({ t: 'sub', h: L.length * .24 * 1.5 * u + .05 * u, lines: L });
    }
    if (o.body) {
      ctx.font = font(400, o.bodySize * u, o.mono);
      const L = wrapLines(ctx, o.body, aw);
      blocks.push({ t: 'body', h: L.length * o.bodySize * 1.6 * u + .09 * u, lines: L });
    }
    if (o.foot) {
      ctx.font = font(500, .23 * u, true);
      blocks.push({ t: 'foot', h: .34 * u, lines: [o.foot] });
    }
    const total = blocks.reduce((s, b) => s + b.h, 0);
    let y = pad;
    if (o.valign === 'middle') y = Math.max(pad, (H - total) / 2);
    else if (o.valign === 'bottom') y = Math.max(pad, H - pad - total);

    for (const b of blocks) {
      if (b.t === 'bar') {
        const bw = .5 * u, bh = .055 * u;
        const bx = o.align === 'center' ? (W - bw) / 2 : (o.align === 'right' ? W - pad - bw : pad);
        roundRect(ctx, bx, y, bw, bh, bh / 2); ctx.fillStyle = o.accent; ctx.fill();
        y += b.h;
      } else if (b.t === 'kicker') {
        ctx.font = font(500, .2 * u, true);
        ctx.fillStyle = o.accent;
        ctx.save(); ctx.letterSpacing = (.03 * u) + 'px';
        ctx.fillText(b.lines[0], x, y + .2 * u); ctx.restore();
        y += b.h;
      } else if (b.t === 'title') {
        ctx.font = font(o.titleWeight, o.titleSize * u, o.mono);
        ctx.fillStyle = o.titleColor;
        b.lines.forEach((l, i) => ctx.fillText(l, x, y + (i + .85) * o.titleSize * 1.42 * u));
        y += b.h;
      } else if (b.t === 'sub') {
        ctx.font = font(400, .24 * u, true);
        ctx.fillStyle = o.accent;
        b.lines.forEach((l, i) => ctx.fillText(l, x, y + (i + .95) * .24 * 1.5 * u));
        y += b.h;
      } else if (b.t === 'body') {
        ctx.font = font(400, o.bodySize * u, o.mono);
        ctx.fillStyle = o.bodyColor;
        b.lines.forEach((l, i) => ctx.fillText(l, x, y + .09 * u + (i + .9) * o.bodySize * 1.6 * u));
        y += b.h;
      } else if (b.t === 'foot') {
        ctx.font = font(500, .23 * u, true);
        ctx.fillStyle = SK.ink3;
        ctx.fillText(b.lines[0], x, y + .24 * u);
        y += b.h;
      }
    }
    S.done();
  }

  mesh.set = next => { Object.assign(o, next); paint(); return mesh; };
  mesh.surface = S;
  paint();
  return mesh;
}

/* ------------------------------------------------------------- 3d labels  */
export function makeLabel(text, opt = {}) {
  const o = Object.assign({ size: .6, color: COL.ink, weight: 600, mono: false, px: 80, glow: 0, align: 'center' }, opt);
  const probe = document.createElement('canvas').getContext('2d');
  let S, sprite;

  function build(t) {
    probe.font = font(o.weight, o.size * o.px, o.mono);
    const lines = String(t).split('\n');
    const w = Math.max(...lines.map(l => probe.measureText(l).width)) + o.size * o.px * 0.9;
    const lh = o.size * 1.36 * o.px;
    const h = lh * lines.length + o.size * o.px * .5;
    if (!S || S.w !== w / 1 || S.h !== h / 1) {
      S = new Surface(w, h);
      if (sprite) { sprite.material.map = S.tex; }
    }
    S.clear();
    const ctx = S.ctx;
    ctx.font = font(o.weight, o.size * o.px, o.mono);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (o.glow) { ctx.shadowColor = o.color; ctx.shadowBlur = 18 * o.glow; }
    ctx.fillStyle = o.color;
    lines.forEach((l, i) => ctx.fillText(l, S.w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh));
    S.done();
    return { w: w / o.px, h: h / o.px };
  }

  const dim = build(text);
  const mat = new THREE.SpriteMaterial({ map: S.tex, transparent: true, depthWrite: false });
  sprite = new THREE.Sprite(mat);
  sprite.scale.set(dim.w, dim.h, 1);
  sprite.set = t => { const d = build(t); sprite.material.map = S.tex; sprite.scale.set(d.w, d.h, 1); return sprite; };
  return sprite;
}

/* ------------------------------------------------------------ primitives  */
export function tube(a, b, r, color, opacity = 1, additive = false) {
  const geo = new THREE.CylinderGeometry(r, r, 1, 8, 1, true);
  geo.translate(0, .5, 0);
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
  });
  const m = new THREE.Mesh(geo, mat);
  m.aim = (p, q) => {
    const d = new THREE.Vector3().subVectors(q, p);
    m.position.copy(p);
    m.scale.set(1, Math.max(.0001, d.length()), 1);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    return m;
  };
  if (a && b) m.aim(a, b);
  return m;
}

export function glowSprite(size, color, opacity = .8) {
  const S = new Surface(128, 128, 1);
  const g = S.ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(.25, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  S.ctx.fillStyle = g; S.ctx.fillRect(0, 0, 128, 128); S.done();
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: S.tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  sp.scale.set(size, size, 1);
  sp.userData.noFit = true;
  return sp;
}

export function floorGlow(r, color, opacity = .3) {
  const S = new Surface(256, 256, 1);
  const g = S.ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,.85)');
  g.addColorStop(.45, 'rgba(255,255,255,.22)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  S.ctx.fillStyle = g; S.ctx.fillRect(0, 0, 256, 256); S.done();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({
    map: S.tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  m.rotation.x = -Math.PI / 2;
  m.userData.noFit = true;
  return m;
}

export function ringMesh(r, thick, color, opacity = .7) {
  const m = new THREE.Mesh(
    new THREE.TorusGeometry(r, thick, 6, Math.min(256, Math.max(48, Math.round(r * 8)))),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

export function dashRing(r, color, opacity = .5, seg = 60) {
  const g = new THREE.Group();
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(r * Math.PI * 2 / seg * .55, .02, .09),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
    );
    box.position.set(Math.cos(a0) * r, 0, Math.sin(a0) * r);
    box.rotation.y = -a0;
    g.add(box);
  }
  return g;
}

/* pretty pedestal used under most props */
export function pedestal(w, d, color, h = 1.05) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, .16, d), solid(SK.stand));
  top.position.y = h;
  const base = new THREE.Mesh(new THREE.BoxGeometry(w * .82, h, d * .82), solid(SK.standDark));
  base.position.y = h / 2;
  const edge = new THREE.Mesh(new THREE.BoxGeometry(w + .04, .025, d + .04),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: SK.toon ? .95 : .5 }));
  edge.position.y = h + .09;
  g.add(inked(top, .018), inked(base, .014), edge, floorGlow(w * .9, color, SK.toon ? .1 : .16));
  return g;
}

/* ---------------------------------------------------------------- engine  */
export function initEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(SK.bg, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(SK.bg, SK.fog[0], SK.fog[1]);

  const camera = new THREE.PerspectiveCamera(58, 1, .1, 600);
  camera.rotation.order = 'YXZ';

  scene.add(new THREE.HemisphereLight(SK.hemiSky, SK.hemiGround, SK.hemiInt));
  const key = new THREE.DirectionalLight(SK.sun, SK.keyInt);
  key.position.set(...SK.sunPos);
  scene.add(key);

  /* The STYLESHEET owns the canvas CSS box (#gl{position:fixed;inset:0;width:100%;height:100%}),
     so three.js must never write an inline size: a single bad measurement would otherwise
     become an inline width that permanently overrides CSS and blanks the page. Here we only
     ever set the drawing buffer, measured from the element's own CSS box. */
  canvas.style.removeProperty('width');
  canvas.style.removeProperty('height');
  let lastW = 0, lastH = 0;
  function resize() {
    const w = canvas.clientWidth || document.documentElement.clientWidth || innerWidth;
    const h = canvas.clientHeight || document.documentElement.clientHeight || innerHeight;
    if (w < 2 || h < 2) return;
    if (w === lastW && h === lastH) return;
    lastW = w; lastH = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 780 ? 70 : 58;
    camera.updateProjectionMatrix();
  }
  resize();
  addEventListener('resize', resize);
  addEventListener('load', resize);
  setTimeout(resize, 0);
  setTimeout(resize, 300);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(canvas);
  return { renderer, scene, camera, resize };
}

/* ---------------------------------------------------------------- world   */
/* soft cotton cloud billboard */
function cloudTex() {
  const S = new Surface(256, 128, 1);
  const ctx = S.ctx;
  const puff = (x, y, r) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,.98)');
    g.addColorStop(.55, 'rgba(255,255,255,.82)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  };
  puff(96, 78, 44); puff(140, 70, 52); puff(184, 82, 38); puff(66, 86, 32); puff(120, 56, 34);
  S.done();
  return S.tex;
}

/* nested shells + floor rings — the architecture of the world */
export function buildWorld(scene, shells) {
  const extras = [];

  /* ---- sky: a vertical gradient dome, drawn behind everything ---- */
  if (SK.toon) {
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(540, 32, 20),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: {
          top: { value: new THREE.Color(SK.skyTop) },
          mid: { value: new THREE.Color(SK.skyMid) },
          low: { value: new THREE.Color(SK.skyLow) }
        },
        vertexShader: `varying float h;
          void main(){ vec4 w = modelMatrix * vec4(position,1.); h = normalize(w.xyz).y;
          gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `varying float h; uniform vec3 top, mid, low;
          void main(){ float t = clamp(h,-1.,1.);
            vec3 c = t > 0.06 ? mix(mid, top, smoothstep(0.06,0.78,t))
                              : mix(low, mid, smoothstep(-0.32,0.06,t));
            gl_FragColor = vec4(c,1.); }`
      })
    );
    sky.userData.noFit = true;
    scene.add(sky);

    /* ---- sun + clouds ---- */
    const sun = glowSprite(120, 0xFFF3CE, .5);
    sun.position.set(...SK.sunPos.map(v => v * 2.4));
    sun.userData.noFit = true;
    scene.add(sun);

    const tex = cloudTex();
    const clouds = [];
    for (let i = 0; i < 34; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: .5 + Math.random() * .35, depthWrite: false, fog: false
      }));
      const rr = 200 + Math.random() * 300, th = Math.random() * Math.PI * 2;
      const sc = 60 + Math.random() * 110;
      s.scale.set(sc * 2, sc, 1);
      s.position.set(Math.cos(th) * rr, 55 + Math.random() * 130, Math.sin(th) * rr);
      s.userData.noFit = true;
      scene.add(s);
      clouds.push({ s, th, rr, sp: .004 + Math.random() * .01 });
    }
    extras.push({ tick: (dt, t) => clouds.forEach(c2 => {
      c2.th += c2.sp * dt;
      c2.s.position.x = Math.cos(c2.th) * c2.rr;
      c2.s.position.z = Math.sin(c2.th) * c2.rr;
    })});
  }

  /* ---- the nested layers ---- */
  const domes = shells.map((s, i) => {
    const g = new THREE.Group();
    const geo = new THREE.IcosahedronGeometry(s.r, s.det ?? 2);
    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(geo),
      new THREE.LineBasicMaterial({ color: s.c, transparent: true, opacity: s.o, depthWrite: false })
    );
    const shellMat = new THREE.MeshBasicMaterial({
      color: s.c, transparent: true, opacity: SK.shellOpacity, side: THREE.BackSide, depthWrite: false
    });
    const fill = new THREE.Mesh(geo, shellMat);
    g.add(wire, fill);
    g.userData = {
      r: s.r, o: s.o * SK.wireOpacity, fb: SK.shellOpacity,
      wire: wire.material, fill: shellMat, spin: .008 + i * .003
    };
    g.userData.noFit = true;
    scene.add(g);

    /* the layer boundary, painted on the ground like a running track */
    const ring = ringMesh(s.r, SK.toon ? .16 : .07, s.c, SK.ringOpacity);
    ring.position.y = .02; ring.userData.noFit = true;
    scene.add(ring);
    const ring2 = dashRing(s.r - (SK.toon ? 1.3 : .55), s.c, SK.toon ? .55 : .3, Math.round(s.r * 2.2));
    ring2.position.y = .03; ring2.userData.noFit = true;
    scene.add(ring2);
    return g;
  });

  /* ---- ground ---- */
  const grid = new THREE.GridHelper(900, SK.toon ? 90 : 180, SK.groundLine, SK.groundLine);
  grid.material.transparent = true;
  grid.material.opacity = SK.toon ? .5 : .5;
  grid.userData.noFit = true;
  scene.add(grid);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400),
    SK.toon ? new THREE.MeshToonMaterial({ color: SK.ground, gradientMap: ramp() })
            : new THREE.MeshStandardMaterial({ color: SK.ground, roughness: .95, metalness: .05 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.05;
  floor.userData.noFit = true;
  scene.add(floor);

  /* ---- floating motes: pollen in daylight, dust at night ---- */
  const N = SK.toon ? 900 : 2000, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const rr = 8 + Math.pow(Math.random(), .55) * 220;
    const th = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(th) * rr;
    pos[i * 3 + 1] = Math.random() * 62;
    pos[i * 3 + 2] = Math.sin(th) * rr;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({
    color: SK.dust, size: SK.dustSize, transparent: true, opacity: SK.dustOpacity, depthWrite: false
  }));
  dust.userData.noFit = true;
  scene.add(dust);

  return { domes, dust, extras };
}

/* wait for the Thai + mono webfonts before any canvas text is rasterised */
export async function fontsReady() {
  const want = ['400 40px ' + TH, '500 40px ' + TH, '600 40px ' + TH, '700 40px ' + TH, '400 40px ' + MONO, '500 40px ' + MONO];
  try {
    await Promise.all(want.map(f => document.fonts.load(f, 'กขคABC0123')));
    await document.fonts.ready;
  } catch (e) { /* non-fatal */ }
}

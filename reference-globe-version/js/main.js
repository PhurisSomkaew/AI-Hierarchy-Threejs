import {
  THREE, COL, SK, setSkin, hex, initEngine, buildWorld, fontsReady, makeCard, makeLabel, glowSprite, floorGlow, dashRing, tube, solid, inked, onPaper, clamp, lerp, damp, sstep, rgba, wash, accentInk
} from './core.js';
import { createUI } from './ui.js';
import { makeRuleMachine, makeSortTable } from './stations-1.js';
import { makeWeightRoom, makeForgeryLab } from './stations-2.js';
import { makeTokenGame, makeAttention, makeLifecycle } from './stations-3.js';

/* the skin is chosen before the engine boots, because every material, label and
   card bakes its colours at build time. Switching skins reloads the page. */
const SKIN_KEY = 'aiworld.skin', CH_KEY = 'aiworld.chapter';
let savedSkin = 'anime', resumeCh = -1;
try {
  const s = localStorage.getItem(SKIN_KEY);
  if (s === 'night' || s === 'anime') savedSkin = s;
  const r = parseInt(localStorage.getItem(CH_KEY), 10);
  if (r >= 0) resumeCh = r;
  localStorage.removeItem(CH_KEY);
} catch (e) { }
setSkin(savedSkin);

const canvas = document.getElementById('gl');
const { renderer, scene, camera, resize } = initEngine(canvas);
const ui = createUI();

/* ------------------------------------------------------------ the world  */
const SHELLS = [
  { r: 150, c: COL.ai, o: .16, det: 2, en: 'Artificial Intelligence', th: 'ชั้นที่ 1 · ทำตามกฎที่คนเขียนไว้' },
  { r: 112, c: COL.ml, o: .18, det: 2, en: 'Machine Learning', th: 'ชั้นที่ 2 · แก้กฎของตัวเองได้' },
  { r: 76, c: COL.dl, o: .20, det: 2, en: 'Deep Learning', th: 'ชั้นที่ 3 · หาจุดสังเกตเอง' },
  { r: 42, c: COL.ga, o: .26, det: 2, en: 'Generative AI', th: 'ชั้นที่ 4 · สร้างของใหม่ได้' }
];
const { domes, extras } = buildWorld(scene, SHELLS);
const gates = [];

/* gates you literally walk through, on the way in */
SHELLS.forEach(s => {
  const arch = new THREE.Mesh(new THREE.TorusGeometry(9, SK.toon ? .3 : .12, 8, 96),
    SK.toon ? solid(s.c) : new THREE.MeshBasicMaterial({ color: s.c, transparent: true, opacity: .5 }));
  arch.position.set(0, 0, s.r);
  arch.userData.noFit = true;
  scene.add(SK.toon ? inked(arch, .06) : arch);
  const gz = floorGlow(11, s.c, SK.toon ? .16 : .3);
  gz.position.set(0, .04, s.r);
  scene.add(gz);
  const en = makeLabel(s.en, { size: 2.6, color: hex(s.c), weight: 700, glow: .5 });
  en.position.set(0, 25.5, s.r);
  const th = makeLabel(s.th, { size: 1.2, color: COL.ink2, weight: 400 });
  th.position.set(0, 22.6, s.r);
  scene.add(en, th);
  gates.push({ en, th, pos: new THREE.Vector3(0, 3, s.r) });
});

/* ------------------------------------------------------- chapter table   */
const env = {
  ui,
  reveal(spec) {
    const c = CH[active];
    ui.reveal(Object.assign({}, spec, { onNext: () => { ui.hideReveal(); next(); } }));
    ui.markDone(active);
    done.add(active);
  }
};

const CH = [
  {
    no: 'บทที่ 01', name: 'กฎที่คนเขียนไว้ล่วงหน้า', en: 'AI', tease: 'Rule-Based — ทำตามเงื่อนไขที่คนกำหนด',
    css: hex(COL.ai), col: COL.ai, at: [0, 0, 126], view: [0, -.02], make: makeRuleMachine,
    guide: [-7.4, 7.6],
    lines: {
      open: ['AI ยุคแรกทำงานแบบ Rule-Based ครับ คือทำตามเงื่อนไขที่คนเขียนไว้ล่วงหน้า ตรงเงื่อนไขก็ทำได้ ไม่ตรงก็ทำไม่ได้', 'Guide'],
      human: ['ข้อจำกัดของ Rule-Based คือเจอของที่ไม่มีในเงื่อนไขแล้วไปต่อไม่ได้ ต้องรอคนมาเขียนเงื่อนไขเพิ่มทุกครั้ง', 'Guide · ข้อจำกัด']
    }
  },
  {
    no: 'บทที่ 02', name: 'เครื่องปรับกฎเองจากข้อมูล', en: 'ML', tease: 'Machine Learning — เรียนจากข้อมูลแล้วแก้กฎเอง',
    css: hex(COL.ml), col: COL.ml, at: [0, 0, 92], view: [0, -.66], make: makeSortTable,
    guide: [-9.9, 8.2],
    lines: {
      open: ['Machine Learning คือเครื่องที่หากฎจากข้อมูลเองครับ เริ่มจากให้คุณลากเส้นแบ่งกลุ่มข้อมูลด้วยมือก่อน', 'Guide'],
      human: ['จุดต่างจาก Rule-Based คือพอข้อมูลใหม่เข้ามา มันขยับเส้นแบ่งของตัวเองได้ ไม่ต้องรอคนมาแก้กฎ', 'Guide · จุดต่าง']
    }
  },
  {
    no: 'บทที่ 03', name: 'โครงข่ายประสาทเทียม', en: 'DL', tease: 'Neural Network, Weight และ Backpropagation',
    css: hex(COL.dl), col: COL.dl, at: [0, 0, 58], view: [0, .02], make: makeWeightRoom,
    guide: [-12.9, 6.2],
    lines: {
      open: ['ข้างใน Neural Network ไม่มีความคิดครับ มีแต่ตัวเลขชื่อ Weight ที่บอกว่าข้อมูลแต่ละอย่างสำคัญแค่ไหน', 'Guide'],
      human: ['Deep Learning ต่างจาก ML ตรงที่ไม่ต้องมีคนบอกว่าให้ดูจากอะไร มันหาจุดสังเกต (Feature) ด้วยตัวเอง', 'Guide · จุดต่าง']
    }
  },
  {
    no: 'บทที่ 04', name: 'Generative AI สร้างของใหม่ได้', en: 'GenAI', tease: 'Generator กับ Discriminator ไล่กวดกัน',
    css: hex(COL.ga), col: COL.ga, at: [0, 0, 26], view: [0, .02], make: makeForgeryLab,
    guide: [-10.4, 6.6],
    lines: {
      open: ['รอบนี้คุณจะได้เป็น Generator คือตัวที่สร้างของขึ้นมาใหม่ แล้วส่งไปให้ Discriminator ตรวจว่าจริงหรือปลอม', 'Guide'],
      human: ['สองตัวนี้ฝึกกันเอง Generator สร้างให้เนียนขึ้น Discriminator ก็ตรวจได้คมขึ้น สุดท้ายตัวที่เอาไปใช้งานคือ Discriminator', 'Guide · จุดต่าง']
    }
  },
  {
    no: 'บทที่ 05', name: 'LLM ทายคำถัดไปทีละคำ', en: 'LLM', tease: 'Token, ความน่าจะเป็น และการทายคำต่อไป',
    css: hex(COL.llm), col: COL.llm, at: [-24, 0, 2], view: [0, .03], make: makeTokenGame,
    guide: [-8.6, 6.6],
    lines: {
      open: ['LLM ทำอยู่เรื่องเดียวครับ คือดูข้อความที่มีแล้วคำนวณว่าคำถัดไปควรเป็นคำอะไร ลองเลือกแทนมันดู', 'Guide'],
      human: ['คำตอบของ LLM คือคำที่ความน่าจะเป็นสูงสุด ไม่ใช่ความจริงที่ถูกเก็บไว้ เลยมีโอกาสตอบผิดได้', 'Guide · จุดสำคัญ']
    }
  },
  {
    no: 'บทที่ 06', name: 'Attention จับความสัมพันธ์ของคำ', en: 'Attention', tease: 'หัวใจของ Transformer ที่ LLM ใช้',
    css: hex(COL.llm), col: COL.llm, at: [24, 0, 2], view: [0, .02], make: makeAttention,
    guide: [-11.0, 6.2],
    lines: {
      open: ['Attention คือกลไกที่คำนวณว่าคำไหนเกี่ยวกับคำไหนครับ ลองโยงเองดูว่า “มัน” ในประโยคนี้หมายถึงคำใด', 'Guide'],
      human: ['ตัวเลขที่ขึ้นบนการ์ดคือน้ำหนัก Attention ยิ่งสูงยิ่งเกี่ยวกันมาก นี่คือหัวใจของ Transformer ที่ LLM ใช้', 'Guide · จุดสำคัญ']
    }
  },
  {
    no: 'บทที่ 07', name: 'โมเดลถูกเทรนมายังไง', en: 'Lifecycle', tease: 'Pretrain → Fine-Tuning → RL → In-Context',
    css: hex(COL.llm), col: COL.llm, at: [0, 0, -28], view: [0, .02], make: makeLifecycle,
    guide: [-9.6, 7.2],
    lines: {
      open: ['โมเดลหนึ่งตัวผ่านการเทรน 4 ขั้นครับ ลองป้อนตามลำดับแล้วดูว่าคำตอบมันเปลี่ยนไปยังไง', 'Guide'],
      human: ['สามขั้นแรกเกิดที่ผู้พัฒนาโมเดล ขั้นที่สี่ In-Context Learning คือขั้นเดียวที่เราทำเองได้ตอนใช้งาน', 'Guide · จุดสำคัญ']
    }
  },
  {
    no: 'สรุป', name: 'Hierarchy of AI', en: 'Summary', tease: 'ภาพรวมว่าแต่ละชั้นเพิ่มอะไรเข้ามา',
    css: COL.ink2, col: 0xA7ADBD, at: [0, 0, 0], view: [0, 0], make: makeFinale,
    guide: [-10.4, 6.2],
    lines: {
      open: ['มาถึงใจกลางแล้วครับ ทั้งสี่ชั้นที่เดินผ่านมาซ้อนกันอยู่แบบนี้', 'Guide'],
      human: ['ชั้นในสุดไม่ได้มาแทนชั้นนอก แต่เป็นชั้นนอกที่ถูกเพิ่มความสามารถเข้าไปครับ', 'Guide']
    }
  }
];

const done = new Set();
let active = -1, station = null;

/* ---------------------------------------------------------- the finale   */
function makeFinale() {
  const g = new THREE.Group();
  const pick = [];
  const LAY = [
    { r: 4.6, c: COL.ai, t: 'Artificial Intelligence (AI)', th: 'ทำตามกฎที่คนเขียนไว้' },
    { r: 3.5, c: COL.ml, t: 'Machine Learning (ML)', th: '+ แก้กฎเองได้จากข้อมูลใหม่' },
    { r: 2.4, c: COL.dl, t: 'Deep Learning (DL)', th: '+ หาจุดสังเกตเองไม่ต้องรอคนบอก' },
    { r: 1.3, c: COL.ga, t: 'Generative AI', th: '+ สร้างของใหม่ได้ (รวมถึง LLM)' }
  ];
  const cx = -4.4, cy = 6.6;
  const parts = LAY.map((s, i) => {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(s.r, 64),
      new THREE.MeshBasicMaterial({ color: s.c, transparent: true, opacity: .1, blending: THREE.AdditiveBlending, depthWrite: false }));
    disc.position.set(cx, cy, -.02 * i);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(s.r, .045, 6, 96),
      new THREE.MeshBasicMaterial({ color: s.c, transparent: true, opacity: .95 }));
    ring.position.set(cx, cy, .01);
    g.add(disc, ring);
    const lb = makeLabel(s.t.split(' (')[0], { size: .34, color: hex(s.c), weight: 600 });
    lb.position.set(cx, cy + s.r - .38, .2);
    g.add(lb);
    const card = makeCard({
      w: 7.8, h: 1.4, px: 110, radius: .2, valign: 'middle', accent: hex(s.c),
      fill: SK.cardFill, border: SK.cardBorderSoft,
      title: s.th, titleSize: .3, sub: s.t
    });
    card.position.set(4.6, 10.6 - i * 1.72, 0);
    g.add(card);
    return { ring, disc };
  });
  const t = makeLabel('Hierarchy of AI', { size: .95, color: COL.ink, weight: 700 });
  t.position.set(.6, 14.1, 0);
  const t2 = makeLabel('ชั้นในสุดไม่ได้มาแทนชั้นนอก — มันคือชั้นนอกที่ถูกเติมของเข้าไป', { size: .38, color: COL.ink3, weight: 400 });
  t2.position.set(.6, 13.2, 0);
  g.add(t, t2);

  return {
    group: g, pickables: pick,
    enter() {
      ui.panel({
        eyebrow: 'จบทัวร์ · สรุป',
        title: 'ชั้นในสุดไม่ได้มาแทนชั้นนอก',
        quote: 'ทั้ง 4 ชั้นที่คุณเดินผ่านมา จริง ๆ แล้วคือ<b>คนพยายามสอนเครื่องให้ตัดสินใจแทนเรา</b>ทีละนิด — จากเขียนกฎให้ทุกข้อ มาเป็นให้มันหากฎเอง จนสุดท้ายมันสร้างของใหม่ได้',
        who: 'G',
        body: 'มันคือ<strong>ชั้นนอกที่ถูกเติมของเข้าไป</strong> — Generative AI ก็คือ Deep Learning ที่ถูกต่อยอด, Deep Learning ก็คือ Machine Learning ที่ถูกต่อยอด แบบเดียวกับวงกลมซ้อนกันที่คุณเดินผ่านมาทั้งหมด',
        status: `เล่นครบแล้ว <b>${done.size}/7 ด่าน</b> — ย้อนไปเล่นด่านที่ข้ามได้จากสารบัญ`,
        actions: [{ id: 'menu', label: 'เปิดสารบัญ', primary: true }, { id: 'top', label: 'กลับไปด่านแรก' }],
        onAction: id => {
          if (id === 'menu') ui.openMenu();
          if (id === 'top') goTo(0);
        }
      });
    },
    exit() { ui.panel(null); },
    pick() { },
    update(dt, tt) {
      parts.forEach((p, i) => {
        const k = 1 + Math.sin(tt * .7 + i * .9) * .012;
        p.ring.scale.set(k, k, 1);
        p.disc.material.opacity = .08 + Math.sin(tt * .9 + i) * .03;
      });
    }
  };
}


/* ---- framing: fit a station into the screen area the reading panel leaves free ---- */
/* the props are framed to the RIGHT of a gutter; the guide stands in the gutter,
   so a human-scale figure is always visible without covering anything */
const GUTTER = -.93;
function safeNdc() {
  const w = innerWidth, h = innerHeight;
  const y0 = -1 + 2 * 66 / h, y1 = 1 - 2 * 76 / h;
  if (document.body.classList.contains('panel-min')) return { x0: GUTTER, x1: .95, y0, y1 };
  if (w < 900) return { x0: -.9, x1: .9, y0: -.04, y1: .74 };
  const x1 = ((w - 20 - 378 - 30) / w) * 2 - 1;
  return { x0: -.93, x1: Math.min(.5, x1), y0, y1 };
}
const probe = new THREE.PerspectiveCamera(58, 1.7, .1, 2000);
probe.rotation.order = 'YXZ';

function fitBox(group) {
  group.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const one = new THREE.Box3();
  group.traverse(o => {
    if (!o.visible || o.userData.noFit) return;
    if (!(o.isMesh || o.isSprite || o.isLine || o.isPoints)) return;
    let p = o.parent, skip = false;
    while (p && p !== group) { if (p.userData.noFit) { skip = true; break; } p = p.parent; }
    if (skip) return;
    one.setFromObject(o);
    if (!one.isEmpty()) box.union(one);
  });
  return box;
}

function fitDock(group, view) {
  const box = fitBox(group);
  if (box.isEmpty()) return null;
  const c = box.getCenter(new THREE.Vector3());
  const s = safeNdc();
  const tx = (s.x0 + s.x1) / 2, ty = (s.y0 + s.y1) / 2;
  const vy = view[0], vp = view[1];
  const dir = new THREE.Vector3(-Math.sin(vy) * Math.cos(vp), Math.sin(vp), -Math.cos(vy) * Math.cos(vp));
  const tanV = Math.tan(camera.fov * Math.PI / 360), tanH = tanV * camera.aspect;
  const corners = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z])
    corners.push(new THREE.Vector3(x, y, z));
  probe.fov = camera.fov; probe.aspect = camera.aspect;
  const test = D => {
    const pos = c.clone().addScaledVector(dir, -D);
    const d = c.clone().sub(pos);
    probe.position.copy(pos);
    probe.rotation.set(
      Math.atan2(d.y, Math.hypot(d.x, d.z)) - Math.atan(ty * tanV),
      Math.atan2(-d.x, -d.z) + Math.atan(tx * tanH), 0);
    probe.updateMatrixWorld(true);
    probe.updateProjectionMatrix();
    for (const p of corners) {
      const v = p.clone().project(probe);
      if (!isFinite(v.x) || v.z < -1 || v.z > 1) return null;
      if (v.x < s.x0 || v.x > s.x1 || v.y < s.y0 || v.y > s.y1) return null;
    }
    return { pos, pitch: probe.rotation.x, yaw: probe.rotation.y };
  };
  let lo = 3, hi = 420, best = test(hi);
  for (let i = 0; i < 30; i++) {
    const D = (lo + hi) / 2, r = test(D);
    if (r) { best = r; hi = D; } else lo = D;
  }
  return best;
}

/* ------------------------------------------------------------ navigation */
const nav = { pos: new THREE.Vector3(30, 10, 202), yaw: -.15, pitch: -.03 };
camera.position.copy(nav.pos);
camera.rotation.set(nav.pitch, nav.yaw, 0);
let flying = false, started = false, docked = false;
let dockFit = null, zoom = 0;

function goTo(i) {
  if (i < 0 || i >= CH.length) return;
  if (station) station.exit();
  active = i;
  const c = CH[i];
  if (!c.station) {
    c.station = c.make(env);
    c.station.group.position.set(...c.at);
    const stage = new THREE.Group();
    const disc = floorGlow(17, c.col, .17); disc.position.y = .03;
    stage.add(disc, dashRing(15.5, c.col, .2, 100));
    stage.position.set(c.at[0], .05, c.at[2]);
    scene.add(stage);
    scene.add(c.station.group);
  }
  station = c.station;
  CH.forEach((o, k) => { if (o.station) o.station.group.visible = k === i; });
  ui.accent(c.css, c.cssTx);
  ui.chapter(c);
  ui.backEnabled(i > 0);
  ui.hideReveal();
  dock();
  flying = true;
  station.enter();
}
function dock(snap) {
  const c = CH[active];
  if (!c || !c.station) return;
  const f = fitDock(c.station.group, c.view);
  if (!f) return;
  /* remember the framing so the wheel can zoom along the same axis */
  const ctr = fitBox(c.station.group).getCenter(new THREE.Vector3());
  dockFit = { pos: f.pos.clone(), dir: ctr.clone().sub(f.pos).normalize(), dist: f.pos.distanceTo(ctr) };
  zoom = 0;
  nav.pos.copy(f.pos).addScaledVector(dockFit.dir, zoom);
  nav.yaw = nearestYaw(f.yaw); nav.pitch = f.pitch;
  docked = true;
  if (snap) { camera.position.copy(nav.pos); camera.rotation.set(nav.pitch, nav.yaw, 0); }
}
function next() { goTo(Math.min(CH.length - 1, active + 1)); }
function goBack() { goTo(Math.max(0, active - 1)); }

function nearestYaw(target) {
  let y = target;
  while (y - camera.rotation.y > Math.PI) y -= Math.PI * 2;
  while (camera.rotation.y - y > Math.PI) y += Math.PI * 2;
  return y;
}

canvas.addEventListener('wheel', e => {
  if (!started || !docked || !dockFit) return;
  e.preventDefault();
  zoom = clamp(zoom - e.deltaY * .018, -dockFit.dist * .55, dockFit.dist * .62);
  nav.pos.copy(dockFit.pos).addScaledVector(dockFit.dir, zoom);
  flying = false;
}, { passive: false });

const reframe = () => { if (docked) setTimeout(() => dock(true), 60); };
addEventListener('resize', reframe);
if (window.ResizeObserver) new ResizeObserver(reframe).observe(document.documentElement);

let notesOff = false;
function toggleNotes() {
  notesOff = !notesOff;
  document.body.classList.toggle('panel-min', notesOff);
  ui.hideLabel(notesOff);
  if (docked) { dock(); flying = true; }
}
ui.onHideButton(toggleNotes);
ui.onBackButton(goBack);
function switchSkin() {
  try {
    localStorage.setItem(SKIN_KEY, SK.name === 'night' ? 'anime' : 'night');
    localStorage.setItem(CH_KEY, String(Math.max(0, active)));
  } catch (e) { }
  location.reload();
}
const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round">'
  + '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.4M12 19v2.4M2.6 12h2.4M19 12h2.4'
  + 'M5.3 5.3l1.7 1.7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7"/></svg>';
const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a6.8 6.8 0 0 0 11.1 11.1Z"/></svg>';
const skinBtn = document.getElementById('btn-skin');
if (skinBtn) {
  /* show the skin you would switch TO */
  skinBtn.innerHTML = SK.name === 'night' ? SUN : MOON;
  skinBtn.onclick = switchSkin;
}

/* each chapter's accent, darkened until it is legible as small text on paper */
CH.forEach(c2 => { c2.cssTx = onPaper(c2.col); });

ui.menu(CH, i => goTo(i));
ui.onMenuButton(() => ui.toggleMenu());
ui.onStart(() => {
  started = true;
  ui.hideIntro();
  ui.hint(true);
  setTimeout(() => goTo(0), 120);
});

/* ------------------------------------------------------------- controls  */
const keys = new Set();
addEventListener('keydown', e => {
  if (e.key === 'Escape') { ui.closeMenu(); return; }
  if (!started) return;
  const k = e.key.toLowerCase();
  if (k === 'm') { ui.toggleMenu(); return; }
  if (k === 'h') { toggleNotes(); return; }
  if (k === ' ') { e.preventDefault(); next(); return; }
  if (k === 'arrowright') { e.preventDefault(); next(); return; }
  if (k === 'arrowleft') { e.preventDefault(); goBack(); return; }
  if (k === 'backspace') { e.preventDefault(); goBack(); return; }
  if (k >= '1' && k <= '8') { goTo(+k - 1); return; }
  keys.add(k);
  if (['w', 'a', 's', 'd'].includes(k)) { flying = false; docked = false; }
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

const rc = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let mode = null, last = { x: 0, y: 0 }, downAt = { x: 0, y: 0 }, downObj = null, hover = null;

function setNdc(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  rc.setFromCamera(ndc, camera);
}
function hitStation() {
  if (!station || !station.pickables.length) return null;
  const h = rc.intersectObjects(station.pickables, false);
  return h.length ? h[0] : null;
}

canvas.addEventListener('pointerdown', e => {
  if (!started) return;
  canvas.setPointerCapture(e.pointerId);
  setNdc(e);
  last = { x: e.clientX, y: e.clientY }; downAt = { x: e.clientX, y: e.clientY };
  const h = hitStation();
  downObj = h ? h.object : null;
  if (h && station.dragStart && station.dragStart(h.object, h.point, rc)) mode = 'sdrag';
  else if (h) mode = 'click';
  else mode = 'look';
  canvas.classList.add('grabbing');
});
canvas.addEventListener('pointermove', e => {
  if (!started) return;
  const dx = e.clientX - last.x, dy = e.clientY - last.y;
  last = { x: e.clientX, y: e.clientY };
  setNdc(e);
  if (mode === 'sdrag') { station.dragMove && station.dragMove(rc, dx, dy); return; }
  if (mode === 'click' && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 12) mode = 'look';
  if (mode === 'look') {
    nav.yaw -= dx * .0034; nav.pitch = clamp(nav.pitch - dy * .003, -.75, .7);
    flying = false;
    return;
  }
  if (!mode) {
    const h = hitStation();
    const o = h ? h.object : null;
    if (o !== hover) {
      if (hover) hover.scale.copy(hover.userData._s0 || new THREE.Vector3(1, 1, 1));
      hover = o;
      if (hover) {
        if (!hover.userData._s0) hover.userData._s0 = hover.scale.clone();
        hover.scale.copy(hover.userData._s0).multiplyScalar(1.07);
      }
    }
    canvas.classList.toggle('pointing', !!o);
  }
});
function endPointer(e) {
  if (!started) return;
  canvas.classList.remove('grabbing');
  if (mode === 'sdrag') { station.dragEnd && station.dragEnd(rc); }
  else if (mode === 'click' && downObj && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 12) {
    const h = hitStation();
    if (h) station.pick && station.pick(h.object, h.point, rc);
  }
  mode = null; downObj = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', e => { canvas.classList.remove('grabbing'); if (mode === 'sdrag') station.dragEnd && station.dragEnd(rc); mode = null; });

/* --------------------------------------------------------------- render  */
const fwd = new THREE.Vector3(), right = new THREE.Vector3();
let prev = performance.now(), clockT = 0;

function step(dt, t) {
  /* walking */
  if (started) {
    let mx = 0, mz = 0;
    if (keys.has('w')) mz -= 1;
    if (keys.has('s')) mz += 1;
    if (keys.has('a')) mx -= 1;
    if (keys.has('d')) mx += 1;
    if (mx || mz) {
      const sp = (keys.has('shift') ? 34 : 17) * dt;
      fwd.set(-Math.sin(nav.yaw), 0, -Math.cos(nav.yaw));
      right.set(Math.cos(nav.yaw), 0, -Math.sin(nav.yaw));
      nav.pos.addScaledVector(fwd, -mz * sp).addScaledVector(right, mx * sp);
      const r = Math.hypot(nav.pos.x, nav.pos.z);
      if (r > 222) { nav.pos.x *= 222 / r; nav.pos.z *= 222 / r; }
    }
  } else {
    nav.pos.z = 202 - Math.sin(t * .12) * 8;
    nav.pos.x = 30 + Math.sin(t * .09) * 9;
  }

  const k = damp(flying ? 1.7 : 8, dt);
  camera.position.lerp(nav.pos, k);
  camera.rotation.x = lerp(camera.rotation.x, nav.pitch, k);
  camera.rotation.y = lerp(camera.rotation.y, nav.yaw, k);
  if (flying && camera.position.distanceTo(nav.pos) < .35) flying = false;

  const introF = started ? 0 : sstep(140, 176, camera.position.length()) * .9;
  const walk = started && !docked ? 1 : 0;
  gates.forEach(gt => {
    const d = camera.position.distanceTo(gt.pos);
    const o = Math.max(sstep(9, 22, d) * (1 - sstep(26, 44, d)) * walk, introF);
    gt.en.material.opacity = o; gt.th.material.opacity = o * .8;
    gt.en.visible = gt.th.visible = o > .02;
  });

  /* shells dissolve as you pass into them, and thin out near the core */
  const dist = camera.position.length();
  domes.forEach((d, i) => {
    const r = d.userData.r;
    const outside = .34 + .66 * sstep(r * .8, r * 1.3, dist);
    const inner = sstep(r * .16, r * .5, dist);
    const v = outside * inner;
    d.userData.wire.opacity = d.userData.o * v;
    d.userData.fill.opacity = d.userData.fb * v;
    d.visible = v > .01;
    d.rotation.y = t * d.userData.spin * (i % 2 ? -1 : 1);
  });

  if (extras) extras.forEach(e => e.tick && e.tick(dt, t));
  if (station && station.update) station.update(dt, t);
}

function frame(now) {
  requestAnimationFrame(frame);
  resize();
  const dt = Math.min(.05, (now - prev) / 1000); prev = now;
  clockT = now * .001;
  step(dt, clockT);
  renderer.render(scene, camera);
}

/* deterministic advance — used when rAF is throttled (hidden iframe, capture) */
function advance(seconds = 2, n = 60) {
  for (let i = 0; i < n; i++) { clockT += seconds / n; step(seconds / n, clockT); }
  renderer.render(scene, camera);
}

function cap(secs = .05, n = 1) { advance(secs, n); }
window.__world = { THREE, renderer, scene, camera, nav, goTo, next, CH, advance, cap, ui, get station() { return station; }, get docked() { return docked; }, get started() { return started; }, keys };

/* ------------------------------------------------------------- boot      */
(async function boot() {
  await fontsReady();
  ui.accent(hex(COL.ai), onPaper(COL.ai));
  ui.hint(false);
  /* paint one frame synchronously — never depend on rAF being delivered to show something */
  resize();
  step(1 / 60, 0);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
  setTimeout(() => ui.hideLoading(), 200);
  /* came back from a skin switch — drop straight into the chapter we left */
  if (resumeCh >= 0) {
    started = true;
    ui.hideIntro();
    ui.hint(true);
    setTimeout(() => goTo(resumeCh), 60);
  }
})();

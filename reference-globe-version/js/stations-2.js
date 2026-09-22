import {
  THREE, COL, hex, makeCard, makeLabel, pedestal, glowSprite, floorGlow, Surface, tube, clamp, lerp, damp, ringMesh, roundRect, font, SK, rgba, wash, accentInk, solid, inked
} from './core.js';

/* ==================================================================== 03
   DL — ลูกบิดในหัวเครื่อง: หมุน Weight ให้ทายถูก แล้วดูมันเรียนเอง
==================================================================== */
export function makeWeightRoom(env) {
  const A = hex(COL.dl);
  const g = new THREE.Group();
  const pick = [];
  const W = [.30, .26, .62, .58];
  const START = W.slice();
  const T = .26;
  const KY = [6.7, 5.0, 3.3, 1.6];
  const FY = [6.0, 3.3];

  const person = makeCard({
    w: 3.5, h: 2.9, px: 110, accent: A, radius: .24, bar: true,
    kicker: 'ลูกค้าคนนี้', title: 'อยู่นนทบุรี\nใส่เสื้อสีส้ม', titleSize: .34,
    body: 'ความจริงคือเขา\nชอบกิน “กะเพราหมูสับ”', bodySize: .25, bodyColor: accentInk(0x63C48C)
  });
  person.position.set(-7.5, 4.8, 0);
  g.add(person);

  const FEAT = ['อยู่นนทบุรี', 'ใส่เสื้อสีส้ม'];
  FEAT.forEach((t, i) => {
    const c = makeCard({
      w: 3.0, h: 1.05, px: 130, radius: .26, align: 'center', valign: 'middle',
      fill: SK.cardFillAlt, border: SK.cardBorder,
      title: t, titleSize: .26, sub: 'ใช่ = 1', accent: A
    });
    c.position.set(-4.6, FY[i], 0);
    g.add(c);
  });
  const featLb = makeLabel('ข้อมูลที่เครื่องเห็น (ตรง = 1, ไม่ตรง = 0)', { size: .28, color: COL.ink3, weight: 500 });
  featLb.position.set(-4.6, 7.0, 0); g.add(featLb);

  const KN = [
    { i: 0, t: 'นนทบุรี → กะเพรา', out: 0, f: 0 },
    { i: 1, t: 'เสื้อส้ม → กะเพรา', out: 0, f: 1 },
    { i: 2, t: 'นนทบุรี → คะน้า', out: 1, f: 0 },
    { i: 3, t: 'เสื้อส้ม → คะน้า', out: 1, f: 1 }
  ].map(k => Object.assign(k, { y: KY[k.i] }));

  const faceTex = (() => {
    const S = new Surface(160, 160, 2);
    const ctx = S.ctx;
    ctx.clearRect(0, 0, 160, 160);
    ctx.fillStyle = wash(COL.dl, .14, .18);
    ctx.beginPath(); ctx.arc(80, 80, 78, 0, 7); ctx.fill();
    ctx.strokeStyle = SK.cardBorderSoft;
    ctx.beginPath(); ctx.moveTo(8, 80); ctx.lineTo(152, 80); ctx.stroke();
    const tri = (cy, up) => {
      ctx.beginPath();
      ctx.moveTo(80, cy + (up ? -17 : 17));
      ctx.lineTo(80 - 15, cy + (up ? 10 : -10));
      ctx.lineTo(80 + 15, cy + (up ? 10 : -10));
      ctx.closePath();
      ctx.fillStyle = up ? accentInk(COL.dl) : SK.ink2;
      ctx.fill();
    };
    tri(40, true); tri(120, false);
    S.done();
    return S.tex;
  })();

  const knobs = KN.map(k => {
    const grp = new THREE.Group();
    grp.position.set(-1.15, k.y, 0);
    const face = new THREE.Mesh(new THREE.CircleGeometry(.43, 32),
      new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false }));
    face.position.z = .17;
    face.userData.knob = k.i;
    grp.add(face);
    pick.push(face);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(.44, .44, .3, 28),
      new THREE.MeshStandardMaterial({ color: 0x1a1f2b, roughness: .4, metalness: .6 }));
    dial.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.48, .034, 6, 40),
      new THREE.MeshBasicMaterial({ color: COL.dl, transparent: true, opacity: .75 }));
    const notch = new THREE.Mesh(new THREE.BoxGeometry(.07, .32, .07),
      new THREE.MeshBasicMaterial({ color: 0xEAF3EA }));
    notch.position.set(0, .2, .17);
    const hub = new THREE.Group(); hub.add(notch);
    grp.add(dial, rim, hub, glowSprite(1.7, COL.dl, .25));
    const val = makeLabel('0.30', { size: .31, color: COL.ink, weight: 600, mono: true });
    val.position.set(1.32, .12, 0);
    const nm = makeLabel(k.t, { size: .22, color: COL.ink3, weight: 500 });
    nm.position.set(-.1, -.72, 0);
    const eq = makeLabel('1 × 0.30 = 0.30', { size: .2, color: accentInk(COL.dl), weight: 500, mono: true });
    eq.position.set(-.1, -1.0, 0);
    grp.add(eq);
    grp.add(val, nm);
    g.add(grp);
    dial.userData.knob = k.i; rim.userData.knob = k.i;
    pick.push(dial, rim);
    return { grp, hub, val, rim, eq, k };
  });
  const knobLb = makeLabel('ลูกบิด “ให้ความสำคัญเท่าไร” · คลิกครึ่งบน = เพิ่ม  ครึ่งล่าง = ลด', { size: .29, color: A, weight: 600 });
  knobLb.position.set(-1.15, 7.8, 0); g.add(knobLb);

  const hid = [0, 1].map(i => makeCard({
    w: 2.8, h: 1.1, px: 120, radius: .2, align: 'center', valign: 'middle', mono: true,
    fill: wash(COL.dl, .13, .17), border: rgba(COL.dl, .5), title: '0.00', titleSize: .32, titleColor: COL.ink,
    sub: i ? 'รวมคะแนน คะน้า' : 'รวมคะแนน กะเพรา', accent: A
  }));
  hid[0].position.set(2.6, 6.0, 0); hid[1].position.set(2.6, 2.6, 0);
  g.add(hid[0], hid[1]);
  const hidLb = makeLabel('ชั้นคำนวณข้างใน', { size: .27, color: COL.ink3, weight: 500 });
  hidLb.position.set(2.6, 7.0, 0); g.add(hidLb);

  const OUT = ['กะเพราหมูสับ', 'ผัดคะน้า'];
  const BX = 5.3, BW = 2.6;
  const bars = OUT.map((t, i) => {
    const geo = new THREE.BoxGeometry(1, .58, .38); geo.translate(.5, 0, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: i ? 0x7C8797 : COL.dl, transparent: true, opacity: .92 }));
    m.position.set(BX, i ? 2.6 : 6.0, 0);
    const track = new THREE.Mesh(new THREE.BoxGeometry(BW, .58, .3).translate(BW / 2, 0, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .07 }));
    track.position.copy(m.position);
    const lb = makeLabel(t, { size: .3, color: COL.ink, weight: 600 });
    lb.position.set(BX + BW / 2, (i ? 2.6 : 6.0) + .68, 0);
    const pc = makeLabel('0%', { size: .36, color: i ? COL.ink3 : hex(COL.dl), weight: 700, mono: true });
    pc.position.set(BX + BW + .75, i ? 2.6 : 6.0, 0);
    g.add(m, track, lb, pc);
    return { m, pc, lb };
  });

  const wires = [];
  function wire(a, b, col, op) { const t = tube(a, b, .02, col, op, true); g.add(t); wires.push(t); return t; }
  KN.forEach(k => {
    wire(new THREE.Vector3(-3.15, FY[k.f], 0), new THREE.Vector3(-1.7, k.y, 0), COL.dl, .28);
    wire(new THREE.Vector3(-.6, k.y, 0), new THREE.Vector3(1.2, k.out ? 2.6 : 6.0, 0), COL.dl, .28);
  });
  wire(new THREE.Vector3(4, 6.0, 0), new THREE.Vector3(BX, 6.0, 0), COL.dl, .4);
  wire(new THREE.Vector3(4, 2.6, 0), new THREE.Vector3(BX, 2.6, 0), COL.dl, .4);

  const PATH = [new THREE.Vector3(6.4, 4.3, 0), new THREE.Vector3(3.4, 4.3, 0), new THREE.Vector3(.8, 4.3, 0), new THREE.Vector3(-1.15, 4.3, 0)];
  const pulses = [];
  for (let i = 0; i < 7; i++) {
    const s = glowSprite(1.2, 0xE58166, 0); s.position.set(0, 4.3, 0); g.add(s);
    pulses.push({ s, t: -i * .16 });
  }

  const title = makeLabel('ข้างในเครื่อง มีแต่ลูกบิด', { size: .74, color: COL.ink, weight: 700 });
  title.position.set(-.6, 9.5, 0);
  const sub = makeLabel('เครื่องไม่ได้ “รู้” อะไรเลย มันมีแค่ลูกบิดเป็นล้านตัว', { size: .36, color: COL.ink3, weight: 400 });
  sub.position.set(-.6, 8.75, 0);
  g.add(title, sub);

  function probs() {
    const s0 = W[0] + W[1], s1 = W[2] + W[3];
    const e0 = Math.exp(s0 / T), e1 = Math.exp(s1 / T);
    return [e0 / (e0 + e1), e1 / (e0 + e1)];
  }
  let phase = 'manual', learnT = 0, finished = false;

  function refresh() {
    const p = probs();
    knobs.forEach(k => {
      const v = W[k.k.i];
      k.val.set(v.toFixed(2));
      k.eq.set('1 × ' + v.toFixed(2) + ' = ' + v.toFixed(2));
      k.hub.rotation.z = -(v - .5) * 4.6;
    });
    hid[0].set({ title: (W[0] + W[1]).toFixed(2), sub: W[0].toFixed(2) + ' + ' + W[1].toFixed(2) + ' = ' + (W[0] + W[1]).toFixed(2) });
    hid[1].set({ title: (W[2] + W[3]).toFixed(2), sub: W[2].toFixed(2) + ' + ' + W[3].toFixed(2) + ' = ' + (W[2] + W[3]).toFixed(2) });
    bars.forEach((b, i) => {
      b.m.scale.x = Math.max(.02, p[i] * BW);
      b.pc.set(Math.round(p[i] * 100) + '%');
      const win = p[i] > .5;
      b.m.material.color.setHex(i === 0 ? (win ? COL.dl : 0x3c5c46) : (win ? 0xC26B4F : 0x50596a));
      b.pc.material.color.set(win ? (i === 0 ? hex(COL.dl) : COL.bad) : COL.ink3);
    });
    return p;
  }

  function sync() {
    const p = probs();
    const good = p[0] >= .7;
    let st;
    if (phase === 'manual') {
      st = good
        ? `<span class="ok">ทายถูกแล้ว! ${Math.round(p[0] * 100)}% ว่ากะเพรา</span><br>คุณเพิ่งทำสิ่งที่เรียกว่า “เทรนโมเดล” ด้วยมือเปล่า`
        : `เครื่องยังทายว่า <b>${p[0] > p[1] ? 'กะเพรา' : 'ผัดคะน้า'} ${Math.round(Math.max(p[0], p[1]) * 100)}%</b> — ยังไม่ตรงกับความจริง ลองหมุนลูกบิดสองตัวบน<b>ขึ้น</b> และสองตัวล่าง<b>ลง</b>`;
    } else if (phase === 'learning') {
      st = `<span style="color:#E58166">กำลังเรียน…</span> เครื่องเทียบคำตอบที่ผิด แล้วไล่ย้อนกลับไปบอกลูกบิดทุกตัวว่าควรหมุนทางไหน`;
    } else {
      st = `<span class="ok">เครื่องหมุนลูกบิดเองจนถูก: ${Math.round(p[0] * 100)}%</span><br>คุณหมุนเองใช้เวลาเป็นนาที เครื่องทำแบบนี้ได้<b>ล้านครั้งต่อวินาที</b>`;
    }
    env.ui.panel({
      eyebrow: 'บทที่ 3 · Deep Learning',
      title: 'โครงข่ายประสาทเทียม',
      body: 'ด่านก่อนยังต้องมีคนบอกว่า “ดูจากอะไร” ด่านนี้เราจะเข้าไปดูข้างในเครื่อง ในนั้นไม่มีความคิดอะไรเลย — มีแค่<strong>ลูกบิดที่คอยให้คะแนน</strong>ว่าเรื่องไหนสำคัญแค่ไหน',
      quote: 'วิธีคำนวณคือ เอาข้อมูลที่เข้ามา (ค่า 1) <b>คูณกับ Weight</b> ของแต่ละเส้น แล้วบวกกันเป็นคะแนนของแต่ละคำตอบ ฝั่งที่คะแนนมากกว่าคือคำตอบที่โมเดลเลือก',
      who: 'G',
      task: phase === 'manual'
        ? 'ตอนนี้ลูกบิดทั้ง 4 ตัวถูกตั้งไว้มั่ว ๆ (0.30 / 0.26 / 0.62 / 0.58) คะแนน “คะน้า” จึงมากกว่า<br><b>คลิกครึ่งบนของลูกบิด</b>เพื่อเพิ่มค่า, <b>ครึ่งล่าง</b>เพื่อลด (ลากก็ได้)<br>เป้าหมาย: หมุน<b>สองตัวบนขึ้น</b> และ<b>สองตัวล่างลง</b> จนแถบ “กะเพราหมูสับ” ชนะเกิน 70%'
        : 'ดูให้ดี ๆ ตอนคลื่นสีส้มไหลย้อนกลับ — นั่นคือเครื่องกำลังบอกลูกบิดทุกตัวว่าหมุนผิดไปเท่าไร',
      taskLabel: 'ภารกิจ',
      status: st,
      actions: phase === 'manual'
        ? (good ? [{ id: 'auto', label: 'ทีนี้ให้เครื่องเรียนเอง →', primary: true }, { id: 'reset', label: 'รีเซ็ตลูกบิด' }] : [{ id: 'reset', label: 'รีเซ็ตลูกบิด' }])
        : [],
      onAction: id => {
        if (id === 'reset') { W.forEach((_, i) => W[i] = START[i]); refresh(); sync(); }
        if (id === 'auto') {
          W[0] = .18; W[1] = .12; W[2] = .74; W[3] = .69;
          refresh();
          phase = 'learning'; learnT = 0; sync();
        }
      }
    });
  }

  function reveal() {
    env.reveal({
      title: 'Neural Network ปรับ Weight ของตัวเองได้ ด้วยการดูว่าตอบผิดไปเท่าไร',
      terms: [
        { t: 'Neural Network', d: 'โครงข่ายลูกบิดหลายชั้น ที่คูณเลขต่อกันไปตลอดสาย' },
        { t: 'Weight', d: 'ตัวลูกบิดนั่นเอง คือค่าความสำคัญของแต่ละเรื่อง' },
        { t: 'Backpropagation', d: 'คลื่นสีส้มที่ไล่บอกทุกลูกบิดว่าต้องหมุนทางไหน' },
        { t: 'Deep Learning', d: 'ML ที่หาจุดสังเกต (Feature) เองได้ ไม่ต้องรอคนบอก' }
      ],
      note: 'ตอนนี้เครื่อง<b>ตัดสินของที่มีอยู่</b>เก่งแล้ว แต่ยังสร้างของใหม่เองไม่ได้ — ชั้นในสุดคือชั้นที่แก้เรื่องนี้',
      next: 'เข้าชั้นในสุด →'
    });
  }

  let dragKnob = -1;
  refresh();

  return {
    group: g, pickables: pick,
    enter() { refresh(); sync(); },
    exit() { env.ui.panel(null); },
    pick(obj, point) {
      const i = obj.userData.knob;
      if (i == null || phase !== 'manual') return;
      const local = g.worldToLocal(point.clone());
      const up = local.y > KY[i];
      W[i] = clamp(W[i] + (up ? .12 : -.12), 0, 1);
      refresh(); sync();
    },
    dragStart(obj) {
      if (phase !== 'manual') return false;
      const i = obj.userData.knob;
      if (i == null) return false;
      dragKnob = i; return true;
    },
    dragMove(rc, dx, dy) {
      if (dragKnob < 0) return;
      W[dragKnob] = clamp(W[dragKnob] - dy * .0055, 0, 1);
      refresh();
      const p = probs();
      env.ui.status(`กะเพรา <b>${Math.round(p[0] * 100)}%</b> · ผัดคะน้า <b>${Math.round(p[1] * 100)}%</b>`);
    },
    dragEnd() { if (dragKnob >= 0) { dragKnob = -1; sync(); } },
    update(dt, t) {
      wires.forEach((w, i) => { w.material.opacity = .16 + Math.abs(Math.sin(t * 1.1 + i * .4)) * .28; });
      knobs.forEach((k, i) => { k.rim.material.opacity = .5 + Math.sin(t * 2 + i) * .18; });

      if (phase === 'learning') {
        learnT += dt;
        const steps = Math.min(3, Math.ceil(dt * 90));
        for (let s = 0; s < steps; s++) {
          const p = probs(), lr = .05;
          const g0 = (p[0] - 1) / T, g1 = (p[1] - 0) / T;
          W[0] = clamp(W[0] - lr * g0, 0, 1); W[1] = clamp(W[1] - lr * g0, 0, 1);
          W[2] = clamp(W[2] - lr * g1, 0, 1); W[3] = clamp(W[3] - lr * g1, 0, 1);
        }
        refresh();
        pulses.forEach(p => {
          p.t += dt * .55;
          if (p.t > 1) p.t -= 1;
          if (p.t < 0) { p.s.material.opacity = 0; return; }
          const seg = p.t * 3, i = Math.min(2, Math.floor(seg));
          p.s.position.lerpVectors(PATH[i], PATH[i + 1], seg - i);
          p.s.material.opacity = .75 * Math.sin(p.t * Math.PI);
        });
        if (learnT > 3.4 && !finished) {
          finished = true; phase = 'done'; sync();
          pulses.forEach(p => p.s.material.opacity = 0);
          setTimeout(reveal, 600);
        }
      }
    }
  };
}

/* ==================================================================== 04
   GenAI — โรงงานทำแบงก์ปลอม: คุณเป็นคนทำของปลอม ไปหลอกเครื่องตรวจ
==================================================================== */
export function makeForgeryLab(env) {
  const A = hex(COL.ga);
  const g = new THREE.Group();
  const pick = [];

  const traits = { line: 0, color: 0, mark: 0 };   /* 0 = ทำดี, 1 = ทำมั่ว */
  const GROUPS = [
    { key: 'line', t: 'ลายเส้น', y: 7.9, opts: ['วาดละเอียดเหมือนของจริง', 'ลากหยาบ ๆ พอผ่าน'] },
    { key: 'color', t: 'โทนสี', y: 5.15, opts: ['ผสมสีให้ตรงเป๊ะ', 'สีเพี้ยนไปนิดหน่อย'] },
    { key: 'mark', t: 'ลายน้ำ', y: 2.4, opts: ['ทำลายน้ำซ่อนไว้ด้วย', 'ไม่ต้องทำ เสียเวลา'] }
  ];
  const bench = pedestal(4.7, 2.6, COL.ga, 1.0);
  bench.position.set(-6.6, 0, 1.1);
  g.add(bench);

  const optMesh = {};
  GROUPS.forEach(gr => {
    const lb = makeLabel(gr.t, { size: .3, color: COL.ink3, weight: 600 });
    lb.position.set(-6.6, gr.y + .88, 0);
    g.add(lb);
    optMesh[gr.key] = gr.opts.map((o, i) => {
      const c = makeCard({
        w: 3.5, h: .92, px: 130, radius: .3, align: 'center', valign: 'middle',
        fill: i === 0 ? wash(COL.ga, .16, .2) : SK.cardFillAlt,
        border: i === 0 ? rgba(COL.ga, .65) : SK.cardBorder,
        title: o, titleSize: .25, titleColor: i === 0 ? accentInk(COL.ga) : COL.ink2
      });
      c.position.set(-6.6, gr.y - i * 1.06, 0);
      c.userData.opt = { key: gr.key, i };
      g.add(c); pick.push(c);
      return c;
    });
  });
  const benchLb = makeLabel('เลือกวิธีทำแบงก์ปลอม · คลิกเลือกได้เลย', { size: .36, color: A, weight: 600 });
  benchLb.position.set(-6.6, 9.6, 0); g.add(benchLb);

  /* ---------- the fake note ---------- */
  const NS = new Surface(4.6 * 120, 2.3 * 120);
  function paintNote() {
    const ctx = NS.ctx, W = NS.w, H = NS.h;
    ctx.clearRect(0, 0, W, H);
    const off = traits.color === 1;
    roundRect(ctx, 4, 4, W - 8, H - 8, 16);
    const grd = ctx.createLinearGradient(0, 0, W, H);
    grd.addColorStop(0, off ? '#4a5c86' : '#2f4a3c');
    grd.addColorStop(1, off ? '#7a6f3f' : '#4e6b42');
    ctx.fillStyle = grd; ctx.fill();
    ctx.strokeStyle = off ? 'rgba(255,220,160,.55)' : 'rgba(220,240,200,.6)';
    ctx.lineWidth = 3; ctx.stroke();

    ctx.save();
    roundRect(ctx, 4, 4, W - 8, H - 8, 16); ctx.clip();
    const rough = traits.line === 1;
    ctx.strokeStyle = rough ? SK.cardBorder : SK.cardBorderSoft;
    ctx.lineWidth = rough ? 3.4 : 1.1;
    const n = rough ? 7 : 26;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += rough ? 26 : 7) {
        const y = H / 2 + Math.sin(x / (rough ? 70 : 46) + i * .5) * (H / 2.5) * (1 - i / (n * 1.6));
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    if (traits.mark === 0) {
      const cx = W * .77, cy = H * .5, r = H * .3;
      const wg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      wg.addColorStop(0, 'rgba(255,255,255,.34)');
      wg.addColorStop(.7, SK.cardBorderSoft);
      wg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = wg; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, r * .62, 0, 7); ctx.stroke();
      ctx.font = font(500, 22, true); ctx.fillStyle = 'rgba(255,255,255,.5)';
      ctx.textAlign = 'center'; ctx.fillText('WATERMARK', cx, cy + r * .95);
    }
    ctx.restore();

    ctx.textAlign = 'left';
    ctx.font = font(700, 62, false);
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.fillText('๑๐๐', 34, H - 34);
    ctx.font = font(500, 21, true);
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText('แบงก์ปลอมที่คุณทำเอง', 34, 44);
    NS.done();
  }
  paintNote();
  const note = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.3),
    new THREE.MeshBasicMaterial({ map: NS.tex, transparent: true }));
  note.position.set(-.4, 4.6, 1.2);
  g.add(note);
  const noteGlow = glowSprite(7, COL.ga, .18); noteGlow.position.copy(note.position); noteGlow.position.z -= .2;
  g.add(noteGlow);

  /* ---------- the discriminator ---------- */
  const eye = new THREE.Group();
  eye.position.set(7.6, 4.6, 0);
  const iris = new THREE.Mesh(new THREE.CircleGeometry(1.05, 40),
    new THREE.MeshBasicMaterial({ color: 0x0d1017 }));
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(1.15, .06, 8, 64),
    new THREE.MeshBasicMaterial({ color: COL.ga, transparent: true, opacity: .85 }));
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.62, .03, 8, 64),
    new THREE.MeshBasicMaterial({ color: COL.ga, transparent: true, opacity: .4 }));
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(.4, 32),
    new THREE.MeshBasicMaterial({ color: COL.ga }));
  pupil.position.z = .02;
  eye.add(iris, ring1, ring2, pupil, glowSprite(6, COL.ga, .22));
  g.add(eye);
  const eyeLb = makeLabel('เครื่องตรวจของปลอม', { size: .38, color: COL.ink, weight: 600 });
  eyeLb.position.set(7.6, 6.6, 0);
  const eyeSub = makeLabel('ตัวนี้คือของจริงที่ใช้งานอยู่', { size: .3, color: COL.ink3, weight: 400 });
  eyeSub.position.set(7.6, 6.1, 0);
  g.add(eyeLb, eyeSub);

  /* live inspection report: one row per check, with a lamp you can read at a glance */
  const RS = new Surface(5.8 * 110, 3.1 * 110);
  const report = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 3.1),
    new THREE.MeshBasicMaterial({ map: RS.tex, transparent: true, depthWrite: false }));
  report.position.set(7.6, 2.1, 0);
  g.add(report);
  let headline = { t: 'ยังไม่ได้ส่งของมาตรวจ', c: COL.ink2 };

  function paintReport() {
    const ctx = RS.ctx, W = RS.w, Hh = RS.h, u = 110;
    RS.clear();
    roundRect(ctx, 2, 2, W - 4, Hh - 4, .2 * u);
    ctx.fillStyle = SK.cardFill; ctx.fill();
    ctx.strokeStyle = headline.c === COL.ink2 ? SK.cardBorderSoft
      : (headline.c === COL.ok ? rgba(SK.ok, .65) : rgba(SK.bad, .65));
    ctx.lineWidth = 2.6; ctx.stroke();
    ctx.textAlign = 'left';
    ctx.font = font(600, .3 * u, false);
    ctx.fillStyle = headline.c;
    ctx.fillText(headline.t, .34 * u, .55 * u);
    ctx.strokeStyle = SK.cardBorderSoft; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(.3 * u, .78 * u); ctx.lineTo(W - .3 * u, .78 * u); ctx.stroke();
    CHECKS.forEach((c, i) => {
      const y = (1.22 + i * .58) * u;
      const st = c.state || 'off';
      const col = st === 'pass' ? SK.ok : st === 'fail' ? SK.bad
        : st === 'scan' ? hex(COL.ga) : st === 'idle' ? SK.ink3 : hex(SK.toon ? 0xB9AD99 : 0x3a4050);
      ctx.beginPath(); ctx.arc(.52 * u, y - .07 * u, .12 * u, 0, 7);
      ctx.fillStyle = col; ctx.globalAlpha = st === 'off' ? .4 : 1; ctx.fill(); ctx.globalAlpha = 1;
      ctx.font = font(500, .25 * u, false);
      ctx.fillStyle = st === 'off' ? hex(SK.toon ? 0x9A9382 : 0x4b5262) : SK.ink;
      ctx.fillText('ตรวจ' + c.name, .78 * u, y);
      ctx.font = font(500, .21 * u, true);
      ctx.fillStyle = col;
      ctx.textAlign = 'right';
      ctx.fillText(st === 'pass' ? 'ผ่าน' : st === 'fail' ? 'จับได้!' : st === 'scan' ? 'กำลังดู…'
        : st === 'idle' ? 'รอตรวจ' : 'ยังไม่ตรวจ', W - .34 * u, y);
      ctx.textAlign = 'left';
    });
    RS.done();
  }

  const plinth = pedestal(3.4, 2.2, COL.ga, 1.0);
  plinth.position.set(.4, 0, 5.4);
  g.add(plinth);
  const btnBase = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 1.1, .26, 30),
    new THREE.MeshStandardMaterial({ color: 0x1a1f2b, roughness: .5, metalness: .5 }));
  btnBase.position.set(.4, 1.18, 5.4);
  const btnTop = new THREE.Mesh(new THREE.CylinderGeometry(.88, .88, .34, 30),
    new THREE.MeshStandardMaterial({ color: 0xE8A33D, roughness: .35, metalness: .3, emissive: 0x4a2f06 }));
  btnTop.position.set(.4, 1.42, 5.4);
  btnTop.userData.send = true;
  const btnRing = new THREE.Mesh(new THREE.TorusGeometry(1.15, .05, 6, 44),
    new THREE.MeshBasicMaterial({ color: COL.ga, transparent: true, opacity: .8 }));
  btnRing.rotation.x = -Math.PI / 2;
  btnRing.position.set(.4, 1.3, 5.4);
  const btnGlow = glowSprite(4.4, 0xE8A33D, .32);
  btnGlow.position.set(.4, 1.55, 5.4); btnGlow.userData.noFit = true;
  g.add(btnBase, btnTop, btnRing, btnGlow);
  pick.push(btnTop);
  const btnLb = makeLabel('กดส่งไปตรวจ', { size: .42, color: accentInk(0xD08E14), weight: 700 });
  btnLb.position.set(.4, 2.5, 5.4);
  g.add(btnLb);
  let btnPress = 0;

  const beam = new THREE.Mesh(new THREE.PlaneGeometry(.16, 2.5),
    new THREE.MeshBasicMaterial({ color: COL.ga, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  beam.position.set(0, 4.6, 1.4);
  g.add(beam);

  const title = makeLabel('ชั้นในสุด · โรงงานทำแบงก์ปลอม', { size: .8, color: COL.ink, weight: 700 });
  title.position.set(1.2, 11.2, 0);
  const sub = makeLabel('อยากให้เครื่องตรวจเก่งขึ้น ต้องมีของปลอมให้มันฝึกจับ', { size: .4, color: COL.ink3, weight: 400 });
  sub.position.set(1.2, 10.5, 0);
  g.add(title, sub);

  /* ---------- rounds ---------- */
  const CHECKS = [
    { key: 'mark', name: 'ลายน้ำ', why: 'ไม่มีลายน้ำ' },
    { key: 'color', name: 'โทนสี', why: 'โทนสีเพี้ยน' },
    { key: 'line', name: 'ความละเอียดลายเส้น', why: 'ลายเส้นหยาบเกินไป' }
  ];
  CHECKS.forEach((c, i) => c.state = i === 0 ? 'idle' : 'off');
  let level = 1, passes = 0, scanning = 0, scanDone = null, done = false;

  const checkList = () => CHECKS.slice(0, level).map(c => c.name).join(' · ');
  const risky = () => Object.keys(traits).filter(k => traits[k] === 1).length;

  function sync(msg) {
    paintReport();
    env.ui.panel({
      eyebrow: 'บทที่ 4 · Generative AI',
      title: 'คุณคือ Generator',
      quote: 'เหตุผลที่ต้องมี Generator คือ <b>Discriminator</b> จะเก่งขึ้นได้ก็ต่อเมื่อเคยเห็นของปลอมมาเยอะครับ ยิ่ง Generator ทำได้เนียน ตัวตรวจก็ยิ่งถูกฝึกให้คมขึ้น',
      who: 'G',
      body: 'สามชั้นก่อนหน้า โมเดลเก่งเรื่อง<strong>ตัดสินของที่มีอยู่</strong> ชั้นนี้เพิ่ม <strong>Generator</strong> เข้ามา คือตัวที่สร้างข้อมูลขึ้นใหม่ เพื่อเอาไปฝึก Discriminator',
      task: 'ทำ 3 ขั้น:<br>① คลิกการ์ด<b>ทางซ้าย</b> เลือกว่าจะทำละเอียดหรือมักง่าย (ดูแบงก์ตรงกลางเปลี่ยนตามได้เลย)<br>② กด<b>ปุ่มสีส้ม</b>กลางฉาก เพื่อส่งไปตรวจ<br>③ อ่านผลตรวจทางขวา แล้วแก้จุดที่โดนจับ<br><b>ต้องหลอกผ่านให้ได้ 3 รอบ</b>',
      taskLabel: 'วิธีเล่น',
      meter: passes / 3,
      status: msg || 'ตอนนี้เครื่องตรวจดูอยู่ <b>' + level + '</b> อย่าง: ' + checkList() + ' — เลือกวิธีทำแล้วกดปุ่มสีส้มได้เลย',
      actions: done ? [] : [{ id: 'send', label: scanning > 0 ? 'กำลังตรวจ…' : 'ส่งไปให้เครื่องตรวจ', primary: true, disabled: scanning > 0 }],
      onAction: id => { if (id === 'send') tryScan(); }
    });
  }

  function tryScan() {
    if (scanning || done) return;
    scanning = 1; scanDone = null; btnPress = 1;
    for (let i = 0; i < level; i++) CHECKS[i].state = 'scan';
    headline = { t: 'กำลังสแกน…', c: COL.ink };
    sync('เครื่องตรวจกำลังไล่ดูทีละจุด…');
  }

  function judge() {
    let caught = null;
    for (let i = 0; i < level; i++) {
      const c = CHECKS[i];
      const bad = traits[c.key] === 1;
      c.state = bad ? 'fail' : 'pass';
      if (bad && !caught) caught = c;
    }
    if (caught) {
      headline = { t: 'ปลอม! จับได้', c: COL.bad };
      sync('<span class="no">ไม่ผ่าน</span> เครื่องจับได้ว่า<b>' + caught.why + '</b><br>ดูผลตรวจทางขวา จุดที่เป็นสีแดงคือจุดที่โดนจับ — กลับไปแก้จุดนั้นแล้วส่งใหม่');
    } else {
      passes++;
      if (passes >= 3) {
        headline = { t: 'ผ่าน! แยกไม่ออกแล้ว', c: COL.ok };
        done = true;
        sync('<span class="ok">หลอกผ่านครบ 3 รอบ</span> แบงก์ปลอมของคุณเนียนจนแยกไม่ออก — และเครื่องตรวจก็คมกว่าเดิมมาก');
        setTimeout(reveal, 900);
      } else {
        level = Math.min(3, level + 1);
        CHECKS[level - 1].state = 'idle';
        headline = { t: 'รอบนี้ผ่าน… แต่มันจำได้', c: COL.ok };
        sync('<span class="ok">หลอกผ่าน!</span> แต่พอโดนหลอก เครื่องตรวจก็<b>จำจุดนั้นไว้</b> รอบหน้ามันเพิ่มการตรวจเป็น <b>' + level + '</b> อย่าง: ' + checkList() + '<br>คุณต้องทำให้เนียนขึ้นอีก');
      }
    }
  }

  function reveal() {
    env.reveal({
      title: 'Generator กับ Discriminator ไล่กวดกัน — นี่คือหัวใจของ Generative AI',
      terms: [
        { t: 'Generative AI', d: 'ชั้นที่สร้างของใหม่ได้ ไม่ใช่แค่ตัดสินของที่มีอยู่' },
        { t: 'Generator Model', d: 'ตัวทำของปลอม (คุณเมื่อกี้) มีไว้ลับคมตัวจริง' },
        { t: 'Discriminator Model', d: 'ตัวตรวจ คือโมเดลที่เอาไปใช้งานจริง' },
        { t: 'Binary Classification', d: 'คำตอบสองทางของตัวตรวจ คือจริงหรือปลอม' }
      ],
      note: 'ถัดไปคือของที่เราคุยกันทุกวัน — <b>LLM</b> คือ Generative AI ที่สร้าง “คำ” ออกมาทีละคำ',
      next: 'ไปดูตัวที่เราคุยด้วยทุกวัน →'
    });
  }

  return {
    group: g, pickables: pick,
    enter() { paintReport(); sync(); },
    exit() { env.ui.panel(null); },
    pick(obj) {
      if (obj.userData.send) { tryScan(); return; }
      const o = obj.userData.opt;
      if (!o || scanning || done) return;
      traits[o.key] = o.i;
      GROUPS.forEach(gr => optMesh[gr.key].forEach((m, i) => {
        const on = traits[gr.key] === i;
        m.set({
          fill: on ? wash(COL.ga, .16, .2) : SK.cardFillAlt,
          border: on ? rgba(COL.ga, .65) : SK.cardBorder,
          titleColor: on ? accentInk(COL.ga) : COL.ink2
        });
      }));
      paintNote();
      const n = risky();
      sync(n === 0
        ? 'เลือกแล้ว: ทำละเอียดทุกจุด — <b>กดปุ่มสีส้ม</b>ส่งไปตรวจได้เลย'
        : 'เลือกแล้ว: มีจุดที่ทำมักง่ายอยู่ <b>' + n + '</b> จุด จะโดนจับหรือไม่ขึ้นกับว่าเครื่องตรวจจุดนั้นหรือยัง — <b>กดปุ่มสีส้ม</b>ส่งไปตรวจ');
    },
    update(dt, t) {
      note.position.y = 4.6 + Math.sin(t * 1.1) * .1;
      note.rotation.y = Math.sin(t * .45) * .16;
      ring2.rotation.z += dt * .35;
      pupil.scale.setScalar(1 + Math.sin(t * 2.2) * .06);
      btnPress = Math.max(0, btnPress - dt * 2.6);
      btnTop.position.y = 1.42 - btnPress * .14;
      btnRing.material.opacity = scanning > 0 ? .3 : .55 + Math.sin(t * 2.6) * .3;
      btnGlow.material.opacity = scanning > 0 ? .1 : .22 + Math.sin(t * 2.6) * .14;
      if (scanning > 0) {
        scanning += dt;
        const e = clamp((scanning - 1) / 1.6, 0, 1);
        beam.material.opacity = .9 * Math.sin(e * Math.PI);
        beam.position.x = lerp(-2.9, 2.1, e);
        pupil.material.color.setHex(0xffffff);
        /* lamps resolve one by one as the beam sweeps, so the check order is visible */
        const step = Math.floor(e * level + .0001);
        for (let i = 0; i < level; i++) {
          if (i < step && CHECKS[i].state === 'scan') {
            CHECKS[i].state = traits[CHECKS[i].key] === 1 ? 'fail' : 'pass';
            paintReport();
          }
        }
        if (e >= 1 && !scanDone) { scanDone = 1; scanning = 0; beam.material.opacity = 0; pupil.material.color.setHex(COL.ga); judge(); }
      }
    }
  };
}

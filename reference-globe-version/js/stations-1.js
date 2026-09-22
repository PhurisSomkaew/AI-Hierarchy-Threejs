import {
  THREE, COL, hex, makeCard, makeLabel, pedestal, floorGlow, glowSprite, Surface, font, clamp, lerp, damp, ringMesh, SK, rgba, wash, accentInk, solid, inked
} from './core.js';

/* ==================================================================== 01
   AI — ตู้กดน้ำที่ทำตามกฎเป๊ะ ๆ  (Rule-Based)
   เล่น: หยิบของหย่อนใส่ตู้ ของที่มีกฎ → ได้น้ำ / ของแปลก → ตู้ค้าง
==================================================================== */
export function makeRuleMachine(env) {
  const A = hex(COL.ai);
  const g = new THREE.Group();
  const pick = [];

  const shell = new THREE.Group();
  shell.position.set(0, 0, -1.2);
  g.add(shell);

  const body = new THREE.Mesh(new THREE.BoxGeometry(6.2, 7.6, 2.4),
    new THREE.MeshStandardMaterial({ color: 0x141821, roughness: .48, metalness: .45 }));
  body.position.y = 3.6;
  const trim = new THREE.Mesh(new THREE.BoxGeometry(6.3, 7.7, 2.42),
    new THREE.MeshBasicMaterial({ color: COL.ai, transparent: true, opacity: .13, wireframe: true }));
  trim.position.y = 3.6;
  shell.add(body, trim);

  const screen = makeCard({
    w: 5.2, h: 2.9, px: 120, accent: A, radius: .18,
    fill: SK.cardFill, border: rgba(COL.ai, .5),
    kicker: 'กฎในเครื่อง · มีแค่ 2 ข้อ', bodySize: .27, mono: true,
    body: '1) เหรียญ 10 บาท → จ่ายน้ำ\n2) เหรียญ 5 บาท → รออีก 5 บาท'
  });
  screen.position.set(0, 5.25, 1.23);
  shell.add(screen);

  const readout = makeCard({
    w: 5.2, h: 1.05, px: 120, radius: .16, mono: true, bodySize: .3, align: 'center', valign: 'middle',
    fill: SK.cardFill, border: SK.cardBorderSoft, body: 'พร้อมทำงาน · รอรับของ', bodyColor: COL.ink2
  });
  readout.position.set(0, 3.55, 1.23);
  shell.add(readout);

  const slot = new THREE.Mesh(new THREE.BoxGeometry(1.8, .3, .34),
    new THREE.MeshBasicMaterial({ color: COL.ai, transparent: true, opacity: .85 }));
  slot.position.set(0, 2.6, 1.2);
  const slotGlow = glowSprite(2.6, COL.ai, .5); slotGlow.position.set(0, 2.6, 1.35);
  shell.add(slot, slotGlow);

  const tray = new THREE.Mesh(new THREE.BoxGeometry(2.6, .22, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x0c0f16, roughness: .8 }));
  tray.position.set(0, 1.05, 1.5);
  shell.add(tray);

  const title = makeLabel('ตู้กดน้ำอัตโนมัติ', { size: .78, color: COL.ink, weight: 700 });
  title.position.set(0, 9.1, -1.2);
  const sub = makeLabel('รุ่น “ทำตามกฎที่ช่างเขียนไว้”', { size: .42, color: COL.ink3, weight: 400, mono: true });
  sub.position.set(0, 8.3, -1.2);
  g.add(title, sub);

  /* ---- things you can feed it ---- */
  const ITEMS = [
    { id: 'c10', t: 'เหรียญ\n10 บาท', kind: 'ok' },
    { id: 'c5', t: 'เหรียญ\n5 บาท', kind: 'half' },
    { id: 'b20', t: 'ธนบัตร\n20 บาท', kind: 'bad', why: 'เป็นแบงก์ ไม่ใช่เหรียญ' },
    { id: 'fx', t: 'เหรียญ\nต่างประเทศ', kind: 'bad', why: 'หน้าตาไม่ตรงกับที่เขียนไว้' },
    { id: 'bt', t: 'กระดุม\nเสื้อ', kind: 'bad', why: 'ไม่มีกฎข้อไหนพูดถึงมันเลย' }
  ];
  const bench = pedestal(10.6, 2.6, COL.ai, 1.0);
  bench.position.set(0, 0, 4.9);
  g.add(bench);
  const benchLb = makeLabel('คลิกหย่อนของเข้าตู้ได้เลย', { size: .42, color: accentInk(COL.ai), weight: 600 });
  benchLb.position.set(0, .62, 7.1);
  g.add(benchLb);

  ITEMS.forEach((it, i) => {
    const c = makeCard({
      w: 1.9, h: 1.4, px: 130, radius: .2, align: 'center', valign: 'middle',
      fill: SK.cardFill, border: SK.cardBorder,
      title: it.t, titleSize: .26, titleWeight: 600
    });
    c.position.set(-4 + i * 2, 1.9, 4.85);
    c.rotation.x = -.22;
    c.userData.item = it;
    c.userData.home = c.position.clone();
    g.add(c);
    pick.push(c);
    it.mesh = c;
  });

  const can = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .95, 20),
    new THREE.MeshStandardMaterial({ color: 0x3FC3A6, roughness: .35, metalness: .5, emissive: 0x0d2f28 }));
  can.visible = false; shell.add(can);

  /* ---- state ---- */
  let ok = 0, bad = 0, half = false, solved = false;
  let fly = null, shake = 0, flash = 0, flashCol = COL.ai, canT = -1;

  function sync(msg) {
    const done = ok >= 1 && bad >= 1;
    env.ui.panel({
      eyebrow: 'บทที่ 1 · Rule-Based',
      title: 'กฎที่คนเขียนไว้ล่วงหน้า',
      quote: 'จุดที่ต้องสังเกตคือ ตู้ไม่ได้ “เข้าใจ” ว่าของที่ใส่เข้าไปคืออะไรครับ มันแค่<b>เทียบกับเงื่อนไขที่มี</b> ถ้าไม่ตรงก็จบ',
      who: 'G',
      body: 'เครื่องนี้ทำงานแบบ <strong>Rule-Based</strong> คือมี<strong>เงื่อนไขที่คนเขียนไว้ล่วงหน้า 2 ข้อ</strong> ถ้าข้อมูลที่เข้ามาตรงกับเงื่อนไข มันทำได้แม่นมาก',
      task: 'ทดลองป้อนข้อมูลให้ครบทั้งสองแบบ:<br>① ของที่<b>ตรงเงื่อนไข</b> (เหรียญ 10 บาท)<br>② ของที่<b>ไม่ตรงเงื่อนไข</b> (กระดุม / แบงก์ / เหรียญต่างประเทศ)',
      taskLabel: 'ภารกิจ',
      status: msg || 'ยังไม่ได้ป้อนอะไรเลย — คลิกของบนแท่นข้างหน้า',
      onAction: () => { }
    });
    if (done && !solved) { solved = true; setTimeout(reveal, 700); }
  }

  function reveal() {
    env.reveal({
      title: 'นี่คือ AI แบบ Rule-Based — ทำได้เท่าที่เงื่อนไขครอบคลุม ไม่มากกว่านั้น',
      terms: [
        { t: 'Rule-Based', d: 'ทำตามกฎที่คนเขียนไว้ล่วงหน้า ถ้าเจอแบบนี้ ให้ทำแบบนี้' },
        { t: 'Artificial Intelligence', d: 'ระบบที่ทำงานแทนคนได้ จุดตั้งต้นของทุกชั้นที่เหลือ' },
        { t: 'ปัญหาที่ค้างไว้', d: 'เจอของที่ไม่มีในกฎก็ค้าง ต้องรอคนมาเขียนเพิ่ม' }
      ],
      note: 'ชั้นถัดไปแก้ปัญหานี้ตรง ๆ: ทำให้กฎ<b>ขยับตัวเองได้</b> โดยไม่ต้องรอช่าง',
      next: 'เดินเข้าชั้นถัดไป →'
    });
  }

  function feed(mesh) {
    if (fly) return;
    const it = mesh.userData.item;
    fly = { mesh, t: 0, from: mesh.position.clone(), to: new THREE.Vector3(0, 2.6, .2), it };
  }

  function apply(it) {
    if (it.kind === 'ok' || (it.kind === 'half' && half)) {
      ok++; half = false;
      flash = 1; flashCol = 0x3FC3A6; canT = 0;
      readout.set({ body: 'ตรงกฎข้อ 1 · จ่ายน้ำ ✓', bodyColor: COL.ok, border: rgba(SK.ok, .55) });
      sync(`<span class="ok">ทำงานได้!</span> ของชิ้นนี้ตรงกับโพยพอดี ตู้จึงทำได้เป๊ะ — <b>เพราะมีคนเขียนกฎรอไว้แล้ว</b>`);
    } else if (it.kind === 'half') {
      half = true;
      readout.set({ body: 'ตรงกฎข้อ 2 · รออีก 5 บาท', bodyColor: COL.ink, border: SK.cardBorder });
      sync('ตู้บอกว่า “รออีก 5 บาท” — ใส่เหรียญ 5 อีกเหรียญสิ');
    } else {
      bad++;
      flash = 1; flashCol = 0xE58166; shake = .75;
      readout.set({ body: 'ERROR · ไม่มีกฎสำหรับของชิ้นนี้', bodyColor: COL.bad, border: rgba(SK.bad, .6) });
      screen.set({ body: '1) เหรียญ 10 บาท → จ่ายน้ำ\n2) เหรียญ 5 บาท → รออีก 5 บาท\n\nไม่มีข้อไหนตรงกับของชิ้นนี้' });
      sync(`<span class="no">ตู้ค้างไปเลย</span> — ${it.why} ตู้ไม่ได้ “คิด” ว่ามันคืออะไร มันแค่หาในโพยแล้วไม่เจอ`);
    }
  }

  return {
    group: g, pickables: pick,
    enter() { sync(); },
    exit() { env.ui.panel(null); },
    pick(obj) { if (obj.userData.item) feed(obj); },
    update(dt, t) {
      if (fly) {
        fly.t = Math.min(1, fly.t + dt * 1.6);
        const e = fly.t, p = fly.from.clone().lerp(fly.to, e);
        p.y += Math.sin(e * Math.PI) * 1.5;
        fly.mesh.position.copy(p);
        fly.mesh.rotation.z = e * 3;
        fly.mesh.scale.setScalar(1 - e * .55);
        if (fly.t >= 1) {
          const it = fly.it, m = fly.mesh;
          m.visible = false; fly = null;
          apply(it);
          setTimeout(() => {
            m.position.copy(m.userData.home); m.rotation.set(-.22, 0, 0);
            m.scale.setScalar(1); m.visible = true;
          }, 900);
        }
      }
      if (shake > 0) {
        shake = Math.max(0, shake - dt);
        shell.position.x = Math.sin(t * 46) * .09 * shake;
        shell.rotation.z = Math.sin(t * 39) * .012 * shake;
      } else { shell.position.x = 0; shell.rotation.z = 0; }
      if (flash > 0) {
        flash = Math.max(0, flash - dt * 1.3);
        slot.material.color.setHex(flashCol);
        slotGlow.material.color.setHex(flashCol);
        slotGlow.material.opacity = .35 + flash * .8;
        slotGlow.scale.setScalar(2.6 + flash * 2.4);
      }
      if (canT >= 0) {
        canT += dt * 1.4;
        can.visible = true;
        const e = Math.min(1, canT);
        can.position.set(0, lerp(2.4, 1.35, e), lerp(.4, 1.5, e));
        can.rotation.x = e * 2.4;
        if (canT > 3.2) { can.visible = false; canT = -1; }
      }
      slot.material.opacity = .6 + Math.sin(t * 2.4) * .18;
    }
  };
}

/* ==================================================================== 02
   ML — โต๊ะคัดมะม่วง: วางไม้กั้นด้วยมือ แล้วให้เครื่องขยับไม้เองเมื่อของใหม่มา
==================================================================== */
export function makeSortTable(env) {
  const A = hex(COL.ml);
  const g = new THREE.Group();
  const pick = [];
  const TW = 15.4, TD = 10.4, TOP = 2.0;

  g.add(pedestal(TW, TD, COL.ml, TOP - .16));

  const S = new Surface(TW * 46, TD * 46);
  (function paintTop() {
    const ctx = S.ctx, W = S.w, Hh = S.h;
    ctx.fillStyle = hex(SK.toon ? 0xEFE7D7 : 0x0b0f16); ctx.fillRect(0, 0, W, Hh);
    const grd = ctx.createLinearGradient(0, Hh, W, 0);
    grd.addColorStop(0, rgba(COL.ml, SK.toon ? .08 : .05)); grd.addColorStop(1, rgba(0xD08E14, SK.toon ? .1 : .07));
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, Hh);
    ctx.strokeStyle = rgba(SK.ink, SK.toon ? .1 : .055); ctx.lineWidth = 1;
    for (let i = 0; i <= 16; i++) { const x = i / 16 * W; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, Hh); ctx.stroke(); }
    for (let i = 0; i <= 11; i++) { const y = i / 11 * Hh; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = SK.cardBorderSoft; ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, W - 3, Hh - 3);
    ctx.fillStyle = SK.ink2;
    ctx.font = font(500, 22, false);
    ctx.textAlign = 'center';
    ctx.fillText('ขนาดผล   เล็ก → ใหญ่', W / 2, Hh - 22);
    ctx.save();
    ctx.translate(30, Hh / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('สีเปลือก   เขียว → เหลือง', 0, 0);
    ctx.restore();
    S.done();
  })();
  const top = new THREE.Mesh(new THREE.PlaneGeometry(TW, TD), new THREE.MeshBasicMaterial({ map: S.tex }));
  top.rotation.x = -Math.PI / 2;
  top.position.y = TOP;
  g.add(top);

  const title = makeLabel('โต๊ะคัดมะม่วง', { size: .7, color: COL.ink, weight: 700 });
  title.position.set(0, TOP + 2.6, -TD / 2 - 1.4);
  const sub = makeLabel('แม่ค้าคัดด้วยมือทั้งวันไม่ทัน — ลองวางไม้กั้นให้เครื่องคัดแทน', { size: .4, color: COL.ink3, weight: 400 });
  sub.position.set(0, TOP + 1.9, -TD / 2 - 1.4);
  g.add(title, sub);

  const lg1 = makeCard({
    w: 3.1, h: .78, px: 130, radius: .3, align: 'center', valign: 'middle',
    fill: wash(0xD08E14, .14, .18), border: rgba(0xD08E14, .55), title: 'สุกแล้ว · ขายได้', titleSize: .28, titleColor: accentInk(0xD08E14)
  });
  lg1.position.set(-2.4, TOP + .12, TD / 2 + 1.7); lg1.rotation.x = -1.15;
  const lg2 = makeCard({
    w: 3.1, h: .78, px: 130, radius: .3, align: 'center', valign: 'middle',
    fill: wash(0x63C48C, .12, .16), border: rgba(0x63C48C, .5), title: 'ยังดิบ · ขายไม่ได้', titleSize: .28, titleColor: accentInk(0x63C48C)
  });
  lg2.position.set(2.4, TOP + .12, TD / 2 + 1.7); lg2.rotation.x = -1.15;
  g.add(lg1, lg2);

  let seed = 20240917;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const gauss = (m, sd) => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return m + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2832 * v); };
  const XL = TW / 2 - .8, ZL = TD / 2 - .8;
  const dots = [];
  const dotGeo = new THREE.SphereGeometry(.28, 16, 12);
  function addDot(x, z, cls, fresh) {
    const m = new THREE.Mesh(dotGeo, new THREE.MeshStandardMaterial({
      color: cls ? 0xE8A33D : 0x63C48C, roughness: .34, metalness: .12,
      emissive: cls ? 0x3a2405 : 0x08301c
    }));
    m.position.set(clamp(x, -XL, XL), TOP + .32, clamp(z, -ZL, ZL));
    m.scale.setScalar(fresh ? .01 : 1);
    const halo = glowSprite(1.7, 0xE58166, 0);
    halo.position.copy(m.position); halo.position.y += .1;
    halo.userData.noFit = true;
    g.add(m, halo);
    dots.push({ m, halo, cls, grow: fresh ? 0 : 1, wrong: false });
  }
  for (let i = 0; i < 17; i++) addDot(gauss(3.6, 2.5), gauss(-2.3, 1.5), 1, false);
  for (let i = 0; i < 17; i++) addDot(gauss(-3.8, 2.5), gauss(2.4, 1.5), 0, false);

  const hA = new THREE.Vector3(-XL - .3, TOP, -3.7);
  const hB = new THREE.Vector3(XL + .3, TOP, -3.7);

  const fence = new THREE.Mesh(new THREE.BoxGeometry(.17, 1.35, 1),
    new THREE.MeshBasicMaterial({ color: COL.ml, transparent: true, opacity: .32, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  const rail = new THREE.Mesh(new THREE.BoxGeometry(.3, .17, 1),
    new THREE.MeshStandardMaterial({ color: 0x2b6f61, roughness: .4, metalness: .5, emissive: 0x0d2a25 }));
  rail.userData.grab = 'mid';
  g.add(fence, rail);
  pick.push(rail);

  const posts = [hA, hB].map((p, i) => {
    const grp = new THREE.Group();
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.46, 20, 14),
      new THREE.MeshStandardMaterial({ color: 0x8FE8D4, roughness: .3, metalness: .35, emissive: 0x0e3c33 }));
    knob.position.y = 1.5;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.09, .11, 1.5, 12),
      new THREE.MeshStandardMaterial({ color: 0x2b6f61, roughness: .5, metalness: .4 }));
    stem.position.y = .75;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.62, .035, 6, 34),
      new THREE.MeshBasicMaterial({ color: COL.ml, transparent: true, opacity: .8 }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = .06;
    const gl = glowSprite(2.6, COL.ml, .3); gl.position.y = 1.5; gl.userData.noFit = true;
    grp.add(knob, stem, ring, gl);
    knob.userData.grab = i; stem.userData.grab = i;
    pick.push(knob, stem);
    g.add(grp);
    return { grp, knob, ring };
  });
  const grip = makeLabel('จับลูกบิดสีเขียวแล้วลากได้เลย', { size: .38, color: accentInk(COL.ml), weight: 600 });
  grip.position.set(0, TOP + 3.4, 0);
  g.add(grip);

  function drawFence() {
    const mid = hA.clone().add(hB).multiplyScalar(.5);
    const d = hB.clone().sub(hA);
    const len = Math.max(.6, d.length());
    const rotY = Math.atan2(d.x, d.z);
    fence.scale.set(1, 1, len);
    fence.position.set(mid.x, TOP + .68, mid.z);
    fence.rotation.set(0, rotY, 0);
    rail.scale.set(1, 1, len);
    rail.position.set(mid.x, TOP + 1.42, mid.z);
    rail.rotation.set(0, rotY, 0);
    posts[0].grp.position.set(hA.x, TOP, hA.z);
    posts[1].grp.position.set(hB.x, TOP, hB.z);
  }

  const side = p => (hB.x - hA.x) * (p.z - hA.z) - (hB.z - hA.z) * (p.x - hA.x);
  function evaluate() {
    let a = 0, b = 0, c = 0, e = 0;
    for (const d of dots) {
      if (side(d.m.position) > 0) { d.cls ? a++ : b++; } else { d.cls ? c++ : e++; }
    }
    const posRipe = (a + e) >= (b + c);
    let wrong = 0;
    for (const d of dots) {
      const p = side(d.m.position) > 0;
      const predRipe = posRipe ? p : !p;
      d.wrong = predRipe !== !!d.cls;
      if (d.wrong) wrong++;
    }
    return { wrong, acc: 1 - wrong / dots.length };
  }

  let phase = 'adjust';
  let acc = 0, wrong = 0, animating = false;
  const tgt = { a: hA.clone(), b: hB.clone() };

  function actions() {
    if (phase === 'good') return [{ id: 'new', label: 'รับมะม่วงล็อตใหม่เข้ามา', primary: true }];
    if (phase === 'drifted') return [{ id: 'learn', label: 'ให้เครื่องขยับไม้เอง', primary: true }, { id: 'again', label: 'ขยับเองอีกครั้ง' }];
    return [];
  }
  function statusText() {
    const pct = Math.round(acc * 100);
    const okc = dots.length - wrong;
    if (phase === 'adjust') return acc >= .9
      ? '<span class="ok">แบ่งถูก ' + okc + '/' + dots.length + ' (' + pct + '%)</span> — พอแล้ว กดปุ่มข้างล่างไปต่อได้'
      : 'ตอนนี้ไม้วางผิดทาง แบ่งถูกแค่ <b>' + okc + '/' + dots.length + ' ผล (' + pct + '%)</b><br>ผลที่ตัดผิดมีวงแดงรอบตัว — ลองลากลูกบิดข้างหนึ่งขึ้นไปขอบบน อีกข้างลงมาขอบล่าง ให้ไม้<b>ตั้งเฉียง</b>คั่นกลางสองกอง (ต้องได้ 90%)';
    if (phase === 'good') return '<span class="ok">แบ่งถูก ' + pct + '%</span><br>ไม้อันนี้คือ “กฎ” ที่คุณตั้งด้วยมือ เหมือนช่างเขียนโพยใส่ตู้ในด่านที่แล้ว';
    if (phase === 'drifted') return '<span class="no">ไม้เดิมตัดผิดเยอะเลย เหลือ ' + pct + '%</span><br>ล็อตใหม่เป็นมะม่วง<b>พันธุ์ลูกเล็ก</b> — ลูกเล็กแต่สุกแล้ว ไม้เดิมเลยไปกองรวมกับพวกดิบหมด<br>ถ้าเป็นตู้กดน้ำในด่าน 1 ตอนนี้ต้องโทรตามช่างมาแก้';
    return '<span class="ok">เครื่องขยับไม้เองแล้ว: ' + pct + '%</span><br>ไม่มีใครไปแก้กฎให้มันเลย มันดูของใหม่แล้ว<b>เลื่อนไม้ของตัวเอง</b>';
  }
  function sync() {
    if (phase === 'adjust' && acc >= .9) phase = 'good';
    env.ui.panel({
      eyebrow: 'บทที่ 2 · Machine Learning',
      title: 'เครื่องปรับกฎเองจากข้อมูล',
      quote: 'เส้นที่คุณลากเรียกว่า <b>Decision Boundary</b> ครับ คือเส้นแบ่งที่โมเดลใช้ตัดสินว่าข้อมูลชิ้นหนึ่งควรอยู่กลุ่มไหน',
      who: 'G',
      body: 'Rule-Based ต้องรอคนมาแก้เงื่อนไข ส่วน <strong>Machine Learning</strong> หากฎจากข้อมูลเองได้ — แต่เริ่มจากให้คุณตั้งเส้นแบ่งเส้นแรกด้วยมือก่อน',
      task: 'จับ<b>ลูกบิดสีเขียว</b>บนหัวเสาทั้งสองข้าง แล้วลากให้ไม้กั้นแยกมะม่วงสีทอง (สุก) ออกจากสีเขียว (ดิบ)<br><span style="color:#6E7488">จับกลางราวก็ได้ — จะเลื่อนไม้ทั้งอัน</span>',
      taskLabel: 'ภารกิจ',
      meter: clamp((acc - .5) / .45, 0, 1),
      status: statusText(),
      actions: actions(),
      onAction: id => {
        if (id === 'new') {
          /* the new lot is a small-fruit variety: ripe but tiny, so the old
             diagonal fence puts them on the unripe side — the drift must be real */
          for (let i = 0; i < 11; i++) addDot(gauss(-3.0, 1.5), gauss(-3.1, 1.0), 1, true);
          for (let i = 0; i < 9; i++) addDot(gauss(2.4, 1.5), gauss(2.9, 1.0), 0, true);
          const r = evaluate(); acc = r.acc; wrong = r.wrong;
          phase = 'drifted'; sync();
        } else if (id === 'learn') {
          let best = null;
          const sa = hA.clone(), sb = hB.clone();
          for (let i = 0; i < 72; i++) {
            const th = i / 72 * Math.PI;
            const nx = Math.cos(th), nz = Math.sin(th);
            for (let j = -34; j <= 34; j++) {
              const rho = j * .22;
              const ca = new THREE.Vector3(nx * rho - nz * 40, TOP, nz * rho + nx * 40);
              const cb = new THREE.Vector3(nx * rho + nz * 40, TOP, nz * rho - nx * 40);
              hA.copy(ca); hB.copy(cb);
              const r = evaluate();
              if (!best || r.acc > best.acc) best = { acc: r.acc, a: ca.clone(), b: cb.clone() };
            }
          }
          hA.copy(sa); hB.copy(sb);
          const dir = best.b.clone().sub(best.a);
          if (Math.abs(dir.z) > 1e-4) {
            const tA = (-ZL - .1 - best.a.z) / dir.z, tB = (ZL + .1 - best.a.z) / dir.z;
            tgt.a.set(clamp(best.a.x + dir.x * tA, -XL - .4, XL + .4), TOP, -ZL - .1);
            tgt.b.set(clamp(best.a.x + dir.x * tB, -XL - .4, XL + .4), TOP, ZL + .1);
          } else {
            tgt.a.set(-XL - .4, TOP, clamp(best.a.z, -ZL, ZL));
            tgt.b.set(XL + .4, TOP, clamp(best.b.z, -ZL, ZL));
          }
          /* report the machine's result immediately — the fence animates into it */
          acc = best.acc;
          wrong = Math.round((1 - best.acc) * dots.length);
          animating = true; phase = 'learned';
          sync();
          setTimeout(() => {
            const r = evaluate(); acc = r.acc; wrong = r.wrong; sync();
            env.reveal({
              title: 'สิ่งที่เพิ่มเข้ามาในชั้นนี้คือ “กฎที่อัปเดตตัวเองได้จากข้อมูลใหม่”',
              terms: [
                { t: 'Machine Learning', d: 'เรียนจากข้อมูลใหม่แล้วปรับกฎของตัวเองได้' },
                { t: 'Classification', d: 'ขีดเส้นแบ่งของเป็นกลุ่ม — ไม้ที่คุณเพิ่งวาง' },
                { t: 'Clustering', d: 'จับของหน้าตาคล้ายกันมากองไว้ ยังไม่ต้องตั้งชื่อกลุ่ม' },
                { t: 'ปัญหาที่ค้างไว้', d: 'ยังต้องมีคนบอกว่ากองไหนสุก กองไหนดิบ' }
              ],
              note: 'อย่างที่ผมบอกตอนแรก ว่าผมเองก็อธิบายไม่ถูกว่าบีบมะม่วงแล้วรู้ได้ยังไง — ชั้นถัดไปคือทางออกของเรื่องนั้น: <b>ให้เครื่องหาเอง</b>',
              next: 'เดินเข้าชั้นถัดไป →'
            });
          }, 2000);
        } else if (id === 'again') { phase = 'adjust'; sync(); }
      }
    });
  }

  let drag = null;
  drawFence();
  { const r = evaluate(); acc = r.acc; wrong = r.wrong; }

  function onTable(rc) {
    const h = rc.intersectObject(top, false);
    return h.length ? g.worldToLocal(h[0].point.clone()) : null;
  }

  return {
    group: g, pickables: pick,
    enter() { drawFence(); sync(); },
    exit() { env.ui.panel(null); },
    pick() { },
    dragStart(obj, point) {
      if (phase === 'learned' || phase === 'drifted') { env.ui.status('ตอนนี้เป็นตาของเครื่องแล้ว — กดปุ่มข้างล่างดูก่อน'); return false; }
      const k = obj.userData.grab;
      if (k == null) return false;
      drag = { k, from: g.worldToLocal(point.clone()), a0: hA.clone(), b0: hB.clone() };
      return true;
    },
    dragMove(rc) {
      if (!drag) return;
      const p = onTable(rc);
      if (!p) return;
      if (drag.k === 'mid') {
        const dx = p.x - drag.from.x, dz = p.z - drag.from.z;
        hA.set(clamp(drag.a0.x + dx, -XL - .4, XL + .4), TOP, clamp(drag.a0.z + dz, -ZL - .6, ZL + .6));
        hB.set(clamp(drag.b0.x + dx, -XL - .4, XL + .4), TOP, clamp(drag.b0.z + dz, -ZL - .6, ZL + .6));
      } else {
        const h = drag.k === 0 ? hA : hB;
        const other = drag.k === 0 ? hB : hA;
        h.set(clamp(p.x, -XL - .4, XL + .4), TOP, clamp(p.z, -ZL - .6, ZL + .6));
        if (h.distanceTo(other) < 2.5) {
          const d = h.clone().sub(other);
          if (d.length() < 1e-3) d.set(0, 0, 1);
          h.copy(other).addScaledVector(d.normalize(), 2.5);
        }
      }
      drawFence();
      const r = evaluate(); acc = r.acc; wrong = r.wrong;
      env.ui.status('กำลังลาก… แบ่งถูก <b>' + (dots.length - wrong) + '/' + dots.length + '</b> (' + Math.round(acc * 100) + '%)');
      env.ui.meter(clamp((acc - .5) / .45, 0, 1));
    },
    dragEnd() {
      if (!drag) return;
      drag = null;
      if (phase === 'adjust' && acc >= .9) phase = 'good';
      sync();
    },
    update(dt, t) {
      if (animating) {
        const k = damp(2.6, dt);
        hA.lerp(tgt.a, k); hB.lerp(tgt.b, k);
        drawFence();
        if (hA.distanceTo(tgt.a) < .02 && hB.distanceTo(tgt.b) < .02) animating = false;
      }
      for (const d of dots) {
        if (d.grow < 1) { d.grow = Math.min(1, d.grow + dt * 2.2); d.m.scale.setScalar(d.grow); }
        d.halo.material.opacity = lerp(d.halo.material.opacity, d.wrong ? .6 : 0, damp(6, dt));
      }
      fence.material.opacity = .26 + Math.sin(t * 2) * .07;
      posts.forEach((p, i) => {
        p.ring.material.opacity = .55 + Math.sin(t * 2.4 + i * 1.5) * .25;
        p.knob.position.y = 1.5 + Math.sin(t * 1.7 + i) * .04;
      });
      grip.material.opacity = phase === 'adjust' ? .9 : 0;
    }
  };
}

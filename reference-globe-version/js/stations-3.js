import {
  THREE, COL, hex, makeCard, makeLabel, pedestal, glowSprite, Surface, tube, clamp, lerp, damp, SK, rgba, wash, accentInk, solid, inked
} from './core.js';

/* ==================================================================== 05
   LLM — เลือกคำถัดไปเอง: คุณเป็นตัวโมเดลที่ทายคำถัดไป
==================================================================== */
export function makeTokenGame(env) {
  const A = hex(COL.llm);
  const g = new THREE.Group();
  const pick = [];

  const q = makeCard({
    w: 8.0, h: 1.45, px: 110, radius: .24, align: 'center', valign: 'middle', accent: A,
    fill: wash(COL.llm, .12, .16), border: rgba(COL.llm, .5),
    title: 'คำถาม:  สัตว์อะไรน่ารักที่สุด ?', titleSize: .38
  });
  q.position.set(0, 8.1, 0);
  g.add(q);

  const title = makeLabel('คุณคือคนทายคำถัดไป', { size: .8, color: COL.ink, weight: 700 });
  title.position.set(0, 10.2, 0);
  g.add(title);

  const STEPS = [
    { opts: [{ w: 'แมว', p: .52 }, { w: 'หมา', p: .31 }, { w: 'ปลาหมึกยักษ์', p: .02 }] },
    { opts: [{ w: 'เพราะ', p: .46 }, { w: 'ที่', p: .21 }, { w: 'แต่', p: .06 }] },
    { opts: [{ w: 'ขนมันนุ่ม', p: .39 }, { w: 'เสียงมันน่ารัก', p: .24 }, { w: 'มันเสียภาษีตรงเวลา', p: .01 }] },
    { opts: [{ w: 'แล้วก็ขี้อ้อน', p: .41 }, { w: 'และตาโต', p: .18 }, { w: 'และมันบินได้', p: .02 }] }
  ];

  /* answer row */
  const rowY = 5.9;
  const tiles = [];
  function layoutRow() {
    const gap = .3;
    const total = tiles.reduce((s, t) => s + t.w, 0) + gap * Math.max(0, tiles.length - 1);
    let x = -total / 2;
    tiles.forEach(t => { t.mesh.position.x = x + t.w / 2; t.mesh.position.y = rowY; x += t.w + gap; });
  }
  const rowLb = makeLabel('คำตอบที่กำลังถูกสร้างขึ้นทีละคำ', { size: .32, color: COL.ink3, weight: 500 });
  rowLb.position.set(0, rowY + 1.3, 0);
  g.add(rowLb);

  /* candidate cards */
  const CX = [-4.7, 0, 4.7];
  const cands = CX.map((x, i) => {
    const c = makeCard({
      w: 4.1, h: 2.0, px: 110, radius: .22, align: 'center', valign: 'middle',
      fill: SK.cardFill, border: SK.cardBorder,
      title: '', titleSize: .38, sub: ''
    });
    c.position.set(x, 2.4, 0);
    c.userData.cand = i;
    c.userData.home = c.position.clone();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1, .16, .2).translate(.5, 0, 0),
      new THREE.MeshBasicMaterial({ color: COL.llm, transparent: true, opacity: .9 }));
    bar.position.set(x - 1.65, 1.1, .05);
    g.add(c, bar); pick.push(c);
    return { c, bar };
  });
  const candLb = makeLabel('คำที่เป็นไปได้ + ความน่าจะเป็น — คลิกเลือกหนึ่งคำ', { size: .34, color: A, weight: 600 });
  candLb.position.set(0, 3.9, 0);
  g.add(candLb);

  let step = 0, weird = 0, fly = null, busy = false, done = false;

  function showStep() {
    const s = STEPS[step];
    cands.forEach((cd, i) => {
      const o = s.opts[i];
      cd.c.visible = true;
      cd.c.set({ title: o.w, sub: o.p.toFixed(2), titleSize: o.w.length > 8 ? .3 : .38 });
      cd.c.position.copy(cd.c.userData.home);
      cd.c.scale.setScalar(1);
      cd.bar.visible = true;
      cd.bar.scale.x = Math.max(.06, o.p * 3.3);
      cd.bar.material.color.setHex(o.p > .3 ? COL.llm : (o.p < .05 ? 0xE58166 : 0x6E7488));
    });
  }

  function addTile(word) {
    const w = Math.max(1.5, word.length * .32 + .9);
    const m = makeCard({
      w, h: 1.1, px: 120, radius: .18, align: 'center', valign: 'middle',
      fill: wash(COL.llm, .18, .2), border: rgba(COL.llm, .6),
      title: word, titleSize: .38
    });
    m.position.set(0, rowY, 0);
    g.add(m);
    tiles.push({ mesh: m, w });
    layoutRow();
  }

  function sentence() { return tiles.map(t => t.mesh.userData.opt.title).join(' '); }

  function sync(msg) {
    env.ui.panel({
      eyebrow: 'บทที่ 5 · LLM',
      title: 'LLM ไม่ได้รู้คำตอบ แต่ทายคำถัดไป',
      quote: 'เลขบนการ์ดคือ <b>ความน่าจะเป็น</b> ของคำนั้นครับ โมเดลจะหยิบคำที่เลขสูงสุดออกมา แล้วเอาประโยคใหม่กลับเข้าไปทายคำต่อไปอีกรอบ',
      who: 'G',
      body: '<strong>LLM</strong> ทำอยู่เรื่องเดียว คือ<strong>ดูข้อความที่มีอยู่ แล้วคำนวณว่าคำถัดไปควรเป็นคำอะไร</strong> แล้วทำซ้ำทีละคำจนจบประโยค',
      task: 'คลิกเลือกคำถัดไปเอง 4 ครั้ง — ลองเลือกคำที่เลขน้อย ๆ ดูสักครั้งก็ได้ ว่าจะเกิดอะไรขึ้น',
      taskLabel: 'ภารกิจ',
      meter: step / STEPS.length,
      status: msg || 'เลขบนการ์ดคือ “ความน่าจะเป็น” ที่คำนั้นจะมาต่อ — ปกติเครื่องจะหยิบตัวที่เลขสูงสุด',
      actions: done ? [{ id: 'again', label: 'ลองสร้างประโยคใหม่' }] : [],
      onAction: id => { if (id === 'again') restart(); }
    });
  }

  function restart() {
    tiles.forEach(t => g.remove(t.mesh));
    tiles.length = 0; step = 0; weird = 0; done = false;
    showStep(); sync();
  }

  function finish() {
    done = true;
    const s = sentence();
    if (weird) {
      sync(`ประโยคที่คุณสร้าง: <b>“${s}”</b><br><span class="no">หลุดโลกไปหน่อย</span> — เวลาเครื่องหยิบคำที่ความน่าจะเป็นต่ำ ๆ นี่แหละคืออาการที่คนเรียกว่า AI “มั่ว”`);
    } else {
      sync(`ประโยคที่คุณสร้าง: <b>“${s}”</b><br><span class="ok">ลื่นไหลดี</span> — เพราะคุณหยิบคำที่ความน่าจะเป็นสูงทุกครั้ง เหมือนที่เครื่องทำ`);
    }
    setTimeout(() => env.reveal({
      title: 'LLM ทำงานแบบนี้ทั้งกระบวนการ — ทายคำถัดไปทีละคำ ไม่ได้ค้นคำตอบจากที่ไหน',
      terms: [
        { t: 'Token', d: 'ข้อความถูกซอยเป็นชิ้น การ์ดหนึ่งใบคือหนึ่งชิ้น' },
        { t: 'Prediction', d: 'คำตอบของมันคือคำที่น่าจะมาต่อที่สุด' },
        { t: 'Max(dict)', d: 'หยิบคำที่ได้คะแนนสูงสุดออกมา คือเลขบนการ์ด' },
        { t: 'ตัว L ใน LLM', d: 'Large คือจุดสังเกตมหาศาล ไม่ใช่แค่ 3 การ์ด' }
      ],
      note: 'แล้วมันรู้ได้ยังไงว่าคำไหนเกี่ยวกับคำไหน? ด่านถัดไปคือกลไกนั้น',
      next: 'ไปดูกลไกนั้น →'
    }), 1300);
  }

  showStep();

  return {
    group: g, pickables: pick,
    enter() { sync(); },
    exit() { env.ui.panel(null); },
    pick(obj) {
      if (busy || done) return;
      const i = obj.userData.cand;
      if (i == null) return;
      const o = STEPS[step].opts[i];
      if (o.p < .05) weird++;
      busy = true;
      fly = { mesh: obj, t: 0, from: obj.position.clone(), word: o.w, p: o.p };
      cands.forEach((cd, j) => { if (j !== i) { cd.c.visible = false; cd.bar.visible = false; } });
    },
    update(dt, t) {
      cands.forEach((cd, i) => { if (cd.c.visible && !fly) cd.c.position.y = cd.c.userData.home.y + Math.sin(t * 1.5 + i) * .06; });
      if (fly) {
        fly.t = Math.min(1, fly.t + dt * 1.9);
        const e = fly.t;
        fly.mesh.position.lerpVectors(fly.from, new THREE.Vector3(0, rowY, 0), e);
        fly.mesh.scale.setScalar(lerp(1, .55, e));
        if (e >= 1) {
          addTile(fly.word);
          tiles[tiles.length - 1].mesh.userData.opt = { title: fly.word };
          const low = fly.p < .05;
          fly = null; busy = false; step++;
          if (step >= STEPS.length) { cands.forEach(c => { c.c.visible = false; c.bar.visible = false; }); finish(); }
          else {
            showStep();
            sync(low
              ? `<span class="no">อ้าว…</span> คุณหยิบคำที่ความน่าจะเป็นต่ำมาก ประโยคเริ่มเพี้ยนแล้ว — ไปต่อ`
              : `ดี — คำนั้นถูกต่อเข้าประโยคแล้ว ทีนี้มันต้องทายคำถัดไปอีก`);
          }
        }
      }
    }
  };
}

/* ==================================================================== 06
   Attention — ลากเส้นโยงว่า "มัน" หมายถึงคำไหน
==================================================================== */
export function makeAttention(env) {
  const A = hex(COL.llm);
  const g = new THREE.Group();
  const pick = [];

  const ROUNDS = [
    { last: 'แข็ง', answer: 4, why: 'แข็ง = คุณสมบัติของโต๊ะ' },
    { last: 'จะแตก', answer: 2, why: 'จะแตก = คุณสมบัติของแก้ว' }
  ];
  const WORDS = ['เขา', 'วาง', 'แก้ว', 'บน', 'โต๊ะ', 'เพราะ', 'มัน', 'แข็ง'];
  const LASTW = Math.max(...ROUNDS.map(r => r.last.length));
  const IT = 6;
  const ROWS = [[0, 1, 2, 3], [4, 5, 6, 7]];
  const y = 5.6, RH = 2.15;

  const tiles = WORDS.map((w, i) => {
    const wd = Math.max(1.8, (i === WORDS.length - 1 ? LASTW : w.length) * .38 + 1.05);
    const c = makeCard({
      w: wd, h: 1.5, px: 130, radius: .22, align: 'center', valign: 'middle',
      fill: i === IT ? wash(COL.llm, .22, .24) : SK.cardFill,
      border: i === IT ? rgba(COL.llm, .8) : SK.cardBorder,
      title: w, titleSize: .46
    });
    c.userData.word = i; c.userData.w = wd;
    g.add(c); pick.push(c);
    const wt = makeLabel('', { size: .32, color: A, weight: 600, mono: true });
    g.add(wt);
    return { c, wt, w: wd };
  });
  function layout() {
    const gap = .34;
    ROWS.forEach((row, ri) => {
      const total = row.reduce((s, i) => s + tiles[i].w, 0) + gap * (row.length - 1);
      let x = -total / 2;
      row.forEach(i => {
        const t = tiles[i], cy = y - ri * RH;
        t.c.position.set(x + t.w / 2, cy, 0);
        t.wt.position.set(x + t.w / 2, cy + (ri ? -1.02 : 1.02), 0);
        x += t.w + gap;
      });
    });
  }
  layout();

  const title = makeLabel('คำเดียวเปลี่ยน — ความหมายเปลี่ยนทั้งประโยค', { size: .56, color: COL.ink, weight: 700 });
  title.position.set(0, 9.3, 0);
  const sub = makeLabel('“มัน” ในประโยคนี้ หมายถึงอะไร ?', { size: .42, color: A, weight: 600 });
  sub.position.set(0, 8.4, 0);
  g.add(title, sub);

  const band = tube(null, null, .05, COL.llm, .8, true);
  band.visible = false; g.add(band);
  const locked = [];
  const hitPlane = new THREE.Mesh(new THREE.PlaneGeometry(30, 14),
    new THREE.MeshBasicMaterial({ visible: false }));
  hitPlane.userData.noFit = true;
  hitPlane.position.set(0, y - RH / 2, -.2);
  g.add(hitPlane);

  let round = 0, dragging = false, solved = 0, done = false;

  function weightsFor(ans) {
    const w = new Array(WORDS.length).fill(.02);
    w[ans] = .71; w[IT] = .09;
    w[ans === 4 ? 2 : 4] = .11;
    w[1] = .04;
    return w;
  }
  function showWeights(ans) {
    const w = weightsFor(ans);
    tiles.forEach((t, i) => {
      t.wt.set(w[i].toFixed(2));
      const hot = i === ans;
      t.c.set({
        border: hot ? rgba(COL.llm, .9) : (i === IT ? rgba(COL.llm, .65) : SK.cardBorderSoft),
        fill: hot ? wash(COL.llm, .3, .3) : (i === IT ? wash(COL.llm, .18, .2) : SK.cardFill)
      });
    });
  }

  function sync(msg) {
    env.ui.panel({
      eyebrow: 'บทที่ 6 · Attention',
      title: 'Attention จับความสัมพันธ์ของคำ',
      quote: 'โมเดลไม่รู้ความหมายของคำเดี่ยว ๆ ครับ มันคำนวณ<b>น้ำหนักความสัมพันธ์</b>ระหว่างคำทุกคู่ในประโยค แล้วใช้น้ำหนักนั้นตัดสินว่า “มัน” หมายถึงอะไร',
      who: 'G',
      body: 'ประโยคเดียวกัน เปลี่ยนคำสุดท้ายคำเดียว ความหมายของ “มัน” ก็ย้ายไปอีกคำ — <strong>คนอ่านรู้ทันที ส่วนเครื่องต้องคำนวณ</strong>',
      task: `<b>รอบที่ ${round + 1}/2</b> — ประโยคจบด้วยคำว่า “<b>${ROUNDS[round].last}</b>”<br>ลากเส้นจากการ์ด <b>“มัน”</b> ไปยังคำที่มันหมายถึง`,
      taskLabel: 'ภารกิจ',
      meter: solved / 2,
      status: msg || 'กดที่การ์ด “มัน” แล้วลากไปปล่อยบนคำที่คุณคิดว่าถูก',
      actions: [],
      onAction: () => { }
    });
  }

  function nextRound() {
    round++;
    if (round >= ROUNDS.length) { finish(); return; }
    WORDS[WORDS.length - 1] = ROUNDS[round].last;
    tiles[tiles.length - 1].c.set({ title: ROUNDS[round].last });
    layout();
    tiles.forEach(t => t.wt.set(''));
    locked.forEach(l => g.remove(l)); locked.length = 0;
    tiles.forEach((t, i) => t.c.set({
      fill: i === IT ? wash(COL.llm, .22, .24) : SK.cardFill,
      border: i === IT ? rgba(COL.llm, .8) : SK.cardBorder
    }));
    sync(`<span class="ok">ถูกต้อง!</span> ทีนี้เปลี่ยนคำสุดท้ายเป็น “<b>${ROUNDS[round].last}</b>” — คำว่า “มัน” ย้ายไปหมายถึงอะไรแล้ว?`);
  }

  function finish() {
    done = true;
    sync(`<span class="ok">ถูกทั้งสองรอบ</span> คุณเพิ่งทำสิ่งที่ Transformer ทำ: ชั่งน้ำหนักว่าคำไหนควร<b>มอง</b>คำไหน`);
    setTimeout(() => env.reveal({
      title: 'Attention คือกลไกที่บอกว่าคำไหนควรให้น้ำหนักกับคำไหน',
      terms: [
        { t: 'Attention', d: 'ตัวบอกว่าคำไหนควรให้น้ำหนักกับคำไหน' },
        { t: 'Transformer', d: 'โครงข่างที่ LLM ใช้ มี Attention เป็นหัวใจ' },
        { t: 'Encoder / Decoder', d: 'ตัวแปลงข้อความเป็นตัวเลข และแปลงกลับมา' },
        { t: 'ทำไมต้องมี', d: 'ความหมายอยู่ในความสัมพันธ์ระหว่างคำ ไม่ใช่คำเดี่ยว' }
      ],
      note: 'เหลือเรื่องเดียว: โมเดลหนึ่งตัว<b>ถูกเลี้ยงมายังไง</b> กว่าจะเป็นตัวที่เราคุยด้วยได้',
      next: 'ไปด่านสุดท้าย →'
    }), 1200);
  }

  return {
    group: g, pickables: pick,
    enter() { sync(); },
    exit() { env.ui.panel(null); },
    pick() { },
    dragStart(obj) {
      if (done) return false;
      if (obj.userData.word !== IT) { env.ui.status('ต้องเริ่มลากจากการ์ด <b>“มัน”</b> นะ'); return false; }
      dragging = true; band.visible = true;
      return true;
    },
    dragMove(rc) {
      if (!dragging) return;
      const h = rc.intersectObject(hitPlane, false);
      if (!h.length) return;
      const from = tiles[IT].c.getWorldPosition(new THREE.Vector3());
      band.aim(from, h[0].point);
    },
    dragEnd(rc) {
      if (!dragging) return;
      dragging = false; band.visible = false;
      const hits = rc.intersectObjects(pick, false);
      const t = hits.length ? hits[0].object.userData.word : null;
      if (t == null || t === IT) { env.ui.status('ปล่อยเส้นลงบน<b>การ์ดคำ</b> ที่คุณคิดว่า “มัน” หมายถึง'); return; }
      const ans = ROUNDS[round].answer;
      if (t === ans) {
        const from = tiles[IT].c.getWorldPosition(new THREE.Vector3());
        const to = tiles[t].c.getWorldPosition(new THREE.Vector3());
        const b = tube(from, to, .07, COL.llm, .95, true);
        g.add(b); locked.push(b);
        showWeights(ans);
        solved++;
        if (round === 0) setTimeout(nextRound, 1600);
        else { sync(`<span class="ok">ถูก!</span> ${ROUNDS[round].why}`); setTimeout(finish, 900); }
      } else {
        env.ui.status(`<span class="no">ยังไม่ใช่</span> — ลองคิดว่าคำว่า “${ROUNDS[round].last}” มันใช้บรรยายของชิ้นไหนในประโยค`);
      }
    },
    update(dt, t) {
      locked.forEach((l, i) => l.material.opacity = .6 + Math.sin(t * 3 + i) * .3);
    }
  };
}

/* ==================================================================== 07
   Lifecycle — สอนโมเดลหนึ่งตัวจนใช้งานได้
==================================================================== */
export function makeLifecycle(env) {
  const A = hex(COL.llm);
  const g = new THREE.Group();
  const pick = [];

  const STAGES = [
    {
      t: 'อ่านหนังสือทั้งโลก', s: 'ยังไม่มีใครสอนให้ทำงาน',
      ans: 'อีเมลคือข้อความอิเล็กทรอนิกส์ ซึ่งเริ่มใช้กันตั้งแต่ปี 1971 โดย…',
      note: 'รู้เยอะมหาศาล แต่ยังไม่ทำตามที่สั่ง',
      term: 'Pretrain Model'
    },
    {
      t: 'การ์ดสอนงาน', s: 'ตัวอย่างงานที่ทำถูก ๆ',
      ans: 'สรุปให้ครับ: ลูกค้าขอเลื่อนนัดออกไป',
      note: 'ทำตามคำสั่งได้แล้ว แต่ยังไม่รู้ว่าคำตอบแบบไหนที่คนชอบ',
      term: 'Fine-Tuning → Instruct Model'
    },
    {
      t: 'ปุ่มชม / ปุ่มติ', s: 'คนบอกว่าคำตอบไหนดี',
      ans: 'สรุปให้ครับ: ลูกค้าขอเลื่อนนัด และขอโทษที่แจ้งช้า — ให้ผมร่างข้อความตอบกลับด้วยไหมครับ?',
      note: 'ตอบในแบบที่คนให้คะแนนว่าดี',
      term: 'Reinforcement Learning'
    },
    {
      t: 'แฟ้มงานของเราเอง', s: 'ข้อมูลที่เราแนบให้ตอนใช้',
      ans: 'จากอีเมลที่แนบมา: คุณเอขอเลื่อนนัดจากพุธ → ศุกร์ 14:00 และขอใบเสนอราคาเวอร์ชัน 2 ครับ',
      note: 'แม่นขึ้นทันที เพราะเราป้อนข้อมูลจริงให้มันด้วย',
      term: 'In-Context Learning'
    }
  ];

  const orb = new THREE.Group();
  orb.position.set(-3.6, 6.6, 0);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1),
    new THREE.MeshBasicMaterial({ color: 0x1b2130, transparent: true, opacity: .5 }));
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1.52, 1)),
    new THREE.LineBasicMaterial({ color: COL.llm, transparent: true, opacity: .35 }));
  const halo = glowSprite(6, COL.llm, .18);
  orb.add(core, wire, halo);
  const rings = [0, 1, 2].map(i => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(2.2 + i * .5, .035, 6, 72),
      new THREE.MeshBasicMaterial({ color: COL.llm, transparent: true, opacity: 0 }));
    r.rotation.set(1.1 + i * .5, i * .8, 0);
    orb.add(r); return r;
  });
  const sat = new THREE.Mesh(new THREE.BoxGeometry(.5, .65, .1),
    new THREE.MeshBasicMaterial({ color: 0xEAF3EA, transparent: true, opacity: 0 }));
  orb.add(sat);
  g.add(orb);

  const orbLb = makeLabel('โมเดลหนึ่งตัว', { size: .42, color: COL.ink2, weight: 600 });
  orbLb.position.set(-3.6, 9.2, 0);
  g.add(orbLb);

  const ask = makeCard({
    w: 6.4, h: 1.25, px: 110, radius: .22, align: 'center', valign: 'middle',
    fill: SK.cardFill, border: SK.cardBorder,
    title: 'เราสั่งว่า: “สรุปอีเมลฉบับนี้ให้ลูกค้า”', titleSize: .27, titleColor: COL.ink2
  });
  ask.position.set(-3.0, 10.6, 0);
  const say = makeCard({
    w: 7.2, h: 3.1, px: 110, radius: .24, accent: A, bar: true,
    kicker: 'มันตอบว่า', body: 'ยังตอบอะไรไม่ได้เลย — ยังไม่ได้สอน', bodySize: .26, foot: ''
  });
  say.position.set(4.6, 6.6, 0);
  g.add(ask, say);

  const bench = pedestal(13.4, 2.6, COL.llm, 1.0);
  bench.position.set(0, 0, 3.4);
  g.add(bench);

  const cards = STAGES.map((s, i) => {
    const c = makeCard({
      w: 3.0, h: 1.7, px: 120, radius: .2, align: 'center', valign: 'middle',
      fill: SK.cardFill, border: SK.cardBorder,
      title: s.t, titleSize: .26, sub: '', body: s.s, bodySize: .21, bodyColor: COL.ink3
    });
    c.position.set(-5.0 + i * 3.34, 2.2, 3.3);
    c.rotation.x = -.24;
    c.userData.stage = i;
    g.add(c); pick.push(c);
    const num = makeLabel(String(i + 1), { size: .34, color: COL.ink3, weight: 700, mono: true });
    num.position.set(-5.0 + i * 3.34, 3.3, 3.3);
    g.add(num);
    return { c, num };
  });

  const title = makeLabel('ด่านสุดท้าย · สอนโมเดลหนึ่งตัว', { size: .78, color: COL.ink, weight: 700 });
  title.position.set(-.4, 13.1, 0);
  const sub = makeLabel('ป้อนให้ถูกลำดับ 1 → 4 แล้วดูคำตอบมันเปลี่ยน', { size: .4, color: COL.ink3, weight: 400 });
  sub.position.set(-.4, 12.35, 0);
  g.add(title, sub);

  const streams = [];
  for (let i = 0; i < 14; i++) {
    const s = glowSprite(.9, COL.llm, 0); g.add(s);
    streams.push({ s, t: -1, from: new THREE.Vector3(), to: new THREE.Vector3() });
  }

  let fed = 0, done = false;

  function sync(msg) {
    env.ui.panel({
      eyebrow: 'บทที่ 7 · Training Lifecycle',
      title: 'โมเดลถูกเทรนมายังไง',
      quote: 'สามขั้นแรกเกิดขึ้นที่ผู้พัฒนาโมเดลครับ ส่วนขั้นที่สี่ <b>In-Context Learning</b> คือขั้นเดียวที่เราทำเองได้ ด้วยการแนบข้อมูลจริงไปตอนใช้งาน',
      who: 'G',
      body: 'โมเดลหนึ่งตัวผ่านการเทรน<strong>สี่ขั้นตามลำดับ</strong> และขั้นสุดท้ายเป็นขั้นเดียวที่<strong>อยู่ในมือผู้ใช้</strong>',
      task: 'คลิกป้อนของทั้ง 4 อย่างตามลำดับ 1 → 4 แล้วอ่านคำตอบของมันในแต่ละขั้น',
      taskLabel: 'ภารกิจ',
      meter: fed / 4,
      status: msg || 'เริ่มจากใบซ้ายสุด: กองหนังสือทั้งโลก',
      actions: [],
      onAction: () => { }
    });
  }

  function feed(i) {
    if (i !== fed) { env.ui.status(`ยังไม่ถึงคิวของใบนี้ — ต้องป้อนใบที่ <b>${fed + 1}</b> ก่อน`); return; }
    const s = STAGES[i];
    fed++;
    cards[i].c.set({
      fill: wash(COL.llm, .18, .2), border: rgba(COL.llm, .75),
      body: 'ป้อนแล้ว ✓', bodyColor: accentInk(COL.llm)
    });
    const from = cards[i].c.getWorldPosition(new THREE.Vector3());
    const to = orb.getWorldPosition(new THREE.Vector3());
    streams.forEach((st, k) => {
      st.from.copy(from).add(new THREE.Vector3((Math.random() - .5) * 2, (Math.random() - .5) * .8, 0));
      st.to.copy(to); st.t = -k * .05;
    });
    say.set({ body: s.ans, foot: s.note, kicker: 'มันตอบว่า · ขั้นที่ ' + fed });
    sync(`<b>${s.term}</b> — ${s.note}`);
    if (fed >= 4 && !done) { done = true; setTimeout(reveal, 1400); }
  }

  function reveal() {
    env.reveal({
      title: 'สี่ขั้นที่ทำให้โมเดลใช้งานได้จริง — ขั้นที่สี่คือขั้นที่เราทำเองได้',
      terms: [
        { t: 'Pretrain Model', d: 'อ่านข้อมูลมหาศาลเอง รู้มาก แต่ยังทำงานไม่เก่ง' },
        { t: 'Fine-Tuning → Instruct Model', d: 'สอนด้วยตัวอย่างงานที่ถูก จนทำงานเฉพาะทางได้' },
        { t: 'Reinforcement Learning', d: 'คนกดชมกดติ โมเดลปรับให้ตอบแบบที่คนชอบ' },
        { t: 'In-Context Learning', d: 'ป้อนข้อมูลจริงตอนใช้งาน ไม่ต้องเทรนใหม่' }
      ],
      note: 'ครบทั้ง 4 ชั้นแล้ว — เดินไปที่ใจกลางเพื่อดูภาพรวมทั้งหมดอีกครั้ง',
      next: 'ไปดูภาพรวมที่ใจกลาง →'
    });
  }

  return {
    group: g, pickables: pick,
    enter() { sync(); },
    exit() { env.ui.panel(null); },
    pick(obj) { if (obj.userData.stage != null && !done) feed(obj.userData.stage); },
    update(dt, t) {
      orb.rotation.y += dt * .25;
      wire.material.opacity = .3 + fed * .12;
      halo.material.opacity = .14 + fed * .07;
      halo.scale.setScalar(6 + fed * .7);
      core.material.opacity = .4 + fed * .1;
      core.scale.setScalar(1 + fed * .06);
      rings.forEach((r, i) => {
        r.material.opacity = lerp(r.material.opacity, fed > i ? .5 : 0, damp(3, dt));
        r.rotation.z += dt * (.2 + i * .12);
      });
      sat.material.opacity = lerp(sat.material.opacity, fed >= 4 ? .9 : 0, damp(3, dt));
      sat.position.set(Math.cos(t * .9) * 2.6, Math.sin(t * 1.3) * .6, Math.sin(t * .9) * 2.6);
      streams.forEach(st => {
        if (st.t < -.9) { st.s.material.opacity = 0; return; }
        st.t += dt * 1.1;
        if (st.t > 1) { st.t = -1; st.s.material.opacity = 0; return; }
        if (st.t < 0) return;
        st.s.position.lerpVectors(st.from, st.to, st.t);
        st.s.position.y += Math.sin(st.t * Math.PI) * 1.2;
        st.s.material.opacity = .8 * Math.sin(st.t * Math.PI);
      });
    }
  };
}

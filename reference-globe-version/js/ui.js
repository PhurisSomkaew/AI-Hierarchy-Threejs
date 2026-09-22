/* DOM overlay: HUD, station panel, term-reveal card, chapter menu, hints */

const $ = s => document.querySelector(s);

export function createUI() {
  const hud = $('#hud'), panel = $('#panel'), reveal = $('#reveal'),
    revealIn = reveal.querySelector('.in'), menu = $('#menu'), menuRows = $('#menu-rows'),
    hint = $('#hint'), vig = $('#vig');

  let actionHandler = null;
  let nextHandler = null;

  panel.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (b && actionHandler) actionHandler(b.dataset.act);
  });
  revealIn.addEventListener('click', e => {
    if (e.target.closest('[data-next]') && nextHandler) nextHandler();
  });

  const api = {
    /* accent colour drives the whole overlay */
    accent(cssColor, textColor) {
      document.documentElement.style.setProperty('--accent', cssColor);
      document.documentElement.style.setProperty('--accentTx', textColor || cssColor);
      vig.style.background =
        `radial-gradient(120% 90% at 50% 112%, ${cssColor}22, transparent 62%),` +
        `radial-gradient(80% 60% at 50% -10%, ${cssColor}14, transparent 60%)`;
    },
    chapter({ no, name, en }) {
      hud.querySelector('.no').textContent = no;
      hud.querySelector('.nm').textContent = name;
      hud.querySelector('.en').textContent = en;
    },
    panel(spec) {
      if (!spec) { panel.classList.add('off'); return; }
      const acts = (spec.actions || []).map(a =>
        `<button class="btn ${a.primary ? 'pri' : ''}" data-act="${a.id}"${a.disabled ? ' disabled style="opacity:.4;cursor:default"' : ''}>${a.label}</button>`).join('');
      panel.innerHTML =
        '<div class="scroll"><div class="grow">' +
        (spec.eyebrow ? `<div class="eyebrow">${spec.eyebrow}</div>` : '') +
        (spec.title ? `<h2>${spec.title}</h2>` : '') +
        /* what to do comes first — the story is below it, a scroll away */
        (spec.task ? `<div class="task"><div class="t">${spec.taskLabel || 'ลองทำดู'}</div><p>${spec.task}</p></div>` : '') +
        (spec.meter != null ? `<div class="meter"><i style="width:${Math.round(spec.meter * 100)}%"></i></div>` : '') +
        (spec.body ? `<p>${spec.body}</p>` : '') +
        (spec.quote ? `<div class="quote"><span class="who">${spec.who || 'G'}</span><p>${spec.quote}</p></div>` : '') +
        '</div>' +
        (spec.status ? `<div class="status">${spec.status}</div>` : '') +
        '</div>' +
        (acts ? `<div class="acts">${acts}</div>` : '');
      panel.classList.remove('off');
      actionHandler = spec.onAction || null;
    },
    /* patch only the live parts, so buttons don't lose focus / flicker */
    status(html) {
      const s = panel.querySelector('.status');
      if (s) { s.innerHTML = html; return; }
      const sc = panel.querySelector('.scroll');
      if (!sc) { api.panel({ status: html }); return; }
      const d = document.createElement('div');
      d.className = 'status';
      d.innerHTML = html;
      sc.appendChild(d);
    },
    meter(v) {
      const m = panel.querySelector('.meter i');
      if (m) m.style.width = Math.round(clamp01(v) * 100) + '%';
    },
    reveal(spec) {
      if (!spec) { reveal.classList.add('off'); return; }
      revealIn.innerHTML =
        `<div class="lead">${spec.lead || 'เฉลยศัพท์จริงของสิ่งที่คุณเพิ่งทำ'}</div>` +
        `<h3>${spec.title}</h3>` +
        `<div class="terms">${(spec.terms || []).map(t => `<div class="term"><b>${t.t}</b><span>${t.d}</span></div>`).join('')}</div>` +
        `<div class="foot"><p>${spec.note || ''}</p>` +
        `<button class="btn pri" data-next="1">${spec.next || 'เดินต่อ →'}</button></div>`;
      reveal.classList.remove('off');
      panel.classList.add('raised');
      nextHandler = spec.onNext || null;
    },
    hideReveal() { reveal.classList.add('off'); panel.classList.remove('raised'); },
    hint(on) { hint.classList.toggle('off', !on); },
    menu(chapters, onPick) {
      menuRows.innerHTML = chapters.map((c, i) =>
        `<div class="row" data-i="${i}" style="--c:${c.css};--ct:${c.cssTx || c.css}">
           <span class="n">${c.no}</span>
           <span class="tt"><b>${c.name}</b><span>${c.tease}</span></span>
           <span class="en">${c.en}</span>
           <span class="tick" data-done="${i}"></span>
         </div>`).join('');
      menuRows.onclick = e => {
        const r = e.target.closest('.row');
        if (r) { api.closeMenu(); onPick(+r.dataset.i); }
      };
    },
    markDone(i) {
      const t = menuRows.querySelector(`[data-done="${i}"]`);
      if (t) t.textContent = '✓ เล่นแล้ว';
    },
    openMenu() { menu.classList.remove('off'); },
    closeMenu() { menu.classList.add('off'); },
    toggleMenu() { menu.classList.toggle('off'); },
    menuOpen() { return !menu.classList.contains('off'); },
    onMenuButton(fn) { $('#btn-menu').onclick = fn; },
    onHideButton(fn) { $('#btn-hide').onclick = fn; },
    onBackButton(fn) { $('#btn-back').onclick = fn; },
    backEnabled(on) {
      const b = $('#btn-back');
      b.style.opacity = on ? '1' : '.35';
      b.style.pointerEvents = on ? 'auto' : 'none';
    },
    hideLabel(min) {
      $('#btn-hide').innerHTML = (min ? 'แสดงคำอธิบาย' : 'ซ่อนคำอธิบาย') + ' <kbd>H</kbd>';
    },
    onStart(fn) { $('#btn-start').onclick = fn; },
    hideIntro() { $('#intro').classList.add('off'); setTimeout(() => { $('#intro').style.display = 'none'; }, 900); },
    hideLoading() { $('#loading').classList.add('off'); }
  };
  const clamp01 = v => Math.min(1, Math.max(0, v));
  return api;
}

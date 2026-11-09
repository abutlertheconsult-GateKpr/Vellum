// Everything about adding, moving, resizing and deleting marks.
// To add a new tool: add a button in index.html, then handle its type in draw() here and in export.js.
App.tools = {
  layers: {},
  uid() { return Math.random().toString(36).slice(2, 9); },
  list(n) { return App.annots[n] || (App.annots[n] = []); },
  find(n, id) { return this.list(n).find(a => a.id === id); },
  changed() { App.store.saveSoon(); },

  attach(layer, n) {
    this.layers[n] = layer;
    const pos = e => { const r = layer.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };

    layer.addEventListener('pointerdown', e => {
      const t = App.tool, p = pos(e);
      if (t === 'fill') { // form fields handle their own taps; buttons and links are followed
        const hit = e.target.closest('.ann');
        if (hit && ['link', 'iconbtn'].includes(hit.dataset.type)) App.nav.follow(this.find(n, hit.dataset.id));
        if (hit && hit.dataset.type === 'sig') App.sign.tap(n, this.find(n, hit.dataset.id));
        return;
      }
      const el = e.target.closest('.ann');
      if (e.target.classList.contains('grip')) return this.drag(layer, e, n, App.selected.id, 'resize', pos);
      if (t === 'select') {
        if (!el || (el.isContentEditable)) { if (!el) this.select(null); return; }
        const was = App.selected && App.selected.id === el.dataset.id;
        this.select(n, el.dataset.id);
        return this.drag(layer, e, n, el.dataset.id, 'move', pos, was);
      }
      // drawing tools
      const a = { id: this.uid(), type: t, x: p.x, y: p.y, w: 0, h: 0, x2: p.x, y2: p.y, color: App.color };
      if (t.startsWith('sig-')) { // a signature, initials or date box
        const k = t.slice(4);
        Object.assign(a, { type: 'sig', kind: k, w: k === 'initials' ? .13 : k === 'date' ? .2 : .3, h: k === 'initials' ? .04 : k === 'date' ? .03 : .045, signer: App.sign.currentSigner, img: null, text: '', color: '#d4b483' });
        this.list(n).push(a); App.setTool('select'); this.select(n, a.id); this.draw(n); this.changed(); return;
      }
      if (t.startsWith('f-')) { // a fillable field
        const f = t.slice(2), sq = f === 'check' || f === 'radio';
        Object.assign(a, { type: 'field', ftype: f, name: '', options: [], choice: '', w: sq ? .03 : .3, h: sq ? .03 * layer.clientWidth / layer.clientHeight : .035, color: '#8c9fff' });
        this.list(n).push(a); App.setTool('select'); this.select(n, a.id); this.draw(n); App.designer.edit(n, a, true); return;
      }
      if (t === 'iconbtn') {
        Object.assign(a, { w: .07, h: .07 * layer.clientWidth / layer.clientHeight, icon: 'home', kind: 'page', page: 1, color: '#d4b483', every: true, group: this.uid() });
        this.list(n).push(a); App.setTool('select'); this.select(n, a.id); this.draw(n); App.nav.edit(n, a, true); return;
      }
      if (t === 'text' || t === 'note') {
        Object.assign(a, t === 'note' ? { w: .26, h: .14, fs: .02, text: '', color: '#ffd95a' } : { w: .3, h: .04, text: '', ...App.textStyle });
        this.list(n).push(a); this.select(n, a.id); App.setTool('select');
        this.edit(n, a.id); this.changed(); return;
      }
      this.list(n).push(a);
      layer.setPointerCapture(e.pointerId);
      const move = ev => {
        const q = pos(ev);
        if (t === 'arrow') { a.x2 = q.x; a.y2 = q.y; } else { a.w = q.x - p.x; a.h = q.y - p.y; }
        this.draw(n);
      };
      const up = () => {
        layer.removeEventListener('pointermove', move); layer.removeEventListener('pointerup', up);
        if (a.w < 0) { a.x += a.w; a.w = -a.w; }
        if (a.h < 0) { a.y += a.h; a.h = -a.h; }
        const tiny = t === 'arrow' ? Math.hypot(a.x2 - a.x, a.y2 - a.y) < .01 : (a.w < .01 || a.h < .005);
        if (tiny) this.list(n).splice(this.list(n).indexOf(a), 1); else this.select(n, a.id);
        this.draw(n); this.changed();
        if (!tiny && t === 'link') { a.kind = 'url'; App.setTool('select'); App.nav.edit(n, a, true); }
      };
      layer.addEventListener('pointermove', move); layer.addEventListener('pointerup', up);
    });
  },

  drag(layer, e, n, id, mode, pos, was) {
    const a = this.find(n, id), start = pos(e), o = { ...a };
    let moved = false;
    layer.setPointerCapture(e.pointerId);
    const move = ev => {
      const q = pos(ev), dx = q.x - start.x, dy = q.y - start.y;
      if (Math.hypot(dx, dy) > .004) moved = true;
      if (mode === 'move') { a.x = o.x + dx; a.y = o.y + dy; if (a.type === 'arrow') { a.x2 = o.x2 + dx; a.y2 = o.y2 + dy; } }
      else if (a.type === 'arrow') { a.x2 = o.x2 + dx; a.y2 = o.y2 + dy; }
      else { a.w = Math.max(.03, o.w + dx); a.h = Math.max(.01, o.h + dy); }
      this.draw(n);
    };
    const up = () => {
      layer.removeEventListener('pointermove', move); layer.removeEventListener('pointerup', up); this.changed();
      if (a.every) { App.nav.sync(a); Object.keys(this.layers).forEach(k => this.draw(+k)); }
      if (!moved && was && mode === 'move') { // tap a selected item: type in it, or follow it
        if (a.type === 'text' || a.type === 'note') this.edit(n, id);
        else if (a.type === 'link' || a.type === 'iconbtn') App.nav.follow(a);
        else if (a.type === 'sig') App.sign.tap(n, a);
      }
    };
    layer.addEventListener('pointermove', move); layer.addEventListener('pointerup', up);
  },

  select(n, id) {
    App.selected = id ? { n, id } : null;
    document.body.classList.toggle('has-sel', !!id);
    document.body.classList.toggle('has-text', !!id && this.find(n, id).type === 'text');
    document.body.classList.toggle('has-link', !!id && ['link', 'iconbtn', 'field'].includes(this.find(n, id).type));
    document.body.classList.toggle('has-sig', !!id && this.find(n, id).type === 'sig');
    if (id && this.find(n, id).type === 'sig') $('sigSigner').value = this.find(n, id).signer || 1;
    App.textPaint && App.textPaint();
    Object.keys(this.layers).forEach(k => this.draw(+k));
  },

  remove() {
    if (!App.selected) return;
    const { n, id } = App.selected;
    const gone = this.find(n, id);
    if (gone && gone.every && gone.group) for (const k of Object.keys(App.annots)) App.annots[k] = App.annots[k].filter(a => a.group !== gone.group);
    else App.annots[n] = this.list(n).filter(a => a.id !== id);
    App.selected = null; document.body.classList.remove('has-sel', 'has-text', 'has-link', 'has-sig'); Object.keys(this.layers).forEach(k => this.draw(+k)); this.changed();
  },

  setColor(c) {
    if (!App.selected) return;
    const a = this.find(App.selected.n, App.selected.id);
    a.color = c; App.nav.sync(a);
    Object.keys(this.layers).forEach(k => this.draw(+k)); this.changed();
  },

  edit(n, id) {
    const el = this.layers[n].querySelector(`[data-id="${id}"]`);
    if (!el || !['text', 'note'].includes(el.dataset.type)) return;
    el.contentEditable = 'true'; el.focus();
    el.onblur = () => { this.find(n, id).text = el.innerText; el.contentEditable = 'false'; this.changed(); };
  },

  draw(n) {
    const layer = this.layers[n]; if (!layer) return;
    App.sign && App.sign.count();
    const W = layer.clientWidth, H = layer.clientHeight, ns = 'http://www.w3.org/2000/svg';
    layer.innerHTML = '';
    for (const a of this.list(n)) {
      let el;
      if (a.type === 'arrow') {
        el = document.createElementNS(ns, 'svg');
        const x1 = a.x * W, y1 = a.y * H, x2 = a.x2 * W, y2 = a.y2 * H, ang = Math.atan2(y2 - y1, x2 - x1);
        const head = [.5, -.5].map(d => `<line x1="${x2}" y1="${y2}" x2="${x2 - 14 * Math.cos(ang + d)}" y2="${y2 - 14 * Math.sin(ang + d)}" stroke="${a.color}" stroke-width="3" stroke-linecap="round" style="pointer-events:none"/>`).join('');
        el.innerHTML = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${a.color}" stroke-width="3" stroke-linecap="round" style="pointer-events:none"/>${head}<line class="hit" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
        el.setAttribute('class', 'ann arrow');
        el.addEventListener('pointerdown', e => { if (App.tool !== 'select') return; e.stopPropagation(); this.select(n, a.id); this.drag(layer, e, n, a.id, 'move', ev => { const r = layer.getBoundingClientRect(); return { x: (ev.clientX - r.left) / r.width, y: (ev.clientY - r.top) / r.height }; }); });
      } else {
        el = document.createElement('div');
        el.className = 'ann ' + a.type;
        Object.assign(el.style, { left: a.x * 100 + '%', top: a.y * 100 + '%', width: a.w * 100 + '%', height: a.h * 100 + '%' });
        if (a.type === 'highlight') el.style.background = a.color;
        if (a.type === 'iconbtn') { el.innerHTML = `<svg viewBox="0 0 24 24"><path d="${App.icons[a.icon || 'home']}"/></svg>`; el.style.borderColor = a.color; el.style.color = a.color; }
        if (a.type === 'sig') {
          el.style.setProperty('--sc', App.sign.signerColors[(a.signer || 1) - 1] || '#d4b483'); el.classList.toggle('signed', !!a.img);
          el.innerHTML = a.img ? `<img src="${a.img}" alt="">` : a.kind === 'date' ? `<span>${a.text || 'Date'}</span>` : `<span>${a.kind === 'initials' ? 'Initials' : 'Sign here'}</span><b>S${a.signer || 1}</b>`;
        }
        if (a.type === 'field') { el.classList.add('f-' + a.ftype); el.textContent = ['check', 'radio'].includes(a.ftype) ? '' : (a.name || 'field') + (a.ftype === 'drop' ? '  ▾' : ''); }
        if (a.type === 'image') { const im = new Image(); im.src = a.src; im.draggable = false; el.appendChild(im); }
        if (a.type === 'rect' || a.type === 'ellipse') el.style.borderColor = a.color;
        if (a.type === 'text' || a.type === 'note') {
          el.style.fontSize = a.fs * W + 'px'; el.textContent = a.text; el.ondblclick = () => this.edit(n, a.id);
          if (a.type === 'note') el.style.background = a.color;
          else {
            el.style.color = a.color; el.style.height = 'auto'; el.style.minHeight = a.h * 100 + '%';
            el.style.fontFamily = App.fonts[a.font || 'sans'].css;
            if (a.bold) el.style.fontWeight = '700';
            if (a.italic) el.style.fontStyle = 'italic';
          }
        }
      }
      el.dataset.id = a.id; el.dataset.type = a.type;
      if (App.selected && App.selected.id === a.id) {
        el.classList.add('sel');
        if (a.type !== 'highlight' || true) { const g = document.createElement('div'); g.className = 'grip'; if (a.type === 'arrow') { g.style.cssText = `left:${a.x2 * W - 8}px;top:${a.y2 * H - 8}px;right:auto;bottom:auto`; layer.appendChild(el); g.dataset.id = a.id; layer.appendChild(g); continue; } el.appendChild(g); }
      }
      layer.appendChild(el);
    }
  }
};

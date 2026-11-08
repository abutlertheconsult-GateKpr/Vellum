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
      if (t === 'fill') return; // form fields handle their own taps
      const el = e.target.closest('.ann');
      if (e.target.classList.contains('grip')) return this.drag(layer, e, n, App.selected.id, 'resize', pos);
      if (t === 'select') {
        if (!el || (el.isContentEditable)) { if (!el) this.select(null); return; }
        this.select(n, el.dataset.id);
        return this.drag(layer, e, n, el.dataset.id, 'move', pos);
      }
      // drawing tools
      const a = { id: this.uid(), type: t, x: p.x, y: p.y, w: 0, h: 0, x2: p.x, y2: p.y, color: App.color };
      if (t === 'text') {
        Object.assign(a, { w: .3, h: .04, fs: .022, text: '' });
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
      };
      layer.addEventListener('pointermove', move); layer.addEventListener('pointerup', up);
    });
  },

  drag(layer, e, n, id, mode, pos) {
    const a = this.find(n, id), start = pos(e), o = { ...a };
    layer.setPointerCapture(e.pointerId);
    const move = ev => {
      const q = pos(ev), dx = q.x - start.x, dy = q.y - start.y;
      if (mode === 'move') { a.x = o.x + dx; a.y = o.y + dy; if (a.type === 'arrow') { a.x2 = o.x2 + dx; a.y2 = o.y2 + dy; } }
      else if (a.type === 'arrow') { a.x2 = o.x2 + dx; a.y2 = o.y2 + dy; }
      else { a.w = Math.max(.03, o.w + dx); a.h = Math.max(.01, o.h + dy); }
      this.draw(n);
    };
    const up = () => { layer.removeEventListener('pointermove', move); layer.removeEventListener('pointerup', up); this.changed(); };
    layer.addEventListener('pointermove', move); layer.addEventListener('pointerup', up);
  },

  select(n, id) {
    App.selected = id ? { n, id } : null;
    document.body.classList.toggle('has-sel', !!id);
    Object.keys(this.layers).forEach(k => this.draw(+k));
  },

  remove() {
    if (!App.selected) return;
    const { n, id } = App.selected;
    App.annots[n] = this.list(n).filter(a => a.id !== id);
    App.selected = null; document.body.classList.remove('has-sel'); this.draw(n); this.changed();
  },

  setColor(c) {
    if (!App.selected) return;
    this.find(App.selected.n, App.selected.id).color = c;
    this.draw(App.selected.n); this.changed();
  },

  edit(n, id) {
    const el = this.layers[n].querySelector(`[data-id="${id}"]`);
    if (!el || el.dataset.type !== 'text') return;
    el.contentEditable = 'true'; el.focus();
    el.onblur = () => { this.find(n, id).text = el.innerText; el.contentEditable = 'false'; this.changed(); };
  },

  draw(n) {
    const layer = this.layers[n]; if (!layer) return;
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
        if (a.type === 'rect' || a.type === 'ellipse') el.style.borderColor = a.color;
        if (a.type === 'text') { el.style.color = a.color; el.style.fontSize = a.fs * W + 'px'; el.style.height = 'auto'; el.style.minHeight = a.h * 100 + '%'; el.textContent = a.text; el.ondblclick = () => this.edit(n, a.id); }
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

// Undo and redo. Remembers your marks and typed answers after each change (up to 40 steps).
// It starts fresh when a document opens or when pages change.
App.history = {
  stack: [], i: -1, t: null, busy: false,
  now() { return { a: JSON.stringify(App.annots), f: JSON.stringify(App.fields) }; },
  total() { return this.stack.reduce((n, s) => n + s.a.length + s.f.length, 0); },
  reset() { clearTimeout(this.t); this.stack = [this.now()]; this.i = 0; this.paint(); },
  touch() { if (this.busy) return; clearTimeout(this.t); this.t = setTimeout(() => this.snap(), 500); },
  snap() {
    if (!App.pdf || this.busy) return;
    const s = this.now(), cur = this.stack[this.i];
    if (cur && cur.a === s.a && cur.f === s.f) return;
    this.stack = this.stack.slice(0, this.i + 1); this.stack.push(s);
    while (this.stack.length > 40 || this.total() > 40e6) this.stack.shift(); // keep memory small
    this.i = this.stack.length - 1; this.paint();
  },
  async go(d) {
    clearTimeout(this.t); this.snap(); // capture anything still waiting first
    const j = this.i + d; if (j < 0 || j >= this.stack.length || !App.pdf) return;
    const s = this.stack[j], fieldsChanged = s.f !== this.stack[this.i].f, y = scrollY;
    this.busy = true; this.i = j;
    App.annots = JSON.parse(s.a); App.fields = JSON.parse(s.f); App.selected = null;
    document.body.classList.remove('has-sel', 'has-text', 'has-link', 'has-sig');
    if (fieldsChanged) { await App.viewer.render(); scrollTo(0, y); } else App.nav.redraw();
    this.busy = false; App.store.saveSoon(); this.paint();
  },
  paint() { $('undoBtn').disabled = this.i <= 0; $('redoBtn').disabled = this.i < 0 || this.i >= this.stack.length - 1; }
};
$('undoBtn').onclick = () => App.history.go(-1);
$('redoBtn').onclick = () => App.history.go(1);
addEventListener('keydown', e => {
  if (!(e.ctrlKey || e.metaKey) || e.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if (k === 'z') { e.preventDefault(); App.history.go(e.shiftKey ? 1 : -1); }
  else if (k === 'y') { e.preventDefault(); App.history.go(1); }
});

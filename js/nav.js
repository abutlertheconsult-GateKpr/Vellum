// Links and icon buttons: web addresses, folders, or jumps to a page. Icon buttons can repeat on every page.
App.icons = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  up: 'M5 15l7-7 7 7',
  list: 'M5 7h14M5 12h14M5 17h14',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'
};
App.nav = {
  kind: 'url', icon: 'home', cur: null,

  normUrl(u) {
    u = u.trim();
    if (/^[a-z]:[\\/]/i.test(u) || u.startsWith('\\\\')) return 'file:///' + u.replace(/\\/g, '/');
    if (/^[a-z][a-z0-9+.-]+:/i.test(u)) return u;
    return 'https://' + u;
  },
  goPage(t) {
    const p = document.querySelectorAll('.page')[t - 1];
    if (p) p.scrollIntoView({ behavior: 'smooth', block: 'start' }); else App.settings.toast('That page doesn’t exist.');
  },
  follow(a) {
    if (a.kind === 'page') this.goPage(a.page);
    else if (a.url) window.open(this.normUrl(a.url), '_blank', 'noopener');
  },
  redraw() { Object.keys(App.tools.layers).forEach(k => App.tools.draw(+k)); },

  // Keep every copy of a repeating button identical, and make sure every page has one.
  sync(a) {
    if (!a.every || !a.group) return;
    for (const list of Object.values(App.annots)) for (const b of list)
      if (b.group === a.group && b !== a) Object.assign(b, { x: a.x, y: a.y, w: a.w, h: a.h, icon: a.icon, kind: a.kind, url: a.url, page: a.page, color: a.color, every: true });
    this.ensureEvery();
  },
  ensureEvery() {
    const tpl = {};
    for (const list of Object.values(App.annots)) for (const b of list) if (b.every && b.group && !tpl[b.group]) tpl[b.group] = b;
    const N = App.pdf ? App.pdf.numPages : 0;
    for (const g of Object.keys(tpl)) for (let n = 1; n <= N; n++) {
      const list = App.tools.list(n);
      if (!list.some(b => b.group === g)) list.push({ ...tpl[g], id: App.tools.uid() });
    }
  },

  edit(n, a, fresh) {
    this.cur = { n, a, fresh };
    const btn = a.type === 'iconbtn';
    $('linkTitle').textContent = btn ? 'Icon button' : 'Link area';
    $('iconRow').hidden = $('everyRow').hidden = !btn;
    this.setKind(a.kind || 'url');
    $('linkUrl').value = a.url || ''; $('linkPage').value = a.page || '';
    this.icon = a.icon || 'home'; $('linkEvery').checked = a.every !== false;
    this.paintIcons(); $('linkDlg').showModal();
  },
  setKind(k) {
    this.kind = k;
    $('kUrl').classList.toggle('on', k === 'url'); $('kPage').classList.toggle('on', k === 'page');
    $('linkUrl').hidden = k !== 'url'; $('linkPage').hidden = k !== 'page';
  },
  paintIcons() { document.querySelectorAll('#iconRow [data-icon]').forEach(b => b.classList.toggle('on', b.dataset.icon === this.icon)); },

  ok() {
    const { n, a } = this.cur;
    a.kind = this.kind; a.url = $('linkUrl').value.trim(); a.page = Math.max(1, +$('linkPage').value || 1);
    if (a.type === 'iconbtn') {
      a.icon = this.icon;
      const every = $('linkEvery').checked;
      if (!every && a.every) for (const k of Object.keys(App.annots)) App.annots[k] = App.annots[k].filter(b => b === a || b.group !== a.group);
      a.every = every; a.group = every ? (a.group || App.tools.uid()) : null;
    }
    $('linkDlg').close(); this.sync(a); this.redraw(); App.store.saveSoon();
  },
  cancel() {
    const { n, a, fresh } = this.cur;
    $('linkDlg').close();
    if (fresh) { App.annots[n] = App.tools.list(n).filter(b => b !== a); App.tools.select(null); this.redraw(); }
  }
};
$('iconRow').innerHTML = Object.keys(App.icons).map(k => `<button type="button" class="ib" data-icon="${k}"><svg class="ic" viewBox="0 0 24 24"><path d="${App.icons[k]}"/></svg></button>`).join('');
$('iconRow').onclick = e => { const b = e.target.closest('[data-icon]'); if (b) { App.nav.icon = b.dataset.icon; App.nav.paintIcons(); } };
$('kUrl').onclick = () => App.nav.setKind('url');
$('kPage').onclick = () => App.nav.setKind('page');
$('linkOk').onclick = () => App.nav.ok();
$('linkCancel').onclick = () => App.nav.cancel();
$('editLink').onclick = () => { if (App.selected) App.nav.edit(App.selected.n, App.tools.find(App.selected.n, App.selected.id)); };

// Templates: save a document with its boxes and marks once, then start a fresh copy whenever you need one.
// Signatures and typed answers are not kept. Templates live on this device.
App.templates = {
  async list() { return (await App.store.get('tpl:index')) || []; },

  async saveCurrent() {
    if (!App.pdf) return App.settings.toast('Open or create a PDF first.');
    if (App.sec.user || App.sec.owner) return App.settings.toast('Remove the password first. Templates aren’t saved with passwords.');
    await App.designer.bake();
    $('tplName').value = App.name.replace(/\.pdf$/i, ''); $('tplDlg').showModal();
  },
  async commit() {
    const name = $('tplName').value.trim() || 'Template', id = App.tools.uid() + Date.now().toString(36);
    const annots = JSON.parse(JSON.stringify(App.annots));
    Object.values(annots).flat().forEach(a => { if (a.type === 'sig') { a.img = null; if (a.kind === 'date') a.text = ''; } });
    await App.store.put('tpl:' + id, { bytes: App.bytes, annots });
    await App.store.put('tpl:index', [...(await this.list()), { id, name, created: Date.now() }]);
    $('tplDlg').close(); App.settings.toast('Template saved.'); this.paint();
  },

  async use(id) {
    const rec = await App.store.get('tpl:' + id), meta = (await this.list()).find(t => t.id === id);
    if (!rec || !meta) return App.settings.toast('That template is missing.');
    App.resetSec(); App.annots = JSON.parse(JSON.stringify(rec.annots)); App.fields = {};
    try { await App.viewer.load(rec.bytes); } catch (e) { return App.settings.toast('Couldn’t open that template.'); }
    App.name = meta.name + '.pdf'; App.selected = null; App.counter(); App.store.saveSoon();
    App.home.hide(); $('sendPanel').hidden = true; document.body.classList.remove('noscroll');
    if (App.sign.all().length) document.body.classList.add('tray-sign');
    App.settings.toast(`New copy ready from “${meta.name}”.`);
  },
  async remove(id) {
    if (!confirm('Delete this template?')) return;
    await App.store.put('tpl:' + id, null);
    await App.store.put('tpl:index', (await this.list()).filter(t => t.id !== id));
    this.paint();
  },

  async paint() {
    const l = await this.list(), E = App.cloud.esc;
    $('homeTpl').hidden = !l.length;
    $('tplList').innerHTML = l.map(t => `<div class="tpl"><button data-use="${t.id}">${E(t.name)}</button><button class="x" data-del="${t.id}" aria-label="Delete template">✕</button></div>`).join('');
    $('tplPickList').innerHTML = l.map(t => `<button data-use="${t.id}">${E(t.name)}</button>`).join('');
  }
};
$('tplList').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.use) App.templates.use(b.dataset.use); else if (b.dataset.del) App.templates.remove(b.dataset.del);
};
$('tplPickList').onclick = e => { const b = e.target.closest('[data-use]'); if (b) { $('tplPick').close(); App.templates.use(b.dataset.use); } };
$('tplOk').onclick = () => App.templates.commit();
$('tplCancel').onclick = () => $('tplDlg').close();
$('tplSaveBtn').onclick = () => { $('menu').hidden = true; App.templates.saveCurrent(); };
$('tplPickClose').onclick = () => $('tplPick').close();
$('tplPickFile').onclick = () => {
  $('tplPick').close(); if (!App.pdf) $('file').click();
  document.body.classList.add('tray-sign'); App.settings.toast('Place signature boxes, then tap Send.');
};
// "New request": if a document is open, ask whether to close it. Then offer templates, or a file.
const beginRequest = async () => {
  $('sendPanel').hidden = true; document.body.classList.remove('noscroll');
  if ((await App.templates.list()).length) { $('tplPickFile').textContent = App.pdf ? 'Use the open document' : 'Open a PDF file'; return $('tplPick').showModal(); }
  if (!App.pdf) { $('file').click(); App.settings.toast('Choose the PDF to send. If nothing opens, tap the folder button at the top.'); }
  document.body.classList.add('tray-sign'); App.settings.toast('Place signature boxes, then tap Send.');
};
$('spNew').onclick = () => { if (App.pdf) { $('newReqName').textContent = App.name; $('newReqDlg').showModal(); } else beginRequest(); };
$('newReqClose').onclick = async () => { $('newReqDlg').close(); await App.closeDoc(); beginRequest(); };
$('newReqKeep').onclick = () => { $('newReqDlg').close(); beginRequest(); };
$('newReqCancel').onclick = () => $('newReqDlg').close();
App.templates.paint();

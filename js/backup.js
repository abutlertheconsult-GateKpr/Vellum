// Backup and restore. A backup is one file with your open document (and its marks) plus all your templates.
// It never includes passwords, your sign-in, or password-protected documents.
App.backup = {
  async make() {
    const C = App.cloud, tpls = [];
    for (const t of await App.templates.list()) {
      const r = await App.store.get('tpl:' + t.id);
      if (r) tpls.push({ ...t, bytes: C.toB64(r.bytes), annots: r.annots });
    }
    const protectedDoc = !!(App.sec.user || App.sec.owner);
    const doc = App.pdf && App.bytes && !protectedDoc ? { name: App.name, bytes: C.toB64(App.bytes), annots: App.annots, fields: App.fields } : null;
    return { protectedDoc, json: new TextEncoder().encode(JSON.stringify({ vellum: 1, made: new Date().toISOString(), doc, templates: tpls, backupLink: App.settings.backupLink })) };
  },

  async now() {
    if (App.pdf) await App.designer.bake();
    const r = await this.make(), day = new Date().toISOString().slice(0, 10);
    $('settings').close();
    App.settings.offer(r.json, `vellum-backup-${day}.json`, {
      mime: 'application/json', ext: 'json', kind: 'backup',
      after: () => { if (App.settings.backupLink) { App.settings.toast('Backup saved. Drop it into your folder.'); App.settings.openLink(); } }
    });
    if (r.protectedDoc) $('saveMsg').textContent = 'The password-protected document was left out.';
  },

  async restore(file) {
    let d; try { d = JSON.parse(await file.text()); } catch (e) {}
    if (!d || d.vellum !== 1) return App.settings.toast('That isn’t a Vellum backup file.');
    const n = (d.templates || []).length;
    if (!confirm(`Restore this backup?\n\n${d.doc ? '1 document' : 'No document'} and ${n} ${n === 1 ? 'template' : 'templates'}.\nThis replaces the templates on this device${d.doc ? ' and the document you have open' : ''}.`)) return;
    const C = App.cloud;
    for (const t of await App.templates.list()) await App.store.put('tpl:' + t.id, null);
    for (const t of d.templates || []) await App.store.put('tpl:' + t.id, { bytes: C.fromB64(t.bytes), annots: t.annots });
    await App.store.put('tpl:index', (d.templates || []).map(({ id, name, created }) => ({ id, name, created })));
    if (typeof d.backupLink === 'string') { App.settings.backupLink = d.backupLink; await App.store.put('backupLink', d.backupLink); $('backupLink').value = d.backupLink; }
    if (d.doc) {
      App.resetSec(); App.annots = d.doc.annots || {}; App.fields = d.doc.fields || {}; App.selected = null;
      try { await App.viewer.load(C.fromB64(d.doc.bytes)); App.name = d.doc.name; App.counter(); App.store.saveSoon(); }
      catch (e) { App.settings.toast('The templates came back, but the document couldn’t be opened.'); }
    }
    App.templates.paint(); $('settings').close(); App.settings.toast('Restored.');
  }
};
$('backupNow').onclick = () => App.backup.now();
$('restoreBtn').onclick = () => $('restoreFile').click();
$('restoreFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) App.backup.restore(f); };
$('backupOpen').onclick = () => App.settings.openLink();
$('backupLink').onchange = e => { App.settings.backupLink = e.target.value.trim(); App.store.put('backupLink', App.settings.backupLink); };
$('openAfterPdf').onchange = e => { App.settings.openAfterPdf = e.target.checked; App.store.put('openAfterPdf', e.target.checked); };

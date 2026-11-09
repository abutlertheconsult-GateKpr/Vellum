// Passwords. Nothing here is ever stored: passwords live only while the app is open.
// App.sec is what the next saved copy will use. App.openPassword is only for opening the current file.
App.resetSec = () => { App.sec = { user: '', owner: '', print: true, edit: true, copy: true }; App.openPassword = null; };
App.resetSec();
App.pdfLoad = bytes => PDFLib.PDFDocument.load(bytes, { password: App.openPassword || '' });

App.askPassword = wrong => new Promise(ok => {
  const dlg = $('pwDlg'), done = v => { dlg.close(); ok(v); };
  $('pwMsg').textContent = wrong ? 'That password didn’t work. Try again.' : 'This file is password protected.';
  $('pwIn').value = ''; dlg.showModal(); $('pwIn').focus();
  $('pwOk').onclick = () => done($('pwIn').value);
  $('pwNo').onclick = () => done(null);
  dlg.oncancel = e => { e.preventDefault(); done(null); };
});

App.openPdf = bytes => new Promise((ok, no) => {
  const task = pdfjsLib.getDocument({ data: bytes.slice(0), password: App.openPassword || undefined });
  task.onPassword = async (update, reason) => {
    const pw = await App.askPassword(reason === 2);
    if (pw === null) { task.destroy(); no(new Error('cancelled')); return; }
    App.openPassword = pw; update(pw);
  };
  task.promise.then(ok, no);
});

(() => {
  const protectedNow = () => !!(App.sec.user || App.sec.owner);
  const check = () => {
    if (App.sec.user && $('secCur').value !== App.sec.user) { $('secMsg').textContent = 'The current open password doesn’t match.'; return false; }
    return true;
  };
  const finish = msg => {
    $('secDlg').close(); App.settings.toast(msg);
    protectedNow() ? App.store.put('doc', null) : App.store.saveSoon(); // protected files are never kept on this device
  };
  $('secBtn').onclick = () => {
    $('menu').hidden = true;
    if (!App.pdf) return App.settings.toast('Open or create a PDF first.');
    $('secUser').value = App.sec.user; $('secOwner').value = App.sec.owner;
    $('secPrint').checked = App.sec.print; $('secEdit').checked = App.sec.edit; $('secCopy').checked = App.sec.copy;
    $('secCurRow').hidden = !App.sec.user; $('secCur').value = ''; $('secMsg').textContent = '';
    $('secStatus').textContent = protectedNow() ? 'The next saved copy will have a password.' : 'This file isn’t password protected.';
    $('secDlg').showModal();
  };
  $('secApply').onclick = () => {
    if (!check()) return;
    const sec = { user: $('secUser').value, owner: $('secOwner').value, print: $('secPrint').checked, edit: $('secEdit').checked, copy: $('secCopy').checked };
    if ((!sec.print || !sec.edit || !sec.copy) && !sec.owner) { $('secMsg').textContent = 'To limit printing, editing or copying, add a permissions password.'; return; }
    App.sec = sec; finish('Applied. It takes effect when you save.');
  };
  $('secRemove').onclick = () => {
    if (!check()) return;
    App.sec = { user: '', owner: '', print: true, edit: true, copy: true }; finish('The next saved copy will have no password.');
  };
  $('secCancel').onclick = () => $('secDlg').close();
})();

// A protected file that has been opened keeps its old lock when saved. This removes it,
// so "Remove password" and "Change password" really replace the old one.
App.clean = doc => {
  const ctx = doc.context;
  ctx.security = undefined; delete ctx.trailerInfo.Encrypt;
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    const s = String(obj.toString ? obj.toString() : '');
    if (/\/Filter\s*\/Standard/.test(s) && /\/R\s+\d/.test(s)) ctx.delete(ref);
  }
};

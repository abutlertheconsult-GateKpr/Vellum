// Settings (save folder, install) and the Save PDF flow.
App.settings = {
  folder: null,
  hasDir: 'showDirectoryPicker' in window,
  hasSaveAs: 'showSaveFilePicker' in window,
  touch: matchMedia('(pointer:coarse)').matches,

  async init() {
    if (this.hasDir) this.folder = (await App.store.get('folder')) || null;
    this.paint(); this.paintInstall(); this.wire();
  },

  paint() {
    $('folderName').textContent = this.folder ? this.folder.name : 'Not set';
    $('pickFolder').hidden = !this.hasDir;
    $('clearFolder').hidden = !this.folder;
    $('folderNote').textContent = this.hasDir
      ? 'Save PDF will offer this folder, and you can still browse to a different one.'
      : 'This browser can’t remember a folder. Save PDF will open your share or download options, where you pick the folder yourself.';
  },

  paintInstall() {
    const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    $('install').hidden = !this.deferred;
    $('installNote').textContent = installed ? 'Installed. You’re using the app.'
      : this.deferred ? 'Install for its own icon and offline use.'
      : ios ? 'On iPhone or iPad: tap Share, then “Add to Home Screen”.'
      : 'Use your browser menu and choose “Install app” (it only shows once the page is hosted online).';
  },

  wire() {
    $('settingsBtn').onclick = () => $('settings').showModal();
    $('closeSettings').onclick = () => $('settings').close();
    $('pickFolder').onclick = async () => {
      try { this.folder = await showDirectoryPicker({ mode: 'readwrite', id: 'pdfstudio' }); await App.store.put('folder', this.folder); this.paint(); } catch (e) {}
    };
    $('clearFolder').onclick = async () => { this.folder = null; await App.store.put('folder', null); this.paint(); };
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); this.deferred = e; this.paintInstall(); });
    window.addEventListener('appinstalled', () => { this.deferred = null; this.paintInstall(); });
    $('install').onclick = async () => { if (this.deferred) { this.deferred.prompt(); await this.deferred.userChoice; this.deferred = null; this.paintInstall(); } };

    $('saveCancel').onclick = () => $('saveDlg').close();
    $('saveHere').onclick = () => this.run(async () => {
      if (!(await this.allowed(this.folder))) throw new Error('Permission is needed. Tap again and choose Allow.');
      return this.toFolder(this.folder);
    });
    $('saveBrowse').onclick = () => this.run(async () => {
      const p = this.pending;
      if (this.hasSaveAs) {
        const h = await showSaveFilePicker({ suggestedName: p.name, types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }] });
        const w = await h.createWritable(); await w.write(p.bytes); await w.close(); return h.name;
      }
      return this.toFolder(await showDirectoryPicker({ mode: 'readwrite' }));
    });
    $('saveShare').onclick = () => this.run(async () => {
      const p = this.pending, file = new File([p.bytes], p.name, { type: 'application/pdf' });
      if (this.touch && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return p.name; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = p.name; a.click(); return p.name;
    });
  },

  // Opens the Save box. The PDF is built first so the buttons can act right away.
  async save() {
    if (!App.bytes) return;
    this.pending = { bytes: await App.exporter.make(), name: App.name.replace(/\.pdf$/i, '') + '-edited.pdf' };
    $('saveName').textContent = this.pending.name;
    $('saveMsg').textContent = '';
    $('saveHere').hidden = !(this.folder && this.hasDir);
    if (this.folder) $('saveHere').textContent = 'Save to “' + this.folder.name + '”';
    $('saveBrowse').hidden = !(this.hasSaveAs || this.hasDir);
    $('saveShare').textContent = this.touch && navigator.canShare ? 'Share or save to Files' : 'Download';
    $('saveDlg').showModal();
  },

  async run(fn) {
    try { const name = await fn(); $('saveDlg').close(); this.toast('Saved: ' + name); }
    catch (e) { if (e.name !== 'AbortError') $('saveMsg').textContent = e.message || 'Could not save. Try another option.'; }
  },

  async allowed(h) {
    let p = await h.queryPermission({ mode: 'readwrite' });
    if (p !== 'granted') p = await h.requestPermission({ mode: 'readwrite' });
    return p === 'granted';
  },

  async toFolder(dir) { // never overwrites: adds (2), (3)... if the name is taken
    let name = this.pending.name, i = 1;
    for (;;) { try { await dir.getFileHandle(name); name = this.pending.name.replace(/\.pdf$/i, '') + ' (' + (++i) + ').pdf'; } catch (e) { break; } }
    const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
    await w.write(this.pending.bytes); await w.close();
    return name;
  },

  toast(msg) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(this.tt); this.tt = setTimeout(() => t.hidden = true, 3000);
  }
};

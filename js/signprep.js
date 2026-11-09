// Getting a document ready for signing: signature/initial/date boxes, finding "Signature ____" lines,
// the "left to complete" counter, and the Send box.
App.sign = {
  currentSigner: 1, myName: '',
  signerColors: ['#d4b483', '#7cc4ff', '#9be38f', '#f29ec7'],

  all() { return Object.entries(App.annots).flatMap(([n, l]) => l.filter(a => a.type === 'sig').map(a => [+n, a])); },

  count() { // "3 signatures · 2 initials to complete"
    const el = $('sigCount'); if (!el) return;
    const b = this.all().map(x => x[1]), s = b.filter(a => a.kind === 'signature'), i = b.filter(a => a.kind === 'initials');
    const ls = s.filter(a => !a.img).length, li = i.filter(a => !a.img).length;
    el.hidden = !(s.length + i.length);
    el.textContent = ls + li === 0 ? 'All signed ✓' :
      [ls && `${ls} ${ls === 1 ? 'signature' : 'signatures'}`, li && `${li} ${li === 1 ? 'initial' : 'initials'}`].filter(Boolean).join(' · ') + ' to complete';
  },

  async tap(n, a) { // sign one of your own boxes right here
    if (a.kind === 'date') { a.text = new Date().toLocaleDateString(); return this.refresh(); }
    const r = await SigPad.open({ kind: a.kind, name: this.myName, askAll: true });
    if (!r) return;
    if (r.text) this.myName = r.text;
    for (const [, b] of this.all()) if (b.kind === a.kind && (b === a || r.all)) b.img = r.img;
    this.refresh();
  },
  refresh() { App.nav.redraw(); App.store.saveSoon(); },

  // Look for labels like "Signature:" and put a box on the line to the right of each.
  async detect() {
    if (!App.pdf) return App.settings.toast('Open a PDF first.');
    let found = 0;
    for (let n = 1; n <= App.pdf.numPages; n++) {
      const page = await App.pdf.getPage(n), [x0, y0, x1, y1] = page.view, W = x1 - x0, H = y1 - y0;
      const items = (await page.getTextContent()).items.filter(t => t.str && t.str.trim());
      for (const t of items) {
        if (t.str.length > 40) continue; // skip sentences
        const kind = /\binitials?\b/i.test(t.str) ? 'initials' : /\bsignature\b|\bsign here\b/i.test(t.str) ? 'signature' : null;
        if (!kind) continue;
        const e = t.transform[4], f = t.transform[5], right = e + t.width, m = t.str.match(/_{3,}/);
        let sx, ex;
        if (m) { sx = e + t.width * m.index / t.str.length; ex = e + t.width * (m.index + m[0].length) / t.str.length; }
        else {
          const next = items.filter(o => o !== t && Math.abs(o.transform[5] - f) < 4 && o.transform[4] >= right - 2).sort((a, b) => a.transform[4] - b.transform[4])[0];
          sx = right + 6;
          if (next && /^[\s_\-–—.]{3,}$/.test(next.str)) { sx = next.transform[4]; ex = sx + next.width; }
          else ex = next ? next.transform[4] - 6 : Math.min(x1 - 36, sx + 240);
        }
        if (ex - sx < 50) ex = sx + 200;
        const bw = Math.min(ex - sx, kind === 'initials' ? 90 : 260), bh = kind === 'initials' ? 28 : 32, top = f - 3 + bh;
        const a = { id: App.tools.uid(), type: 'sig', kind, x: (sx - x0) / W, y: (y1 - top) / H, w: bw / W, h: bh / H, signer: this.currentSigner, img: null, text: '', color: '#d4b483' };
        const list = App.tools.list(n);
        if (list.some(b => b.type === 'sig' && Math.abs(b.x - a.x) < .05 && Math.abs(b.y - a.y) < .03)) continue;
        list.push(a); found++;
      }
    }
    this.refresh();
    App.settings.toast(found ? `Found ${found} ${found === 1 ? 'spot' : 'spots'}. Check them and delete any that are wrong.` : 'No “Signature” or “Initials” labels found. Use the Signature tool to place boxes.');
  },

  // Send for signatures
  async send() {
    if (App.sec.user || App.sec.owner) return App.settings.toast('Remove the password first. Signers open the file without one.');
    const boxes = this.all().filter(([, a]) => !a.img);
    if (!boxes.length) return App.settings.toast('Add signature or initial boxes first.');
    const nos = [...new Set(boxes.map(([, a]) => a.signer || 1))].sort();
    $('sendRows').innerHTML = nos.map(no => `<div class="srow"><b style="color:${this.signerColors[no - 1]}">Signer ${no}</b>
      <input type="text" data-no="${no}" data-f="name" placeholder="Name" autocomplete="off"><input type="email" data-no="${no}" data-f="email" placeholder="Email (optional)" autocomplete="off"></div>`).join('');
    $('sendOut').innerHTML = ''; $('sendMsg').textContent = ''; $('sendGo').hidden = false; $('sendGo').disabled = false;
    $('sendDlg').showModal();
  },
  async go() {
    const nos = [...new Set(this.all().filter(([, a]) => !a.img).map(([, a]) => a.signer || 1))].sort();
    const signers = nos.map(no => ({ no, name: document.querySelector(`[data-no="${no}"][data-f=name]`).value.trim() || 'Signer ' + no, email: document.querySelector(`[data-no="${no}"][data-f=email]`).value.trim() }));
    $('sendGo').disabled = true; $('sendMsg').textContent = 'Creating links…';
    try {
      const links = await App.cloud.createRequest({ name: App.name, signers, boxes: this.all().filter(([, a]) => !a.img) });
      $('sendMsg').textContent = 'Links work once and expire in 14 days.'; $('sendGo').hidden = true;
      $('sendOut').innerHTML = links.map((l, i) => `<div class="lrow"><span>${App.cloud.esc(l.name)}</span><div>
        <button class="pbtn" data-i="${i}" data-a="copy">Copy</button>${navigator.share ? `<button class="pbtn" data-i="${i}" data-a="share">Share</button>` : ''}<button class="pbtn" data-i="${i}" data-a="mail">Email</button></div></div>`).join('');
      this.links = links;
    } catch (e) { $('sendMsg').textContent = e.message === 'cancelled' ? 'Sign in to send.' : e.message; $('sendGo').disabled = false; }
  }
};
$('sigFind').onclick = () => { document.body.classList.remove('tray-sign'); App.sign.detect(); };
$('sigSend').onclick = () => { document.body.classList.remove('tray-sign'); App.sign.send(); };
$('sendGo').onclick = () => App.sign.go();
$('sendClose').onclick = () => $('sendDlg').close();
$('sendOut').onclick = async e => {
  const b = e.target.closest('button'); if (!b) return;
  const l = App.sign.links[+b.dataset.i], text = `Please sign ${App.name}:`;
  if (b.dataset.a === 'copy') { try { await navigator.clipboard.writeText(l.url); App.settings.toast('Link copied.'); } catch (x) { prompt('Copy this link:', l.url); } }
  else if (b.dataset.a === 'share') { try { await navigator.share({ title: 'Please sign', text, url: l.url }); } catch (x) {} }
  else App.cloud.email(l);
};
$('sigSigner').onchange = e => {
  if (!App.selected) return;
  const a = App.tools.find(App.selected.n, App.selected.id), v = +e.target.value;
  a.signer = v; App.sign.currentSigner = v; App.sign.refresh();
};

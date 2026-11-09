// Everything that talks to Firebase: sign-in, creating signing links, the requests list, and building the signed PDF.
App.cloud = {
  cfg: window.VELLUM_FIREBASE || {},
  CHUNK: 700000,
  esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),

  init() {
    if (this.db) return true;
    if (!window.firebase || !this.cfg.apiKey || /^PASTE/.test(this.cfg.apiKey)) return false;
    firebase.initializeApp(this.cfg); this.auth = firebase.auth(); this.db = firebase.firestore();
    return true;
  },
  user() { return new Promise(ok => { const off = this.auth.onAuthStateChanged(u => { off(); ok(u); }); }); },
  async requireUser() {
    if (!this.init()) throw new Error('Firebase isn’t set up yet. See SETUP.md, then fill in js/firebase-config.js.');
    return (await this.user()) || this.askLogin();
  },
  askLogin() {
    return new Promise((ok, no) => {
      const d = $('authDlg'), msg = t => $('auMsg').textContent = t;
      const go = async make => {
        try { msg('One moment…'); const e = $('auEmail').value.trim(), p = $('auPass').value; const r = make ? await this.auth.createUserWithEmailAndPassword(e, p) : await this.auth.signInWithEmailAndPassword(e, p); d.close(); ok(r.user); }
        catch (e) { msg(e.message.replace(/^Firebase: /, '').replace(/ \(auth.*\)\.?$/, '')); }
      };
      $('auIn').onclick = () => go(false); $('auNew').onclick = () => go(true);
      $('auCancel').onclick = () => { d.close(); no(new Error('cancelled')); };
      d.oncancel = e => { e.preventDefault(); $('auCancel').onclick(); };
      msg(''); d.showModal();
    });
  },

  token() { const a = new Uint8Array(24); crypto.getRandomValues(a); return [...a].map(b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join(''); },
  toB64(u) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); },
  fromB64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; },
  linkUrl(t) { const u = new URL('sign.html', location.href); u.search = ''; u.hash = ''; u.searchParams.set('t', t); return u.href; },

  async createRequest({ name, signers, boxes }) {
    const u = await this.requireUser();
    await App.designer.bake();
    const bytes = await App.exporter.make({ flatten: false });
    if (bytes.length > 6e6) throw new Error('This file is too large to send (limit about 6 MB).');
    const parts = []; const b64 = this.toB64(bytes);
    for (let i = 0; i < b64.length; i += this.CHUNK) parts.push(b64.slice(i, i + this.CHUNK));
    const db = this.db, ts = firebase.firestore.FieldValue.serverTimestamp(), reqId = this.token().slice(0, 16);
    await db.collection('requests').doc(reqId).set({ ownerUid: u.uid, name, chunks: parts.length, createdAt: ts });
    await Promise.all(parts.map((p, i) => db.collection('requests').doc(reqId).collection('chunks').doc(String(i)).set({ i, data: p })));
    const out = [];
    for (const s of signers) {
      const tok = this.token();
      const mine = boxes.filter(([, a]) => (a.signer || 1) === s.no).map(([n, a]) => ({ id: a.id, page: n, x: a.x, y: a.y, w: a.w, h: a.h, kind: a.kind }));
      await db.collection('links').doc(tok).set({ ownerUid: u.uid, ownerEmail: u.email, reqId, docName: name, signerNo: s.no, signerName: s.name, signerEmail: s.email,
        boxes: mine, chunks: parts.length, used: false, createdAt: ts, expiresAt: firebase.firestore.Timestamp.fromMillis(Date.now() + 14 * 864e5) });
      await Promise.all(parts.map((p, i) => db.collection('links').doc(tok).collection('chunks').doc(String(i)).set({ i, data: p })));
      out.push({ ...s, token: tok, url: this.linkUrl(tok), docName: name, ownerEmail: u.email });
    }
    return out;
  },

  email(l) {
    const subject = `Please sign: ${l.docName}`;
    if (this.cfg.emailExtension && l.email) {
      this.db.collection('mail').add({ to: [l.email], message: { subject, html: `<p>Hi ${this.esc(l.name)},</p><p>${this.esc(l.ownerEmail)} asked you to sign <b>${this.esc(l.docName)}</b>.</p><p><a href="${l.url}">Open and sign</a></p><p>The link works once and expires in 14 days.</p>` } })
        .then(() => App.settings.toast('Email sent.'), () => App.settings.toast('Couldn’t send the email.'));
    } else {
      const a = document.createElement('a');
      a.href = `mailto:${l.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`Hi ${l.name},\n\nPlease sign ${l.docName} here:\n${l.url}\n\nThe link works once and expires in 14 days.`)}`;
      a.click();
    }
  },

  // The requests list
  async list() {
    const u = await this.requireUser();
    return (await this.db.collection('links').where('ownerUid', '==', u.uid).get()).docs.map(d => ({ token: d.id, ...d.data() }));
  },
  async openDashboard() {
    $('sendPanel').hidden = false; document.body.classList.add('noscroll');
    const body = $('spBody'); body.innerHTML = '<p class="spmsg">Loading…</p>';
    try { this.render(await this.list()); }
    catch (e) { body.innerHTML = `<p class="spmsg">${this.esc(e.message === 'cancelled' ? 'Sign in to see your signature requests.' : e.message)}</p><button class="pbtn gold" id="spRetry">Try again</button>`; $('spRetry').onclick = () => this.openDashboard(); }
  },
  render(all) {
    const by = {}; all.forEach(l => (by[l.reqId] = by[l.reqId] || []).push(l));
    const ms = l => (l.createdAt && l.createdAt.toMillis ? l.createdAt.toMillis() : 0);
    const reqs = Object.values(by).map(ls => ls.sort((a, b) => a.signerNo - b.signerNo)).sort((a, b) => ms(b[0]) - ms(a[0]));
    const E = this.esc, tot = (ls, k, used) => ls.filter(l => !used || l.used).reduce((n, l) => n + l.boxes.filter(b => b.kind === k).length, 0);
    this.reqs = by;
    $('spBody').innerHTML = (reqs.length ? reqs.map(ls => {
      const nd = ls.filter(l => l.used).length;
      return `<div class="rq" data-req="${ls[0].reqId}"><div class="rqh"><b>${E(ls[0].docName)}</b><span>${nd} of ${ls.length} signed</span></div>
        <div class="rqs">${tot(ls, 'signature', 1)}/${tot(ls, 'signature')} signatures · ${tot(ls, 'initials', 1)}/${tot(ls, 'initials')} initials</div>
        ${ls.map(l => `<div class="rqrow"><span>${E(l.signerName || 'Signer ' + l.signerNo)}</span><em class="${l.used ? 'ok' : ''}">${l.used && l.signedAt ? 'Signed ' + l.signedAt.toDate().toLocaleString() : 'Waiting'}</em>${l.used ? '' : `<button class="pbtn" data-act="copy" data-t="${l.token}">Copy link</button>`}</div>`).join('')}
        <div class="rqf"><button class="pbtn gold" data-act="dl" ${nd ? '' : 'disabled'}>Download${nd === ls.length ? '' : ' (partial)'}</button><button class="pbtn del" data-act="rm">Delete</button></div></div>`;
    }).join('') : '<p class="spmsg">No requests yet. Tap “New request”.</p>') +
      `<p class="spmsg">Signed in as ${E(this.auth.currentUser.email)} · <button class="linkbtn" id="spOut">Sign out</button></p>`;
  },

  async compose(reqId, ls) { // the original file + everyone's signatures + a signing record page
    const snap = await this.db.collection('requests').doc(reqId).collection('chunks').get();
    const bytes = this.fromB64(snap.docs.map(d => d.data()).sort((a, b) => a.i - b.i).map(c => c.data).join(''));
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    const { PDFDocument, StandardFonts, rgb } = PDFLib, doc = await PDFDocument.load(bytes), pages = doc.getPages(), font = await doc.embedFont(StandardFonts.Helvetica);
    const clean = s => String(s).replace(/[^\x00-\xFF]/g, '?');
    for (const L of ls.filter(l => l.used && l.result)) {
      const sig = L.result.sig && await doc.embedPng(L.result.sig), ini = L.result.initials && await doc.embedPng(L.result.initials), when = L.signedAt.toDate();
      for (const b of L.boxes) {
        const pg = pages[b.page - 1]; if (!pg) continue;
        const W = pg.getWidth(), H = pg.getHeight(), x = b.x * W, w = b.w * W, h = b.h * H, y = H - (b.y + b.h) * H, img = b.kind === 'signature' ? sig : b.kind === 'initials' ? ini : null;
        if (img) { const r = Math.min(w / img.width, h / img.height); pg.drawImage(img, { x: x + (w - img.width * r) / 2, y: y + (h - img.height * r) / 2, width: img.width * r, height: img.height * r }); }
        else if (b.kind === 'date') pg.drawText(when.toLocaleDateString(), { x: x + 2, y: y + h * .3, size: Math.min(12, h * .6), font, color: rgb(.07, .08, .18) });
      }
    }
    const rec = doc.addPage([612, 792]); let y = 740;
    const line = (t, size = 10, gap = 16) => { rec.drawText(clean(t), { x: 50, y, size, font }); y -= gap; };
    line('Signing record', 20, 30); line(ls[0].docName, 11, 24);
    line('Fingerprint of the original file (SHA-256):', 9, 13); line(hash.slice(0, 32), 9, 13); line(hash.slice(32), 9, 24); line('Request ' + ls[0].reqId, 9, 28);
    for (const l of ls) {
      line(`${l.signerName || 'Signer ' + l.signerNo}${l.signerEmail ? ' <' + l.signerEmail + '>' : ''}`, 11, 15);
      if (l.used) { line('Signed: ' + l.signedAt.toDate().toString(), 9, 13); line('Agreed to use electronic records and signatures.', 9, 13); line('Device: ' + (l.ua || '').slice(0, 80), 8, 22); }
      else line('Has not signed yet.', 9, 22);
    }
    return doc.save();
  },
  async deleteRequest(reqId, ls) {
    for (const l of ls) { for (let i = 0; i < l.chunks; i++) await this.db.collection('links').doc(l.token).collection('chunks').doc(String(i)).delete(); await this.db.collection('links').doc(l.token).delete(); }
    const n = ls[0].chunks; for (let i = 0; i < n; i++) await this.db.collection('requests').doc(reqId).collection('chunks').doc(String(i)).delete();
    await this.db.collection('requests').doc(reqId).delete();
  }
};

$('spBody').onclick = async e => {
  const b = e.target.closest('button'); if (!b) return;
  const C = App.cloud;
  if (b.id === 'spOut') { await C.auth.signOut(); return C.openDashboard(); }
  const card = b.closest('.rq'), reqId = card && card.dataset.req, ls = reqId && C.reqs[reqId];
  try {
    if (b.dataset.act === 'copy') { const url = C.linkUrl(b.dataset.t); try { await navigator.clipboard.writeText(url); App.settings.toast('Link copied.'); } catch (x) { prompt('Copy this link:', url); } }
    else if (b.dataset.act === 'dl') { App.settings.toast('Building the signed PDF…'); App.settings.offer(await C.compose(reqId, ls), ls[0].docName.replace(/\.pdf$/i, '') + '-signed.pdf'); }
    else if (b.dataset.act === 'rm' && confirm('Delete this request? Unused links will stop working.')) { await C.deleteRequest(reqId, ls); C.openDashboard(); }
  } catch (x) { App.settings.toast('Something went wrong: ' + x.message); }
};
$('spNew').onclick = () => {
  $('sendPanel').hidden = true; document.body.classList.remove('noscroll');
  if (!App.pdf) $('file').click();
  document.body.classList.add('tray-sign');
  App.settings.toast('Place signature boxes, then tap Send.');
};

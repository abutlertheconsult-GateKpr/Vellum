// The page your clients see. It works from one link, once.
(async () => {
  const $ = id => document.getElementById(id), cfg = window.VELLUM_FIREBASE || {}, tok = new URLSearchParams(location.search).get('t');
  const only = id => ['msg', 'intro', 'pages'].forEach(x => $(x).hidden = x !== id);
  const say = (t, p) => { $('msgT').textContent = t; $('msgP').textContent = p; $('bar').hidden = true; only('msg'); };
  if (!tok) return say('This link isn’t valid', 'Ask the sender for a new one.');
  if (!window.firebase || !cfg.apiKey || /^PASTE/.test(cfg.apiKey)) return say('Not ready yet', 'Signing isn’t set up on this site yet.');
  firebase.initializeApp(cfg); const db = firebase.firestore(), ref = db.collection('links').doc(tok);
  let L;
  try { const s = await ref.get(); if (!s.exists) return say('This link isn’t valid', 'It may have been removed. Ask the sender for a new one.'); L = s.data(); }
  catch (e) { return say('Can’t open this link', 'Check your connection and try again.'); }
  if (L.used) return say('Already signed', 'This document has been signed. Thank you. You can close this page.');
  if (L.expiresAt.toMillis() < Date.now()) return say('This link has expired', 'Ask the sender for a new one.');

  const need = L.boxes.filter(b => b.kind !== 'date').length;
  $('hello').textContent = `Hi ${L.signerName}, ${L.ownerEmail || 'someone'} asked you to sign “${L.docName}”. There ${need === 1 ? 'is 1 place' : 'are ' + need + ' places'} to sign.`;
  only('intro');
  $('consent').onchange = e => $('start').disabled = !e.target.checked;

  const adopted = { signature: null, initials: null }, boxes = [];
  const paint = () => {
    for (const x of boxes) {
      if (x.b.kind === 'date') x.el.textContent = new Date().toLocaleDateString();
      else if (adopted[x.b.kind]) { x.el.innerHTML = `<img src="${adopted[x.b.kind]}" alt="">`; x.el.classList.add('done'); }
      else x.el.textContent = x.b.kind === 'initials' ? 'Initial' : 'Sign here';
    }
    const left = boxes.filter(x => x.b.kind !== 'date' && !adopted[x.b.kind]).length;
    $('left').textContent = left ? `${left} left to complete` : 'All done. Tap Finish.';
    $('finish').disabled = left > 0; $('next').hidden = left === 0;
  };

  $('start').onclick = async () => {
    $('start').disabled = true; $('start').textContent = 'Loading…';
    try {
      const cs = await Promise.all(Array.from({ length: L.chunks }, (_, i) => ref.collection('chunks').doc(String(i)).get()));
      const b64 = cs.map(c => c.data().data).join(''), bin = atob(b64), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise, dpr = window.devicePixelRatio || 1;
      only('pages'); $('bar').hidden = false;
      for (let n = 1; n <= pdf.numPages; n++) {
        const pg = await pdf.getPage(n), v1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: Math.min(innerWidth - 16, 900) / v1.width });
        const wrap = document.createElement('div'); wrap.className = 'spage'; wrap.style.width = vp.width + 'px'; wrap.style.height = vp.height + 'px';
        const cv = document.createElement('canvas'); cv.width = vp.width * dpr; cv.height = vp.height * dpr; cv.style.width = vp.width + 'px'; cv.style.height = vp.height + 'px';
        wrap.appendChild(cv); $('pages').appendChild(wrap);
        pg.render({ canvasContext: cv.getContext('2d'), viewport: vp, transform: [dpr, 0, 0, dpr, 0, 0] });
        for (const b of L.boxes.filter(b => b.page === n)) {
          const el = document.createElement('button'); el.className = 'sbox ' + b.kind;
          el.style.cssText = `left:${b.x * 100}%;top:${b.y * 100}%;width:${b.w * 100}%;height:${b.h * 100}%`;
          if (b.kind !== 'date') el.onclick = async () => { const r = await SigPad.open({ kind: b.kind, name: L.signerName }); if (r) { adopted[b.kind] = r.img; paint(); } };
          wrap.appendChild(el); boxes.push({ b, el });
        }
      }
      paint();
    } catch (e) { say('Couldn’t load the document', 'Check your connection and reopen the link.'); }
  };

  $('next').onclick = () => {
    const t = boxes.find(x => x.b.kind !== 'date' && !adopted[x.b.kind]); if (!t) return;
    t.el.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.el.classList.add('pulse');
    setTimeout(() => { t.el.classList.remove('pulse'); t.el.click(); }, 500);
  };
  const submit = async extra => {
    $('finish').disabled = true; $('finish').textContent = 'Saving…';
    try {
      await ref.update({ used: true, result: { sig: adopted.signature, initials: adopted.initials, consent: true, ...extra }, signedAt: firebase.firestore.FieldValue.serverTimestamp(), ua: navigator.userAgent.slice(0, 200) });
      say('Thank you. You’re done.', extra.wantsCopy ? 'Your signature has been sent. A signed copy will be emailed to you once everyone has signed.' : 'Your signature has been sent. You can close this page.');
    } catch (e) { $('finish').disabled = false; $('finish').textContent = 'Finish'; say('Couldn’t save your signature', 'This link may have already been used or has expired. Ask the sender for a new one.'); }
  };
  $('finish').onclick = () => { // only asks about a copy if the sender allowed it
    if (!L.copyAllowed) return submit({ wantsCopy: false });
    $('copyEmail').value = L.signerEmail || ''; $('copyMsg').textContent = ''; $('copyDlg').showModal();
  };
  $('copyBack').onclick = () => $('copyDlg').close();
  $('copyGo').onclick = () => {
    const want = $('wantCopy').checked, em = $('copyEmail').value.trim();
    if (want && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return ($('copyMsg').textContent = 'Please enter a valid email address.');
    $('copyDlg').close(); submit(want ? { wantsCopy: true, copyEmail: em } : { wantsCopy: false });
  };
})();

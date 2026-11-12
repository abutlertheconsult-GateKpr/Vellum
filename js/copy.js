// The page signers open to see and download their signed copy. It works from one secret link and expires.
(async () => {
  const $ = id => document.getElementById(id), cfg = window.VELLUM_FIREBASE || {}, code = new URLSearchParams(location.search).get('d');
  const say = (t, p) => { $('msgT').textContent = t; $('msgP').textContent = p; $('bar').hidden = true; $('pages').hidden = true; $('msg').hidden = false; };
  if (!code) return say('This link isn’t valid', 'Ask the sender for a new one.');
  if (!window.firebase || !cfg.apiKey || /^PASTE/.test(cfg.apiKey)) return say('Not ready yet', 'This site isn’t set up yet.');
  firebase.initializeApp(cfg); const ref = firebase.firestore().collection('deliveries').doc(code);
  try {
    const s = await ref.get(); if (!s.exists) return say('This link isn’t valid', 'It may have been removed. Ask the sender for a new one.');
    const D = s.data();
    const cs = await Promise.all(Array.from({ length: D.chunks }, (_, i) => ref.collection('chunks').doc(String(i)).get()));
    const bin = atob(cs.map(c => c.data().data).join('')), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    $('dl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' })); a.download = D.docName.replace(/\.pdf$/i, '') + '-signed.pdf'; a.click(); };
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise, dpr = window.devicePixelRatio || 1;
    $('bar').hidden = false; $('pages').hidden = false;
    for (let n = 1; n <= pdf.numPages; n++) {
      const pg = await pdf.getPage(n), v1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: Math.min(innerWidth - 16, 900) / v1.width });
      const wrap = document.createElement('div'); wrap.className = 'spage'; wrap.style.width = vp.width + 'px'; wrap.style.height = vp.height + 'px';
      const cv = document.createElement('canvas'); cv.width = vp.width * dpr; cv.height = vp.height * dpr; cv.style.width = vp.width + 'px'; cv.style.height = vp.height + 'px';
      wrap.appendChild(cv); $('pages').appendChild(wrap);
      pg.render({ canvasContext: cv.getContext('2d'), viewport: vp, transform: [dpr, 0, 0, dpr, 0, 0] });
    }
  } catch (e) { say('This link has expired or isn’t valid', 'Signed copy links work for 30 days. Ask the sender for a new one.'); }
})();

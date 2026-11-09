// Signature pad: draw it, or type it in one of several styles.
// SigPad.open({ kind: 'signature' | 'initials', name, askAll }) gives back { img, mode, text, all } or null.
window.SigPad = (() => {
  const FONTS = [
    { n: 'Script', f: '"Snell Roundhand","Segoe Script","Brush Script MT",cursive', s: 'italic' },
    { n: 'Chancery', f: '"Apple Chancery","Lucida Calligraphy","URW Chancery L","Palatino Linotype",serif', s: 'italic' },
    { n: 'Handwritten', f: '"Bradley Hand","Segoe Print","Chalkboard SE","Comic Sans MS",cursive', s: 'normal' },
    { n: 'Brush', f: '"Brush Script MT","Brush Script Std","Lucida Handwriting",cursive', s: 'italic' },
    { n: 'Formal', f: 'Zapfino,"Monotype Corsiva",Georgia,serif', s: 'italic' },
    { n: 'Classic', f: 'Georgia,"Times New Roman",serif', s: 'italic' }
  ];
  const INK = '#11152e';
  let dlg, cv, ctx, mode = 'draw', fi = 0, inked = false, done, o = {};
  const q = s => dlg.querySelector(s);
  const initialsOf = n => (n || '').split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).join('').slice(0, 3);
  const nameVal = () => q('.sp-name').value.trim();

  function trim(src) { // cut away the empty space and keep the image small
    const w = src.width, h = src.height, d = src.getContext('2d').getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const pad = 10, cw = x1 - x0 + 1 + pad * 2, ch = y1 - y0 + 1 + pad * 2, k = Math.min(1, 700 / cw);
    const out = document.createElement('canvas'); out.width = Math.round(cw * k); out.height = Math.round(ch * k);
    out.getContext('2d').drawImage(src, x0 - pad, y0 - pad, cw, ch, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  }
  function typed(text, i) {
    const c = document.createElement('canvas'); c.width = 1400; c.height = 380;
    const x = c.getContext('2d'), F = FONTS[i]; let size = 220;
    do { x.font = `${F.s} ${size}px ${F.f}`; size -= 10; } while (x.measureText(text).width > 1300 && size > 40);
    x.fillStyle = INK; x.fillText(text, 50, 260); return trim(c);
  }
  function refresh() {
    q('.sp-draw').hidden = mode !== 'draw'; q('.sp-type').hidden = mode !== 'type';
    q('[data-m=draw]').classList.toggle('on', mode === 'draw'); q('[data-m=type]').classList.toggle('on', mode === 'type');
    q('.sp-ok').disabled = mode === 'draw' ? !inked : !nameVal();
    q('.sp-fonts').innerHTML = FONTS.map((F, i) => `<button type="button" data-i="${i}" class="${i === fi ? 'on' : ''}" style="font-family:${F.f.replace(/"/g, "'")};font-style:${F.s}">${nameVal().replace(/</g, '&lt;') || 'Your name'}<small>${F.n}</small></button>`).join('');
  }
  function clear() { ctx.clearRect(0, 0, cv.width, cv.height); inked = false; }
  function build() {
    dlg = document.createElement('dialog'); dlg.className = 'sp';
    dlg.innerHTML = `<h2></h2>
      <div class="sp-tabs"><button type="button" data-m="draw" class="on">Draw</button><button type="button" data-m="type">Type</button></div>
      <div class="sp-draw"><canvas width="900" height="300"></canvas><button type="button" class="sp-clear">Clear</button></div>
      <div class="sp-type" hidden><input class="sp-name" placeholder="Type your name" autocomplete="off"><div class="sp-fonts"></div></div>
      <label class="sp-all"><input type="checkbox" checked> Use on all my boxes of this kind</label>
      <p class="sp-note">By adopting this, you agree it is your legal signature on this document.</p>
      <div class="sp-row"><button type="button" class="sp-cancel">Cancel</button><button type="button" class="sp-ok">Adopt and sign</button></div>`;
    document.body.appendChild(dlg);
    cv = q('canvas'); ctx = cv.getContext('2d'); ctx.strokeStyle = ctx.fillStyle = INK; ctx.lineWidth = 6; ctx.lineCap = ctx.lineJoin = 'round';
    let last = null;
    const pt = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height }; };
    cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); last = pt(e); ctx.beginPath(); ctx.arc(last.x, last.y, 3, 0, 7); ctx.fill(); inked = true; refresh(); };
    cv.onpointermove = e => { if (!last) return; const p = pt(e); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; };
    cv.onpointerup = cv.onpointercancel = () => { last = null; };
    q('.sp-clear').onclick = () => { clear(); refresh(); };
    dlg.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; refresh(); });
    q('.sp-name').oninput = refresh;
    q('.sp-fonts').onclick = e => { const b = e.target.closest('[data-i]'); if (b) { fi = +b.dataset.i; refresh(); } };
    q('.sp-cancel').onclick = () => { dlg.close(); done(null); };
    dlg.oncancel = e => { e.preventDefault(); dlg.close(); done(null); };
    q('.sp-ok').onclick = () => {
      const img = mode === 'draw' ? trim(cv) : typed(nameVal(), fi);
      if (!img) return;
      dlg.close(); done({ img, mode, text: mode === 'type' ? nameVal() : '', all: o.askAll ? q('.sp-all input').checked : true });
    };
  }
  return {
    open(opts) {
      o = opts || {}; if (!dlg) build();
      q('h2').textContent = o.kind === 'initials' ? 'Adopt your initials' : 'Adopt your signature';
      q('.sp-name').value = o.kind === 'initials' ? initialsOf(o.name) : (o.name || '');
      q('.sp-all').hidden = !o.askAll; clear(); refresh(); dlg.showModal();
      return new Promise(r => { done = r; });
    }
  };
})();

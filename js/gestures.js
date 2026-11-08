// Touch and mouse gestures: pinch to zoom, double-tap to zoom, controls that hide while you read.
(() => {
  const pages = $('pages');
  let d0 = 0, f = 1, cx = 0, cy = 0;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  pages.addEventListener('touchstart', e => {
    if (e.touches.length !== 2 || !App.pdf) return;
    d0 = dist(e.touches); f = 1;
    cx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
    cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
    const r = pages.getBoundingClientRect();
    pages.style.transformOrigin = `${cx - r.left}px ${cy - r.top}px`;
  }, { passive: true });
  pages.addEventListener('touchmove', e => {
    if (e.touches.length !== 2 || !d0) return;
    e.preventDefault();
    f = Math.min(4 / App.scale, Math.max(.4 / App.scale, dist(e.touches) / d0));
    pages.style.transform = `scale(${f})`;
  }, { passive: false });
  pages.addEventListener('touchend', e => {
    if (!d0 || e.touches.length >= 2) return;
    const k = f; d0 = 0; f = 1; pages.style.transform = '';
    if (Math.abs(k - 1) > .02) App.viewer.zoomTo(App.scale * k, cx, cy);
  });

  // Double-tap (or double-click) empty page area: zoom in, again to return.
  pages.addEventListener('dblclick', e => {
    if (!App.pdf || App.tool !== 'select' || e.target.closest('.ann')) return;
    App.viewer.zoomTo(App.scale > App.fit * 1.3 ? App.fit : App.fit * 2, e.clientX, e.clientY);
  });

  // Ctrl + mouse wheel, or a trackpad pinch, on a computer.
  addEventListener('wheel', e => {
    if (!e.ctrlKey || !App.pdf) return;
    e.preventDefault();
    App.viewer.zoomTo(App.scale * (e.deltaY < 0 ? 1.1 : .9), e.clientX, e.clientY);
  }, { passive: false });

  // Controls slide away as you scroll down and return as you scroll up.
  let last = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    if (Math.abs(y - last) > 12) { document.body.classList.toggle('calm', y > last && y > 80); last = y; }
    App.counter();
  }, { passive: true });
  $('dock').addEventListener('click', () => document.body.classList.remove('calm'));

  App.counter = () => {
    if (!App.pdf) return;
    let cur = 1;
    document.querySelectorAll('.page').forEach((p, i) => { if (p.getBoundingClientRect().top <= innerHeight / 2) cur = i + 1; });
    $('docname').textContent = App.name.replace(/\.pdf$/i, '') + '  ·  ' + cur + ' / ' + App.pdf.numPages;
  };
})();

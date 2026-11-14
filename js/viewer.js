// Shows the PDF pages. Does not know anything about editing.
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

App.viewer = {
  async load(bytes) {
    const doc = await App.openPdf(bytes);
    App.bytes = bytes.slice(0);
    App.pdf = doc;
    await App.rules.load();
    const first = await App.pdf.getPage(1);
    const w = first.getViewport({ scale: 1 }).width;
    App.scale = Math.min(1.5, (window.innerWidth - 16) / w);
    App.fit = App.scale;
    App.hasForms = false;
    await this.render();
    if (App.hasForms) App.setTool('fill');
    App.history.reset();
  },
  async render() {
    const box = document.getElementById('pages');
    box.innerHTML = '';
    document.getElementById('zoom').textContent = Math.round(App.scale * 100) + '%';
    const dpr = window.devicePixelRatio || 1;
    for (let n = 1; n <= App.pdf.numPages; n++) {
      const page = await App.pdf.getPage(n);
      const vp = page.getViewport({ scale: App.scale });
      const wrap = document.createElement('div');
      wrap.className = 'page';
      wrap.style.width = vp.width + 'px';
      wrap.style.height = vp.height + 'px';
      const cv = document.createElement('canvas');
      cv.width = vp.width * dpr; cv.height = vp.height * dpr;
      cv.style.width = vp.width + 'px'; cv.style.height = vp.height + 'px';
      const layer = document.createElement('div');
      layer.className = 'layer';
      const forms = document.createElement('div');
      forms.className = 'forms';
      wrap.append(cv, layer, forms);
      box.appendChild(wrap);
      page.render({ canvasContext: cv.getContext('2d'), viewport: vp, transform: [dpr, 0, 0, dpr, 0, 0] });
      App.tools.attach(layer, n);
      App.tools.draw(n);
      await App.forms.build(page, vp, forms);
    }
    App.counter && App.counter();
  },
  // Swap in new PDF data (after page changes) without resetting zoom.
  async reload(bytes) {
    App.bytes = bytes.slice(0);
    if (App.pdf) await App.pdf.destroy();
    App.pdf = await App.openPdf(bytes);
    await App.rules.load();
    App.hasForms = false;
    await this.render();
    App.history.reset();
  },
  // Zoom while keeping the spot under your fingers (cx, cy) in place.
  async zoomTo(s, cx = innerWidth / 2, cy = innerHeight / 2) {
    if (this.busy || !App.pdf) return;
    this.busy = true;
    try {
      s = Math.min(4, Math.max(.4, s));
      const f = s / App.scale, sx = scrollX, sy = scrollY;
      App.scale = s;
      await this.render();
      scrollTo((sx + cx) * f - cx, (sy + cy) * f - cy);
    } finally { this.busy = false; }
  }
};

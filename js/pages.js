// Page manager: reorder, delete and add blank pages. Changes apply when you tap Done.
App.pages = {
  work: [], thumbs: {},

  async open() {
    if (!App.pdf) return App.settings.toast('Open or create a PDF first.');
    this.work = Array.from({ length: App.pdf.numPages }, (_, i) => i + 1);
    this.thumbs = {};
    $('pagesPanel').hidden = false; document.body.classList.add('noscroll');
    this.paint();
    for (let n = 1; n <= App.pdf.numPages && !$('pagesPanel').hidden; n++) {
      const pg = await App.pdf.getPage(n), vp = pg.getViewport({ scale: .3 });
      const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
      await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      this.thumbs[n] = cv.toDataURL('image/jpeg', .7);
      document.querySelectorAll(`#pgGrid [data-old="${n}"] .th`).forEach(t => t.innerHTML = `<img src="${this.thumbs[n]}" alt="">`);
    }
  },
  close() { $('pagesPanel').hidden = true; document.body.classList.remove('noscroll'); },

  paint() {
    $('pgGrid').innerHTML = this.work.map((o, i) => `
      <div class="pcard" data-i="${i}" data-old="${o || ''}">
        <div class="th">${o ? (this.thumbs[o] ? `<img src="${this.thumbs[o]}" alt="">` : '…') : 'Blank page'}</div>
        <div class="row2"><button class="pbtn" data-a="left" aria-label="Move earlier">◀</button><b>${i + 1}</b><button class="pbtn" data-a="right" aria-label="Move later">▶</button></div>
        <div class="row2"><button class="pbtn" data-a="add">+ Blank after</button><button class="pbtn del" data-a="del" aria-label="Delete page">✕</button></div>
      </div>`).join('');
  },

  act(a, i) {
    const w = this.work;
    if (a === 'left' && i > 0) [w[i - 1], w[i]] = [w[i], w[i - 1]];
    else if (a === 'right' && i < w.length - 1) [w[i + 1], w[i]] = [w[i], w[i + 1]];
    else if (a === 'del' && w.length > 1) w.splice(i, 1);
    else if (a === 'add') w.splice(i + 1, 0, null);
    this.paint();
  },

  async done() {
    this.close();
    if (this.work.every((o, i) => o === i + 1)) return;
    await this.apply(this.work);
  },

  // order = old page numbers in their new order; null means a new blank page.
  async apply(order) {
    const { PDFDocument } = PDFLib;
    const src = await App.pdfLoad(App.bytes);
    const sz = src.getPage(0).getSize();
    let out = src;
    if (App.hasForms) { // keep the form fields working
      const old = src.getPages();
      for (let i = old.length - 1; i >= 0; i--) src.removePage(i);
      order.forEach(o => o ? src.addPage(old[o - 1]) : src.addPage([sz.width, sz.height]));
    } else { // a clean copy: deleted pages are really gone
      out = await PDFDocument.create();
      for (const o of order) o ? out.addPage((await out.copyPages(src, [o - 1]))[0]) : out.addPage([sz.width, sz.height]);
    }
    App.clean(out);
    const bytes = await out.save(), na = {};
    order.forEach((o, i) => { if (o && App.annots[o]) na[i + 1] = App.annots[o]; });
    App.annots = na; App.selected = null;
    document.body.classList.remove('has-sel', 'has-text', 'has-link');
    await App.viewer.reload(bytes);
    App.nav.ensureEvery(); App.nav.redraw(); App.store.saveSoon();
  }
};
$('pgGrid').onclick = e => { const b = e.target.closest('button'); if (b) App.pages.act(b.dataset.a, +b.closest('.pcard').dataset.i); };
$('pgAdd').onclick = () => { App.pages.work.push(null); App.pages.paint(); };
$('pgCancel').onclick = () => App.pages.close();
$('pgDone').onclick = () => App.pages.done();
$('pagesTab').onclick = () => App.pages.open();

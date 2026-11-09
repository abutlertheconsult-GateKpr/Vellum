// Builds a new PDF with your marks drawn onto it (uses pdf-lib).
App.exporter = {
  async make(opts = {}) {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const doc = await App.pdfLoad(App.bytes);
    const cache = {};
    const getFont = async a => {
      const nm = App.fonts[a.font || 'sans'].pdf[(a.bold ? 1 : 0) + (a.italic ? 2 : 0)];
      return cache[nm] || (cache[nm] = await doc.embedFont(StandardFonts[nm]));
    };
    const pages = doc.getPages();
    // Typed answers go into the PDF's own form fields (they stay editable unless locked in).
    if (App.hasForms) {
      const form = doc.getForm();
      for (const [name, val] of Object.entries(App.fields)) {
        try {
          const f = form.getField(name);
          if (f instanceof PDFLib.PDFTextField) f.setText(String(val));
          else if (f instanceof PDFLib.PDFCheckBox) val ? f.check() : f.uncheck();
          else if (f instanceof PDFLib.PDFRadioGroup) { if (val) f.select(val); }
          else if (val && (f instanceof PDFLib.PDFDropdown || f instanceof PDFLib.PDFOptionList)) f.select(val);
        } catch (e) {}
      }
      if (opts.flatten) form.flatten();
    }
    const col = h => { const v = parseInt(h.slice(1), 16); return rgb((v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255); };
    const ctx = doc.context, { PDFName, PDFString } = PDFLib;
    const addLink = (pg, x, y, w, h, a) => { // makes the tappable link inside the saved PDF
      let act;
      if (a.kind === 'page') { const t = pages[(a.page || 1) - 1]; if (!t) return; act = ctx.obj({ S: 'GoTo', D: [t.ref, 'Fit'] }); }
      else if (a.url) act = ctx.obj({ S: 'URI', URI: PDFString.of(App.nav.normUrl(a.url)) });
      else return;
      const ref = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Link', Rect: [x, y, x + w, y + h], Border: [0, 0, 0], A: act }));
      const arr = pg.node.Annots();
      arr ? arr.push(ref) : pg.node.set(PDFName.of('Annots'), ctx.obj([ref]));
    };
    for (const [n, list] of Object.entries(App.annots)) {
      const pg = pages[n - 1]; if (!pg) continue;
      const { width: W, height: H } = pg.getSize();
      for (const a of list) {
        const c = col(a.color), X = a.x * W, Y = H - a.y * H, w = a.w * W, h = a.h * H;
        if (a.type === 'sig') { // signatures you signed yourself
          if (a.img) { try { const im = await doc.embedPng(a.img), r = Math.min(w / im.width, h / im.height); pg.drawImage(im, { x: X + (w - im.width * r) / 2, y: Y - h + (h - im.height * r) / 2, width: im.width * r, height: im.height * r }); } catch (e) {} }
          else if (a.kind === 'date' && a.text) pg.drawText(a.text, { x: X + 2, y: Y - h + h * .3, size: Math.min(12, h * .6), font: await getFont({}), color: rgb(.07, .08, .18) });
          continue;
        }
        if (a.type === 'image') {
          try { const im = a.src.startsWith('data:image/png') ? await doc.embedPng(a.src) : await doc.embedJpg(a.src); pg.drawImage(im, { x: X, y: Y - h, width: w, height: h }); } catch (e) {}
          continue;
        }
        if (a.type === 'iconbtn' || a.type === 'link') {
          if (a.type === 'iconbtn') {
            pg.drawEllipse({ x: X + w / 2, y: Y - h / 2, xScale: w / 2, yScale: h / 2, color: rgb(.07, .07, .08), borderColor: c, borderWidth: 1.5 });
            const s = Math.min(w, h) * .62 / 24;
            pg.drawSvgPath(App.icons[a.icon || 'home'], { x: X + w / 2 - 12 * s, y: Y - h / 2 + 12 * s, scale: s, borderColor: c, borderWidth: 1.7 });
          }
          addLink(pg, X, Y - h, w, h, a);
          continue;
        }
        if (a.type === 'highlight') pg.drawRectangle({ x: X, y: Y - h, width: w, height: h, color: c, opacity: .38 });
        else if (a.type === 'rect') pg.drawRectangle({ x: X, y: Y - h, width: w, height: h, borderColor: c, borderWidth: 2 });
        else if (a.type === 'ellipse') pg.drawEllipse({ x: X + w / 2, y: Y - h / 2, xScale: w / 2, yScale: h / 2, borderColor: c, borderWidth: 2 });
        else if (a.type === 'arrow') {
          const s = { x: X, y: Y }, e = { x: a.x2 * W, y: H - a.y2 * H }, ang = Math.atan2(e.y - s.y, e.x - s.x);
          pg.drawLine({ start: s, end: e, thickness: 2, color: c });
          [.5, -.5].forEach(d => pg.drawLine({ start: e, end: { x: e.x - 12 * Math.cos(ang + d), y: e.y - 12 * Math.sin(ang + d) }, thickness: 2, color: c }));
        } else if (a.type === 'text' && a.text) {
          const size = a.fs * W;
          pg.drawText(a.text.replace(/[^\x00-\xFF]/g, '?'), { x: X + 2, y: Y - size - 1, size, font: await getFont(a), color: c, maxWidth: w - 4, lineHeight: size * 1.2 });
        }
      }
    }
    App.clean(doc); // drop any old lock first
    if (App.sec.user || App.sec.owner) { // password protection
      const p = App.sec;
      doc.encrypt({
        userPassword: p.user || '', ownerPassword: p.owner || crypto.randomUUID(),
        permissions: { printing: p.print ? 'highResolution' : false, modifying: p.edit, annotating: p.edit, fillingForms: p.edit, documentAssembly: p.edit, copying: p.copy, contentAccessibility: true }
      });
    }
    return doc.save();
  }
};

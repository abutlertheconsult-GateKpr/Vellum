// Builds a new PDF with your marks drawn onto it (uses pdf-lib).
App.exporter = {
  async make(opts = {}) {
    const { PDFDocument, rgb, StandardFonts } = PDFLib;
    const doc = await PDFDocument.load(App.bytes);
    const font = await doc.embedFont(StandardFonts.Helvetica);
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
    for (const [n, list] of Object.entries(App.annots)) {
      const pg = pages[n - 1]; if (!pg) continue;
      const { width: W, height: H } = pg.getSize();
      for (const a of list) {
        const c = col(a.color), X = a.x * W, Y = H - a.y * H, w = a.w * W, h = a.h * H;
        if (a.type === 'highlight') pg.drawRectangle({ x: X, y: Y - h, width: w, height: h, color: c, opacity: .38 });
        else if (a.type === 'rect') pg.drawRectangle({ x: X, y: Y - h, width: w, height: h, borderColor: c, borderWidth: 2 });
        else if (a.type === 'ellipse') pg.drawEllipse({ x: X + w / 2, y: Y - h / 2, xScale: w / 2, yScale: h / 2, borderColor: c, borderWidth: 2 });
        else if (a.type === 'arrow') {
          const s = { x: X, y: Y }, e = { x: a.x2 * W, y: H - a.y2 * H }, ang = Math.atan2(e.y - s.y, e.x - s.x);
          pg.drawLine({ start: s, end: e, thickness: 2, color: c });
          [.5, -.5].forEach(d => pg.drawLine({ start: e, end: { x: e.x - 12 * Math.cos(ang + d), y: e.y - 12 * Math.sin(ang + d) }, thickness: 2, color: c }));
        } else if (a.type === 'text' && a.text) {
          const size = a.fs * W;
          pg.drawText(a.text.replace(/[^\x00-\xFF]/g, '?'), { x: X + 2, y: Y - size - 1, size, font, color: c, maxWidth: w - 4, lineHeight: size * 1.2 });
        }
      }
    }
    return doc.save();
  }
};

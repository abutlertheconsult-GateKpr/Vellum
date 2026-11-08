// Fillable PDF forms: shows the blue boxes and keeps what you type in App.fields.
App.forms = {
  refresh() { document.querySelectorAll('.fld.box').forEach(e => e._paint()); },

  async build(page, vp, box) {
    const list = (await page.getAnnotations()).filter(a => a.subtype === 'Widget' && a.fieldName && !a.pushButton && !a.readOnly);
    for (const a of list) {
      const [x1, y1, x2, y2] = vp.convertToViewportRectangle(a.rect);
      const L = Math.min(x1, x2), T = Math.min(y1, y2), W = Math.abs(x2 - x1), H = Math.abs(y2 - y1), name = a.fieldName;
      let el;
      if (a.fieldType === 'Btn') {
        const radio = !!a.radioButton, val = radio ? a.buttonValue : true;
        if (App.fields[name] === undefined) App.fields[name] = radio ? (a.fieldValue && a.fieldValue !== 'Off' ? a.fieldValue : '') : (!!a.fieldValue && a.fieldValue !== 'Off');
        el = document.createElement('button'); el.type = 'button';
        el.className = 'fld box' + (radio ? ' radio' : '');
        el._paint = () => el.classList.toggle('on', radio ? App.fields[name] === val : !!App.fields[name]);
        el.onclick = () => { App.fields[name] = radio ? (App.fields[name] === val ? '' : val) : !App.fields[name]; this.refresh(); App.store.saveSoon(); };
        el._paint();
      } else if (a.fieldType === 'Ch') {
        el = document.createElement('select'); el.className = 'fld';
        for (const o of a.options || []) el.add(new Option(o.displayValue, o.exportValue));
        if (App.fields[name] === undefined) App.fields[name] = [].concat(a.fieldValue || '')[0] || '';
        el.value = App.fields[name];
        el.onchange = () => { App.fields[name] = el.value; App.store.saveSoon(); };
      } else {
        el = document.createElement(a.multiLine ? 'textarea' : 'input'); el.className = 'fld';
        if (App.fields[name] === undefined) App.fields[name] = String([].concat(a.fieldValue || '')[0] || '');
        el.value = App.fields[name];
        if (a.maxLen) el.maxLength = a.maxLen;
        el.oninput = () => { App.fields[name] = el.value; App.store.saveSoon(); };
      }
      if (a.fieldType !== 'Btn') el.style.fontSize = Math.max(8, Math.min(H * .66, 15 * App.scale)) + 'px';
      Object.assign(el.style, { left: L / vp.width * 100 + '%', top: T / vp.height * 100 + '%', width: W / vp.width * 100 + '%', height: H / vp.height * 100 + '%' });
      box.appendChild(el);
      App.hasForms = true;
    }
  }
};

// Fillable-field designer: place text boxes, tick boxes, dropdowns and choose-one buttons.
// They turn into real form fields when you tap Fill or Save (see bake).
App.designer = {
  cur: null, lastRadio: '',

  fields() { return Object.values(App.annots).flat().filter(b => b.type === 'field'); },
  uniqueName(name, a) {
    const others = this.fields().filter(b => b !== a), base = name.replace(/\./g, '-').trim() || 'Field';
    let nm = base, i = 1;
    while (others.some(b => b.name === nm && !(a.ftype === 'radio' && b.ftype === 'radio'))) nm = base + ' ' + (++i);
    return nm;
  },

  edit(n, a, fresh) {
    this.cur = { n, a, fresh };
    const kind = { text: 'Text box', check: 'Tick box', drop: 'Dropdown', date: 'Date field', radio: 'Choose-one button' }[a.ftype];
    $('fieldTitle').textContent = kind;
    $('fName').value = a.name || (fresh && a.ftype === 'radio' ? this.lastRadio : '');
    $('fOpts').hidden = a.ftype !== 'drop'; $('fOpts').value = (a.options || []).join('\n');
    $('fChoice').hidden = a.ftype !== 'radio'; $('fChoice').value = a.choice || '';
    $('fNote').textContent = a.ftype === 'radio' ? 'Give every button in the same set the same name. The label is what each button means.' : 'The name is what other PDF apps show for this field.';
    const adv = a.ftype === 'text' || a.ftype === 'date', r = a.rule || {};
    $('fAdv').hidden = !adv; $('fAdv').open = false;
    $('fAdvText').hidden = a.ftype !== 'text'; $('fFmt').hidden = a.ftype !== 'date';
    $('fMode').value = r.mode || 'any'; $('fMax').value = r.max || ''; $('fAllow').value = r.allow || ''; $('fBlock').value = r.block || '';
    $('fUpper').checked = !!r.upper; $('fFmt').value = r.fmt || 'MM/DD/YYYY';    
    $('fieldDlg').showModal();
  },
  ok() {
    const { a } = this.cur;
    a.name = this.uniqueName($('fName').value, a);
    if (a.ftype === 'text') a.rule = { mode: $('fMode').value, max: Math.max(0, parseInt($('fMax').value) || 0), allow: $('fAllow').value, block: $('fBlock').value, upper: $('fUpper').checked };
    if (a.ftype === 'date') a.rule = { mode: 'date', fmt: $('fFmt').value };    
    if (a.ftype === 'drop') a.options = $('fOpts').value.split('\n').map(s => s.trim()).filter(Boolean);
    if (a.ftype === 'radio') {
      const mates = this.fields().filter(b => b !== a && b.ftype === 'radio' && b.name === a.name);
      let c = $('fChoice').value.trim() || 'Option ' + (mates.length + 1), k = c, i = 1;
      while (mates.some(b => b.choice === k)) k = c + ' ' + (++i);
      a.choice = k; this.lastRadio = a.name;
    }
    $('fieldDlg').close(); App.nav.redraw(); App.store.saveSoon();
  },
  cancel() {
    const { n, a, fresh } = this.cur;
    $('fieldDlg').close();
    if (fresh) { App.annots[n] = App.tools.list(n).filter(b => b !== a); App.tools.select(null); App.nav.redraw(); }
  },

  // Turn designed fields into real, fillable form fields inside the PDF.
  async bake() {
    const list = Object.entries(App.annots).flatMap(([n, l]) => l.filter(a => a.type === 'field').map(a => [+n, a]));
    if (!list.length) return false;
    const { rgb } = PDFLib, doc = await App.pdfLoad(App.bytes), form = doc.getForm(), pages = doc.getPages();
    const taken = new Set(form.getFields().map(f => f.getName())), groups = {}, names = {}, rules{};
    const style = { backgroundColor: rgb(.86, .89, 1), borderColor: rgb(.1, .14, .31), borderWidth: 1 };
    for (const [n, a] of list) {
      const pg = pages[n - 1]; if (!pg) continue;
      const W = pg.getWidth(), H = pg.getHeight(), box = { x: a.x * W, y: H - (a.y + a.h) * H, width: a.w * W, height: a.h * H, ...style };
      let nm = a.name || 'test1';
      if (a.ftype === 'radio') {
        if (!names[nm]) { let k = nm, i = 1; while (taken.has(k)) k = nm + ' ' + (++i); names[nm] = k; taken.add(k); groups[k] = form.createRadioGroup(k); }
        groups[names[nm]].addOptionToPage(a.choice || 'Option', pg, box);
        continue;
      }
      let k = nm, i = 1; while (taken.has(k)) k = nm + ' ' + (++i); taken.add(k);
      if (a.ftype === 'text' || a.ftype === 'date') {
        const tf = form.createTextField(k), r = a.rule || {};
        if (a.ftype === 'text' && r.max) tf.setMaxLength(r.max);
        tf.addToPage(pg, box);
        if (a.ftype === 'date' || (r.mode && r.mode !== 'any') || r.max || r.allow || r.block || r.upper) {
          rules[k] = a.ftype === 'date' ? { mode: 'date', fmt: r.fmt || 'MM/DD/YYYY' } : r;
          try { App.rules.addScripts(doc, tf, rules[k]); } catch (e) {}
        }
      }
      else if (a.ftype === 'check') form.createCheckBox(k).addToPage(pg, box);
      else { const d = form.createDropdown(k); d.setOptions(a.options && a.options.length ? a.options : ['Option 1']); d.addToPage(pg, box); }
    }
    try { App.rules.save(doc, rules); } catch (e) {}
    for (const k of Object.keys(App.annots)) App.annots[k] = App.annots[k].filter(a => a.type !== 'field');
    App.selected = null; document.body.classList.remove('has-sel', 'has-text', 'has-link');
    App.clean(doc);
    await App.viewer.reload(await doc.save());
    App.store.saveSoon();
    return true;
  }
};
$('fOk').onclick = () => App.designer.ok();
$('fCancel').onclick = () => App.designer.cancel();
$('editLink').onclick = () => {
  if (!App.selected) return;
  const a = App.tools.find(App.selected.n, App.selected.id);
  a.type === 'field' ? App.designer.edit(App.selected.n, a) : App.nav.edit(App.selected.n, a);
};

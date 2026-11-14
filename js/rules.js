// Field rules: numbers only, letters only, maximum characters, allowed or blocked characters, and dates.
// Vellum enforces them while you fill in a form. They are also saved inside the PDF (a custom entry in its
// information block) so they come back when you reopen the file, and Adobe Acrobat is told about them too.
App.fieldRules = {};
App.rules = {
  charOk(ch, r) {
    if (r.allow && !r.allow.includes(ch)) return false;
    if (r.block && r.block.includes(ch)) return false;
    if (r.mode === 'digits') return /[0-9]/.test(ch);
    if (r.mode === 'letters') return /[\p{L} '\-]/u.test(ch);
    if (r.mode === 'alnum') return /[\p{L}\p{N} ]/u.test(ch);
    return true;
  },
  clean(v, r) {
    if (!r || r.mode === 'date') return v;
    if (r.upper) v = v.toUpperCase();
    let out = ''; for (const ch of v) if (this.charOk(ch, r)) out += ch;
    return r.max ? out.slice(0, r.max) : out;
  },
  toIso(s, fmt) { // the text in the PDF -> the calendar picker's format
    s = (s || '').trim(); let m, y, mo, d;
    if (fmt === 'YYYY-MM-DD') { m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/); if (!m) return ''; [y, mo, d] = [m[1], m[2], m[3]]; }
    else { m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (!m) return ''; y = m[3]; [mo, d] = fmt === 'DD/MM/YYYY' ? [m[2], m[1]] : [m[1], m[2]]; }
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  },
  fromIso(iso, fmt) { // the picker's value -> text in the chosen format
    const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!m) return '';
    return fmt === 'DD/MM/YYYY' ? `${m[3]}/${m[2]}/${m[1]}` : fmt === 'YYYY-MM-DD' ? iso : `${m[2]}/${m[3]}/${m[1]}`;
  },

  async load() { // read the saved rules when a document opens
    App.fieldRules = {};
    try { const m = await App.pdf.getMetadata(), j = m.info && m.info.Custom && m.info.Custom.VellumRules; if (j) App.fieldRules = JSON.parse(j); } catch (e) {}
  },
  save(doc, add) { // write the rules into the PDF, keeping any it already had
    if (!Object.keys(add).length) return;
    const info = doc.getInfoDict(), key = PDFLib.PDFName.of('VellumRules'); let cur = {};
    try { const v = info.get(key); if (v) cur = JSON.parse(v.decodeText()); } catch (e) {}
    info.set(key, PDFLib.PDFHexString.fromText(JSON.stringify({ ...cur, ...add })));
  },
  script(r) { // the same rules as a small script that Adobe Acrobat understands
    const c = [];
    if (r.mode === 'digits') c.push('!/[0-9]/.test(ch)');
    if (r.mode === 'letters') c.push("!/[A-Za-z '\\-]/.test(ch)");
    if (r.mode === 'alnum') c.push('!/[A-Za-z0-9 ]/.test(ch)');
    if (r.allow) c.push(JSON.stringify(r.allow) + '.indexOf(ch)<0');
    if (r.block) c.push(JSON.stringify(r.block) + '.indexOf(ch)>=0');
    if (!c.length && !r.upper) return '';
    return `if(!event.willCommit){${r.upper ? 'event.change=event.change.toUpperCase();' : ''}var s=event.change,bad=false;for(var i=0;i<s.length;i++){var ch=s.charAt(i);if(${c.join('||') || 'false'}){bad=true;}}if(bad){event.rc=false;}}`;
  },
  addScripts(doc, field, r) {
    if (!r) return;
    const { PDFName, PDFString } = PDFLib, act = js => ({ S: 'JavaScript', JS: PDFString.of(js) }), aa = {};
    if (r.mode === 'date') {
      const f = ({ 'MM/DD/YYYY': 'mm/dd/yyyy', 'DD/MM/YYYY': 'dd/mm/yyyy', 'YYYY-MM-DD': 'yyyy-mm-dd' })[r.fmt] || 'mm/dd/yyyy';
      aa.K = act(`AFDate_KeystrokeEx("${f}");`); aa.F = act(`AFDate_FormatEx("${f}");`);
    } else { const s = this.script(r); if (s) aa.K = act(s); }
    if (Object.keys(aa).length) field.acroField.dict.set(PDFName.of('AA'), doc.context.obj(aa));
  }
};

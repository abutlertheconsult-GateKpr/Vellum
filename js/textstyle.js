// Font, bold, italic and size for text boxes. Applies to the selected text box, and to the next ones you add.
App.textStyle = { font: 'sans', bold: false, italic: false, fs: .022 };
(() => {
  const cur = () => (App.selected ? App.tools.find(App.selected.n, App.selected.id) : null);
  const state = () => { const a = cur(); return a && a.type === 'text' ? a : App.textStyle; };
  const paint = () => {
    const s = state();
    $('fontSel').value = s.font || 'sans';
    $('boldBtn').classList.toggle('on', !!s.bold);
    $('italBtn').classList.toggle('on', !!s.italic);
  };
  const apply = patch => {
    Object.assign(App.textStyle, patch);
    const a = cur();
    if (a && a.type === 'text') { Object.assign(a, patch); App.tools.draw(App.selected.n); App.store.saveSoon(); }
    paint();
  };
  $('fontSel').onchange = e => apply({ font: e.target.value });
  $('boldBtn').onclick = () => apply({ bold: !state().bold });
  $('italBtn').onclick = () => apply({ italic: !state().italic });
  $('sizeUp').onclick = () => apply({ fs: Math.min(.08, state().fs * 1.15) });
  $('sizeDn').onclick = () => apply({ fs: Math.max(.01, state().fs / 1.15) });
  App.textPaint = paint;
})();

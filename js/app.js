// Connects the buttons to everything else.

App.setTool = t => {
  App.tool = t;
  document.body.dataset.tool = t;
  document.querySelectorAll('button[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  $('shapesTab').classList.toggle('on', ['rect', 'ellipse', 'arrow'].includes(t));
  ['shapes', 'img', 'link', 'field', 'sign', 'more'].forEach(x => document.body.classList.remove('tray-' + x));
  $('linkTab').classList.toggle('on', ['link', 'iconbtn'].includes(t));
  $('fieldTab').classList.toggle('on', t.startsWith('f-'));
  $('signTab').classList.toggle('on', t.startsWith('sig-'));
  $('moreTab').classList.toggle('on', ['note', 'rect', 'ellipse', 'arrow', 'link', 'iconbtn'].includes(t) || t.startsWith('f-'));
};

document.querySelectorAll('button[data-tool]').forEach(b => b.onclick = async () => { if (b.dataset.tool === 'fill') await App.designer.bake(); App.setTool(b.dataset.tool); });
$('open').onclick = () => $('file').click();
$('file').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  const bytes = new Uint8Array(await f.arrayBuffer());
  const prev = { pw: App.openPassword, sec: App.sec, annots: App.annots, fields: App.fields };
  App.resetSec(); App.annots = {}; App.fields = {};
  try { await App.viewer.load(bytes); }
  catch (err) { Object.assign(App, { openPassword: prev.pw, sec: prev.sec, annots: prev.annots, fields: prev.fields }); App.settings.toast('That file wasn’t opened.'); return; }
  App.name = f.name; App.selected = null;
  if (App.openPassword) App.sec.user = App.openPassword; // a protected file stays protected when saved, until you remove it
  App.counter(); App.store.saveSoon();
};
$('color').oninput = e => { App.color = e.target.value; App.tools.setColor(App.color); };
$('del').onclick = () => App.tools.remove();
$('zin').onclick = () => zoom(.2);
$('zout').onclick = () => zoom(-.2);
function zoom(d) { App.viewer.zoomTo(App.scale * (d > 0 ? 1.25 : .8)); }
if ($('open2')) $('open2').onclick = () => $('file').click();

$('save').onclick = () => App.settings.save();

document.addEventListener('keydown', e => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.isContentEditable) App.tools.remove();
});

// Bring back the last document when the app opens.
App.store.get('doc').then(async d => {
  if (!d || !d.bytes) return;
  App.name = d.name; App.annots = d.annots || {}; App.fields = d.fields || {};
  await App.viewer.load(d.bytes);
});

App.settings.init();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// Top-right menu and the Shapes tray.
const tray = name => {
  const c = 'tray-' + name, was = document.body.classList.contains(c);
  ['shapes', 'img', 'link', 'field', 'sign', 'more'].forEach(x => document.body.classList.remove('tray-' + x));
  document.body.classList.toggle(c, !was);
};
$('shapesTab').onclick = () => tray('shapes');
$('imgTab').onclick = () => tray('img');
$('linkTab').onclick = () => tray('link');
$('fieldTab').onclick = () => tray('field');
$('signTab').onclick = () => tray('sign');
$('moreTab').onclick = () => tray('more');
$('pagesTab').addEventListener('click', () => document.body.classList.remove('tray-more'));
App.newBlank = async () => {
  const doc = await PDFLib.PDFDocument.create(); doc.addPage([612, 792]);
  Object.assign(App, { name: 'Untitled.pdf', annots: {}, fields: {}, selected: null });
  App.resetSec();
  await App.viewer.load(await doc.save());
  App.setTool('text'); App.store.saveSoon();
};
$('newBlank').onclick = () => App.newBlank();
$('newBlankBtn').onclick = () => { $('menu').hidden = true; App.newBlank(); };
$('moreBtn').onclick = e => { e.stopPropagation(); $('menu').hidden = !$('menu').hidden; };
document.addEventListener('click', e => { if (!e.target.closest('#menu')) $('menu').hidden = true; });

// Close the current document so you can open the right one.
const emptyEl = $('empty');
App.closeDoc = async () => {
  clearTimeout(App.store.t);
  if (App.pdf) await App.pdf.destroy();
  Object.assign(App, { pdf: null, bytes: null, annots: {}, fields: {}, selected: null, hasForms: false, name: 'document.pdf' });
  document.body.classList.remove('has-sel', 'has-text');
  App.resetSec();
  App.history.reset();
  $('pages').innerHTML = ''; $('pages').appendChild(emptyEl);
  $('docname').textContent = 'Vellum'; $('file').value = '';
  App.setTool('select'); scrollTo(0, 0);
  await App.store.put('doc', null);
};
$('closeDocBtn').onclick = () => { $('menu').hidden = true; if (App.pdf) $('closeDlg').showModal(); };
$('closeNo').onclick = () => $('closeDlg').close();
$('closeYes').onclick = async () => { $('closeDlg').close(); await App.closeDoc(); };

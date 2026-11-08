// Connects the buttons to everything else.

App.setTool = t => {
  App.tool = t;
  document.body.dataset.tool = t;
  document.querySelectorAll('button[data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  $('shapesTab').classList.toggle('on', ['rect', 'ellipse', 'arrow'].includes(t));
  document.body.classList.remove('tray-open');
};

document.querySelectorAll('button[data-tool]').forEach(b => b.onclick = () => App.setTool(b.dataset.tool));
$('open').onclick = () => $('file').click();
$('file').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  App.name = f.name; App.annots = {}; App.fields = {}; App.selected = null;
  await App.viewer.load(new Uint8Array(await f.arrayBuffer()));
  App.store.saveSoon();
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
  if (!d) return;
  App.name = d.name; App.annots = d.annots || {}; App.fields = d.fields || {};
  await App.viewer.load(d.bytes);
});

App.settings.init();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// Top-right menu and the Shapes tray.
$('shapesTab').onclick = () => document.body.classList.toggle('tray-open');
$('moreBtn').onclick = e => { e.stopPropagation(); $('menu').hidden = !$('menu').hidden; };
document.addEventListener('click', e => { if (!e.target.closest('#menu')) $('menu').hidden = true; });

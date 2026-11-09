// Pictures and screenshots: from the gallery, the clipboard, or a screen capture (PC).
App.images = {
  curPage() {
    let cur = 1;
    document.querySelectorAll('.page').forEach((p, i) => { if (p.getBoundingClientRect().top <= innerHeight / 2) cur = i + 1; });
    return cur;
  },
  load(src) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; }); },

  async place(blob) {
    if (!App.pdf) return App.settings.toast('Open or create a PDF first.');
    const url = URL.createObjectURL(blob), img = await this.load(url);
    const s = Math.min(1, 1800 / Math.max(img.width, img.height));
    const cv = document.createElement('canvas'); cv.width = img.width * s; cv.height = img.height * s;
    cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
    const src = cv.toDataURL(blob.type === 'image/png' ? 'image/png' : 'image/jpeg', .9), ratio = cv.height / cv.width;
    const n = this.curPage(), layer = App.tools.layers[n], W = layer.clientWidth, H = layer.clientHeight;
    let w = .45, h = w * W * ratio / H;
    if (h > .8) { h = .8; w = h * H / (W * ratio); }
    const r = layer.getBoundingClientRect(), cy = (innerHeight / 2 - r.top) / r.height;
    const a = { id: App.tools.uid(), type: 'image', x: (1 - w) / 2, y: Math.min(.98 - h, Math.max(.02, cy - h / 2)), w, h, src, color: '#ffffff' };
    App.tools.list(n).push(a); App.setTool('select'); App.tools.select(n, a.id); App.tools.draw(n); App.store.saveSoon();
  }
};
const closeImgTray = () => document.body.classList.remove('tray-img');
$('imgPick').onclick = () => { closeImgTray(); $('imgFile').click(); };
$('imgFile').onchange = async e => { for (const f of e.target.files) await App.images.place(f); e.target.value = ''; };
$('imgPaste').onclick = async () => {
  closeImgTray();
  try {
    for (const it of await navigator.clipboard.read()) {
      const t = it.types.find(x => x.startsWith('image/'));
      if (t) return App.images.place(await it.getType(t));
    }
    App.settings.toast('No picture on the clipboard.');
  } catch (e) { App.settings.toast('Allow clipboard access, or press Ctrl+V.'); }
};
addEventListener('paste', e => {
  const t = e.target; if (!App.pdf || t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
  const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
  if (it) { e.preventDefault(); App.images.place(it.getAsFile()); }
});
if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) $('imgCap').hidden = true;
$('imgCap').onclick = async () => {
  closeImgTray();
  try {
    const st = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const v = document.createElement('video'); v.srcObject = st; v.muted = true; await v.play();
    await new Promise(r => setTimeout(r, 400));
    const cv = document.createElement('canvas'); cv.width = v.videoWidth; cv.height = v.videoHeight;
    cv.getContext('2d').drawImage(v, 0, 0); st.getTracks().forEach(t => t.stop());
    cv.toBlob(b => App.images.place(b), 'image/png');
  } catch (e) {}
};

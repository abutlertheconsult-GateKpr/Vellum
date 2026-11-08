// Keeps your PDF and edits on this device so they are still there next time.
App.store = {
  db() {
    return new Promise((ok, no) => {
      const r = indexedDB.open('pdfstudio', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => no(r.error);
    });
  },
  async put(k, v) {
    const d = await this.db();
    return new Promise(ok => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = ok; });
  },
  async get(k) {
    const d = await this.db();
    return new Promise(ok => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => ok(q.result); });
  },
  saveSoon() {
    clearTimeout(this.t);
    this.t = setTimeout(() => this.put('doc', { name: App.name, bytes: App.bytes, annots: App.annots, fields: App.fields }), 400);
  }
};

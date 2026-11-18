// Access codes: scrambles a file with a code (AES-256) so the code is needed to open it.
// The code is never stored with the file. A wrong code simply fails.
window.CodeLock = {
  ITER: 300000,
  b64(u) { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); },
  unb64(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; },
  norm(code) { return String(code || '').replace(/[\s-]/g, '').toUpperCase(); }, // codes ignore capitals, spaces and dashes
  valid(code) { return /^[A-Za-z0-9]{4,32}$/.test(String(code || '').replace(/[\s-]/g, '')); },
  makeCode(len = 10) { // easy-to-read letters and numbers (no 0, O, 1, I or L)
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', out = [];
    while (out.length < len) { const b = crypto.getRandomValues(new Uint8Array(1))[0]; if (b < 248) out.push(A[b % A.length]); }
    return out.join('');
  },
  show(code) { return this.norm(code).replace(/(.{5})(?=.)/g, '$1-'); }, // ABCDE-FGHJK
  async key(code, salt, iter) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(this.norm(code)), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },
  async encrypt(bytes, code) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const k = await this.key(code, salt, this.ITER);
    return { bytes: new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, bytes)), meta: { salt: this.b64(salt), iv: this.b64(iv), iter: this.ITER } };
  },
  async decrypt(bytes, code, meta) {
    const k = await this.key(code, this.unb64(meta.salt), meta.iter);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.unb64(meta.iv) }, k, bytes));
  }
};

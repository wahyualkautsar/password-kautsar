/**
 * Penghubung ke backend Apps Script lewat fetch (pengganti google.script.run).
 * Memakai Content-Type text/plain agar tidak memicu preflight CORS.
 */
async function callServer(fn, ...args) {
  setBusy(1);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    if (!GAS_URL || GAS_URL.indexOf('script.google.com') < 0) {
      throw new Error('GAS_URL belum diisi. Buka js/config.js dan isi dengan URL Web App (/exec).');
    }
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn: fn, args: args }),
      redirect: 'follow',
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error('Server mengembalikan status ' + res.status + '.');
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch (e) { throw new Error('Respons server bukan JSON. Pastikan Web App di-deploy dengan akses "Anyone" dan URL /exec benar.'); }
    if (data && data.__error) throw new Error(data.__error);
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Server terlalu lama merespons. Coba lagi.');
    if (e.message === 'Failed to fetch') throw new Error('Tidak bisa terhubung ke server. Periksa koneksi internet dan GAS_URL.');
    throw e;
  } finally {
    clearTimeout(timer);
    setBusy(-1);
  }
}

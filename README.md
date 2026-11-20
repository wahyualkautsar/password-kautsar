# Pencatatan Password Pribadi (frontend GitHub Pages)

Tampilan statis. Data disimpan di Google Sheets lewat API Apps Script.

- `index.html` — halaman utama (harus ada di root repository)
- `css/style.css` — gaya tampilan (mode terang/gelap)
- `js/config.js` — **isi `GAS_URL` dengan URL Web App (/exec)**
- `js/api.js` — penghubung ke Apps Script
- `js/app.js` — logika aplikasi

Backend (`Kode.gs`) dipasang terpisah di Apps Script, bukan di repository ini.

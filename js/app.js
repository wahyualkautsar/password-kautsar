/**
 * ============================================================
 * PENCATATAN PASSWORD PRIBADI — Frontend (JavaScript.html)
 * SPA: navigasi di sisi klien; data lewat API Apps Script (lihat js/api.js)
 * ============================================================
 */

// ════════════════════════════════════════════════════════
// BAGIAN 1: UTILITAS DASAR
// ════════════════════════════════════════════════════════

const mem = {};
const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch (e) { return mem[k] || null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
  del(k) { try { window.localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
};

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const APP = { token: '', user: null, settings: {}, categories: [], pub: {}, defaultLoginActive: false, section: 'dashboard' };
const TITLES = { dashboard: 'Dashboard', password: 'Data Password', kategori: 'Kategori', user: 'User Admin', log: 'Log Aktivitas', pengaturan: 'Pengaturan' };
const COLOR_LABEL = { pink: 'Merah muda', orange: 'Oranye', yellow: 'Kuning', slate: 'Abu-abu', green: 'Hijau', blue: 'Biru', purple: 'Ungu', teal: 'Tosca' };

let pending = 0;
function setBusy(d) {
  pending = Math.max(0, pending + d);
  $('topLoader').classList.toggle('on', pending > 0);
}

/** Panggil pintu API tunggal di server. Melempar Error jika gagal. */
async function api(action, payload) {
  const res = await callServer('api', APP.token, action, payload || {});
  if (!res) throw new Error('Respons server kosong.');
  if (!res.success) {
    const err = new Error(res.message || 'Terjadi kesalahan.');
    if (res.code === 'AUTH') { err.code = 'AUTH'; if (APP.user) handleAuthLost(); }
    throw err;
  }
  return res.data;
}

function toast(msg, type) {
  const el = $('appToast');
  el.className = 'toast align-items-center border-0 text-bg-' + (type === 'error' ? 'danger' : type === 'warn' ? 'warning' : 'success');
  $('toastBody').textContent = msg;
  bootstrap.Toast.getOrCreateInstance(el, { delay: type === 'error' ? 6000 : 3500 }).show();
}

function confirmDialog(opt) {
  return new Promise(resolve => {
    $('cfmTitle').textContent = opt.title || 'Konfirmasi';
    $('cfmBody').innerHTML = opt.message;
    const ok = $('cfmOk');
    ok.textContent = opt.ok || 'Ya';
    ok.className = 'btn ' + (opt.danger === false ? 'btn-primary' : 'btn-danger');
    const el = $('modalConfirm');
    const modal = bootstrap.Modal.getOrCreateInstance(el);
    let done = false;
    const onHidden = () => { el.removeEventListener('hidden.bs.modal', onHidden); if (!done) resolve(false); };
    el.addEventListener('hidden.bs.modal', onHidden);
    ok.onclick = () => { done = true; resolve(true); modal.hide(); };
    modal.show();
  });
}

async function withBusyBtn(btn, fn) {
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-inline"></span> Memproses...';
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = html; }
}

const loadingHtml = () => '<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-2 text-muted mb-0">Memuat data...</p></div>';
function showViewError(el, e) {
  el.innerHTML = '<div class="card-box text-center"><i class="bi bi-exclamation-circle fs-2 text-danger"></i><p class="mt-2 mb-3">' + esc(e.message) + '</p><button class="btn btn-outline-primary btn-sm" onclick="refreshView()">Coba lagi</button></div>';
}

function fmtDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? m[3] + '-' + m[2] + '-' + m[1] : (iso || '');
}
function todayIso() { return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); }

function safeUrl(u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(u)) return 'https://' + u;
  return '';
}
function linkHtml(u) {
  if (!u) return '';
  const s = safeUrl(u);
  return s ? '<div><a class="link-sm" href="' + esc(s) + '" target="_blank" rel="noopener noreferrer">' + esc(u) + '</a></div>'
           : '<div class="note-line">' + esc(u) + '</div>';
}
const tagHtml = (name, color) => '<span class="tag tag-' + esc(color || 'slate') + '">' + esc(name) + '</span>';
const statusTag = s => '<span class="tag ' + (s === 'Aktif' ? 'tag-green' : 'tag-off') + '">' + esc(s) + '</span>';

function copyText(text) {
  return new Promise(resolve => {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      resolve(ok);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => resolve(true)).catch(fallback);
    } else { fallback(); }
  });
}

// ════════════════════════════════════════════════════════
// BAGIAN 2: TEMA (TERANG / GELAP)
// ════════════════════════════════════════════════════════

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  store.set('pp_theme', t);
  document.querySelectorAll('[data-theme-icon]').forEach(i => { i.className = t === 'dark' ? 'bi bi-sun' : 'bi bi-moon-stars'; });
}
function toggleTheme() {
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}

// ════════════════════════════════════════════════════════
// BAGIAN 3: INISIALISASI, LOGIN & SESI
// ════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', init);

function hideOverlay() {
  const o = $('loadingOverlay');
  o.style.opacity = '0';
  setTimeout(() => { o.style.display = 'none'; }, 300);
}

function setBrand(name, owner) {
  name = name || 'Pencatatan Password Pribadi';
  owner = (owner || 'Pribadi').toUpperCase();
  $('brandName').textContent = name; $('brandOwner').textContent = owner;
  $('loginTitle').textContent = name; $('loginOwner').textContent = owner;
  document.title = name;
}

async function init() {
  const saved = store.get('pp_theme');
  applyTheme(saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  $('loginForm').addEventListener('submit', submitLogin);
  $('modalPreview').addEventListener('hidden.bs.modal', clearPreview);
  $('katWarna').innerHTML = Object.keys(COLOR_LABEL).map(k => '<option value="' + k + '">' + COLOR_LABEL[k] + '</option>').join('');
  $('katWarna').addEventListener('change', () => { $('katPreview').className = 'tag tag-' + $('katWarna').value; });
  try {
    const pub = await callServer('apiPublic');
    if (!pub.ready) { showFatal(pub.message || 'Jalankan setupAppEnvironment() dari editor Apps Script.'); return; }
    APP.pub = pub;
    setBrand(pub.appName, pub.ownerLabel);
    APP.token = store.get('pp_token') || '';
    if (pub.requireLogin) {
      if (APP.token) {
        try { await startApp(); return; } catch (e) { APP.token = ''; store.del('pp_token'); }
      }
      showLogin();
    } else {
      await startApp();
    }
  } catch (e) {
    showFatal(e.message);
  } finally {
    hideOverlay();
  }
}

function showFatal(msg) {
  $('fatalMsg').textContent = msg;
  $('fatalScreen').classList.remove('d-none');
  $('loginScreen').classList.add('d-none');
  $('appShell').classList.add('d-none');
}

function showLogin() {
  $('appShell').classList.add('d-none');
  $('fatalScreen').classList.add('d-none');
  $('loginScreen').classList.remove('d-none');
  $('loginPass').value = '';
  setTimeout(() => $('loginUser').focus(), 100);
}

async function submitLogin(ev) {
  ev.preventDefault();
  const err = $('loginError');
  err.classList.add('d-none');
  await withBusyBtn($('loginBtn'), async () => {
    try {
      const res = await callServer('apiLogin', $('loginUser').value, $('loginPass').value);
      if (!res.success) { err.textContent = res.message; err.classList.remove('d-none'); return; }
      APP.token = res.data.token;
      store.set('pp_token', APP.token);
      $('loginPass').value = '';
      await startApp();
    } catch (e) {
      err.textContent = e.message; err.classList.remove('d-none');
    }
  });
}

async function startApp() {
  const boot = await api('bootstrap');
  APP.user = boot.user;
  APP.settings = boot.settings;
  APP.categories = boot.categories;
  APP.defaultLoginActive = boot.defaultLoginActive;
  setBrand(boot.settings.appName, boot.settings.ownerLabel);
  $('userName').textContent = boot.user.Nama || boot.user.Username;
  $('userRole').textContent = boot.user.Role;
  $('btnLogout').classList.toggle('d-none', boot.settings.requireLogin !== 'Ya');
  $('loginScreen').classList.add('d-none');
  $('fatalScreen').classList.add('d-none');
  $('appShell').classList.remove('d-none');
  navigate('dashboard', boot.dashboard);
  if (boot.mustChange) openChangePw(true);
}

function handleAuthLost() {
  APP.token = ''; APP.user = null;
  store.del('pp_token');
  toast('Sesi berakhir. Silakan login kembali.', 'warn');
  showLogin();
}

async function logout() {
  try { await callServer('apiLogout', APP.token); } catch (e) { /* abaikan */ }
  APP.token = ''; APP.user = null;
  store.del('pp_token');
  Object.keys(TABLE_STATE).forEach(k => delete TABLE_STATE[k]);
  document.querySelectorAll('.view').forEach(v => { v.innerHTML = ''; });
  showLogin();
}

function togglePwField(id, btn) {
  const input = id ? $(id) : btn.closest('.input-group').querySelector('input');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.querySelector('i').className = show ? 'bi bi-eye-slash' : 'bi bi-eye';
}

// ════════════════════════════════════════════════════════
// BAGIAN 4: NAVIGASI SPA
// ════════════════════════════════════════════════════════

function navigate(sec, pre) {
  APP.section = sec;
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + sec));
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(l => l.classList.toggle('active', l.dataset.section === sec));
  $('pageTitle').textContent = TITLES[sec];
  closeSidebar();
  window.scrollTo(0, 0);
  LOADERS[sec](pre);
}
function refreshView() { LOADERS[APP.section](); }
function toggleSidebar() { $('sidebar').classList.toggle('show'); $('sidebarOverlay').classList.toggle('show'); }
function closeSidebar() { $('sidebar').classList.remove('show'); $('sidebarOverlay').classList.remove('show'); }

// ════════════════════════════════════════════════════════
// BAGIAN 5: KOMPONEN TABEL (cari, filter, urut, halaman, ekspor)
// ════════════════════════════════════════════════════════

const TABLES = {};
const TABLE_STATE = {};

function textOf(c, r) {
  const v = c.text ? c.text(r) : r[c.key];
  return String(v == null ? '' : v);
}

function makeTable(cfg) {
  const stt = TABLE_STATE[cfg.id] || (TABLE_STATE[cfg.id] = {
    q: '', filters: {}, sortKey: cfg.sortKey || null, sortDir: cfg.sortDir || 'asc',
    page: 1, size: Number(APP.settings.rowsPerPage) || 50
  });
  const cols = cfg.columns;
  const t = { cfg: cfg, st: stt, rows: [], view: [], mount: $(cfg.mount) };
  TABLES[cfg.id] = t;
  const sizes = [10, 25, 50, 100];
  if (sizes.indexOf(stt.size) < 0) { sizes.push(stt.size); sizes.sort((a, b) => a - b); }
  const exportable = cfg.export !== false;

  t.mount.innerHTML = `
    <div class="card-box">
      <div class="tbl-top">
        <div class="d-flex align-items-center gap-2">
          <span class="small fw-bold">Show</span>
          <select class="form-select form-select-sm w-auto" data-r="size">${sizes.map(s => `<option value="${s}" ${s === stt.size ? 'selected' : ''}>${s}</option>`).join('')}</select>
        </div>
        <input type="search" class="form-control" data-r="q" placeholder="${esc(cfg.searchPlaceholder || 'Cari...')}" value="${esc(stt.q)}">
        ${(cfg.filters || []).map(f => `
          <select class="form-select" data-filter="${esc(f.key)}">
            <option value="">${esc(f.label)}</option>
            ${f.options.map(o => `<option value="${esc(o.v)}" ${stt.filters[f.key] === o.v ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}
          </select>`).join('')}
        <div class="d-flex flex-wrap gap-2">
          ${exportable ? `
            <button type="button" class="btn btn-outline-success btn-sm" data-x="xlsx"><i class="bi bi-file-earmark-excel"></i> Excel</button>
            <button type="button" class="btn btn-outline-danger btn-sm" data-x="pdf"><i class="bi bi-file-earmark-pdf"></i> PDF</button>
            <button type="button" class="btn btn-outline-primary btn-sm" data-x="png"><i class="bi bi-file-earmark-image"></i> PNG</button>` : ''}
          ${cfg.actions || ''}
        </div>
        ${cfg.note || ''}
      </div>
      <div class="table-responsive tbl-wrap">
        <table class="table align-middle" data-r="table">
          <thead><tr>${cols.map(c => `<th data-k="${esc(c.key)}" class="${c.sort === false ? '' : 'sortable'}">${esc(c.label)}${c.sort === false ? '' : ' <i class="bi bi-arrow-down-up"></i>'}</th>`).join('')}</tr></thead>
          <tbody data-r="body"></tbody>
        </table>
      </div>
      <div class="tbl-foot"><span class="small text-muted" data-r="info"></span><div class="pager" data-r="pager"></div></div>
    </div>`;

  const q = n => t.mount.querySelector('[data-r="' + n + '"]');
  t.tableEl = q('table');

  function update() {
    let rows = t.rows.slice();
    const term = stt.q.trim().toLowerCase();
    if (term) rows = rows.filter(r => cols.some(c => c.search !== false && textOf(c, r).toLowerCase().indexOf(term) >= 0));
    (cfg.filters || []).forEach(f => { const v = stt.filters[f.key]; if (v) rows = rows.filter(r => f.test(r, v)); });
    if (stt.sortKey) {
      const c = cols.find(x => x.key === stt.sortKey);
      if (c) {
        const dir = stt.sortDir === 'desc' ? -1 : 1;
        rows.sort((a, b) => dir * textOf(c, a).localeCompare(textOf(c, b), 'id', { numeric: true, sensitivity: 'base' }));
      }
    }
    t.view = rows;
    const pages = Math.max(1, Math.ceil(rows.length / stt.size));
    if (stt.page > pages) stt.page = pages;
    const start = (stt.page - 1) * stt.size;
    const slice = rows.slice(start, start + stt.size);
    q('body').innerHTML = slice.length
      ? slice.map(r => '<tr>' + cols.map(c => '<td class="' + (c.cls || '') + '">' + (c.html ? c.html(r) : esc(textOf(c, r))) + '</td>').join('') + '</tr>').join('')
      : '<tr><td colspan="' + cols.length + '" class="text-center text-muted py-4">' + esc(cfg.empty || 'Belum ada data.') + '</td></tr>';
    q('info').textContent = rows.length ? (start + 1) + '–' + (start + slice.length) + ' dari ' + rows.length : '0 dari 0';
    q('pager').innerHTML = `<button type="button" class="btn btn-outline-secondary btn-sm" data-p="-1" ${stt.page <= 1 ? 'disabled' : ''}><i class="bi bi-chevron-left"></i> Previous</button>
      <span class="small">${stt.page} / ${pages}</span>
      <button type="button" class="btn btn-outline-secondary btn-sm" data-p="1" ${stt.page >= pages ? 'disabled' : ''}>Next <i class="bi bi-chevron-right"></i></button>`;
    t.mount.querySelectorAll('thead th').forEach(th => {
      const i = th.querySelector('i');
      if (!i) return;
      i.className = th.dataset.k === stt.sortKey ? (stt.sortDir === 'desc' ? 'bi bi-arrow-down' : 'bi bi-arrow-up') : 'bi bi-arrow-down-up';
    });
  }

  q('size').addEventListener('change', e => { stt.size = Number(e.target.value); stt.page = 1; update(); });
  q('q').addEventListener('input', e => { stt.q = e.target.value; stt.page = 1; update(); });
  t.mount.querySelectorAll('[data-filter]').forEach(sel => sel.addEventListener('change', e => {
    stt.filters[e.target.dataset.filter] = e.target.value; stt.page = 1; update();
  }));
  t.mount.querySelectorAll('thead th.sortable').forEach(th => th.addEventListener('click', () => {
    if (stt.sortKey === th.dataset.k) stt.sortDir = stt.sortDir === 'asc' ? 'desc' : 'asc';
    else { stt.sortKey = th.dataset.k; stt.sortDir = 'asc'; }
    update();
  }));
  t.mount.querySelectorAll('[data-x]').forEach(b => b.addEventListener('click', () => exportTable(cfg.id, b.dataset.x, b)));
  q('pager').addEventListener('click', e => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    stt.page += Number(b.dataset.p); update();
  });

  t.setRows = rows => { t.rows = rows; update(); };
  t.update = update;
  return t;
}

// ── Ekspor (Excel, PDF, PNG) — mengikuti filter yang sedang aktif ──
async function exportTable(id, fmt, btn) {
  const t = TABLES[id];
  if (!t) return;
  const cols = t.cfg.columns.filter(c => c.exp !== false);
  const head = cols.map(c => c.label);
  const body = t.view.map(r => cols.map(c => textOf(c, r)));
  const stamp = todayIso().replace(/-/g, '');
  const name = (t.cfg.exportName || id) + '_' + stamp;
  try {
    if (fmt === 'xlsx') {
      const ws = XLSX.utils.aoa_to_sheet([head].concat(body));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      XLSX.writeFile(wb, name + '.xlsx');
    } else if (fmt === 'pdf') {
      const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      doc.setFontSize(14);
      doc.text(t.cfg.exportTitle || id, 40, 36);
      doc.setFontSize(9);
      doc.text('Dicetak: ' + fmtDate(todayIso()) + ' | ' + body.length + ' baris', 40, 52);
      doc.autoTable({ head: [head], body: body, startY: 64, styles: { fontSize: 8, cellPadding: 4 }, headStyles: { fillColor: [15, 23, 42] } });
      doc.save(name + '.pdf');
    } else {
      const canvas = await html2canvas(t.tableEl, { scale: 2, backgroundColor: getComputedStyle(document.body).backgroundColor });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png'); a.download = name + '.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    toast('Ekspor ' + fmt.toUpperCase() + ' berhasil (' + body.length + ' baris).');
    api('export.log', { menu: id, format: fmt, count: body.length }).catch(() => {});
  } catch (e) {
    toast('Ekspor gagal: ' + e.message, 'error');
  }
}

// ════════════════════════════════════════════════════════
// BAGIAN 6: DASHBOARD
// ════════════════════════════════════════════════════════

async function loadDashboard(pre) {
  const el = $('view-dashboard');
  try {
    let d = pre;
    if (!d) { el.innerHTML = loadingHtml(); d = await api('dash'); }
    renderDashboard(d);
  } catch (e) { showViewError(el, e); }
}

function renderDashboard(d) {
  const cards = [['Total Akun', d.total, 'blue'], ['Akun Aktif', d.aktif, 'green'], ['Favorit', d.favorit, 'purple'], ['Kategori Aktif', d.kategoriAktif, 'orange']];
  $('view-dashboard').innerHTML = `
    <div class="row g-3 mb-3">
      ${cards.map(c => `<div class="col-6 col-lg-3"><div class="stat-card stat-${c[2]}"><div class="lbl">${c[0]}</div><div class="val">${c[1]}</div></div></div>`).join('')}
    </div>
    <div class="card-box d-flex flex-wrap align-items-center justify-content-between gap-3">
      <div><div class="card-title-lg">Akses Cepat</div>
        <div class="note-line">Tambah beberapa username, email, dan password sekaligus melalui form multi data.</div></div>
      <button class="btn btn-primary" onclick="openPwd()"><i class="bi bi-plus-lg"></i> Tambah Password</button>
    </div>
    <div class="card-box">
      <div class="card-title-lg mb-3">Data Terbaru</div>
      <div class="table-responsive tbl-wrap">
        <table class="table">
          <thead><tr><th>Layanan</th><th>Username</th><th>Email</th><th>Kategori</th><th>Status</th><th>Tanggal Ditambahkan</th></tr></thead>
          <tbody>${d.terbaru.length ? d.terbaru.map(r => `<tr>
            <td class="fw-bold">${esc(r.NamaLayanan)}</td><td>${esc(r.Username)}</td><td>${esc(r.Email || '-')}</td>
            <td>${tagHtml(r.KategoriNama, r.Warna)}</td><td>${statusTag(r.Status)}</td><td>${fmtDate(r.TanggalDitambahkan)}</td></tr>`).join('')
            : '<tr><td colspan="6" class="text-center text-muted py-4">Belum ada data password.</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════
// BAGIAN 7: DATA PASSWORD
// ════════════════════════════════════════════════════════

let PWD_ROWS = [];

async function loadPwd() {
  const el = $('view-password');
  el.innerHTML = loadingHtml();
  try {
    const data = await api('pwd.list');
    APP.categories = data.categories;
    PWD_ROWS = data.rows;
    const show = APP.settings.showPassword === 'Ya';
    const t = makeTable({
      id: 'pwd', mount: 'view-password', exportName: 'Data_Password', exportTitle: 'Data Password',
      searchPlaceholder: 'Cari layanan, username, email...',
      sortKey: 'TanggalDitambahkan', sortDir: 'desc',
      filters: [
        { key: 'kat', label: 'Semua Kategori', options: data.categories.map(c => ({ v: c.ID, l: c.NamaKategori })), test: (r, v) => r.KategoriID === v },
        { key: 'status', label: 'Semua Status', options: [{ v: 'Aktif', l: 'Aktif' }, { v: 'Nonaktif', l: 'Nonaktif' }], test: (r, v) => r.Status === v },
        { key: 'fav', label: 'Semua Favorit', options: [{ v: 'Ya', l: 'Favorit' }, { v: 'Tidak', l: 'Bukan favorit' }], test: (r, v) => r.Favorit === v }
      ],
      actions: '<button type="button" class="btn btn-primary btn-sm" onclick="openPwd()"><i class="bi bi-plus-lg"></i> Tambah Password</button>',
      note: '<div class="note-line">' + (show ? 'Password ditampilkan langsung di tabel (diatur di Pengaturan).' : 'Password disamarkan. Klik ikon mata untuk melihat sementara, atau ikon salin untuk menyalin.') + '</div>',
      columns: [
        { key: 'NamaLayanan', label: 'Layanan', text: r => r.NamaLayanan + (r.URL ? ' (' + r.URL + ')' : ''), html: r => '<div class="fw-bold">' + esc(r.NamaLayanan) + '</div>' + linkHtml(r.URL) },
        { key: 'Username', label: 'Username' },
        { key: 'Email', label: 'Email', text: r => r.Email || '-' },
        { key: 'KategoriNama', label: 'Kategori', html: r => tagHtml(r.KategoriNama, r.Warna) },
        { key: 'Password', label: 'Password', sort: false, search: false, text: r => show ? r.Password : '••••••••', html: r => pwCell(r, show) },
        { key: 'Favorit', label: 'Favorit', html: r => r.Favorit === 'Ya' ? '<i class="bi bi-star-fill star"></i>' : '-', text: r => r.Favorit === 'Ya' ? 'Ya' : '-' },
        { key: 'Status', label: 'Status', html: r => statusTag(r.Status) },
        { key: 'TanggalDitambahkan', label: 'Tanggal', text: r => fmtDate(r.TanggalDitambahkan), html: r => fmtDate(r.TanggalDitambahkan) },
        { key: '_act', label: 'Aksi', sort: false, search: false, exp: false, cls: 'act-cell',
          html: r => (r.hasFile ? '<button class="btn btn-xs btn-outline-secondary me-1" onclick="viewFile(\'' + esc(r.ID) + '\')" title="Lihat lampiran"><i class="bi bi-paperclip"></i></button>' : '') +
            '<button class="btn btn-xs btn-outline-dark me-1" onclick="openPwd(\'' + esc(r.ID) + '\')" title="Edit"><i class="bi bi-pencil-fill"></i></button>' +
            '<button class="btn btn-xs btn-outline-danger" onclick="delPwd(\'' + esc(r.ID) + '\')" title="Hapus"><i class="bi bi-trash-fill"></i></button>' }
      ]
    });
    t.setRows(data.rows);
  } catch (e) { showViewError(el, e); }
}

function pwCell(r, show) {
  if (show) {
    return '<span class="pw-cell"><span class="mono">' + esc(r.Password) + '</span>' +
      '<button class="btn btn-xs btn-outline-secondary" onclick="copyPw(\'' + esc(r.ID) + '\')" title="Salin"><i class="bi bi-clipboard"></i></button></span>';
  }
  return '<span class="pw-cell"><span class="mono" id="pw_' + esc(r.ID) + '">••••••••</span>' +
    '<button class="btn btn-xs btn-outline-secondary" onclick="revealPw(\'' + esc(r.ID) + '\', this)" title="Tampilkan"><i class="bi bi-eye"></i></button>' +
    '<button class="btn btn-xs btn-outline-secondary" onclick="copyPw(\'' + esc(r.ID) + '\')" title="Salin"><i class="bi bi-clipboard"></i></button></span>';
}

async function revealPw(id, btn) {
  const span = $('pw_' + id);
  if (!span) return;
  if (span.dataset.shown === '1') { hidePw(span, btn); return; }
  try {
    const d = await api('pwd.reveal', { id: id });
    span.textContent = d.Password; span.dataset.shown = '1';
    btn.querySelector('i').className = 'bi bi-eye-slash';
    setTimeout(() => { if (span.dataset.shown === '1') hidePw(span, btn); }, 15000);
  } catch (e) { toast(e.message, 'error'); }
}
function hidePw(span, btn) {
  span.textContent = '••••••••'; span.dataset.shown = '0';
  btn.querySelector('i').className = 'bi bi-eye';
}

async function copyPw(id) {
  try {
    const row = PWD_ROWS.find(r => r.ID === id);
    let pw = row && row.Password;
    if (!pw) pw = (await api('pwd.reveal', { id: id })).Password;
    const ok = await copyText(pw);
    toast(ok ? 'Password disalin ke clipboard.' : 'Gagal menyalin. Salin manual dari ikon mata.', ok ? 'success' : 'warn');
  } catch (e) { toast(e.message, 'error'); }
}

async function delPwd(id) {
  const r = PWD_ROWS.find(x => x.ID === id);
  const ok = await confirmDialog({ title: 'Hapus Data Password', message: 'Hapus data <b>' + esc(r ? r.NamaLayanan : '') + '</b>? Tindakan ini tidak dapat dibatalkan.', ok: 'Hapus' });
  if (!ok) return;
  try {
    await api('pwd.delete', { id: id });
    toast('Data berhasil dihapus.');
    loadPwd();
  } catch (e) { toast(e.message, 'error'); }
}

// ── Modal Tambah/Edit (multi data) ──
let pwdState = { mode: 'add', id: '' };

function catOptions(sel) {
  const list = APP.categories.filter(c => c.Status === 'Aktif' || c.ID === sel);
  const def = sel || (list.find(c => c.NamaKategori === 'Lainnya') || list[0] || {}).ID;
  return list.map(c => '<option value="' + esc(c.ID) + '"' + (c.ID === def ? ' selected' : '') + '>' + esc(c.NamaKategori) + '</option>').join('');
}

function pwdRowHtml(rec) {
  const r = rec || {};
  const edit = !!rec;
  return `<div class="pwd-row">
    <div class="pwd-row-head"><span>${edit ? 'Data password' : 'Data #<span class="row-no">1</span>'}</span>
      <button type="button" class="btn btn-xs btn-outline-danger btn-rm ${edit ? 'd-none' : ''}" onclick="removePwdRow(this)"><i class="bi bi-x-lg"></i> Hapus baris</button></div>
    <div class="row g-2">
      <div class="col-md-6"><label>Nama Layanan / Aplikasi <span class="text-danger">*</span></label>
        <input class="form-control" data-f="NamaLayanan" maxlength="120" required value="${esc(r.NamaLayanan)}"></div>
      <div class="col-md-6"><label>URL / Website</label>
        <input class="form-control" data-f="URL" maxlength="300" placeholder="contoh: tokopedia.com" value="${esc(r.URL)}"></div>
      <div class="col-md-6"><label>Username <span class="text-danger">*</span></label>
        <input class="form-control" data-f="Username" maxlength="150" required autocomplete="off" value="${esc(r.Username)}"></div>
      <div class="col-md-6"><label>Email</label>
        <input class="form-control" data-f="Email" maxlength="150" autocomplete="off" value="${esc(r.Email)}"></div>
      <div class="col-md-6"><label>Password <span class="text-danger">*</span></label>
        <div class="input-group">
          <input type="password" class="form-control mono" data-f="Password" maxlength="500" required autocomplete="new-password" value="${esc(r.Password)}">
          <button type="button" class="btn btn-outline-secondary" onclick="togglePwField(null, this)" title="Tampilkan/sembunyikan"><i class="bi bi-eye"></i></button>
          <button type="button" class="btn btn-outline-secondary" onclick="genPw(this)" title="Buat password acak"><i class="bi bi-magic"></i></button>
        </div></div>
      <div class="col-md-6"><label>Kategori</label>
        <select class="form-select" data-f="KategoriID" required>${catOptions(r.KategoriID)}</select></div>
      <div class="col-6 col-md-3"><label>Favorit</label>
        <select class="form-select" data-f="Favorit"><option value="Tidak" ${r.Favorit !== 'Ya' ? 'selected' : ''}>Tidak</option><option value="Ya" ${r.Favorit === 'Ya' ? 'selected' : ''}>Ya</option></select></div>
      <div class="col-6 col-md-3"><label>Status</label>
        <select class="form-select" data-f="Status"><option value="Aktif" ${r.Status !== 'Nonaktif' ? 'selected' : ''}>Aktif</option><option value="Nonaktif" ${r.Status === 'Nonaktif' ? 'selected' : ''}>Nonaktif</option></select></div>
      <div class="col-12 col-md-6"><label>Tanggal Ditambahkan <span class="text-danger">*</span></label>
        <input type="date" class="form-control" data-f="TanggalDitambahkan" required value="${esc(r.TanggalDitambahkan || todayIso())}"></div>
      <div class="col-12"><label>Catatan</label>
        <textarea class="form-control" data-f="Catatan" rows="2" maxlength="2000">${esc(r.Catatan)}</textarea></div>
      <div class="col-12"><label>Lampiran (opsional, maks. 5 MB)</label>
        <input type="file" class="form-control" data-file="1">
        ${r.LampiranNama ? `<div class="form-check mt-2 small"><input class="form-check-input" type="checkbox" data-f="removeFile" id="rm_${esc(r.ID)}"><label class="form-check-label" for="rm_${esc(r.ID)}">Hapus lampiran saat ini (${esc(r.LampiranNama)})</label></div>` : ''}</div>
    </div>
  </div>`;
}

function renumberRows() {
  const rows = $('pwdRows').querySelectorAll('.pwd-row');
  rows.forEach((row, i) => {
    const no = row.querySelector('.row-no'); if (no) no.textContent = i + 1;
    const rm = row.querySelector('.btn-rm'); if (rm && pwdState.mode === 'add') rm.classList.toggle('d-none', rows.length === 1);
  });
}
function addPwdRow(rec) {
  const box = $('pwdRows');
  if (!rec && box.querySelectorAll('.pwd-row').length >= 20) { toast('Maksimal 20 baris sekali input.', 'warn'); return; }
  box.insertAdjacentHTML('beforeend', pwdRowHtml(rec && rec.ID ? rec : null));
  renumberRows();
}
function removePwdRow(btn) { btn.closest('.pwd-row').remove(); renumberRows(); }

function genPw(btn) {
  const set = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*?';
  const arr = new Uint32Array(16);
  crypto.getRandomValues(arr);
  const pw = Array.from(arr, n => set[n % set.length]).join('');
  const input = btn.closest('.input-group').querySelector('input');
  input.value = pw; input.type = 'text';
  btn.closest('.input-group').querySelector('button i').className = 'bi bi-eye-slash';
}

async function openPwd(id) {
  if (!APP.categories.some(c => c.Status === 'Aktif')) { toast('Buat atau aktifkan minimal satu kategori dulu.', 'warn'); return; }
  try {
    let rec = null;
    if (id) rec = await api('pwd.get', { id: id });
    pwdState = { mode: id ? 'edit' : 'add', id: id || '' };
    $('pwdTitle').textContent = id ? 'Edit Data Password' : 'Tambah Password';
    $('pwdHint').textContent = id ? '' : 'Anda dapat menambah beberapa akun sekaligus dengan tombol "Tambah baris". Tanda * wajib diisi.';
    $('pwdRows').innerHTML = '';
    addPwdRow(rec);
    $('btnAddRow').classList.toggle('d-none', !!id);
    bootstrap.Modal.getOrCreateInstance($('modalPwd')).show();
  } catch (e) { toast(e.message, 'error'); }
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    if (file.size > 5 * 1024 * 1024) { reject(new Error('Ukuran lampiran "' + file.name + '" melebihi 5 MB.')); return; }
    const fr = new FileReader();
    fr.onload = () => resolve({ name: file.name, type: file.type, data: String(fr.result).split(',')[1] });
    fr.onerror = () => reject(new Error('Gagal membaca berkas.'));
    fr.readAsDataURL(file);
  });
}

async function submitPwd(ev) {
  ev.preventDefault();
  const form = $('pwdForm');
  if (!form.checkValidity()) { form.reportValidity(); return; }
  await withBusyBtn($('btnSavePwd'), async () => {
    try {
      const records = [];
      for (const row of form.querySelectorAll('.pwd-row')) {
        const rec = {};
        row.querySelectorAll('[data-f]').forEach(el => { rec[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value; });
        if (pwdState.mode === 'edit') rec.ID = pwdState.id;
        const fi = row.querySelector('input[data-file]');
        if (fi && fi.files[0]) rec.file = await readFile(fi.files[0]);
        records.push(rec);
      }
      const res = await api('pwd.save', { records: records });
      bootstrap.Modal.getInstance($('modalPwd')).hide();
      toast(res.added ? res.added + ' data ditambahkan.' : 'Data berhasil diperbarui.');
      APP.section === 'dashboard' ? loadDashboard() : loadPwd();
    } catch (e) { toast(e.message, 'error'); }
  });
}

// ── Pratinjau lampiran (modal, bukan tab baru) ──
let previewUrl = '';
function clearPreview() {
  if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = ''; }
  $('pvBody').innerHTML = '';
}
async function viewFile(id) {
  try {
    const f = await api('pwd.file', { id: id });
    const bin = atob(f.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    clearPreview();
    previewUrl = URL.createObjectURL(new Blob([bytes], { type: f.mime }));
    $('pvTitle').textContent = f.name;
    const dl = $('pvDownload'); dl.href = previewUrl; dl.setAttribute('download', f.name);
    if (/^image\//.test(f.mime)) $('pvBody').innerHTML = '<img src="' + previewUrl + '" class="img-fluid rounded" alt="' + esc(f.name) + '">';
    else if (f.mime === 'application/pdf') $('pvBody').innerHTML = '<iframe src="' + previewUrl + '" style="width:100%;height:70vh;border:0"></iframe>';
    else $('pvBody').innerHTML = '<p class="text-muted my-4">Pratinjau tidak tersedia untuk jenis berkas ini. Gunakan tombol Unduh.</p>';
    bootstrap.Modal.getOrCreateInstance($('modalPreview')).show();
  } catch (e) { toast(e.message, 'error'); }
}

// ════════════════════════════════════════════════════════
// BAGIAN 8: KATEGORI
// ════════════════════════════════════════════════════════

let KAT_ROWS = [];
async function loadKat() {
  const el = $('view-kategori');
  el.innerHTML = loadingHtml();
  try {
    KAT_ROWS = await api('kat.list');
    APP.categories = KAT_ROWS;
    const t = makeTable({
      id: 'kat', mount: 'view-kategori', exportName: 'Kategori', exportTitle: 'Kategori Password',
      searchPlaceholder: 'Cari kategori...', sortKey: 'NamaKategori',
      filters: [{ key: 'status', label: 'Semua Status', options: [{ v: 'Aktif', l: 'Aktif' }, { v: 'Nonaktif', l: 'Nonaktif' }], test: (r, v) => r.Status === v }],
      actions: '<button type="button" class="btn btn-primary btn-sm" onclick="openKat()"><i class="bi bi-plus-lg"></i> Tambah Kategori</button>',
      columns: [
        { key: 'NamaKategori', label: 'Nama Kategori', html: r => tagHtml(r.NamaKategori, r.WarnaLabel) },
        { key: 'Status', label: 'Status', html: r => statusTag(r.Status) },
        { key: 'Keterangan', label: 'Keterangan' },
        { key: 'dipakai', label: 'Dipakai', text: r => r.dipakai + ' data' },
        { key: '_act', label: 'Aksi', sort: false, search: false, exp: false, cls: 'act-cell',
          html: r => '<button class="btn btn-xs btn-outline-dark me-1" onclick="openKat(\'' + esc(r.ID) + '\')" title="Edit"><i class="bi bi-pencil-fill"></i></button>' +
            '<button class="btn btn-xs btn-outline-danger" onclick="delKat(\'' + esc(r.ID) + '\')" title="Hapus"><i class="bi bi-trash-fill"></i></button>' }
      ]
    });
    t.setRows(KAT_ROWS);
  } catch (e) { showViewError(el, e); }
}

function openKat(id) {
  const r = id ? KAT_ROWS.find(x => x.ID === id) : null;
  $('katTitle').textContent = r ? 'Edit Kategori' : 'Tambah Kategori';
  $('katId').value = r ? r.ID : '';
  $('katNama').value = r ? r.NamaKategori : '';
  $('katKet').value = r ? r.Keterangan : '';
  $('katStatus').value = r ? r.Status : 'Aktif';
  $('katWarna').value = r ? r.WarnaLabel : 'slate';
  $('katPreview').className = 'tag tag-' + $('katWarna').value;
  bootstrap.Modal.getOrCreateInstance($('modalKat')).show();
}

async function submitKat(ev) {
  ev.preventDefault();
  if (!$('katForm').checkValidity()) { $('katForm').reportValidity(); return; }
  await withBusyBtn($('btnSaveKat'), async () => {
    try {
      await api('kat.save', { ID: $('katId').value, NamaKategori: $('katNama').value, Keterangan: $('katKet').value, Status: $('katStatus').value, WarnaLabel: $('katWarna').value });
      bootstrap.Modal.getInstance($('modalKat')).hide();
      toast('Kategori berhasil disimpan.');
      loadKat();
    } catch (e) { toast(e.message, 'error'); }
  });
}

async function delKat(id) {
  const r = KAT_ROWS.find(x => x.ID === id);
  const ok = await confirmDialog({ title: 'Hapus Kategori', message: 'Hapus kategori <b>' + esc(r ? r.NamaKategori : '') + '</b>?', ok: 'Hapus' });
  if (!ok) return;
  try { await api('kat.delete', { id: id }); toast('Kategori berhasil dihapus.'); loadKat(); }
  catch (e) { toast(e.message, 'error'); }
}

// ════════════════════════════════════════════════════════
// BAGIAN 9: USER ADMIN
// ════════════════════════════════════════════════════════

let USR_ROWS = [];
async function loadUser() {
  const el = $('view-user');
  el.innerHTML = loadingHtml();
  try {
    USR_ROWS = await api('usr.list');
    const t = makeTable({
      id: 'usr', mount: 'view-user', exportName: 'User_Admin', exportTitle: 'User Admin',
      searchPlaceholder: 'Cari user...', sortKey: 'DibuatPada', sortDir: 'desc',
      filters: [{ key: 'status', label: 'Semua Status', options: [{ v: 'Aktif', l: 'Aktif' }, { v: 'Nonaktif', l: 'Nonaktif' }], test: (r, v) => r.Status === v }],
      actions: '<button type="button" class="btn btn-primary btn-sm" onclick="openUser()"><i class="bi bi-plus-lg"></i> Tambah User</button>',
      columns: [
        { key: 'Username', label: 'Username', html: r => '<b>' + esc(r.Username) + '</b>' },
        { key: 'Nama', label: 'Nama' },
        { key: 'Role', label: 'Role', html: r => '<span class="tag tag-purple">' + esc(r.Role) + '</span>' },
        { key: 'Status', label: 'Status', html: r => statusTag(r.Status) },
        { key: 'DibuatPada', label: 'Dibuat' },
        { key: '_act', label: 'Aksi', sort: false, search: false, exp: false, cls: 'act-cell',
          html: r => '<button class="btn btn-xs btn-outline-dark me-1" onclick="openUser(\'' + esc(r.ID) + '\')" title="Edit"><i class="bi bi-pencil-fill"></i></button>' +
            '<button class="btn btn-xs btn-outline-danger" onclick="delUser(\'' + esc(r.ID) + '\')" title="Hapus"><i class="bi bi-trash-fill"></i></button>' }
      ]
    });
    t.setRows(USR_ROWS);
  } catch (e) { showViewError(el, e); }
}

function openUser(id) {
  const r = id ? USR_ROWS.find(x => x.ID === id) : null;
  $('userTitle').textContent = r ? 'Edit User' : 'Tambah User';
  $('userId').value = r ? r.ID : '';
  $('userUsername').value = r ? r.Username : '';
  $('userNama').value = r ? r.Nama : '';
  $('userStatus').value = r ? r.Status : 'Aktif';
  $('userPassword').value = ''; $('userPassword').type = 'password';
  $('userPassword').required = !r;
  $('userPwLabel').innerHTML = r ? 'Password baru' : 'Password <span class="text-danger">*</span>';
  $('userPwHint').textContent = r ? 'Kosongkan jika tidak ingin mengganti password. Minimal 8 karakter.' : 'Minimal 8 karakter.';
  bootstrap.Modal.getOrCreateInstance($('modalUser')).show();
}

async function submitUser(ev) {
  ev.preventDefault();
  if (!$('userForm').checkValidity()) { $('userForm').reportValidity(); return; }
  await withBusyBtn($('btnSaveUser'), async () => {
    try {
      const res = await api('usr.save', { ID: $('userId').value, Username: $('userUsername').value, Nama: $('userNama').value,
        Role: 'Admin', Status: $('userStatus').value, Password: $('userPassword').value });
      if (res && res.token) { APP.token = res.token; store.set('pp_token', res.token); }
      bootstrap.Modal.getInstance($('modalUser')).hide();
      toast('User berhasil disimpan.');
      loadUser();
    } catch (e) { toast(e.message, 'error'); }
  });
}

async function delUser(id) {
  const r = USR_ROWS.find(x => x.ID === id);
  const ok = await confirmDialog({ title: 'Hapus User', message: 'Hapus user <b>' + esc(r ? r.Username : '') + '</b>?', ok: 'Hapus' });
  if (!ok) return;
  try { await api('usr.delete', { id: id }); toast('User berhasil dihapus.'); loadUser(); }
  catch (e) { toast(e.message, 'error'); }
}

// ════════════════════════════════════════════════════════
// BAGIAN 10: LOG AKTIVITAS
// ════════════════════════════════════════════════════════

async function loadLog() {
  const el = $('view-log');
  el.innerHTML = loadingHtml();
  try {
    const d = await api('log.list');
    const t = makeTable({
      id: 'log', mount: 'view-log', exportName: 'Log_Aktivitas', exportTitle: 'Log Aktivitas',
      searchPlaceholder: 'Cari log...', sortKey: 'Tanggal', sortDir: 'desc',
      actions: `
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="clearLog('week')"><i class="bi bi-calendar-x"></i> Hapus Lebih dari 1 Minggu</button>
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="clearLog('month')"><i class="bi bi-calendar3"></i> Hapus Lebih dari 1 Bulan</button>
        <button type="button" class="btn btn-outline-danger btn-sm" onclick="clearLog('year')"><i class="bi bi-calendar-event"></i> Hapus Lebih dari 1 Tahun</button>
        <button type="button" class="btn btn-danger btn-sm" onclick="clearLog('all')"><i class="bi bi-trash3"></i> Hapus Semua Aktivitas</button>`,
      note: '<div class="note-line"><b>Riwayat Log: ' + (d.enabled ? 'ON' : 'OFF') + '.</b> ' +
        (d.enabled ? 'Aktivitas aplikasi dicatat seperti biasa. ' : 'Aktivitas biasa tidak dicatat. ') +
        'Setiap pembersihan membuat riwayat audit yang tidak dapat dihapus oleh keempat tombol pembersihan ini.' +
        (d.truncated ? ' (Hanya 5.000 log terbaru yang ditampilkan.)' : '') + '</div>',
      columns: [
        { key: 'Tanggal', label: 'Tanggal' },
        { key: 'Username', label: 'Username', html: r => '<b>' + esc(r.Username) + '</b>' },
        { key: 'Role', label: 'Role' },
        { key: 'Aksi', label: 'Aksi' },
        { key: 'Menu', label: 'Menu' },
        { key: 'Detail', label: 'Detail' }
      ]
    });
    t.setRows(d.rows);
  } catch (e) { showViewError(el, e); }
}

async function clearLog(mode) {
  const label = { week: 'lebih dari 1 minggu', month: 'lebih dari 1 bulan', year: 'lebih dari 1 tahun', all: 'SEMUA aktivitas' }[mode];
  const ok = await confirmDialog({ title: 'Bersihkan Log Aktivitas', message: 'Hapus log <b>' + label + '</b>? Riwayat pembersihan tetap tersimpan sebagai catatan audit.', ok: 'Ya, Bersihkan' });
  if (!ok) return;
  try {
    const r = await api('log.clear', { mode: mode });
    toast(r.removed + ' baris log dihapus.');
    loadLog();
  } catch (e) { toast(e.message, 'error'); }
}

// ════════════════════════════════════════════════════════
// BAGIAN 11: PENGATURAN & GANTI PASSWORD
// ════════════════════════════════════════════════════════

async function loadSettings() {
  const el = $('view-pengaturan');
  el.innerHTML = loadingHtml();
  try {
    const s = await api('set.get');
    APP.settings = s;
    const sw = (id, on, title, hint) => `
      <div class="form-check form-switch">
        <input class="form-check-input" type="checkbox" role="switch" id="${id}" ${on ? 'checked' : ''}>
        <label class="form-check-label fw-bold" for="${id}">${title}</label>
      </div>
      <div class="note-line mt-1">${hint}</div>`;
    el.innerHTML = `
      <div class="card-box">
        <div class="card-title-lg mb-3">Pengaturan Aplikasi</div>
        <form id="setForm" onsubmit="saveSettings(event)">
          <div class="row g-3">
            <div class="col-md-6"><label class="form-label fw-semibold small">Nama Aplikasi <span class="text-danger">*</span></label>
              <input id="set_appName" class="form-control" maxlength="60" required value="${esc(s.appName)}"></div>
            <div class="col-md-6"><label class="form-label fw-semibold small">Label Pemilik</label>
              <input id="set_ownerLabel" class="form-control" maxlength="30" value="${esc(s.ownerLabel)}"></div>
            <div class="col-md-6"><label class="form-label fw-semibold small">Baris per Halaman</label>
              <select id="set_rows" class="form-select">${[10, 25, 50, 100].map(n => `<option ${n === s.rowsPerPage ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
            <div class="col-md-6"><label class="form-label fw-semibold small d-block">Login untuk Masuk Aplikasi</label>
              ${sw('set_requireLogin', s.requireLogin === 'Ya', 'Wajib login dengan username &amp; password', 'Default ON. Jika dimatikan, siapa pun yang punya link bisa langsung membuka aplikasi tanpa layar login.')}</div>
            <div class="col-md-6"><label class="form-label fw-semibold small d-block">Riwayat Log Aktivitas</label>
              ${sw('set_logEnabled', s.logEnabled === 'Ya', 'Aktifkan pencatatan Log Aktivitas', 'Jika OFF, aktivitas biasa tidak dicatat sama sekali. Riwayat Hapus dari tombol pembersihan Log tetap dicatat dan tetap dilindungi.')}</div>
            <div class="col-md-6"><label class="form-label fw-semibold small d-block">Tampilan Password</label>
              ${sw('set_showPassword', s.showPassword === 'Ya', 'Tampilkan password langsung di tabel', 'Default OFF (disamarkan). Jika ON, password terlihat apa adanya di menu Data Password dan ikut terekspor.')}</div>
          </div>
          ${APP.defaultLoginActive ? `<div class="info-box info-gray"><b>Login bawaan database baru</b><br>Username: <code class="kbd">admin</code> &nbsp; Password: <code class="kbd">admin123</code><br><span class="note-line">Segera ganti password lewat tombol "Ganti Password Login Saya" di bawah.</span></div>` : ''}
          <div class="info-box info-blue">Password akun tersimpan <b>terenkripsi</b> pada sheet <b>PP_DataPassword</b>. Setelah masuk aplikasi, password ditampilkan sesuai pengaturan di atas.</div>
          <div class="mt-3 d-flex flex-wrap gap-2">
            <button id="btnSaveSet" type="submit" class="btn btn-primary"><i class="bi bi-save"></i> Simpan Pengaturan</button>
            <button type="button" class="btn btn-outline-secondary" onclick="openChangePw(false)"><i class="bi bi-shield-lock"></i> Ganti Password Login Saya</button>
          </div>
        </form>
      </div>`;
  } catch (e) { showViewError(el, e); }
}

async function saveSettings(ev) {
  ev.preventDefault();
  const wasLogin = APP.settings.requireLogin === 'Ya';
  const wantLogin = $('set_requireLogin').checked;
  if (wasLogin && !wantLogin) {
    const ok = await confirmDialog({ title: 'Matikan Wajib Login?', ok: 'Ya, Matikan',
      message: 'Jika dimatikan, <b>siapa pun yang memiliki link aplikasi dapat melihat semua password Anda</b> tanpa login. Lanjutkan?' });
    if (!ok) { $('set_requireLogin').checked = true; return; }
  }
  await withBusyBtn($('btnSaveSet'), async () => {
    try {
      const s = await api('set.save', {
        appName: $('set_appName').value, ownerLabel: $('set_ownerLabel').value, rowsPerPage: $('set_rows').value,
        requireLogin: wantLogin ? 'Ya' : 'Tidak', logEnabled: $('set_logEnabled').checked ? 'Ya' : 'Tidak',
        showPassword: $('set_showPassword').checked ? 'Ya' : 'Tidak'
      });
      APP.settings = s;
      setBrand(s.appName, s.ownerLabel);
      $('btnLogout').classList.toggle('d-none', s.requireLogin !== 'Ya');
      Object.keys(TABLE_STATE).forEach(k => delete TABLE_STATE[k]);
      toast('Pengaturan berhasil disimpan.');
      if (s.requireLogin === 'Ya' && !APP.token) { showLogin(); }
    } catch (e) { toast(e.message, 'error'); }
  });
}

function openChangePw(forced) {
  $('cpForm').reset();
  $('cpForced').classList.toggle('d-none', !forced);
  $('cpClose').classList.toggle('d-none', !!forced);
  $('cpCancel').classList.toggle('d-none', !!forced);
  bootstrap.Modal.getOrCreateInstance($('modalChangePw')).show();
}

async function submitChangePw(ev) {
  ev.preventDefault();
  if (!$('cpForm').checkValidity()) { $('cpForm').reportValidity(); return; }
  if ($('cpNew').value !== $('cpNew2').value) { toast('Konfirmasi password baru tidak sama.', 'error'); return; }
  await withBusyBtn($('btnSaveCp'), async () => {
    try {
      const r = await api('auth.changePassword', { oldPassword: $('cpOld').value, newPassword: $('cpNew').value });
      if (r && r.token) { APP.token = r.token; store.set('pp_token', r.token); }
      APP.defaultLoginActive = false;
      bootstrap.Modal.getInstance($('modalChangePw')).hide();
      toast('Password login berhasil diganti.');
      if (APP.section === 'pengaturan') loadSettings();
    } catch (e) { toast(e.message, 'error'); }
  });
}

// ════════════════════════════════════════════════════════
// BAGIAN 12: PEMETAAN HALAMAN
// ════════════════════════════════════════════════════════

const LOADERS = {
  dashboard: loadDashboard,
  password: loadPwd,
  kategori: loadKat,
  user: loadUser,
  log: loadLog,
  pengaturan: loadSettings
};

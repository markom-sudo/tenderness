(function () {
'use strict';

const KEL = ['menang', 'kalah', 'berjalan', 'gugur'];
const LBL = { menang: 'Menang', kalah: 'Kalah', berjalan: 'Berjalan', gugur: 'Gugur (tidak bersaing)' };
const KMAP = { Menang: 'menang', Kalah: 'kalah', Berjalan: 'berjalan', Gugur: 'gugur' };
const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MIN_HASIL = 5;            // di bawah ini win rate ditandai "sampel kecil"
const $ = s => document.querySelector(s);
const nf = new Intl.NumberFormat('id-ID');
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dec = (x, d = 1) => x.toFixed(d).replace('.', ',');
const pct = (x, d = 1) => x == null ? '–' : dec(x, d) + '%';
const rp = n => {
  if (n == null || !isFinite(n)) return '–';
  const a = Math.abs(n);
  if (a >= 1e12) return 'Rp ' + dec(n / 1e12) + ' T';
  if (a >= 1e9) return 'Rp ' + dec(n / 1e9) + ' M';
  if (a >= 1e6) return 'Rp ' + dec(n / 1e6, 0) + ' jt';
  return 'Rp ' + nf.format(Math.round(n));
};
const parseD = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtD = d => d ? d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear() : '–';

let ALL = [], SUM = null;
const S = { tab: 'ringkasan', F: { prov: '', produk: '', tahun: '' }, sort: {}, expand: {}, q: '' };

// ---------- data ----------
const skeleton = () => '<div class="kpis">' + '<div class="kpi"><div class="shim w40"></div><div class="shim w70 h24"></div><div class="shim w50"></div></div>'.repeat(4) + '</div><div class="panel"><div class="shim w40"></div><div class="shim block"></div></div>';
async function load() {
  $('#view').innerHTML = skeleton(); $('#topLoader').classList.add('on');
  try {
    const r = await fetch('data/tender.json', { cache: 'no-cache' });
    if (!r.ok) throw new Error('tender.json ' + r.status);
    ALL = (await r.json()).filter(o => o.versi_terakhir !== false);
    ALL.forEach(o => { o._k = KMAP[o.kelompok] || 'gugur'; });
    try { const s = await fetch('data/summary.json', { cache: 'no-cache' }); if (s.ok) SUM = await s.json(); } catch (e) { /* opsional */ }
  } catch (e) {
    $('#view').innerHTML = '<p>Data tidak bisa dimuat (' + esc(e.message) + '). Pastikan file <code>data/tender.json</code> ada di repo dan halaman dibuka lewat GitHub Pages atau server lokal, bukan langsung dari file.</p>';
    return false;
  } finally { $('#topLoader').classList.remove('on'); }
  return true;
}

function filtered() {
  const { prov, produk, tahun } = S.F;
  return ALL.filter(o => (!prov || o.provinsi === prov) && (!produk || o.produk === produk) &&
    (!tahun || (o.tgl_buka && o.tgl_buka.slice(0, 4) === tahun)));
}

function group(rows, key) {
  const m = new Map();
  rows.forEach(o => {
    const k = o[key]; if (k == null) return;
    if (!m.has(k)) m.set(k, { k, menang: 0, kalah: 0, berjalan: 0, gugur: 0, total: 0 });
    const g = m.get(k); g[o._k]++; g.total++;
  });
  return [...m.values()].map(g => { g.hasil = g.menang + g.kalah; g.wr = g.hasil ? 100 * g.menang / g.hasil : null; return g; });
}
const tally = rows => { const c = { menang: 0, kalah: 0, berjalan: 0, gugur: 0, total: rows.length }; rows.forEach(o => c[o._k]++); c.hasil = c.menang + c.kalah; c.wr = c.hasil ? 100 * c.menang / c.hasil : null; return c; };
const sumBy = (rows, f) => rows.reduce((a, o) => a + (f(o) || 0), 0);

// ---------- komponen ----------
function legend() {
  return '<ul class="legend">' + KEL.map(k => '<li><span class="sw ' + k + '"></span>' + LBL[k] + '</li>').join('') + '</ul>';
}
function sbar(c, scale, label) {
  const w = scale ? (c.total / scale * 100) : 100;
  const segs = KEL.filter(k => c[k] > 0).map(k =>
    '<span class="s-' + k + '" style="flex:' + c[k] + ' 1 0" data-tip="' + esc(label + '\n' + LBL[k] + ': ' + c[k]) + '"></span>').join('');
  const aria = KEL.map(k => LBL[k] + ' ' + c[k]).join(', ');
  return '<div class="sbar" role="img" aria-label="' + esc(label + ': ' + aria) + '" style="width:' + w.toFixed(2) + '%">' + segs + '</div>';
}
function wrCell(c) {
  if (!c.hasil) return '<div class="wr low">–</div>';
  const low = c.hasil < MIN_HASIL;
  return '<div class="wr' + (low ? ' low' : '') + '"' + (low ? ' title="Sampel kecil: baru ' + c.hasil + ' tender yang ada hasilnya"' : '') + '>' +
    pct(c.wr, 0) + ' <small>' + c.menang + '/' + c.hasil + '</small></div>';
}
function barTable(id, title, sub, list, limit) {
  const sort = S.sort[id] || 'total', expand = !!S.expand[id];
  const sorted = list.slice().sort(sort === 'wr'
    ? (a, b) => ((b.hasil >= 3) - (a.hasil >= 3)) || ((b.wr ?? -1) - (a.wr ?? -1)) || b.hasil - a.hasil
    : (a, b) => b.total - a.total || b.menang - a.menang);
  const shown = expand ? sorted : sorted.slice(0, limit);
  const scale = Math.max(1, ...shown.map(c => c.total));
  let h = '<h2>' + title + '</h2><p class="sub">' + sub + '</p>';
  h += '<div class="ctl">Urutkan: <span class="seg" role="group" aria-label="Urutan">' +
    '<button type="button" data-act="sort" data-id="' + id + '" data-v="total" aria-pressed="' + (sort === 'total') + '">Jumlah tender</button>' +
    '<button type="button" data-act="sort" data-id="' + id + '" data-v="wr" aria-pressed="' + (sort === 'wr') + '">Win rate</button></span></div>';
  h += '<div class="rows"><div class="h">&nbsp;</div><div class="h">Hasil tiap tender</div><div class="h num tot">Total</div><div class="h num">Win rate</div>';
  shown.forEach(c => {
    h += '<div class="nm" title="' + esc(c.k) + '">' + esc(c.k) + '</div>' + sbar(c, scale, c.k) +
      '<div class="num tot">' + c.total + '</div>' + wrCell(c);
  });
  h += '</div>';
  if (sorted.length > limit) h += '<button type="button" class="link more" data-act="expand" data-id="' + id + '">' +
    (expand ? 'Tampilkan lebih sedikit' : 'Tampilkan semua (' + sorted.length + ')') + '</button>';
  return h;
}

// ---------- tampilan ----------
function viewRingkasan(rows) {
  const c = tally(rows);
  const nilaiMenang = sumBy(rows.filter(o => o._k === 'menang'), o => o.total_sph_inc);
  const pipeline = sumBy(rows.filter(o => o._k === 'berjalan'), o => o.total_sph_inc);
  if (!rows.length) return '<p class="muted" style="padding:30px 0">Tidak ada tender dengan filter ini.</p>';
  const lead = c.hasil
    ? 'Dari <b>' + c.hasil + '</b> tender yang sudah ada hasilnya, kita menang <b>' + c.menang + '</b> (' + pct(c.wr) + '). <b>' + c.gugur + '</b> tender gugur sebelum sempat bersaing.'
    : 'Belum ada tender yang selesai dengan filter ini. <b>' + c.berjalan + '</b> masih berjalan.';
  let h = '<p class="lead">' + lead + '</p><div class="kpis">' +
    kpi('Win rate', pct(c.wr), c.menang + ' menang dari ' + c.hasil + ' yang ada hasilnya') +
    kpi('Tender berjalan', String(c.berjalan), 'Nilai penawaran ' + rp(pipeline)) +
    kpi('Nilai tender menang', rp(nilaiMenang), c.menang + ' tender') +
    kpi('Gugur sebelum bersaing', pct(c.total ? 100 * c.gugur / c.total : null), c.gugur + ' dari ' + c.total + ': batal, terlewat, tidak submit') +
    '</div>';

  // corong
  const tahap = {}; rows.forEach(o => { (tahap[o._k] = tahap[o._k] || {})[o.tahap] = (tahap[o._k][o.tahap] || 0) + 1; });
  h += '<section class="panel"><h2>Ke mana tender kita berakhir</h2><p class="sub">Setiap tender dihitung satu kali, memakai versi terakhirnya. Win rate hanya menghitung yang menang dan kalah.</p>' + legend() +
    '<div class="funnel">' + sbar(c, c.total, 'Semua tender') + '</div><div class="stages">' +
    KEL.map(k => '<span><b>' + LBL[k] + ' ' + c[k] + '</b>' + (tahap[k] ? ': ' + Object.entries(tahap[k]).sort((a, b) => b[1] - a[1]).map(([t, n]) => esc(t.toLowerCase()) + ' ' + n).join(', ') : '') + '</span>').join('') +
    '</div></section>';

  // tren bulanan
  const bm = {}; let tanpa = 0;
  rows.forEach(o => { if (!o.tgl_buka) { tanpa++; return; } const m = o.tgl_buka.slice(0, 7); (bm[m] = bm[m] || { menang: 0, kalah: 0, berjalan: 0, gugur: 0, total: 0 }); bm[m][o._k]++; bm[m].total++; });
  const ms = Object.keys(bm).sort();
  if (ms.length) {
    const months = []; let [y, m] = ms[0].split('-').map(Number); const [ey, em] = ms[ms.length - 1].split('-').map(Number);
    while (y < ey || (y === ey && m <= em)) { months.push(y + '-' + String(m).padStart(2, '0')); m++; if (m > 12) { m = 1; y++; } }
    const mx = Math.max(...ms.map(k => bm[k].total));
    h += '<section class="panel"><h2>Tender masuk per bulan</h2><p class="sub">Berdasarkan tanggal penawaran dibuka. Warna menunjukkan hasil akhirnya.' + (tanpa ? ' ' + tanpa + ' tender tanpa tanggal tidak ditampilkan.' : '') + '</p>' + legend() + '<div class="trend">';
    months.forEach(k => {
      const b = bm[k] || { menang: 0, kalah: 0, berjalan: 0, gugur: 0, total: 0 }; const lab = BLN[+k.slice(5) - 1] + ' ' + k.slice(2, 4);
      h += '<div class="tcol" style="height:' + (b.total / mx * 100).toFixed(1) + '%;align-self:flex-end">' +
        KEL.filter(x => b[x] > 0).reverse().map(x => '<span class="s-' + x + '" style="flex:' + b[x] + ' 1 0" data-tip="' + esc(lab + '\n' + LBL[x] + ': ' + b[x]) + '"></span>').join('') + '</div>';
    });
    h += '</div><div class="tlabels">' + months.map(k => '<div>' + BLN[+k.slice(5) - 1] + ' ' + k.slice(2, 4) + '</div>').join('') + '</div></section>';
  }
  return h;
}
const kpi = (l, v, n) => '<div class="kpi"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="n">' + n + '</div></div>';

function temuan(rows) {
  const g = group(rows, 'produk'), out = [];
  const cold = g.filter(x => x.hasil >= MIN_HASIL && x.menang === 0).sort((a, b) => b.hasil - a.hasil);
  if (cold.length) out.push('<li class="hot">Belum pernah menang meski sering ikut: ' + cold.slice(0, 4).map(x => '<b>' + esc(x.k) + '</b> (0 dari ' + x.hasil + ')').join(', ') + '. Cek harga dan spesifikasi yang kita tawarkan.</li>');
  const hot = g.filter(x => x.hasil >= 3 && x.menang > 0).sort((a, b) => b.wr - a.wr || b.hasil - a.hasil).slice(0, 3);
  if (hot.length) out.push('<li class="good">Win rate tertinggi: ' + hot.map(x => '<b>' + esc(x.k) + '</b> ' + pct(x.wr, 0) + ' (' + x.menang + '/' + x.hasil + ')').join(', ') + '. Sampelnya masih kecil, jadi perlakukan sebagai petunjuk.</li>');
  const lost = g.map(x => ({ x, t: rows.filter(o => o.produk === x.k && o.tahap === 'TERLEWAT').length })).filter(a => a.t >= 3).sort((a, b) => b.t - a.t).slice(0, 3);
  if (lost.length) out.push('<li class="hot">Paling sering terlewat: ' + lost.map(a => '<b>' + esc(a.x.k) + '</b> (' + a.t + ' dari ' + a.x.total + ')').join(', ') + '. Ini peluang yang hilang tanpa sempat bersaing.</li>');
  return out.length ? '<section class="panel"><h2>Temuan dari data</h2><p class="sub">Dihitung otomatis dari tender yang tampil sesuai filter.</p><ul class="finds">' + out.join('') + '</ul></section>' : '';
}

function gapPlot(rows) {
  const pts = rows.filter(o => (o._k === 'menang' || o._k === 'kalah') && o.gap_sph_vs_pagu_pct != null);
  const hasil = rows.filter(o => o._k === 'menang' || o._k === 'kalah').length;
  let h = '<section class="panel gap"><h2>Harga kita dibanding pagu</h2><p class="sub">Tiap titik adalah satu tender. Makin ke kiri, makin jauh harga penawaran di bawah pagu. Garis tebal menandai nilai tengah. Hanya tender yang punya harga SPH dan pagu (' + pts.length + ' dari ' + hasil + ').</p>';
  if (pts.length < 3) return h + '<p class="muted">Data belum cukup untuk digambar.</p></section>';
  const vals = pts.map(o => o.gap_sph_vs_pagu_pct);
  const rawLo = Math.min(...vals), rawHi = Math.max(...vals), step = (rawHi - rawLo) > 120 ? 20 : 10;
  const lo = Math.min(-step, Math.floor(rawLo / step) * step), hi = Math.max(step, Math.ceil(rawHi / step) * step);
  const W = 1100, L = 110, R = 24, X = v => L + (v - lo) / (hi - lo) * (W - L - R);
  const lanes = [['menang', 72], ['kalah', 158]];
  let s = '<svg viewBox="0 0 ' + W + ' 214" role="img" aria-label="Sebaran selisih harga penawaran terhadap pagu, menang dibanding kalah">';
  for (let t = lo; t <= hi; t += step) s += '<line class="ax" x1="' + X(t) + '" x2="' + X(t) + '" y1="22" y2="190"/><text x="' + X(t) + '" y="210" text-anchor="middle">' + (t === 0 ? 'pagu' : (t > 0 ? '+' : '−') + Math.abs(t) + '%') + '</text>';
  lanes.forEach(([k, y]) => {
    const p = pts.filter(o => o._k === k), v = p.map(o => o.gap_sph_vs_pagu_pct).sort((a, b) => a - b);
    s += '<text x="0" y="' + (y + 4) + '">' + LBL[k] + ' (' + p.length + ')</text>';
    p.forEach((o, i) => { const jy = ((i * 37) % 11 - 5) * 2.4; s += '<circle cx="' + X(o.gap_sph_vs_pagu_pct).toFixed(1) + '" cy="' + (y + jy).toFixed(1) + '" r="5" fill="var(--' + k + ')" fill-opacity=".85" stroke="var(--ring)" stroke-width="2" data-tip="' + esc((o.produk || '') + '\n' + (o.instansi || '') + '\nHarga ' + dec(o.gap_sph_vs_pagu_pct) + '% dari pagu') + '"/>'; });
    if (v.length) { const md = v.length % 2 ? v[v.length >> 1] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2; s += '<line class="med" x1="' + X(md) + '" x2="' + X(md) + '" y1="' + (y - 34) + '" y2="' + (y + 34) + '"/><text x="' + X(md) + '" y="' + (y - 40) + '" text-anchor="middle">nilai tengah ' + dec(md).replace('-', '−') + '%</text>'; }
  });
  return h + s + '</svg></section>';
}

function viewAnalisis(rows) {
  if (!rows.length) return '<p class="muted" style="padding:30px 0">Tidak ada tender dengan filter ini.</p>';
  return temuan(rows) +
    '<section class="panel">' + legend() + barTable('produk', 'Per produk', 'Panjang batang menunjukkan jumlah tender, warnanya hasil akhirnya. Win rate di bawah ' + MIN_HASIL + ' hasil ditandai abu-abu karena belum cukup bukti.', group(rows, 'produk'), 12) + '</section>' +
    '<div class="grid"><section class="panel">' + barTable('prov', 'Per provinsi', 'Wilayah pengiriman tender.', group(rows, 'provinsi'), 8) + '</section><section class="panel">' +
    barTable('inst', 'Per instansi', 'Siapa yang membuka tender.', group(rows, 'instansi'), 8) + '</section></div>' + gapPlot(rows);
}

function viewTindak(rows) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const aktif = o => { const d = parseD(o.tgl_selesai); return o.tahap === 'OPEN' || (o.tahap !== 'DIEVALUASI' && d && d >= today); };   // masih butuh tindakan; sisanya tinggal menunggu hasil
  const list = rows.filter(o => o._k === 'berjalan').sort((a, b) => (aktif(b) - aktif(a)) ||
    (aktif(a) ? ((a.tgl_selesai || '9999') < (b.tgl_selesai || '9999') ? -1 : 1) : ((b.tgl_selesai || '') < (a.tgl_selesai || '') ? -1 : 1)));
  let h = '<section class="panel"><h2>Tender yang masih berjalan</h2><p class="sub">Tender yang masih perlu tindakan (open, atau batas penawaran belum lewat) ada di atas, diurutkan dari batas terdekat. Sisanya sudah lewat batas dan tinggal menunggu hasil.</p><div class="tools"><input type="search" id="q" placeholder="Cari produk, instansi, provinsi, ID" aria-label="Cari tender" value="' + esc(S.q) + '"><span class="muted" id="qn"></span></div>' +
    '<div class="tw"><table><thead><tr><th>Tahap</th><th>Produk</th><th>Instansi</th><th>Provinsi</th><th class="r">Qty</th><th class="r">Nilai penawaran</th><th>Batas penawaran</th><th>Sisa waktu</th><th>ID</th></tr></thead><tbody id="tb"></tbody></table></div></section>';
  setTimeout(() => {
    const draw = () => {
      const q = S.q.trim().toLowerCase();
      const r = list.filter(o => !q || [o.produk, o.instansi, o.provinsi, o.no_kompetisi, o.judul_kompetisi].join(' ').toLowerCase().includes(q));
      $('#qn').textContent = r.length + ' dari ' + list.length + ' tender';
      $('#tb').innerHTML = r.length ? r.map(o => {
        const d = parseD(o.tgl_selesai); let due = '–', cls = '';
        if (!aktif(o)) due = 'menunggu hasil'; else if (d) { const n = Math.round((d - today) / 864e5); if (n < 0) { due = 'lewat ' + (-n) + ' hari'; cls = 'due-late'; } else if (n === 0) { due = 'hari ini'; cls = 'due-soon'; } else { due = n + ' hari'; if (n <= 3) cls = 'due-soon'; } }
        return '<tr><td><span class="st"><span class="sw berjalan"></span>' + esc((o.tahap || '').charAt(0) + (o.tahap || '').slice(1).toLowerCase()) + '</span></td><td>' + esc(o.produk) + '</td><td>' + esc(o.instansi || '–') + '</td><td>' + esc(o.provinsi || '–') + '</td><td class="r">' + (o.qty != null ? nf.format(o.qty) : '–') + '</td><td class="r">' + rp(o.total_sph_inc) + '</td><td>' + fmtD(d) + '</td><td class="' + cls + '">' + due + '</td><td class="id" title="' + esc(o.no_kompetisi || '') + '">' + esc((o.no_kompetisi || '').slice(-8)) + '</td></tr>';
      }).join('') : '<tr><td colspan="9" class="muted">Tidak ada tender yang cocok.</td></tr>';
    };
    draw(); const qi = $('#q'); if (qi) qi.addEventListener('input', e => { S.q = e.target.value; draw(); });
  }, 0);
  return h;
}

// ---------- render ----------
let animT = null;
function render(anim) {
  const rows = filtered();
  $('#f-count').textContent = rows.length + ' tender (versi terakhir)';
  $('#view').innerHTML = S.tab === 'analisis' ? viewAnalisis(rows) : S.tab === 'tindak' ? viewTindak(rows) : viewRingkasan(rows);
  document.querySelectorAll('.tabs button').forEach(b => { const on = b.dataset.tab === S.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
  $('#view').setAttribute('aria-labelledby', 'tab-' + S.tab);
  if (anim) { const v = $('#view'); v.classList.add('anim'); clearTimeout(animT); animT = setTimeout(() => v.classList.remove('anim'), 2400); }
}

function fillFilters() {
  const opt = (sel, vals, all) => { $(sel).innerHTML = '<option value="">' + all + '</option>' + vals.map(v => '<option>' + esc(v) + '</option>').join(''); };
  const cnt = k => { const m = {}; ALL.forEach(o => { if (o[k]) m[o[k]] = (m[o[k]] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).map(e => e[0]); };
  opt('#f-prov', cnt('provinsi').sort(), 'Semua provinsi');
  opt('#f-produk', cnt('produk'), 'Semua produk');
  opt('#f-tahun', [...new Set(ALL.map(o => o.tgl_buka && o.tgl_buka.slice(0, 4)).filter(Boolean))].sort(), 'Semua tahun');
}

function init() {
  fillFilters();
  const t = (location.hash || '').slice(1); if (['ringkasan', 'analisis', 'tindak'].includes(t)) S.tab = t;
  const dibuat = SUM && SUM.dibuat;
  $('#stamp').textContent = 'Menang berarti tahap SELESAI.' + (dibuat ? ' Data per ' + dibuat + '.' : '');
  $('#foot').textContent = 'Menang = tahap SELESAI. Win rate = menang ÷ (menang + kalah); tender berjalan dan yang gugur sebelum bersaing tidak dihitung. Tender yang diulang dihitung dari versi terakhirnya.';
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { S.tab = b.dataset.tab; history.replaceState(null, '', '#' + S.tab); render(true); }));
  const bind = (id, key) => $(id).addEventListener('change', e => { S.F[key] = e.target.value; render(); });
  bind('#f-prov', 'prov'); bind('#f-produk', 'produk'); bind('#f-tahun', 'tahun');
  $('#f-reset').addEventListener('click', () => { S.F = { prov: '', produk: '', tahun: '' }; ['#f-prov', '#f-produk', '#f-tahun'].forEach(i => $(i).value = ''); render(); });
  $('#view').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'sort') S.sort[b.dataset.id] = b.dataset.v;
    if (b.dataset.act === 'expand') S.expand[b.dataset.id] = !S.expand[b.dataset.id];
    render();
  });
  // tema: lingkaran meluas dari tombol (View Transitions)
  $('#btnTema').addEventListener('click', e => {
    const rc = e.currentTarget.getBoundingClientRect(), x = rc.left + rc.width / 2, y = rc.top + rc.height / 2;
    const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('elitech_theme', t); } catch (er) {}
    const apply = () => window.__setTheme(t);
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return; }
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(apply).ready.then(() => document.documentElement.animate(
      { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
      { duration: 1000, easing: 'ease-in-out', pseudoElement: '::view-transition-new(root)' }));
  });
  // tooltip
  const tip = $('#tip');
  document.addEventListener('pointermove', e => {
    const el = e.target.closest && e.target.closest('[data-tip]');
    if (!el) { tip.hidden = true; return; }
    tip.textContent = el.dataset.tip; tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.min(e.clientX + 14, innerWidth - r.width - 8) + 'px';
    tip.style.top = (e.clientY + 18 + r.height > innerHeight ? e.clientY - r.height - 10 : e.clientY + 18) + 'px';
  });
  document.addEventListener('scroll', () => { tip.hidden = true; }, true);
  render(true);
}

load().then(ok => { if (ok) init(); });
})();

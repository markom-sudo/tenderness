# Pantauan Tender (front end)

Situs statis, tanpa build. Tema disamakan dengan Laporan Penjualan Elitech.

    index.html   halaman
    style.css    tema (warna, tab pill, animasi, mode gelap)
    app.js       logika: filter, perhitungan, grafik
    data/tender.json   dibuat oleh Apps Script (semua versi)
    data/summary.json  dibuat oleh Apps Script (waktu data, kualitas data)

## Pasang di GitHub Pages
1. Taruh semua file di repo, folder `data/` berisi dua JSON dari Apps Script.
2. Settings > Pages > Deploy from a branch > main, folder / (root).
3. Buka https://AKUN.github.io/NAMAREPO/

Jangan buka index.html langsung dari folder (browser memblokir fetch file lokal).
Uji lokal: `python3 -m http.server` lalu buka http://localhost:8000

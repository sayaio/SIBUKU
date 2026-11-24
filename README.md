# SIBUKU — Sistem Peminjaman Buku Perpustakaan Kampus

SIBUKU membantu petugas perpustakaan mengelola katalog, anggota, peminjaman, pengembalian, jatuh tempo, stok, dan ringkasan operasional. Aplikasi mempertahankan antarmuka Bootstrap yang ada dan kini menggunakan frontend HTML/CSS/Vanilla JavaScript serta REST API Flask.

## Masalah dan tujuan

Pencatatan koleksi dan transaksi secara terpisah mudah menimbulkan informasi stok yang tidak akurat, keterlambatan yang sulit dipantau, dan proses layanan yang lambat. SIBUKU menyatukan data buku, anggota, dan transaksi pada satu aplikasi agar petugas dapat melihat stok dan status pinjaman terkini. Backend memvalidasi setiap perubahan, menghubungkan transaksi dengan anggota dan buku, serta menyimpan data secara persisten di file JSON tanpa database.

## Arsitektur dan teknologi

- Frontend: HTML5, CSS3, Bootstrap 5, Bootstrap Icons, Vanilla JavaScript, Fetch API.
- Backend: Python 3, Flask, Flask-CORS; REST API.
- Persistence: `backend/data/books.json`, `members.json`, dan `borrowings.json`. File dibuat dari seed saat startup/akses pertama. Penulisan menggunakan file sementara, `fsync`, penggantian atomik, dan pemulihan jika penggantian kumpulan file gagal.
- Transaksi pinjam/kembali mengubah data buku dan peminjaman di bawah lock proses dan menulis seluruh file secara terkoordinasi.

## Struktur

```text
frontend/               halaman, CSS, dan JavaScript browser
  index.html            dashboard
  books.html             manajemen buku
  members.html           manajemen anggota
  borrowings.html        transaksi dan pengembalian
  js/api.js              Fetch API terpusat
backend/
  app.py                 Flask routes, aturan bisnis, dan JSON persistence
  requirements.txt
  data/                  file JSON runtime
run.py                   entry point lokal
```

## Entitas

- **Books**: ID, judul, penulis, penerbit, kategori, ISBN, tahun, total stok, stok tersedia.
- **Members**: ID, nama, nomor mahasiswa, email, telepon, program studi, status (`active`/`inactive`). Data seed adalah fiktif.
- **Borrowings**: ID, `book_id`, `member_id`, tanggal pinjam, jatuh tempo, tanggal kembali, status (`borrowed`/`returned`; API juga menghitung `overdue`).

## Fitur

| Fitur | Deskripsi | Entitas |
|---|---|---|
| Kelola buku | Lihat, tambah, ubah, hapus, cari; stok tersedia ditampilkan | Books |
| Kelola anggota | Lihat, tambah, ubah, hapus, validasi nomor mahasiswa | Members |
| Peminjaman | Validasi anggota aktif, stok buku, batas pinjaman dan duplikasi; stok berkurang | Members, Books, Borrowings |
| Pengembalian dan perpanjangan | Menyelesaikan pinjaman, mengembalikan stok, atau memperpanjang jatuh tempo | Borrowings, Books |
| Dashboard | Statistik, transaksi terbaru, dan peringatan stok tipis | Books, Members, Borrowings |
| Reset data | Mengembalikan semua file ke seed awal setelah konfirmasi | Semua |

## Aturan bisnis

Stok tidak boleh negatif; transaksi butuh anggota dan buku yang ada; hanya anggota aktif dapat meminjam; maksimal tiga pinjaman aktif per anggota; satu judul tidak boleh dipinjam ulang selama masih aktif; stok berkurang saat peminjaman dan bertambah tepat sekali saat kembali; pinjaman aktif buku/anggota melindungi entitas dari penghapusan; menghapus transaksi aktif mengembalikan stok; pinjaman yang melewati jatuh tempo ditandai otomatis; tanggal harus valid.

## REST API

Semua respons data menggunakan JSON; kesalahan berbentuk `{"error":"..."}`.

| Method | Endpoint | Kegunaan |
|---|---|---|
| GET/POST | `/api/books` | Daftar / tambah buku |
| GET/PUT/DELETE | `/api/books/<id>` | Baca / ubah / hapus buku |
| GET/POST | `/api/members` | Daftar / tambah anggota |
| GET/PUT/DELETE | `/api/members/<id>` | Baca / ubah / hapus anggota |
| GET/POST | `/api/borrowings` | Daftar / buat peminjaman |
| GET/PUT/DELETE | `/api/borrowings/<id>` | Baca / ubah jatuh tempo / hapus transaksi |
| POST | `/api/borrowings/<id>/return` | Kembalikan buku |
| POST | `/api/borrowings/<id>/extend` | Perpanjang tanggal jatuh tempo |
| GET | `/api/dashboard` | Statistik agregat dan daftar ringkas |
| POST | `/api/reset` | Pulihkan data seed |

Untuk anggota, gunakan `name`, `student_id`, `email`, `phone`, `major`, `status`. Status: `active` atau `inactive`. Buku menggunakan `total_stock`; `available_stock` dihitung backend. Peminjaman menerima `book_id`, `member_id`, dan `due_date` (tanggal pinjam opsional). HTTP status yang digunakan antara lain 201 untuk pembuatan, 204 untuk hapus, 400 untuk input/aturan bisnis yang tidak valid, 404 untuk ID yang tidak ditemukan, 409 untuk konflik relasi, dan 500 untuk masalah penyimpanan.

## Menjalankan lokal

Memerlukan Python 3.10+.

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r backend\requirements.txt
py run.py
```

Buka [http://localhost:5000](http://localhost:5000). Flask menyajikan frontend dan API dari origin yang sama.

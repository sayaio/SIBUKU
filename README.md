# 📚 SIBUKU – Sistem Peminjaman Buku Perpustakaan Kampus

**SIBUKU** adalah aplikasi web modern, ringan, dan responsif untuk mengelola inventaris buku, data anggota (mahasiswa), serta proses peminjaman dan pengembalian buku di perpustakaan kampus secara otomatis dan real-time.

Aplikasi ini dibangun menggunakan arsitektur *Client-side Only* (Frontend) tanpa ketergantungan server/database rumit, memanfaatkan hardcoded initial data dan sinkronisasi `localStorage` browser sehingga data tetap tersimpan saat halaman dimuat ulang.

---

## 🌟 Fitur Utama

### 1. 📊 Dashboard Ringkasan & Monitoring
* **Statistik Cepat**: Menampilkan total buku, total anggota terdaftar, jumlah peminjaman aktif, peminjaman yang terlambat, serta anggota aktif.
* **Peminjaman Terbaru**: Menampilkan riwayat transaksi peminjaman buku paling baru beserta statusnya.
* **Peringatan Stok Menipis**: Memberikan daftar buku yang stoknya hampir habis (≤ 1) atau kosong (0) secara otomatis.

### 2. 📖 Manajemen Buku (CRUD)
* **Lihat Katalog & Stok**: Informasi detail ID buku, judul, penulis, kategori, tahun terbit, dan stok tersedia/total stok.
* **Pencarian Real-Time**: Fitur filter/pencarian instan berdasarkan judul buku, nama penulis, atau kategori buku.
* **Tambah & Edit Buku**: Form modal dengan validasi input (tahun valid, stok tidak boleh negatif).
* **Hapus Buku**: Dilengkapi proteksi keamanan agar buku yang sedang dipinjam aktif tidak dapat terhapus secara tidak sengaja.

### 3. 👥 Manajemen Anggota (CRUD)
* **Daftar Mahasiswa**: Menyimpan ID anggota, nama lengkap, NIM, program studi, dan status keanggotaan (Aktif/Nonaktif).
* **Indikator Pinjaman**: Menampilkan badge jumlah buku yang sedang dipinjam oleh tiap anggota.
* **Tambah & Edit Anggota**: Validasi NIM angka, pengecekan NIM unik (mencegah duplikasi), dan proteksi perubahan status jika masih memiliki pinjaman.
* **Hapus Anggota**: Proteksi penghapusan anggota yang masih memiliki buku pinjaman aktif.

### 4. 🔄 Transaksi Peminjaman & Pengembalian Buku
* **Pencatatan Peminjaman**: Form peminjaman dengan tanggal pinjam otomatis (hari ini) dan tanggal jatuh tempo default (+7 hari).
* **Otomatisasi Stok**: Stok buku langsung berkurang 1 saat dipinjam dan bertambah 1 saat dikembalikan.
* **Pengembalian Buku**: Aksi satu klik untuk menyelesaikan peminjaman dan mencatat tanggal pengembalian secara otomatis.
* **Filter Status**: Memfilter daftar transaksi berdasarkan status: *Semua*, *Dipinjam*, *Dikembalikan*, atau *Terlambat*.
* **Status Terlambat Otomatis**: Menandai buku yang belum dikembalikan melewati tanggal jatuh tempo dengan badge merah.
* **Edit Tanggal Jatuh Tempo**: Kemudahan perpanjangan tanggal jatuh tempo peminjaman jika diperlukan.

### 5. ⚙️ Manajemen Data & Reset
* **Penyimpanan Lokal (`localStorage`)**: Perubahan data tersimpan persisten di browser pengguna.
* **Tombol Reset Data**: Tombol di navbar untuk mengembalikan seluruh data ke kondisi awal (*seed data*) kapan saja jika ingin melakukan demonstrasi ulang.

---

## ⚖️ Aturan Bisnis Perpustakaan

Aplikasi menerapkan 11 aturan bisnis sesuai spesifikasi standar perpustakaan:
1. **Peminjaman:** Stok buku berkurang 1 dan tercatat dengan status `Dipinjam`.
2. **Pengembalian:** Stok buku bertambah 1, status berubah menjadi `Dikembalikan`, dan tanggal pengembalian terisi.
3. **Stok Habis:** Buku dengan stok 0 tidak dapat dipinjam.
4. **Status Anggota:** Hanya anggota berstatus `Aktif` yang diperbolehkan meminjam buku.
5. **Durasi Peminjaman:** Default durasi peminjaman adalah 7 hari.
6. **Batas Maksimal:** Satu anggota maksimal hanya boleh meminjam 3 buku sekaligus.
7. **Peminjaman Duplikat:** Anggota tidak boleh meminjam buku yang sama lebih dari satu kali jika belum mengembalikannya.
8. **Integritas Relasi:** Buku atau anggota tidak bisa dihapus jika masih terkait peminjaman aktif.
9. **Penghapusan Transaksi Aktif:** Menghapus data transaksi yang berstatus `Dipinjam` akan mengembalikan stok buku (+1).
10. **Deteksi Keterlambatan:** Peminjaman aktif yang melampaui tanggal jatuh tempo otomatis diberi label `Terlambat`.
11. **Validasi Formulir:** Semua kolom formulir wajib diisi, NIM wajib unik dan numerik, serta stok tidak boleh bernilai negatif.

---

## 🛠️ Teknologi yang Digunakan

* **HTML5**: Struktur semantik halaman web.
* **CSS3 & Bootstrap 5 (CDN)**: Desain responsif (mobile-friendly), layout grid, modal dialog, alert/toast, dan komponen UI modern.
* **Bootstrap Icons**: Ikon visual yang intuitif.
* **Vanilla JavaScript (ES6+)**: Logika bisnis, manipulasi DOM, validasi data, dan manajemen penyimpanan.
* **Web Storage API (`localStorage`)**: Persistensi data lokal tanpa database backend.

---

## 📁 Struktur Berkas

```text
SIBUKU/
├── README.md               # Dokumentasi proyek aplikasi
├── PRD.md                  # Dokumen Product Requirement Document
└── SIBUKU/
    ├── index.html          # Halaman utama (Dashboard & Ringkasan)
    ├── books.html          # Halaman pengelolaan katalog buku
    ├── members.html        # Halaman pengelolaan data anggota
    ├── borrowings.html     # Halaman transaksi peminjaman & pengembalian
    ├── css/
    │   └── style.css       # Kustomisasi styling, warna, dan tema aplikasi
    └── js/
        ├── data.js         # Data awal (hardcoded seed data) & modul localStorage
        ├── books.js        # Logika CRUD dan pencarian buku
        ├── members.js      # Logika CRUD anggota dan validasi NIM
        └── borrowings.js   # Logika bisnis peminjaman, pengembalian, dan filter
```

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi ini dapat langsung dijalankan tanpa perlu instalasi web server atau instalasi dependensi (Node.js/Composer):

1. Unduh atau clone repositori ini ke komputer Anda.
2. Buka folder proyek `SIBUKU/SIBUKU/`.
3. Buka file **`index.html`** langsung menggunakan web browser apa pun (Google Chrome, Mozilla Firefox, Microsoft Edge, Safari).
4. Gunakan menu navigasi di bagian atas untuk berpindah antar halaman: **Dashboard**, **Buku**, **Anggota**, dan **Peminjaman**.

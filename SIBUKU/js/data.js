/* =============================================
   SIBUKU – data.js
   Data awal (hardcode) + helper localStorage
   ============================================= */

'use strict';

// ── Seed data sesuai PRD ────────────────────────────────────────────────────
const SEED_DATA = {
  books: [
    { id: 'B001', title: 'Algoritma dan Pemrograman',   author: 'Rinaldi Munir',         category: 'Informatika', year: 2016, total: 5, stock: 4 },
    { id: 'B002', title: 'Basis Data',                  author: 'Abdul Kadir',           category: 'Informatika', year: 2018, total: 4, stock: 4 },
    { id: 'B003', title: 'Jaringan Komputer',           author: 'Andrew S. Tanenbaum',   category: 'Jaringan',    year: 2012, total: 3, stock: 2 },
    { id: 'B004', title: 'Rekayasa Perangkat Lunak',    author: 'Roger S. Pressman',     category: 'Informatika', year: 2015, total: 4, stock: 4 },
    { id: 'B005', title: 'Kalkulus',                    author: 'Edwin J. Purcell',      category: 'Matematika',  year: 2010, total: 5, stock: 5 },
    { id: 'B006', title: 'Statistika untuk Teknik',     author: 'Ronald E. Walpole',     category: 'Matematika',  year: 2014, total: 3, stock: 3 },
    { id: 'B007', title: 'Sistem Operasi',              author: 'Abraham Silberschatz',  category: 'Informatika', year: 2013, total: 4, stock: 4 },
    { id: 'B008', title: 'Manajemen Proyek',            author: 'Harold Kerzner',        category: 'Manajemen',   year: 2017, total: 3, stock: 3 },
  ],
  members: [
    { id: 'M001', name: 'Andi Pratama',  nim: '1302220001', major: 'Informatika',       status: 'Aktif' },
    { id: 'M002', name: 'Siti Rahma',    nim: '1302220002', major: 'Sistem Informasi',  status: 'Aktif' },
    { id: 'M003', name: 'Budi Santoso',  nim: '1302220003', major: 'Teknik Komputer',   status: 'Aktif' },
    { id: 'M004', name: 'Dewi Lestari',  nim: '1302220004', major: 'Informatika',       status: 'Aktif' },
    { id: 'M005', name: 'Rizky Maulana', nim: '1302220005', major: 'Sistem Informasi',  status: 'Nonaktif' },
  ],
  borrowings: [
    { id: 'L001', memberId: 'M001', bookId: 'B001', borrowDate: '2026-11-18', dueDate: '2026-11-25', returnDate: null, status: 'Dipinjam' },
    { id: 'L002', memberId: 'M002', bookId: 'B003', borrowDate: '2026-11-12', dueDate: '2026-11-19', returnDate: null, status: 'Dipinjam' },
    { id: 'L003', memberId: 'M003', bookId: 'B002', borrowDate: '2026-11-01', dueDate: '2026-11-08', returnDate: '2026-11-07', status: 'Dikembalikan' },
  ],
};

// ── LocalStorage helpers ─────────────────────────────────────────────────────
const DB = {
  _get(key)        { return JSON.parse(localStorage.getItem(key) || 'null'); },
  _set(key, value) { localStorage.setItem(key, JSON.stringify(value)); },

  getBooks()      { return this._get('books')     || []; },
  getMembers()    { return this._get('members')   || []; },
  getBorrowings() { return this._get('borrowings')|| []; },

  saveBooks(data)      { this._set('books', data); },
  saveMembers(data)    { this._set('members', data); },
  saveBorrowings(data) { this._set('borrowings', data); },

  /** Panggil saat aplikasi pertama kali dibuka */
  init() {
    if (!localStorage.getItem('books')) {
      this.saveBooks(JSON.parse(JSON.stringify(SEED_DATA.books)));
    }
    if (!localStorage.getItem('members')) {
      this.saveMembers(JSON.parse(JSON.stringify(SEED_DATA.members)));
    }
    if (!localStorage.getItem('borrowings')) {
      this.saveBorrowings(JSON.parse(JSON.stringify(SEED_DATA.borrowings)));
    }
  },

  /** Tombol Reset Data */
  reset() {
    localStorage.removeItem('books');
    localStorage.removeItem('members');
    localStorage.removeItem('borrowings');
    this.init();
  },
};

// ── ID Generator ─────────────────────────────────────────────────────────────
function generateId(prefix, items) {
  if (!items || items.length === 0) return `${prefix}001`;
  const nums = items
    .map(i => parseInt(i.id.replace(prefix, ''), 10))
    .filter(n => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

// ── Date helpers ─────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateISO, days) {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isOverdue(dueDate, status) {
  if (status !== 'Dipinjam') return false;
  return todayISO() > dueDate;
}

// ── Toast notification ────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const id = `toast-${Date.now()}`;
  const colorClass = type === 'success' ? 'text-bg-success'
                   : type === 'danger'  ? 'text-bg-danger'
                   : type === 'warning' ? 'text-bg-warning'
                   : 'text-bg-info';

  const html = `
    <div id="${id}" class="toast toast-custom show align-items-center ${colorClass} border-0 mb-2" role="alert" aria-live="assertive">
      <div class="d-flex">
        <div class="toast-body fw-semibold">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>`;
  container.insertAdjacentHTML('beforeend', html);

  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.remove();
  }, 3500);
}

// ── Bootstrap modal helper ───────────────────────────────────────────────────
function openModal(id)  { bootstrap.Modal.getOrCreateInstance(document.getElementById(id)).show(); }
function closeModal(id) { bootstrap.Modal.getInstance(document.getElementById(id))?.hide(); }

// ── Inisialisasi saat halaman load ───────────────────────────────────────────
DB.init();

/* =============================================
   SIBUKU – books.js
   CRUD Buku + pencarian
   ============================================= */

'use strict';

let editingBookId = null;

// ── Render tabel ──────────────────────────────────────────────────────────────
function renderBooks(filter = '') {
  const books    = DB.getBooks();
  const keyword  = filter.toLowerCase().trim();
  const filtered = keyword
    ? books.filter(b =>
        b.title.toLowerCase().includes(keyword)   ||
        b.author.toLowerCase().includes(keyword)  ||
        b.category.toLowerCase().includes(keyword))
    : books;

  const tbody = document.getElementById('books-tbody');
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <p class="mb-0">Tidak ada buku ditemukan.</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(b => {
    const stockClass = b.stock === 0 ? 'stock-zero'
                     : b.stock <= 1 ? 'stock-low'
                     : 'stock-ok';
    return `
    <tr>
      <td class="text-muted small">${b.id}</td>
      <td><strong>${escHtml(b.title)}</strong></td>
      <td>${escHtml(b.author)}</td>
      <td><span class="badge bg-secondary">${escHtml(b.category)}</span></td>
      <td>${b.year}</td>
      <td class="${stockClass}">${b.stock} / ${b.total}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1 mb-1" onclick="openEditBook('${b.id}')">
          <i class="bi bi-pencil-fill"></i> Edit
        </button>
        <button class="btn btn-sm btn-outline-danger mb-1" onclick="deleteBook('${b.id}')">
          <i class="bi bi-trash-fill"></i> Hapus
        </button>
      </td>
    </tr>`;
  }).join('');
}

// ── Add / Edit ────────────────────────────────────────────────────────────────
function openAddBook() {
  editingBookId = null;
  document.getElementById('bookModalLabel').textContent = 'Tambah Buku';
  document.getElementById('book-form').reset();
  document.getElementById('book-id-field').value = '';
  openModal('bookModal');
}

function openEditBook(id) {
  const book = DB.getBooks().find(b => b.id === id);
  if (!book) return;
  editingBookId = id;
  document.getElementById('bookModalLabel').textContent = 'Edit Buku';
  document.getElementById('book-id-field').value  = book.id;
  document.getElementById('book-title').value     = book.title;
  document.getElementById('book-author').value    = book.author;
  document.getElementById('book-category').value  = book.category;
  document.getElementById('book-year').value      = book.year;
  document.getElementById('book-total').value     = book.total;
  openModal('bookModal');
}

function saveBook() {
  const title    = document.getElementById('book-title').value.trim();
  const author   = document.getElementById('book-author').value.trim();
  const category = document.getElementById('book-category').value.trim();
  const year     = parseInt(document.getElementById('book-year').value);
  const total    = parseInt(document.getElementById('book-total').value);

  // Validasi
  if (!title || !author || !category || isNaN(year) || isNaN(total)) {
    showToast('Semua field wajib diisi!', 'danger'); return;
  }
  if (total < 0) {
    showToast('Stok total tidak boleh negatif!', 'danger'); return;
  }
  if (year < 1900 || year > new Date().getFullYear() + 1) {
    showToast('Tahun tidak valid!', 'danger'); return;
  }

  const books = DB.getBooks();

  if (editingBookId) {
    // UPDATE
    const idx  = books.findIndex(b => b.id === editingBookId);
    if (idx === -1) return;
    const old  = books[idx];
    // Hitung stok baru: stok lama + (total baru - total lama)
    const diff = total - old.total;
    const newStock = Math.max(0, old.stock + diff);
    books[idx] = { ...old, title, author, category, year, total, stock: newStock };
    DB.saveBooks(books);
    showToast(`Buku "${title}" berhasil diperbarui.`, 'success');
  } else {
    // CREATE
    const newBook = {
      id:       generateId('B', books),
      title, author, category, year,
      total,
      stock:    total,
    };
    books.push(newBook);
    DB.saveBooks(books);
    showToast(`Buku "${title}" berhasil ditambahkan.`, 'success');
  }

  closeModal('bookModal');
  renderBooks(document.getElementById('search-book').value);
}

// ── Delete ────────────────────────────────────────────────────────────────────
function deleteBook(id) {
  const borrowings = DB.getBorrowings();
  const hasActive  = borrowings.some(l => l.bookId === id && l.status === 'Dipinjam');
  if (hasActive) {
    showToast('Buku tidak dapat dihapus karena masih dipinjam!', 'danger');
    return;
  }
  const book = DB.getBooks().find(b => b.id === id);
  if (!book) return;
  if (!confirm(`Hapus buku "${book.title}"? Tindakan ini tidak dapat dibatalkan.`)) return;

  const books = DB.getBooks().filter(b => b.id !== id);
  DB.saveBooks(books);
  showToast(`Buku "${book.title}" berhasil dihapus.`, 'success');
  renderBooks(document.getElementById('search-book').value);
}

// ── Escape HTML ───────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderBooks();

  document.getElementById('search-book').addEventListener('input', e => {
    renderBooks(e.target.value);
  });

  document.getElementById('btn-add-book').addEventListener('click', openAddBook);
  document.getElementById('btn-save-book').addEventListener('click', saveBook);

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Reset semua data ke kondisi awal? Semua perubahan akan hilang.')) {
      DB.reset();
      renderBooks();
      showToast('Data berhasil direset ke kondisi awal.', 'warning');
    }
  });
});

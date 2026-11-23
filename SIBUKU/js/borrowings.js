/* =============================================
   SIBUKU – borrowings.js
   Kelola Peminjaman: CRUD + pinjam + kembali
   Semua aturan bisnis PRD 3.3 diimplementasikan
   ============================================= */

'use strict';

let editingBorrowId = null;
let currentFilter   = 'Semua';

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getMemberName(id) {
  const m = DB.getMembers().find(m => m.id === id);
  return m ? m.name : '(Tidak Diketahui)';
}

function getBookTitle(id) {
  const b = DB.getBooks().find(b => b.id === id);
  return b ? b.title : '(Tidak Diketahui)';
}

function statusBadge(borrow) {
  if (borrow.status === 'Dikembalikan') {
    return '<span class="badge badge-dikembalikan">Dikembalikan</span>';
  }
  if (isOverdue(borrow.dueDate, borrow.status)) {
    return '<span class="badge badge-terlambat">Terlambat</span>';
  }
  return '<span class="badge badge-dipinjam text-dark">Dipinjam</span>';
}

// ── Render tabel ──────────────────────────────────────────────────────────────
function renderBorrowings() {
  const all  = DB.getBorrowings();
  const data = currentFilter === 'Semua'
    ? all
    : all.filter(l => {
        if (currentFilter === 'Terlambat') return isOverdue(l.dueDate, l.status);
        return l.status === currentFilter;
      });

  const tbody = document.getElementById('borrow-tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p class="mb-0">Tidak ada data peminjaman.</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(l => {
    const isActive   = l.status === 'Dipinjam';
    const overdue    = isOverdue(l.dueDate, l.status);
    const dueCls     = overdue ? 'text-danger fw-bold' : '';
    return `
    <tr>
      <td class="text-muted small">${l.id}</td>
      <td>${escHtml(getMemberName(l.memberId))}</td>
      <td>${escHtml(getBookTitle(l.bookId))}</td>
      <td>${l.borrowDate}</td>
      <td class="${dueCls}">${l.dueDate}</td>
      <td>${l.returnDate || '-'}</td>
      <td>
        <div class="d-flex flex-wrap gap-1">
          ${statusBadge(l)}
          ${isActive ? `
            <button class="btn btn-sm btn-success" onclick="returnBook('${l.id}')" title="Kembalikan Buku">
              <i class="bi bi-arrow-return-left"></i> Kembali
            </button>
            <button class="btn btn-sm btn-outline-primary" onclick="openEditBorrow('${l.id}')" title="Edit Jatuh Tempo">
              <i class="bi bi-pencil-fill"></i>
            </button>` : ''}
          <button class="btn btn-sm btn-outline-danger" onclick="deleteBorrow('${l.id}')" title="Hapus">
            <i class="bi bi-trash-fill"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── Populate select options ───────────────────────────────────────────────────
function populateMemberSelect(selectId, selectedId = '') {
  const sel     = document.getElementById(selectId);
  const members = DB.getMembers().filter(m => m.status === 'Aktif');
  sel.innerHTML = '<option value="">-- Pilih Anggota --</option>' +
    members.map(m => `<option value="${m.id}" ${m.id === selectedId ? 'selected' : ''}>${m.name} (${m.nim})</option>`).join('');
}

function populateBookSelect(selectId, selectedId = '') {
  const sel   = document.getElementById(selectId);
  const books = DB.getBooks();
  sel.innerHTML = '<option value="">-- Pilih Buku --</option>' +
    books.map(b => {
      const disabled = b.stock === 0 ? 'disabled' : '';
      const stockInfo = `[Stok: ${b.stock}/${b.total}]`;
      return `<option value="${b.id}" ${b.id === selectedId ? 'selected' : ''} ${disabled}>${b.title} ${stockInfo}</option>`;
    }).join('');
}

// ── Add Borrowing (Pinjam Buku) ───────────────────────────────────────────────
function openAddBorrow() {
  editingBorrowId = null;
  document.getElementById('borrowModalLabel').textContent = 'Pinjam Buku';
  document.getElementById('borrow-form').reset();

  // Set default dates
  const today  = todayISO();
  const due    = addDays(today, 7);
  document.getElementById('borrow-date').value = today;
  document.getElementById('due-date').value    = due;

  // Readonly untuk add mode
  document.getElementById('borrow-date').readOnly = true;
  document.getElementById('due-date').readOnly    = false;

  // Tampilkan / sembunyikan field
  document.getElementById('row-member-select').style.display = '';
  document.getElementById('row-book-select').style.display   = '';
  document.getElementById('row-due-date').style.display      = '';

  document.getElementById('btn-save-borrow').textContent = 'Pinjam';

  populateMemberSelect('borrow-member');
  populateBookSelect('borrow-book');

  openModal('borrowModal');
}

function saveBorrow() {
  if (editingBorrowId) {
    // Mode edit: hanya ubah dueDate
    const newDue = document.getElementById('due-date').value;
    if (!newDue) { showToast('Jatuh tempo wajib diisi!', 'danger'); return; }
    if (newDue < document.getElementById('borrow-date').value) {
      showToast('Jatuh tempo tidak boleh sebelum tanggal pinjam!', 'danger'); return;
    }

    const borrowings = DB.getBorrowings();
    const idx = borrowings.findIndex(l => l.id === editingBorrowId);
    if (idx === -1) return;
    borrowings[idx].dueDate = newDue;
    DB.saveBorrowings(borrowings);
    showToast('Jatuh tempo berhasil diperbarui.', 'success');
    closeModal('borrowModal');
    renderBorrowings();
    return;
  }

  // Mode tambah baru
  const memberId   = document.getElementById('borrow-member').value;
  const bookId     = document.getElementById('borrow-book').value;
  const borrowDate = document.getElementById('borrow-date').value;
  const dueDate    = document.getElementById('due-date').value;

  if (!memberId || !bookId || !borrowDate || !dueDate) {
    showToast('Semua field wajib diisi!', 'danger'); return;
  }

  const books   = DB.getBooks();
  const members = DB.getMembers();
  const book    = books.find(b => b.id === bookId);
  const member  = members.find(m => m.id === memberId);

  // Aturan bisnis
  // 1. Stok cukup
  if (!book || book.stock <= 0) {
    showToast('Stok buku habis, tidak bisa dipinjam!', 'danger'); return;
  }
  // 2. Anggota aktif
  if (!member || member.status !== 'Aktif') {
    showToast('Hanya anggota berstatus Aktif yang dapat meminjam!', 'danger'); return;
  }

  const borrowings = DB.getBorrowings();

  // 3. Maks 3 buku sekaligus
  const activeLoan = borrowings.filter(l => l.memberId === memberId && l.status === 'Dipinjam');
  if (activeLoan.length >= 3) {
    showToast('Anggota sudah meminjam 3 buku sekaligus (batas maksimal)!', 'danger'); return;
  }
  // 4. Tidak boleh meminjam buku yang sama dua kali selama belum dikembalikan
  const samebook = activeLoan.find(l => l.bookId === bookId);
  if (samebook) {
    showToast('Anggota sudah meminjam buku ini dan belum dikembalikan!', 'danger'); return;
  }

  // Semua validasi lolos → buat borrowing baru
  const newBorrow = {
    id:         generateId('L', borrowings),
    memberId,
    bookId,
    borrowDate,
    dueDate,
    returnDate: null,
    status:     'Dipinjam',
  };
  borrowings.push(newBorrow);
  DB.saveBorrowings(borrowings);

  // Kurangi stok buku
  const bookIdx = books.findIndex(b => b.id === bookId);
  books[bookIdx].stock -= 1;
  DB.saveBooks(books);

  showToast(`Peminjaman buku "${book.title}" berhasil dicatat!`, 'success');
  closeModal('borrowModal');
  renderBorrowings();
}

// ── Edit (hanya dueDate) ──────────────────────────────────────────────────────
function openEditBorrow(id) {
  const borrow = DB.getBorrowings().find(l => l.id === id);
  if (!borrow) return;
  editingBorrowId = id;

  document.getElementById('borrowModalLabel').textContent = 'Edit Jatuh Tempo';

  // Sembunyikan field yang tidak diedit
  document.getElementById('row-member-select').style.display = 'none';
  document.getElementById('row-book-select').style.display   = 'none';

  document.getElementById('borrow-date').value    = borrow.borrowDate;
  document.getElementById('borrow-date').readOnly = true;
  document.getElementById('due-date').value       = borrow.dueDate;
  document.getElementById('due-date').readOnly    = false;
  document.getElementById('row-due-date').style.display = '';

  document.getElementById('btn-save-borrow').textContent = 'Simpan';
  openModal('borrowModal');
}

// ── Return Book ───────────────────────────────────────────────────────────────
function returnBook(id) {
  if (!confirm('Konfirmasi pengembalian buku ini?')) return;

  const borrowings = DB.getBorrowings();
  const idx = borrowings.findIndex(l => l.id === id);
  if (idx === -1) return;

  const borrow = borrowings[idx];
  if (borrow.status !== 'Dipinjam') {
    showToast('Buku ini sudah dikembalikan.', 'warning'); return;
  }

  // Update borrowing
  borrowings[idx].status     = 'Dikembalikan';
  borrowings[idx].returnDate = todayISO();
  DB.saveBorrowings(borrowings);

  // Tambah stok buku
  const books   = DB.getBooks();
  const bookIdx = books.findIndex(b => b.id === borrow.bookId);
  if (bookIdx !== -1) {
    books[bookIdx].stock = Math.min(books[bookIdx].stock + 1, books[bookIdx].total);
    DB.saveBooks(books);
  }

  showToast('Buku berhasil dikembalikan. Stok diperbarui.', 'success');
  renderBorrowings();
}

// ── Delete ────────────────────────────────────────────────────────────────────
function deleteBorrow(id) {
  if (!confirm('Hapus catatan peminjaman ini?')) return;

  const borrowings = DB.getBorrowings();
  const idx        = borrowings.findIndex(l => l.id === id);
  if (idx === -1) return;

  const borrow = borrowings[idx];

  // Aturan 9: Jika masih Dipinjam, kembalikan stok
  if (borrow.status === 'Dipinjam') {
    const books   = DB.getBooks();
    const bookIdx = books.findIndex(b => b.id === borrow.bookId);
    if (bookIdx !== -1) {
      books[bookIdx].stock = Math.min(books[bookIdx].stock + 1, books[bookIdx].total);
      DB.saveBooks(books);
    }
    showToast('Catatan dihapus dan stok buku dikembalikan.', 'warning');
  } else {
    showToast('Catatan peminjaman berhasil dihapus.', 'success');
  }

  borrowings.splice(idx, 1);
  DB.saveBorrowings(borrowings);
  renderBorrowings();
}

// ── Filter buttons ────────────────────────────────────────────────────────────
function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  renderBorrowings();
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderBorrowings();

  document.getElementById('btn-add-borrow').addEventListener('click', openAddBorrow);
  document.getElementById('btn-save-borrow').addEventListener('click', saveBorrow);

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter));
  });

  // Auto-update due date ketika tanggal pinjam berubah (meski readonly, diberi handler)
  document.getElementById('borrow-date').addEventListener('change', e => {
    document.getElementById('due-date').value = addDays(e.target.value, 7);
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Reset semua data ke kondisi awal? Semua perubahan akan hilang.')) {
      DB.reset();
      renderBorrowings();
      showToast('Data berhasil direset ke kondisi awal.', 'warning');
    }
  });
});

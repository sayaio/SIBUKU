'use strict';
const API_BASE = window.SIBUKU_API_URL || '/api';
let requestTail = Promise.resolve();

const api = {
  async request(path, options = {}) {
    const operation = requestTail.then(() =>
      fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      }).catch(() => {
        throw new Error(
          'Tidak dapat terhubung ke server. Pastikan layanan berjalan, lalu coba lagi.',
        );
      }),
    );

    requestTail = operation.catch(() => {});

    const response = await operation;
    if (response.status === 204) return null;

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `Permintaan gagal (${response.status})`);
    }

    return body;
  },

  get: path => api.request(path),
  post: (path, data = {}) => api.request(path, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  put: (path, data) => api.request(path, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  delete: path => api.request(path, { method: 'DELETE' }),
};

const legacy = {
  book: x => ({
    ...x,
    total: x.total_stock,
    stock: x.available_stock,
  }),

  member: x => ({
    ...x,
    nim: x.student_id,
    major: x.major,
    status: x.status === 'active' ? 'Aktif' : 'Nonaktif',
  }),

  loan: x => ({
    ...x,
    memberId: x.member_id,
    bookId: x.book_id,
    borrowDate: x.borrow_date,
    dueDate: x.due_date,
    returnDate: x.return_date,
    status: x.status === 'returned' ? 'Dikembalikan' : 'Dipinjam',
  }),
};

const DB = {
  books: [],
  members: [],
  borrowings: [],

  async init() {
    await this.refresh();
  },

  async refresh() {
    const [books, members, borrowings] = await Promise.all([
      api.get('/books'),
      api.get('/members'),
      api.get('/borrowings'),
    ]);

    this.books = books.map(legacy.book);
    this.members = members.map(legacy.member);
    this.borrowings = borrowings.map(legacy.loan);
  },

  getBooks() {
    return structuredClone(this.books);
  },
  getMembers() {
    return structuredClone(this.members);
  },
  getBorrowings() {
    return structuredClone(this.borrowings);
  },

  async saveBooks(rows) {
    const before = structuredClone(this.books);
    try {
      for (const book of rows) {
        const data = {
          id: book.id,
          title: book.title,
          author: book.author,
          publisher: book.publisher || '',
          category: book.category,
          isbn: book.isbn || '',
          year: book.year,
          total_stock: book.total,
        };

        if (before.some(item => item.id === book.id)) {
          await api.put(`/books/${book.id}`, data);
        } else {
          await api.post('/books', data);
        }
      }

      for (const book of before.filter(item => !rows.some(row => row.id === item.id))) {
        await api.delete(`/books/${book.id}`);
      }

      await this.refresh();
    } catch (e) {
      try {
        await this.refresh();
      } catch (_) {}
      showToast(e.message, 'danger');
      throw e;
    }
  },

  async saveMembers(rows) {
    const before = structuredClone(this.members);
    try {
      for (const member of rows) {
        const data = {
          id: member.id,
          name: member.name,
          student_id: member.nim,
          email: member.email || `${member.nim}@example.test`,
          phone: member.phone || '',
          major: member.major,
          status: member.status === 'Aktif' ? 'active' : 'inactive',
        };

        if (before.some(item => item.id === member.id)) {
          await api.put(`/members/${member.id}`, data);
        } else {
          await api.post('/members', data);
        }
      }

      for (const member of before.filter(item => !rows.some(row => row.id === item.id))) {
        await api.delete(`/members/${member.id}`);
      }

      await this.refresh();
    } catch (e) {
      try {
        await this.refresh();
      } catch (_) {}
      showToast(e.message, 'danger');
      throw e;
    }
  },

  async saveBorrowings(rows) {
    const before = structuredClone(this.borrowings);
    try {
      for (const borrowing of rows) {
        const old = before.find(item => item.id === borrowing.id);

        if (!old) {
          await api.post('/borrowings', {
            id: borrowing.id,
            member_id: borrowing.memberId,
            book_id: borrowing.bookId,
            borrow_date: borrowing.borrowDate,
            due_date: borrowing.dueDate,
          });
        } else if (old.status === 'Dipinjam' && borrowing.status === 'Dikembalikan') {
          await api.post(`/borrowings/${borrowing.id}/return`);
        } else if (old.dueDate !== borrowing.dueDate) {
          await api.post(`/borrowings/${borrowing.id}/extend`, {
            due_date: borrowing.dueDate,
          });
        }
      }

      for (const borrowing of before.filter(
        item => !rows.some(row => row.id === item.id),
      )) {
        await api.delete(`/borrowings/${borrowing.id}`);
      }

      await this.refresh();
    } catch (e) {
      try {
        await this.refresh();
      } catch (_) {}
      showToast(e.message, 'danger');
      throw e;
    }
  },

  async reset() {
    await api.post('/reset');
    await this.refresh();
  },
};

function generateId(prefix, items) {
  const numbers = (items || [])
    .map(item => parseInt(item.id.replace(prefix, ''), 10))
    .filter(Number.isFinite);
  const max = numbers.length ? Math.max(...numbers) : 0;
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const dateValue = new Date(`${dateString}T00:00:00`);
  dateValue.setDate(dateValue.getDate() + days);
  return dateValue.toISOString().slice(0, 10);
}

function isOverdue(dueDate, status) {
  return status === 'Dipinjam' && todayISO() > dueDate;
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const id = `toast-${Date.now()}`;
  const colorClass = type === 'success'
    ? 'text-bg-success'
    : type === 'danger'
      ? 'text-bg-danger'
      : type === 'warning'
        ? 'text-bg-warning'
        : 'text-bg-info';

  const safeMessage = String(message).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));

  container.insertAdjacentHTML('beforeend', `
    <div id="${id}" class="toast toast-custom show align-items-center ${colorClass} border-0 mb-2" role="alert" aria-live="assertive">
      <div class="d-flex">
        <div class="toast-body fw-semibold">${safeMessage}</div>
        <button class="btn-close btn-close-white me-2 m-auto"
                onclick="this.closest('.toast').remove()"></button>
      </div>
    </div>`);

  setTimeout(() => document.getElementById(id)?.remove(), 3500);
}

function openModal(id) {
  bootstrap.Modal.getOrCreateInstance(document.getElementById(id)).show();
}

function closeModal(id) {
  bootstrap.Modal.getInstance(document.getElementById(id))?.hide();
}

async function resetData() {
  await DB.reset();
}

DB.ready = DB.init().catch(error => {
  showToast(`Layanan belum dapat dihubungi: ${error.message}`, 'danger');
  throw error;
});

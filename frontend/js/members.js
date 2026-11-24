'use strict';

let editingMemberId = null;

// ── Render tabel ──────────────────────────────────────────────────────────────
function renderMembers(filter = '') {
  const key = filter.toLowerCase().trim();
  const members = DB.getMembers().filter(m => !key || m.name.toLowerCase().includes(key) || m.nim.includes(key));
  const tbody   = document.getElementById('members-tbody');

  if (!members.length) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state">
        <div class="empty-icon">👤</div>
        <p class="mb-0">Belum ada anggota terdaftar.</p>
      </div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = members.map(m => {
    const badgeClass = m.status === 'Aktif' ? 'badge-aktif' : 'badge-nonaktif';
    const borrowings = DB.getBorrowings();
    const activeLoan = borrowings.filter(l => l.memberId === m.id && l.status === 'Dipinjam').length;
    return `
    <tr>
      <td class="text-muted small">${m.id}</td>
      <td><strong>${escHtml(m.name)}</strong></td>
      <td><code>${m.nim}</code></td>
      <td>${escHtml(m.major)}</td>
      <td>
        <span class="badge ${badgeClass}">${m.status}</span>
        ${activeLoan > 0 ? `<span class="badge bg-warning text-dark ms-1">${activeLoan} pinjaman</span>` : ''}
      </td>
      <td>
        <button class="btn btn-sm btn-outline-primary me-1 mb-1" onclick="openEditMember('${m.id}')">
          <i class="bi bi-pencil-fill"></i> Edit
        </button>
        <button class="btn btn-sm btn-outline-danger mb-1" onclick="deleteMember('${m.id}')">
          <i class="bi bi-trash-fill"></i> Hapus
        </button>
      </td>
    </tr>`;
  }).join('');
}

// ── Add / Edit ────────────────────────────────────────────────────────────────
function openAddMember() {
  editingMemberId = null;
  document.getElementById('memberModalLabel').textContent = 'Tambah Anggota';
  document.getElementById('member-form').reset();
  document.getElementById('member-id-field').value = '';
  openModal('memberModal');
}

function openEditMember(id) {
  const member = DB.getMembers().find(m => m.id === id);
  if (!member) return;
  editingMemberId = id;
  document.getElementById('memberModalLabel').textContent = 'Edit Anggota';
  document.getElementById('member-id-field').value  = member.id;
  document.getElementById('member-name').value      = member.name;
  document.getElementById('member-nim').value       = member.nim;
  document.getElementById('member-major').value     = member.major;
  document.getElementById('member-status').value    = member.status;
  openModal('memberModal');
}

async function saveMember() {
  const name   = document.getElementById('member-name').value.trim();
  const nim    = document.getElementById('member-nim').value.trim();
  const major  = document.getElementById('member-major').value.trim();
  const status = document.getElementById('member-status').value;

  if (!name || !nim || !major || !status) {
    showToast('Semua field wajib diisi!', 'danger'); return;
  }
  if (!/^\d+$/.test(nim)) {
    showToast('NIM harus berupa angka!', 'danger'); return;
  }

  const members = DB.getMembers();

  const nimDuplicate = members.find(m => m.nim === nim && m.id !== editingMemberId);
  if (nimDuplicate) {
    showToast(`NIM ${nim} sudah terdaftar!`, 'danger'); return;
  }

  if (editingMemberId) {
    const idx = members.findIndex(m => m.id === editingMemberId);
    if (idx === -1) return;

    if (status === 'Nonaktif' && members[idx].status === 'Aktif') {
      const hasActive = DB.getBorrowings().some(l => l.memberId === editingMemberId && l.status === 'Dipinjam');
      if (hasActive) {
        showToast('Anggota masih memiliki pinjaman aktif. Selesaikan dulu sebelum menonaktifkan.', 'warning');
        return;
      }
    }

    members[idx] = { ...members[idx], name, nim, major, status };
    try { await DB.saveMembers(members); } catch (_) { return; }
    showToast(`Anggota "${name}" berhasil diperbarui.`, 'success');
  } else {
    const newMember = {
      id: generateId('M', members),
      name, nim, major, status,
    };
    members.push(newMember);
    try { await DB.saveMembers(members); } catch (_) { return; }
    showToast(`Anggota "${name}" berhasil ditambahkan.`, 'success');
  }

  closeModal('memberModal');
  renderMembers();
}

// ── Delete ────────────────────────────────────────────────────────────────────
async function deleteMember(id) {
  const hasActive = DB.getBorrowings().some(l => l.memberId === id && l.status === 'Dipinjam');
  if (hasActive) {
    showToast('Anggota tidak dapat dihapus karena masih memiliki pinjaman aktif!', 'danger');
    return;
  }
  const member = DB.getMembers().find(m => m.id === id);
  if (!member) return;
  if (!confirm(`Hapus anggota "${member.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;

  const members = DB.getMembers().filter(m => m.id !== id);
  try { await DB.saveMembers(members); } catch (_) { return; }
  showToast(`Anggota "${member.name}" berhasil dihapus.`, 'success');
  renderMembers();
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
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('btn-reset').addEventListener('click', async () => {
    if (!confirm('Reset semua data ke kondisi awal? Semua perubahan akan hilang.')) return;
    try { await resetData(); renderMembers(); showToast('Data berhasil direset ke kondisi awal.', 'warning'); }
    catch (e) { showToast(e.message, 'danger'); }
  });
  try { await DB.ready; } catch (_) { return; }
  renderMembers();

  document.getElementById('btn-add-member').addEventListener('click', openAddMember);
  document.getElementById('btn-save-member').addEventListener('click', saveMember);
  document.getElementById('search-member').addEventListener('input', e => renderMembers(e.target.value));

});

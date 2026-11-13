import {
  bindPasswordToggle,
  formatDateTimeBr,
  formatWhatsApp,
  initAccessibleForm,
  postJson,
  setupDialogLightDismiss,
  showToast,
} from '/shared/ui.js';

const statTotal = document.getElementById('stat-total');
const statPending = document.getElementById('stat-pending');
const statApproved = document.getElementById('stat-approved');
const statBlocked = document.getElementById('stat-blocked');

const chipCountAll = document.getElementById('chip-count-all');
const chipCountPending = document.getElementById('chip-count-pending');
const chipCountApproved = document.getElementById('chip-count-approved');
const chipCountBlocked = document.getElementById('chip-count-blocked');

const filterChips = document.querySelectorAll('.filter-chip[data-filter]');
const searchInput = document.getElementById('user-search');
const approveAllBtn = document.getElementById('btn-approve-all');
const tbody = document.getElementById('users-tbody');

const logoutBtn = document.getElementById('btn-admin-logout');

const createDialog = document.getElementById('create-user-dialog');
const openCreateBtn = document.getElementById('btn-open-create-user');
const closeCreateBtn = document.getElementById('close-create-user');
const cancelCreateBtn = document.getElementById('cancel-create-user');
const createForm = document.getElementById('create-user-form');
const createError = document.getElementById('create-user-error');
const submitCreateBtn = document.getElementById('btn-submit-create-user');
const newWhatsappInput = document.getElementById('new-user-whatsapp');
const newPasswordInput = document.getElementById('new-user-password');

const deleteDialog = document.getElementById('delete-user-dialog');
const closeDeleteBtn = document.getElementById('close-delete-dialog');
const cancelDeleteBtn = document.getElementById('cancel-delete-user');
const confirmDeleteBtn = document.getElementById('confirm-delete-user');
const deleteUserLabel = document.getElementById('delete-user-label');

const buyersDialog = document.getElementById('buyers-dialog');
const openBuyersBtn = document.getElementById('btn-open-buyers');
const closeBuyersBtn = document.getElementById('close-buyers-dialog');
const buyersForm = document.getElementById('buyers-form');
const buyersEmailsInput = document.getElementById('buyers-emails');
const saveBuyersBtn = document.getElementById('btn-save-buyers');
const buyersListEl = document.getElementById('buyers-list');

let allUsers = [];
let currentUserId = null;
let activeFilter = 'all';
let searchTerm = '';
let pendingDeleteUser = null;

const STATUS_LABELS = {
  pending: 'Pendente',
  approved: 'Aprovado',
  blocked: 'Bloqueado',
};

function updateCounters(summary) {
  statTotal.textContent = String(summary.total);
  statPending.textContent = String(summary.pending);
  statApproved.textContent = String(summary.approved);
  statBlocked.textContent = String(summary.blocked);

  chipCountAll.textContent = String(summary.total);
  chipCountPending.textContent = String(summary.pending);
  chipCountApproved.textContent = String(summary.approved);
  chipCountBlocked.textContent = String(summary.blocked);

  approveAllBtn.hidden = summary.pending === 0;
  approveAllBtn.textContent = `✓ Aprovar todos (${summary.pending})`;
}

function getFilteredUsers() {
  const q = searchTerm.trim().toLowerCase();
  return allUsers.filter((u) => {
    if (activeFilter !== 'all' && u.status !== activeFilter) return false;
    if (!q) return true;
    return (
      (u.nome || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.whatsapp || '').toLowerCase().includes(q)
    );
  });
}

function createActionButton(label, className, onClick) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn-table ${className}`;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

function renderUsersTable() {
  const rows = getFilteredUsers();
  tbody.innerHTML = '';

  if (rows.length === 0) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 7;
    td.className = 'empty-state';
    td.textContent =
      allUsers.length === 0
        ? 'Nenhum usuário encontrado.'
        : 'Nenhum usuário corresponde aos filtros atuais.';
    tr.append(td);
    tbody.append(tr);
    return;
  }

  for (const user of rows) {
    const tr = document.createElement('tr');

    // Nome (<th scope="row">)
    const thName = document.createElement('th');
    thName.scope = 'row';
    thName.textContent = user.nome || 'Sem nome';
    if (user.role === 'admin') {
      const roleBadge = document.createElement('span');
      roleBadge.className = 'role-badge';
      roleBadge.textContent = 'Admin';
      thName.append(roleBadge);
    }

    // Email
    const tdEmail = document.createElement('td');
    tdEmail.dataset.label = 'Email';
    tdEmail.textContent = user.email;

    // WhatsApp
    const tdWhatsapp = document.createElement('td');
    tdWhatsapp.dataset.label = 'WhatsApp';
    tdWhatsapp.className = 'td-mono';
    tdWhatsapp.textContent = user.whatsapp || '—';

    // Cadastro
    const tdCreated = document.createElement('td');
    tdCreated.dataset.label = 'Cadastro';
    tdCreated.className = 'td-mono';
    tdCreated.textContent = formatDateTimeBr(user.created_at);

    // Status
    const tdStatus = document.createElement('td');
    tdStatus.dataset.label = 'Status';
    const badge = document.createElement('span');
    badge.className = `status-badge status-${user.status}`;
    badge.textContent = STATUS_LABELS[user.status] || user.status;
    tdStatus.append(badge);

    // Último acesso
    const tdLastLogin = document.createElement('td');
    tdLastLogin.dataset.label = 'Último acesso';
    tdLastLogin.className = 'td-mono';
    tdLastLogin.textContent = user.last_login_at
      ? formatDateTimeBr(user.last_login_at)
      : 'Nunca acessou';

    // Ações
    const tdActions = document.createElement('td');
    tdActions.dataset.label = 'Ações';
    const actionsWrap = document.createElement('div');
    actionsWrap.className = 'row-actions';

    const isSelf = user.id === currentUserId;

    if (user.status === 'pending') {
      actionsWrap.append(
        createActionButton('Aprovar', 'btn-table-approve', () =>
          changeUserStatus(user, 'approved')
        )
      );
      if (!isSelf) {
        actionsWrap.append(
          createActionButton('Bloquear', 'btn-table-block', () =>
            changeUserStatus(user, 'blocked')
          )
        );
      }
    } else if (user.status === 'approved') {
      if (!isSelf) {
        actionsWrap.append(
          createActionButton('Bloquear', 'btn-table-block', () =>
            changeUserStatus(user, 'blocked')
          )
        );
      }
    } else if (user.status === 'blocked') {
      actionsWrap.append(
        createActionButton('Desbloquear', 'btn-table-approve', () =>
          changeUserStatus(user, 'approved')
        )
      );
    }

    if (!isSelf) {
      actionsWrap.append(
        createActionButton('Excluir', 'btn-table-delete', () =>
          openDeleteConfirm(user)
        )
      );
    } else if (actionsWrap.children.length === 0) {
      const selfHint = document.createElement('span');
      selfHint.style.fontSize = '12px';
      selfHint.style.color = 'var(--text-dim)';
      selfHint.textContent = 'Sua conta';
      actionsWrap.append(selfHint);
    }

    tdActions.append(actionsWrap);
    tr.append(
      thName,
      tdEmail,
      tdWhatsapp,
      tdCreated,
      tdStatus,
      tdLastLogin,
      tdActions
    );
    tbody.append(tr);
  }
}

async function fetchUsers() {
  try {
    const res = await fetch('/api/admin/users', { credentials: 'same-origin' });
    if (res.status === 401) {
      window.location.assign('/auth/login');
      return;
    }
    if (res.status === 403) {
      window.location.assign('/');
      return;
    }
    const data = await res.json();
    allUsers = data.users || [];
    currentUserId = data.currentUserId;
    updateCounters(
      data.summary || { total: 0, pending: 0, approved: 0, blocked: 0 }
    );
    renderUsersTable();
  } catch {
    showToast('Erro ao carregar lista de usuários.', 'error');
  }
}

async function changeUserStatus(user, newStatus) {
  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || 'Erro ao atualizar status.', 'error');
      return;
    }

    const actionText =
      newStatus === 'approved'
        ? user.status === 'blocked'
          ? 'desbloqueado'
          : 'aprovado'
        : 'bloqueado';
    showToast(`${user.email} ${actionText} com sucesso!`);
    await fetchUsers();
  } catch {
    showToast('Erro de conexão ao atualizar usuário.', 'error');
  }
}

function openDeleteConfirm(user) {
  pendingDeleteUser = user;
  deleteUserLabel.textContent = `${user.nome ? `${user.nome} (${user.email})` : user.email}`;
  deleteDialog.showModal();
}

// Filtros e busca
filterChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    activeFilter = chip.dataset.filter || 'all';
    filterChips.forEach((c) => c.classList.toggle('active', c === chip));
    renderUsersTable();
  });
});

searchInput.addEventListener('input', () => {
  searchTerm = searchInput.value;
  renderUsersTable();
});

// Aprovar todos pendentes
approveAllBtn.addEventListener('click', async () => {
  approveAllBtn.disabled = true;
  try {
    const { ok, data } = await postJson('/api/admin/users/approve-all');
    if (!ok) {
      showToast(data.error || 'Erro ao aprovar pendentes.', 'error');
      return;
    }
    showToast(data.message);
    await fetchUsers();
  } catch {
    showToast('Erro de conexão ao aprovar pendentes.', 'error');
  } finally {
    approveAllBtn.disabled = false;
  }
});

// Logout
logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  await postJson('/api/auth/logout');
  window.location.assign('/auth/login');
});

// Modal: Novo usuário aprovado
setupDialogLightDismiss(createDialog);
bindPasswordToggle(
  document.getElementById('toggle-new-user-password'),
  newPasswordInput
);
newWhatsappInput.addEventListener('input', () => {
  newWhatsappInput.value = formatWhatsApp(newWhatsappInput.value);
});

const createValidator = initAccessibleForm(createForm, {
  nome(val) {
    if (!val.trim()) return 'Informe o nome.';
    if (val.trim().length < 2) return 'Informe pelo menos 2 caracteres.';
    return '';
  },
  password(val) {
    if (val && val.length < 6) return 'Use pelo menos 6 caracteres.';
    return '';
  },
});

openCreateBtn.addEventListener('click', () => {
  createForm.reset();
  createValidator.resetValidation();
  createError.hidden = true;
  createDialog.showModal();
});
closeCreateBtn.addEventListener('click', () => createDialog.close());
cancelCreateBtn.addEventListener('click', () => createDialog.close());

createForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  createError.hidden = true;
  if (!createValidator.validate()) return;

  const original = submitCreateBtn.textContent;
  submitCreateBtn.disabled = true;
  submitCreateBtn.textContent = 'Criando...';

  try {
    const { ok, data } = await postJson('/api/admin/users', {
      nome: document.getElementById('new-user-name').value.trim(),
      email: document.getElementById('new-user-email').value.trim(),
      whatsapp: newWhatsappInput.value.trim() || null,
      role: document.getElementById('new-user-role').value,
      password: newPasswordInput.value || '',
    });

    if (!ok) {
      createError.textContent = data.error || 'Erro ao criar usuário.';
      createError.hidden = false;
      return;
    }

    createDialog.close();
    showToast(data.message);
    await fetchUsers();
  } catch {
    createError.textContent = 'Erro de conexão ao criar usuário.';
    createError.hidden = false;
  } finally {
    submitCreateBtn.disabled = false;
    submitCreateBtn.textContent = original;
  }
});

// Modal: Excluir usuário
setupDialogLightDismiss(deleteDialog);
closeDeleteBtn.addEventListener('click', () => deleteDialog.close());
cancelDeleteBtn.addEventListener('click', () => deleteDialog.close());

confirmDeleteBtn.addEventListener('click', async () => {
  if (!pendingDeleteUser) return;
  const target = pendingDeleteUser;
  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = 'Excluindo...';

  try {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(target.id)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.error || 'Erro ao excluir usuário.', 'error');
      return;
    }
    deleteDialog.close();
    pendingDeleteUser = null;
    showToast('Usuário excluído.');
    await fetchUsers();
  } catch {
    showToast('Erro de conexão ao excluir usuário.', 'error');
  } finally {
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = 'Excluir definitivamente';
  }
});

// Modal: Base de Compradores
setupDialogLightDismiss(buyersDialog);

async function fetchBuyers() {
  buyersListEl.innerHTML =
    '<div style="font-size:12px;color:var(--text-dim);">Carregando compradores...</div>';
  try {
    const res = await fetch('/api/admin/buyers', { credentials: 'same-origin' });
    const { buyers = [] } = await res.json();
    buyersListEl.innerHTML = '';

    if (!buyers.length) {
      buyersListEl.innerHTML =
        '<div style="font-size:12.5px;color:var(--text-dim);padding:8px 0;">Nenhum comprador cadastrado ainda.</div>';
      return;
    }

    for (const b of buyers) {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border:1px solid var(--border-subtle);border-radius:10px;background:var(--bg-input);';

      const info = document.createElement('div');
      info.style.minWidth = '0';

      const emailSpan = document.createElement('div');
      emailSpan.style.cssText =
        'font-size:13px;font-weight:600;color:var(--text-main);overflow:hidden;text-overflow:ellipsis;';
      emailSpan.textContent = b.email;

      const metaSpan = document.createElement('div');
      metaSpan.style.cssText = 'font-size:11px;color:var(--text-dim);';
      metaSpan.textContent = b.redeemed_at
        ? `Primeiro acesso realizado em ${formatDateTimeBr(b.redeemed_at)}`
        : 'Aguardando primeiro acesso';

      info.append(emailSpan, metaSpan);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-table btn-table-delete';
      delBtn.textContent = 'Remover';
      delBtn.addEventListener('click', async () => {
        await fetch(`/api/admin/buyers/${encodeURIComponent(b.id)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        });
        showToast('Comprador removido.');
        fetchBuyers();
      });

      row.append(info, delBtn);
      buyersListEl.append(row);
    }
  } catch {
    buyersListEl.textContent = 'Erro ao carregar compradores.';
  }
}

openBuyersBtn.addEventListener('click', () => {
  buyersDialog.showModal();
  fetchBuyers();
});
closeBuyersBtn.addEventListener('click', () => buyersDialog.close());

buyersForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const raw = buyersEmailsInput.value.trim();
  if (!raw) return;

  saveBuyersBtn.disabled = true;
  saveBuyersBtn.textContent = 'Salvando...';
  try {
    const { ok, data } = await postJson('/api/admin/buyers', { email: raw });
    if (!ok) {
      showToast(data.error || 'Erro ao adicionar compradores.', 'error');
      return;
    }
    buyersEmailsInput.value = '';
    showToast(data.message);
    fetchBuyers();
  } catch {
    showToast('Erro de conexão ao salvar compradores.', 'error');
  } finally {
    saveBuyersBtn.disabled = false;
    saveBuyersBtn.textContent = 'Adicionar à base de compradores';
  }
});

// Inicialização
fetchUsers();


import { postJson, showToast } from '/shared/ui.js';

const emailEl = document.getElementById('pending-user-email');
const statusTextEl = document.getElementById('pending-status-text');
const headingEl = document.getElementById('pending-heading');
const subtitleEl = document.getElementById('pending-subtitle');
const helpEl = document.getElementById('pending-help-text');
const checkBtn = document.getElementById('btn-check-status');
const logoutBtn = document.getElementById('btn-pending-logout');

async function loadStatus() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (res.status === 401) {
      window.location.assign('/auth/login');
      return;
    }
    const { user } = await res.json();
    if (!user) return;

    emailEl.textContent = user.email;

    if (user.status === 'approved') {
      showToast('Acesso liberado! Redirecionando...');
      window.location.assign('/');
      return;
    }

    if (user.status === 'blocked') {
      statusTextEl.textContent = 'Acesso bloqueado';
      headingEl.innerHTML = 'Conta <span>bloqueada</span>';
      subtitleEl.textContent =
        'Sua conta ainda não foi aprovada ou foi bloqueada. Aguarde a liberação do administrador.';
      helpEl.textContent =
        'Se você acredita que houve um engano, entre em contato com o administrador da 3DSJ.';
    }
  } catch {
    showToast('Não foi possível verificar o status agora.', 'error');
  }
}

checkBtn.addEventListener('click', async () => {
  checkBtn.disabled = true;
  checkBtn.textContent = 'Verificando...';
  await loadStatus();
  checkBtn.disabled = false;
  checkBtn.textContent = '🔄 Verificar aprovação';
});

logoutBtn.addEventListener('click', async () => {
  logoutBtn.disabled = true;
  await postJson('/api/auth/logout');
  window.location.assign('/auth/login');
});

loadStatus();


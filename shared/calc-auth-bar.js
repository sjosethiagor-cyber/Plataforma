/**
 * Integração mínima da barra de acesso no cabeçalho da calculadora existente.
 */
async function initCalculatorAuthBar() {
  const emailEl = document.getElementById('nav-user-email');
  const adminLink = document.getElementById('nav-admin-link');
  const logoutBtn = document.getElementById('btn-logout');

  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (res.status === 401) {
      window.location.replace('/auth/login');
      return;
    }
    if (!res.ok) return;

    const { user } = await res.json();
    if (!user) {
      window.location.replace('/auth/login');
      return;
    }

    if (user.status !== 'approved') {
      window.location.replace('/auth/pending');
      return;
    }

    if (emailEl) {
      emailEl.textContent = user.email;
      emailEl.title = user.email;
      emailEl.hidden = false;
    }

    if (adminLink && user.role === 'admin') {
      adminLink.hidden = false;
    }

    if (logoutBtn) {
      logoutBtn.hidden = false;
      logoutBtn.addEventListener('click', async () => {
        logoutBtn.disabled = true;
        try {
          await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'same-origin',
          });
        } finally {
          window.location.assign('/auth/login');
        }
      });
    }
  } catch {
    // Em falha transitória de rede, mantém comportamento protegido pelo middleware HTTP
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCalculatorAuthBar);
} else {
  initCalculatorAuthBar();
}


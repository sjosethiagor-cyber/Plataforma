import { postJson } from '/shared/ui.js';

const heading = document.getElementById('callback-heading');
const subtitle = document.getElementById('callback-subtitle');
const errorBox = document.getElementById('callback-error');
const actions = document.getElementById('callback-actions');

function showExpiredError(msg) {
  heading.innerHTML = 'Link <span>inválido</span>';
  subtitle.textContent = 'Não foi possível validar o seu link de acesso.';
  errorBox.textContent =
    msg ||
    'Este link mágico expirou (validade de 15 minutos) ou já foi utilizado. Solicite um novo link na tela de login.';
  errorBox.hidden = false;
  actions.hidden = false;
}

async function processHashCallback() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('status') === 'expired') {
    showExpiredError();
    return;
  }

  const hash = window.location.hash.replace(/^#/, '');
  const hashParams = new URLSearchParams(hash);
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  const hashError = hashParams.get('error_description');

  if (hashError) {
    showExpiredError();
    return;
  }

  if (!accessToken || !refreshToken) {
    showExpiredError();
    return;
  }

  try {
    const { ok, data } = await postJson('/api/auth/session', {
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (!ok) {
      showExpiredError(data.error);
      return;
    }
    window.location.replace(data.redirectTo || '/');
  } catch {
    showExpiredError('Erro de conexão ao validar seu link. Tente novamente.');
  }
}

processHashCallback();


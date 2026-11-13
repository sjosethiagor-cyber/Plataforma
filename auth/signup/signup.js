import {
  bindPasswordToggle,
  formatWhatsApp,
  initAccessibleForm,
  postJson,
  showToast,
} from '/shared/ui.js';

const form = document.getElementById('signup-form');
const nameInput = document.getElementById('signup-name');
const emailInput = document.getElementById('signup-email');
const whatsappInput = document.getElementById('signup-whatsapp');
const passwordInput = document.getElementById('signup-password');
const submitBtn = document.getElementById('btn-signup');
const errorBox = document.getElementById('signup-error-box');
const successBox = document.getElementById('signup-success-box');
const successTitle = document.getElementById('signup-success-title');
const successSub = document.getElementById('signup-success-sub');

bindPasswordToggle(
  document.getElementById('toggle-signup-password'),
  passwordInput
);

whatsappInput.addEventListener('input', () => {
  whatsappInput.value = formatWhatsApp(whatsappInput.value);
});

const validator = initAccessibleForm(form, {
  nome(val) {
    if (!val.trim()) return 'Informe seu nome.';
    if (val.trim().length < 2) return 'Informe pelo menos 2 caracteres.';
    return '';
  },
  password(val) {
    if (val && val.length < 6) {
      return 'Se informar senha, use pelo menos 6 caracteres.';
    }
    return '';
  },
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.hidden = true;
  if (!validator.validate()) return;

  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Criando conta...';

  try {
    const { ok, data } = await postJson('/api/auth/signup', {
      nome: nameInput.value.trim(),
      email: emailInput.value.trim(),
      whatsapp: whatsappInput.value.trim() || null,
      password: passwordInput.value || '',
    });

    if (!ok) {
      const msg = data.error || 'Não foi possível criar a conta.';
      errorBox.textContent = msg;
      errorBox.hidden = false;
      showToast(msg, 'error');
      return;
    }

    form.hidden = true;
    successTitle.textContent = data.message;
    if (data.status === 'approved') {
      successSub.textContent =
        'Seu e-mail foi reconhecido como administrador principal e já está liberado para entrar.';
    }
    successBox.hidden = false;
    showToast('Cadastro enviado!');
  } catch {
    errorBox.textContent = 'Erro de conexão ao criar conta. Tente novamente.';
    errorBox.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
});


import {
  bindPasswordToggle,
  initAccessibleForm,
  postJson,
  setupDialogLightDismiss,
  showToast,
} from '/shared/ui.js';

const tabMagic = document.getElementById('tab-magic');
const tabPassword = document.getElementById('tab-password');
const panelMagic = document.getElementById('panel-magic');
const panelPassword = document.getElementById('panel-password');

const magicForm = document.getElementById('magic-form');
const magicEmail = document.getElementById('magic-email');
const magicBtn = document.getElementById('btn-send-magic');
const magicFeedback = document.getElementById('magic-feedback');

const passwordForm = document.getElementById('password-form');
const loginEmail = document.getElementById('login-email');
const loginPassword = document.getElementById('login-password');
const passwordBtn = document.getElementById('btn-password-login');
const passwordFeedback = document.getElementById('password-feedback');

const firstAccessBtn = document.getElementById('btn-open-first-access');
const firstAccessDialog = document.getElementById('first-access-dialog');
const closeFirstAccessBtn = document.getElementById('close-first-access');
const cancelFirstAccessBtn = document.getElementById('cancel-first-access');
const firstAccessForm = document.getElementById('first-access-form');
const buyerEmailInput = document.getElementById('buyer-email');
const submitFirstAccessBtn = document.getElementById('btn-submit-first-access');
const firstAccessFeedback = document.getElementById('first-access-feedback');

// Alternância de abas (Link mágico / Email e senha)
function activateTab(mode) {
  const isMagic = mode === 'magic';
  tabMagic.setAttribute('aria-selected', String(isMagic));
  tabPassword.setAttribute('aria-selected', String(!isMagic));
  tabMagic.tabIndex = isMagic ? 0 : -1;
  tabPassword.tabIndex = isMagic ? -1 : 0;

  panelMagic.hidden = !isMagic;
  panelPassword.hidden = isMagic;

  if (isMagic && loginEmail.value && !magicEmail.value) {
    magicEmail.value = loginEmail.value;
  } else if (!isMagic && magicEmail.value && !loginEmail.value) {
    loginEmail.value = magicEmail.value;
  }
}

tabMagic.addEventListener('click', () => activateTab('magic'));
tabPassword.addEventListener('click', () => activateTab('password'));

[tabMagic, tabPassword].forEach((tab) => {
  tab.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = e.currentTarget === tabMagic ? 'password' : 'magic';
      activateTab(next);
      (next === 'magic' ? tabMagic : tabPassword).focus();
    }
  });
});

// Toggle de senha
bindPasswordToggle(
  document.getElementById('toggle-login-password'),
  loginPassword
);

// Validação acessível dos formulários
const magicValidator = initAccessibleForm(magicForm);
const passwordValidator = initAccessibleForm(passwordForm);
const buyerValidator = initAccessibleForm(firstAccessForm);

function setFeedback(box, message, type) {
  if (!box) return;
  box.hidden = !message;
  box.className = `alert-box ${
    type === 'success'
      ? 'alert-success'
      : type === 'info'
        ? 'alert-info'
        : 'alert-error'
  }`;
  box.textContent = message || '';
}

// Verifica mensagens de redirecionamento na URL (?error=...)
const params = new URLSearchParams(window.location.search);
if (params.get('error') === 'link_expirado') {
  setFeedback(
    magicFeedback,
    'Este link mágico expirou (validade de 15 minutos) ou já foi utilizado. Solicite um novo link abaixo.',
    'error'
  );
}

// Envio de Link Mágico
magicForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setFeedback(magicFeedback, '', 'error');
  if (!magicValidator.validate()) return;

  const originalText = magicBtn.textContent;
  magicBtn.disabled = true;
  magicBtn.textContent = 'Enviando link...';

  try {
    const { ok, data } = await postJson('/api/auth/magic-link', {
      email: magicEmail.value.trim(),
    });
    if (!ok) {
      const msg = data.error || 'Não foi possível enviar o link de acesso.';
      setFeedback(magicFeedback, msg, 'error');
      showToast(msg, 'error');
      return;
    }

    setFeedback(magicFeedback, data.message, 'success');
    showToast('Link de acesso enviado para o seu e-mail!');
  } catch {
    setFeedback(
      magicFeedback,
      'Erro de conexão ao enviar o link. Tente novamente.',
      'error'
    );
  } finally {
    magicBtn.disabled = false;
    magicBtn.textContent = originalText;
  }
});

// Login com Email e Senha
passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setFeedback(passwordFeedback, '', 'error');
  if (!passwordValidator.validate()) return;

  const originalText = passwordBtn.textContent;
  passwordBtn.disabled = true;
  passwordBtn.textContent = 'Entrando...';

  try {
    const { ok, data } = await postJson('/api/auth/login', {
      email: loginEmail.value.trim(),
      password: loginPassword.value,
    });

    if (!ok) {
      const msg = data.error || 'Não foi possível entrar.';
      setFeedback(passwordFeedback, msg, 'error');
      showToast(msg, 'error');
      return;
    }

    showToast('Login realizado! Abrindo calculadora...');
    window.location.assign(data.redirectTo || '/');
  } catch {
    setFeedback(
      passwordFeedback,
      'Erro de conexão ao entrar. Tente novamente.',
      'error'
    );
  } finally {
    passwordBtn.disabled = false;
    passwordBtn.textContent = originalText;
  }
});

// Dialog: Primeiro Acesso do Comprador
setupDialogLightDismiss(firstAccessDialog);

firstAccessBtn.addEventListener('click', () => {
  setFeedback(firstAccessFeedback, '', 'info');
  buyerValidator.resetValidation();
  if (magicEmail.value && !buyerEmailInput.value) {
    buyerEmailInput.value = magicEmail.value;
  }
  firstAccessDialog.showModal();
});

closeFirstAccessBtn.addEventListener('click', () => firstAccessDialog.close());
cancelFirstAccessBtn.addEventListener('click', () => firstAccessDialog.close());

firstAccessForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  setFeedback(firstAccessFeedback, '', 'error');
  if (!buyerValidator.validate()) return;

  const originalText = submitFirstAccessBtn.textContent;
  submitFirstAccessBtn.disabled = true;
  submitFirstAccessBtn.textContent = 'Validando compra...';

  try {
    const { ok, data } = await postJson('/api/auth/first-access', {
      email: buyerEmailInput.value.trim(),
    });

    if (!ok) {
      const msg = data.error || 'Não foi possível liberar o primeiro acesso.';
      setFeedback(firstAccessFeedback, msg, 'error');
      showToast(msg, 'error');
      return;
    }

    setFeedback(firstAccessFeedback, data.message, 'success');
    showToast('Primeiro acesso liberado! Confira seu e-mail.');
  } catch {
    setFeedback(
      firstAccessFeedback,
      'Erro de conexão ao validar compra. Tente novamente.',
      'error'
    );
  } finally {
    submitFirstAccessBtn.disabled = false;
    submitFirstAccessBtn.textContent = originalText;
  }
});

// Animação discreta de impressão 3D camada por camada (40 camadas, Z 0.20mm -> 8.00mm)
function initPrinterAnimation() {
  const layersGroup = document.getElementById('printer-layers-group');
  const nozzleGroup = document.getElementById('printer-nozzle-group');
  const layerLabel = document.getElementById('printer-layer-label');
  const progressFill = document.getElementById('printer-progress-fill');
  if (!layersGroup || !nozzleGroup || !layerLabel || !progressFill) return;

  const TOTAL_LAYERS = 40;
  const BASE_Y = 314;
  const LAYER_H = 5.4;
  const CX = 260;

  // Gera silhueta estilo peça circular/anel técnico 3D (inspirada na referência visual)
  const layerData = [];
  for (let i = 0; i < TOTAL_LAYERS; i++) {
    const t = i / (TOTAL_LAYERS - 1); // 0 -> 1
    const y = BASE_Y - i * LAYER_H;
    // Perfil suave de peça circular com base chanfrada e furo central
    const dy = (t - 0.5) * 2; // -1 .. 1
    const outerRadius = 96 * Math.sqrt(Math.max(0.18, 1 - dy * dy * 0.86));
    const innerRadius = Math.abs(dy) < 0.56 ? 48 * Math.sqrt(Math.max(0, 1 - (dy / 0.56) ** 2)) : 0;

    layerData.push({
      y,
      outerRadius,
      innerRadius,
    });
  }

  const svgNS = 'http://www.w3.org/2000/svg';
  const layerEls = layerData.map((d) => {
    const g = document.createElementNS(svgNS, 'g');
    const thickness = 4.5;

    if (d.innerRadius > 4) {
      // Anel dividido (esquerda e direita) criando vazado central 3D
      const leftRect = document.createElementNS(svgNS, 'rect');
      const leftW = d.outerRadius - d.innerRadius;
      leftRect.setAttribute('x', (CX - d.outerRadius).toFixed(1));
      leftRect.setAttribute('y', (d.y - thickness).toFixed(1));
      leftRect.setAttribute('width', leftW.toFixed(1));
      leftRect.setAttribute('height', String(thickness));
      leftRect.setAttribute('rx', '1.4');

      const rightRect = document.createElementNS(svgNS, 'rect');
      rightRect.setAttribute('x', (CX + d.innerRadius).toFixed(1));
      rightRect.setAttribute('y', (d.y - thickness).toFixed(1));
      rightRect.setAttribute('width', leftW.toFixed(1));
      rightRect.setAttribute('height', String(thickness));
      rightRect.setAttribute('rx', '1.4');

      g.append(leftRect, rightRect);
    } else {
      const fullRect = document.createElementNS(svgNS, 'rect');
      fullRect.setAttribute('x', (CX - d.outerRadius).toFixed(1));
      fullRect.setAttribute('y', (d.y - thickness).toFixed(1));
      fullRect.setAttribute('width', (d.outerRadius * 2).toFixed(1));
      fullRect.setAttribute('height', String(thickness));
      fullRect.setAttribute('rx', '1.5');
      g.append(fullRect);
    }

    layersGroup.append(g);
    return { g, ...d };
  });

  function renderFrame(activeCount, phase) {
    layerEls.forEach((item, idx) => {
      const visible = idx < activeCount;
      const isCurrent = idx === activeCount - 1;
      item.g.style.display = visible ? '' : 'none';
      if (visible) {
        const fill = isCurrent ? 'url(#activeLayerGrad)' : 'url(#layerShade)';
        const stroke = isCurrent ? '#7ff5c5' : '#314155';
        for (const rect of item.g.children) {
          rect.setAttribute('fill', fill);
          rect.setAttribute('stroke', stroke);
          rect.setAttribute('stroke-width', isCurrent ? '0.9' : '0.45');
        }
      }
    });

    const currentLayer = layerEls[Math.max(0, activeCount - 1)];
    const sweep = Math.sin(phase) * (currentLayer.outerRadius * 0.65);
    const nozzleX = CX + sweep;
    const nozzleY = currentLayer.y - 16;
    nozzleGroup.setAttribute('transform', `translate(${nozzleX.toFixed(1)}, ${nozzleY.toFixed(1)})`);

    const zMm = (activeCount * 0.2).toFixed(2);
    const padded = String(activeCount).padStart(2, '0');
    layerLabel.textContent = `CAMADA ${padded}/${TOTAL_LAYERS} · Z ${zMm}MM`;
    progressFill.style.transform = `scaleX(${activeCount / TOTAL_LAYERS})`;
  }

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion) {
    renderFrame(TOTAL_LAYERS, 0);
    return;
  }

  let current = 1;
  let phase = 0;
  let lastStep = performance.now();
  let holdUntil = 0;

  function tick(now) {
    phase += 0.09;
    if (now > holdUntil && now - lastStep >= 115) {
      lastStep = now;
      if (current < TOTAL_LAYERS) {
        current += 1;
      } else {
        holdUntil = now + 2200;
        current = 1;
      }
    }
    renderFrame(current, phase);
    requestAnimationFrame(tick);
  }

  renderFrame(TOTAL_LAYERS, 0);
  requestAnimationFrame(tick);
}

initPrinterAnimation();


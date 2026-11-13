/**
 * Utilitários compartilhados de UI, acessibilidade de formulários,
 * toasts e diálogos para a camada de acesso 3DSJ Precificadora.
 */

let liveAnnouncer = null;
let announceTimer = null;
let announcedField = null;

function getAnnouncer() {
  if (liveAnnouncer) return liveAnnouncer;
  liveAnnouncer = document.createElement('div');
  liveAnnouncer.setAttribute('aria-live', 'polite');
  liveAnnouncer.className = 'visually-hidden';
  document.body.append(liveAnnouncer);
  return liveAnnouncer;
}

function linkError(el, shown) {
  const errorId = el.dataset.error;
  if (!errorId) return;
  const ids = (el.getAttribute('aria-describedby') || '')
    .split(/\s+/)
    .filter((id) => id && id !== errorId);
  if (shown) ids.push(errorId);
  if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
  else el.removeAttribute('aria-describedby');

  const errorEl = document.getElementById(errorId);
  if (errorEl) {
    errorEl.classList.toggle('visible', shown);
  }
}

/**
 * Sincroniza estados `:user-invalid` / fallback com `aria-invalid` e `aria-describedby`.
 */
export function initAccessibleForm(form, customValidators = {}) {
  if (!form) return;
  const announcer = getAnnouncer();
  const supportsUserInvalid =
    typeof CSS !== 'undefined' && CSS.supports?.('selector(:user-invalid)');
  const dirtyMap = new WeakMap();
  const flagged = new WeakSet();
  const announced = new WeakSet();

  const applyCustomValidity = (el) => {
    const validator = customValidators[el.name] || customValidators[el.id];
    if (typeof validator === 'function') {
      const msg = validator(el.value, el);
      el.setCustomValidity(msg || '');
    } else if (el.validity.valueMissing) {
      el.setCustomValidity('Preencha este campo obrigatório.');
    } else if (el.validity.typeMismatch && el.type === 'email') {
      el.setCustomValidity('Informe um endereço de e-mail válido.');
    } else if (el.validity.tooShort) {
      el.setCustomValidity(
        `Informe pelo menos ${el.minLength} caracteres.`
      );
    } else {
      el.setCustomValidity('');
    }
  };

  const announceFieldError = (el) => {
    const errorEl = document.getElementById(el.dataset.error || '');
    if (!errorEl) return;
    const labelEl = el.labels?.[0];
    const labelPrefix = labelEl ? `${labelEl.textContent.trim()}: ` : '';
    clearTimeout(announceTimer);
    announcer.textContent = '';
    announcedField = el;
    announceTimer = setTimeout(() => {
      announcer.textContent = `${labelPrefix}${errorEl.textContent.trim()}`;
    }, 500);
  };

  const syncControl = (el, announce = false) => {
    if (!el.matches?.('input, select, textarea')) return;
    applyCustomValidity(el);

    let invalid = false;
    if (supportsUserInvalid) {
      invalid = el.matches(':user-invalid');
    } else {
      const state = dirtyMap.get(el);
      invalid = Boolean(state?.hasBlurred && state?.hasInteracted && !el.validity.valid);
      el.classList.toggle('user-invalid-fallback', invalid);
    }

    const errorEl = document.getElementById(el.dataset.error || '');
    if (errorEl && invalid) {
      errorEl.textContent = el.validationMessage;
    }

    if (invalid) {
      if (announce && !announced.has(el)) {
        announceFieldError(el);
        announced.add(el);
      }
      el.setAttribute('aria-invalid', 'true');
      linkError(el, true);
      flagged.add(el);
    } else if (flagged.has(el) || el.getAttribute('aria-invalid') !== 'true') {
      el.setAttribute('aria-invalid', 'false');
      linkError(el, false);
      flagged.delete(el);
      announced.delete(el);
      if (announcedField === el) {
        clearTimeout(announceTimer);
        announcer.textContent = '';
      }
    }
  };

  form.querySelectorAll('input, select, textarea').forEach((el) => {
    el.setAttribute('aria-invalid', 'false');
  });

  form.addEventListener(
    'blur',
    (e) => {
      const el = e.target;
      if (!el.matches?.('input, select, textarea')) return;
      const state = dirtyMap.get(el) || { hasInteracted: false, hasBlurred: false };
      state.hasBlurred = true;
      if (el.value.trim().length > 0) state.hasInteracted = true;
      dirtyMap.set(el, state);
      syncControl(el, true);
    },
    true
  );

  form.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.matches?.('input, select, textarea')) return;
    const state = dirtyMap.get(el) || { hasInteracted: false, hasBlurred: false };
    state.hasInteracted = true;
    dirtyMap.set(el, state);
    el.setCustomValidity('');
    if (el.getAttribute('aria-invalid') === 'true') {
      syncControl(el, false);
    }
  });

  return {
    validate() {
      const controls = [...form.querySelectorAll('input, select, textarea')];
      let firstInvalid = null;
      for (const el of controls) {
        dirtyMap.set(el, { hasInteracted: true, hasBlurred: true });
        applyCustomValidity(el);
        const isInvalid = !el.validity.valid;
        if (!supportsUserInvalid) {
          el.classList.toggle('user-invalid-fallback', isInvalid);
        }
        const errorEl = document.getElementById(el.dataset.error || '');
        if (errorEl && isInvalid) {
          errorEl.textContent = el.validationMessage;
        }
        el.setAttribute('aria-invalid', isInvalid ? 'true' : 'false');
        linkError(el, isInvalid);
        if (isInvalid) {
          flagged.add(el);
          if (!firstInvalid) firstInvalid = el;
        } else {
          flagged.delete(el);
        }
      }
      if (firstInvalid) {
        firstInvalid.focus();
        return false;
      }
      return true;
    },
    resetValidation() {
      form.querySelectorAll('input, select, textarea').forEach((el) => {
        el.setCustomValidity('');
        el.setAttribute('aria-invalid', 'false');
        el.classList.remove('user-invalid-fallback');
        linkError(el, false);
        flagged.delete(el);
        announced.delete(el);
      });
    },
  };
}

/**
 * Configura alternância acessível de mostrar/ocultar senha.
 */
export function bindPasswordToggle(toggleBtn, inputEl) {
  if (!toggleBtn || !inputEl) return;
  const eyeOpen = toggleBtn.querySelector('[data-eye="open"]');
  const eyeClosed = toggleBtn.querySelector('[data-eye="closed"]');

  toggleBtn.addEventListener('click', () => {
    const willShow = inputEl.type === 'password';
    inputEl.type = willShow ? 'text' : 'password';
    toggleBtn.setAttribute('aria-pressed', String(willShow));
    toggleBtn.setAttribute(
      'aria-label',
      willShow ? 'Ocultar senha' : 'Mostrar senha'
    );
    if (eyeOpen && eyeClosed) {
      eyeOpen.hidden = willShow;
      eyeClosed.hidden = !willShow;
    }
  });
}

/**
 * Exibe notificação toast acessível no canto inferior direito.
 */
export function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Notificações');
    document.body.append(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast-item ${
    type === 'error' ? 'toast-error' : type === 'info' ? 'toast-info' : ''
  }`;
  toast.setAttribute('role', 'status');

  const textSpan = document.createElement('span');
  textSpan.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Fechar notificação');
  closeBtn.textContent = '✕';

  const removeToast = () => {
    toast.remove();
  };
  closeBtn.addEventListener('click', removeToast);

  toast.append(textSpan, closeBtn);
  container.append(toast);

  const announcer = getAnnouncer();
  announcer.textContent = message;

  let timer = setTimeout(() => {
    if (!toast.contains(document.activeElement)) {
      removeToast();
    }
  }, 4500);

  toast.addEventListener('focusin', () => clearTimeout(timer));
  toast.addEventListener('focusout', () => {
    timer = setTimeout(removeToast, 2500);
  });
}

/**
 * Fallback de light-dismiss para `<dialog closedby="any">` em navegadores sem suporte.
 */
export function setupDialogLightDismiss(dialog) {
  if (!dialog) return;
  dialog.addEventListener('close', () => {
    dialog.returnValue = '';
  });

  if ('closedBy' in HTMLDialogElement.prototype) return;
  if (dialog.getAttribute('closedby') !== 'any') return;

  let pressedOutside = false;
  const isOutside = (e) => {
    const r = dialog.getBoundingClientRect();
    return (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    );
  };
  dialog.addEventListener('pointerdown', (e) => {
    pressedOutside = isOutside(e);
  });
  dialog.addEventListener('pointerup', (e) => {
    if (pressedOutside && isOutside(e)) dialog.close();
  });
}

export function formatWhatsApp(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function formatDateTimeBr(iso) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export async function postJson(url, body = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}


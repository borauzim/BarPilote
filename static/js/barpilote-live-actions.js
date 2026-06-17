(() => {
  function csrfToken(form) {
    const field = form && form.querySelector('input[name="csrfmiddlewaretoken"]');
    if (field && field.value) return field.value;
    const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function toArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  function applyTextUpdates(updates) {
    if (!updates) return;
    Object.entries(updates).forEach(([selector, text]) => {
      document.querySelectorAll(selector).forEach((node) => {
        node.textContent = text;
      });
    });
  }

  function applyHtmlUpdates(updates) {
    if (!updates) return;
    Object.entries(updates).forEach(([selector, html]) => {
      document.querySelectorAll(selector).forEach((node) => {
        node.innerHTML = html;
      });
    });
  }

  function applyValueUpdates(updates) {
    if (!updates) return;
    Object.entries(updates).forEach(([selector, value]) => {
      document.querySelectorAll(selector).forEach((node) => {
        node.value = value;
      });
    });
  }

  function removeTargets(targets) {
    toArray(targets).forEach((selector) => {
      document.querySelectorAll(selector).forEach((node) => node.remove());
    });
  }

  function refreshCurrency(payload) {
    if (!window.BarPiloteCurrency) return;
    if (payload && payload.exchange_rate) {
      window.BARPILOTE_EXCHANGE_RATE = Number(payload.exchange_rate) || window.BARPILOTE_EXCHANGE_RATE || 2800;
    }
    const nextCurrency = payload && payload.currency ? payload.currency : window.BarPiloteCurrency.getStoredCurrency();
    window.BarPiloteCurrency.applyCurrency(nextCurrency);
  }

  function flashMessage(message) {
    if (!message) return;
    let toast = document.getElementById('barpilote-live-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'barpilote-live-toast';
      toast.className = 'fixed left-1/2 top-4 z-[9999] -translate-x-1/2 rounded-2xl bg-neutral-950 px-4 py-3 text-sm font-black text-white shadow-2xl transition-opacity';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(window.__barpiloteToastTimer);
    window.__barpiloteToastTimer = setTimeout(() => {
      toast.style.opacity = '0';
    }, 2200);
  }

  async function submitLiveForm(form) {
    const method = (form.method || 'POST').toUpperCase();
    const url = form.getAttribute('action') || window.location.href;
    const formData = new FormData(form);
    const response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json',
        'X-CSRFToken': csrfToken(form),
      },
      body: formData,
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : { error: await response.text() };
    if (!response.ok) {
      const error = payload.error || payload.detail || 'Action impossible.';
      flashMessage(typeof error === 'string' ? error.slice(0, 180) : 'Action impossible.');
      throw new Error(typeof error === 'string' ? error : 'Action impossible.');
    }
    return payload;
  }

  async function handleLiveSubmit(event) {
    const form = event.target.closest('form[data-live-action]');
    if (!form || !form.contains(event.target)) return;
    event.preventDefault();

    const submitter = event.submitter || form.querySelector('[type="submit"]');
    if (submitter) submitter.disabled = true;

    try {
      const payload = await submitLiveForm(form);
      if (payload.message) flashMessage(payload.message);
      removeTargets(payload.remove_selectors || payload.remove_selector);
      applyTextUpdates(payload.text_updates);
      applyHtmlUpdates(payload.html_updates);
      applyValueUpdates(payload.value_updates);
      refreshCurrency(payload);
      if (payload.dispatch_event) {
        window.dispatchEvent(new CustomEvent(payload.dispatch_event.type, { detail: payload.dispatch_event.detail || {} }));
      }
      if (payload.redirect_url) {
        window.location.assign(payload.redirect_url);
        return;
      }
      window.dispatchEvent(new CustomEvent('barpilote:live-action', { detail: payload }));
    } catch (error) {
      console.warn('Live action failed:', error);
    } finally {
      if (submitter) submitter.disabled = false;
    }
  }

  document.addEventListener('submit', handleLiveSubmit, true);
  window.BarPiloteLiveActions = {
    submitLiveForm,
    removeTargets,
    applyTextUpdates,
    applyHtmlUpdates,
    applyValueUpdates,
    refreshCurrency,
  };
})();

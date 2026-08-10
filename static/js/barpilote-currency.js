(function () {
  const CHANNEL_NAME = 'barpilote-currency';
  const DEFAULT_KEY = 'barpilote_currency_global';
  let channel = null;

  function normalizeCurrency(value) {
    return value === 'CDF' ? 'CDF' : 'USD';
  }

  function getStorageKey() {
    return window.BARPILOTE_CURRENCY_KEY || DEFAULT_KEY;
  }

  function getStoredCurrency() {
    try {
      return normalizeCurrency(localStorage.getItem(getStorageKey()) || window.BARPILOTE_INITIAL_CURRENCY || 'USD');
    } catch (error) {
      return normalizeCurrency(window.BARPILOTE_INITIAL_CURRENCY || 'USD');
    }
  }

  function setStoredCurrency(currency) {
    try {
      localStorage.setItem(getStorageKey(), normalizeCurrency(currency));
    } catch (error) {}
  }

  function getExchangeRate() {
    const fromWindow = Number(window.BARPILOTE_EXCHANGE_RATE || 0);
    if (fromWindow > 0) return fromWindow;
    const fromMeta = Number(document.body?.dataset?.exchangeRate || 0);
    return fromMeta > 0 ? fromMeta : 2800;
  }

  function formatAmount(value, currency) {
    const amount = Number(value || 0);
    if (currency === 'CDF') {
      return `${Math.round(amount).toLocaleString('fr-FR')} FC`;
    }
    return `${amount.toFixed(2)} $`;
  }

  function convertAmount(amount, sourceCurrency, targetCurrency, rate) {
    const value = Number(amount || 0);
    const source = normalizeCurrency(sourceCurrency);
    const target = normalizeCurrency(targetCurrency);
    const exchangeRate = Number(rate || getExchangeRate()) || 2800;
    if (source === target) return value;
    if (source === 'USD' && target === 'CDF') return value * exchangeRate;
    if (source === 'CDF' && target === 'USD') return value / exchangeRate;
    return value;
  }

  function updateToggle(currency) {
    const circle = document.getElementById('toggleCircle');
    const labelUSD = document.getElementById('labelUSD');
    const labelCDF = document.getElementById('labelCDF');
    if (!circle || !labelUSD || !labelCDF) return;
    const isUSD = normalizeCurrency(currency) === 'USD';
    circle.classList.toggle('left-1', isUSD);
    circle.classList.toggle('left-5', !isUSD);
    labelUSD.classList.toggle('text-orange-600', isUSD);
    labelUSD.classList.toggle('text-gray-400', !isUSD);
    labelCDF.classList.toggle('text-orange-600', !isUSD);
    labelCDF.classList.toggle('text-gray-400', isUSD);
    labelUSD.classList.toggle('text-orange-300', isUSD);
    labelUSD.classList.toggle('text-white/45', !isUSD);
    labelCDF.classList.toggle('text-orange-300', !isUSD);
    labelCDF.classList.toggle('text-white/45', isUSD);
  }

  function renderMoneyElement(element, currency) {
    const kind = element.dataset.bpKind;
    const rate = Number(element.dataset.bpRate || getExchangeRate()) || 2800;
    const targetCurrency = normalizeCurrency(currency);

    if (kind === 'display_price') {
      const amountUsd = Number(element.dataset.bpAmountUsd || 0);
      const amountCdf = Number(element.dataset.bpAmountCdf || 0);
      const value = targetCurrency === 'USD'
        ? amountUsd + (amountCdf / rate)
        : amountCdf + (amountUsd * rate);
      element.textContent = formatAmount(value, targetCurrency);
      return;
    }

    if (kind === 'money_amount' || kind === 'usd_amount') {
      const amount = Number(element.dataset.bpAmount || 0);
      const sourceCurrency = element.dataset.bpCurrency || 'USD';
      const quantity = Number(element.dataset.bpQuantity || 1);
      const value = convertAmount(amount * quantity, sourceCurrency, targetCurrency, rate);
      element.textContent = formatAmount(value, targetCurrency);
      return;
    }

    if (kind === 'order_total') {
      const amountUsd = Number(element.dataset.bpAmountUsd || 0);
      const amountCdf = Number(element.dataset.bpAmountCdf || 0);
      const value = targetCurrency === 'USD'
        ? amountUsd + (amountCdf / rate)
        : amountCdf + (amountUsd * rate);
      element.textContent = formatAmount(value, targetCurrency);
    }
  }

  function applyCurrency(currency) {
    const next = normalizeCurrency(currency || getStoredCurrency());
    document.querySelectorAll('.bp-money').forEach((element) => renderMoneyElement(element, next));
    updateToggle(next);
    window.__barpiloteCurrency = next;
    return next;
  }

  function broadcastCurrency(currency) {
    const next = normalizeCurrency(currency);
    if (channel) {
      channel.postMessage({ currency: next, key: getStorageKey() });
    }
    window.dispatchEvent(new CustomEvent('barpilote:currency-changed', {
      detail: { currency: next, storageKey: getStorageKey() }
    }));
  }

  function setCurrency(currency, options) {
    const config = options || {};
    const next = normalizeCurrency(currency);
    if (config.persist !== false) {
      setStoredCurrency(next);
    }
    applyCurrency(next);
    if (config.broadcast !== false) {
      broadcastCurrency(next);
    }
    return next;
  }

  function toggleCurrency() {
    return setCurrency(getStoredCurrency() === 'USD' ? 'CDF' : 'USD');
  }

  function getCsrfToken() {
    const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function initChannel() {
    if (!('BroadcastChannel' in window)) return;
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener('message', (event) => {
      const payload = event.data || {};
      if (payload.key && payload.key !== getStorageKey()) return;
      const currency = normalizeCurrency(payload.currency);
      if (currency === window.__barpiloteCurrency) return;
      setCurrency(currency, { persist: true, broadcast: false });
    });
  }

  function initStorageListener() {
    window.addEventListener('storage', (event) => {
      if (event.key !== getStorageKey() || !event.newValue) return;
      const currency = normalizeCurrency(event.newValue);
      if (currency === window.__barpiloteCurrency) return;
      setCurrency(currency, { persist: false, broadcast: false });
    });
  }

  window.BarPiloteCurrency = {
    getCsrfToken,
    getStorageKey,
    getStoredCurrency,
    setCurrency,
    toggleCurrency,
    broadcastCurrency,
    applyCurrency
  };
  window.toggleCurrency = toggleCurrency;

  initChannel();
  initStorageListener();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyCurrency(getStoredCurrency()));
  } else {
    applyCurrency(getStoredCurrency());
  }
})();

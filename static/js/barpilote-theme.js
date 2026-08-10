(() => {
  function applyMode() {
    const rootEl = document.documentElement;
    rootEl.classList.remove('dark');
    rootEl.style.colorScheme = 'light';
    rootEl.dataset.theme = 'light';
    window.__barpiloteTheme = { mode: 'light', resolved: 'light' };
    window.dispatchEvent(new CustomEvent('barpilote:theme-changed', { detail: { mode: 'light', resolved: 'light' } }));
    return 'light';
  }

  function init() {
    applyMode();
  }

  function setMode() {
    return applyMode();
  }

  window.BarPiloteTheme = { applyMode, setMode };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
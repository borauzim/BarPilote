(() => {
  const STORAGE_KEY = 'barpilote_theme_mode';
  let mediaQuery = null;

  function getStoredMode() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === 'dark' || stored === 'light' ? stored : 'system';
    } catch (error) {
      return 'system';
    }
  }

  function getSystemDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function resolveMode(mode) {
    const value = mode === 'dark' || mode === 'light' ? mode : 'system';
    if (value === 'system') {
      return getSystemDark() ? 'dark' : 'light';
    }
    return value;
  }

  function applyMode(mode, options) {
    const config = options || {};
    const storedMode = mode === 'dark' || mode === 'light' ? mode : 'system';
    const resolved = resolveMode(storedMode);
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.style.colorScheme = resolved;
    root.dataset.theme = resolved;
    if (config.persist !== false) {
      try {
        localStorage.setItem(STORAGE_KEY, storedMode);
      } catch (error) {}
    }
    window.__barpiloteTheme = { mode: storedMode, resolved };
    window.dispatchEvent(new CustomEvent('barpilote:theme-changed', { detail: { mode: storedMode, resolved } }));
    return resolved;
  }

  function syncFromStorage() {
    applyMode(getStoredMode(), { persist: false });
  }

  function init() {
    const mode = getStoredMode();
    applyMode(mode, { persist: false });

    if (window.matchMedia) {
      mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => {
        if (getStoredMode() === 'system') {
          applyMode('system', { persist: false });
        }
      };
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', listener);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(listener);
      }
    }

    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY) {
        syncFromStorage();
      }
    });
  }

  function setMode(mode) {
    return applyMode(mode, { persist: true });
  }

  window.BarPiloteTheme = {
    getStoredMode,
    resolveMode,
    applyMode,
    setMode,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

(() => {
  const viewportDialogSelector = '[role="dialog"], [aria-modal="true"]';

  function installViewportDialogStyles() {
    if (document.getElementById('barpilote-viewport-dialog-styles')) return;
    const style = document.createElement('style');
    style.id = 'barpilote-viewport-dialog-styles';
    style.textContent = `
      .bp-viewport-dialog {
        position: fixed !important;
        inset: 0 !important;
        z-index: 10000 !important;
        width: 100vw !important;
        height: 100vh !important;
        height: 100dvh !important;
        margin: 0 !important;
        padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left)) !important;
        align-items: center !important;
        justify-content: center !important;
        overflow-x: hidden !important;
        overflow-y: auto !important;
        overscroll-behavior: contain;
      }
      .bp-viewport-dialog > * {
        max-height: calc(100dvh - max(2rem, env(safe-area-inset-top) + env(safe-area-inset-bottom))) !important;
        margin-block: auto !important;
        overflow-y: auto !important;
        overscroll-behavior: contain;
      }
      .bp-viewport-dialog.bp-viewport-panel {
        inset: 50% auto auto 50% !important;
        width: min(calc(100vw - 2rem), 48rem) !important;
        height: auto !important;
        max-height: calc(100dvh - 2rem) !important;
        padding: 1rem !important;
        transform: translate(-50%, -50%) !important;
        overflow-y: auto !important;
      }
      .bp-viewport-dialog.bp-viewport-panel:not(.sheet-open) { pointer-events: none !important; }
      .bp-viewport-dialog.bp-viewport-panel.sheet-open { opacity: 1 !important; pointer-events: auto !important; }
      html.bp-dialog-open, html.bp-dialog-open body { overflow: hidden !important; }
      @media (max-width: 640px) {
        .bp-viewport-dialog { padding: max(.75rem, env(safe-area-inset-top)) max(.75rem, env(safe-area-inset-right)) max(.75rem, env(safe-area-inset-bottom)) max(.75rem, env(safe-area-inset-left)) !important; }
        .bp-viewport-dialog > * { width: min(100%, 32rem) !important; border-radius: 16px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function portalViewportDialogs(root) {
    const dialogs = [];
    if (root instanceof Element && root.matches(viewportDialogSelector)) dialogs.push(root);
    if (root.querySelectorAll) dialogs.push(...root.querySelectorAll(viewportDialogSelector));
    dialogs.forEach((dialog) => {
      if (dialog.closest('#notif-menu, #notificationToast') || dialog.classList.contains('bp-global-order-alert-bubble')) return;
      dialog.classList.add('bp-viewport-dialog');
      if (!dialog.classList.contains('inset-0')) dialog.classList.add('bp-viewport-panel');
      if (dialog.parentElement !== document.body) document.body.appendChild(dialog);
    });
  }

  function syncDialogScrollLock() {
    const hasOpenDialog = Array.from(document.querySelectorAll('.bp-viewport-dialog')).some((dialog) => {
      if (dialog.id === 'identitySheet' && !dialog.classList.contains('sheet-open')) return false;
      if (dialog.classList.contains('pointer-events-none') && dialog.classList.contains('opacity-0')) return false;
      return !dialog.hidden && !dialog.classList.contains('hidden') && dialog.getAttribute('aria-hidden') !== 'true' && getComputedStyle(dialog).display !== 'none';
    });
    document.documentElement.classList.toggle('bp-dialog-open', hasOpenDialog);
  }

  function initViewportDialogs() {
    installViewportDialogStyles();
    portalViewportDialogs(document);
    syncDialogScrollLock();
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) portalViewportDialogs(node);
      }));
      syncDialogScrollLock();
    });
    observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'aria-hidden']});
  }

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
    initViewportDialogs();
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

(function () {
  'use strict';
  if (window.__barpiloteOwnerNavigationReady) return;
  window.__barpiloteOwnerNavigationReady = true;
  var controller = null, sequence = 0;

  function eligible(link, event) {
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (link.target || link.hasAttribute('download') || link.hasAttribute('data-no-pjax')) return false;
    var href = link.getAttribute('href') || '';
    if (!href || href[0] === '#' || /^(mailto:|tel:|javascript:)/i.test(href)) return false;
    var url;
    try { url = new URL(link.href, location.href); } catch (_) { return false; }
    return url.origin === location.origin && url.pathname.indexOf('/proprietaire/') === 0 && (url.pathname !== location.pathname || url.search !== location.search);
  }

  function headNodes(doc) {
    var start = doc.getElementById('bp-page-head-start'), end = doc.getElementById('bp-page-head-end'), nodes = [];
    if (!start || !end) return nodes;
    for (var node = start.nextSibling; node && node !== end; node = node.nextSibling) nodes.push(node);
    return nodes;
  }

  function replaceHead(next) {
    headNodes(document).forEach(function (node) { node.remove(); });
    var end = document.getElementById('bp-page-head-end');
    headNodes(next).forEach(function (node) { end.parentNode.insertBefore(document.importNode(node, true), end); });
  }

  function runScripts(root) {
    if (!root) return;
    root.querySelectorAll('script').forEach(function (old) {
      var script = document.createElement('script');
      Array.prototype.forEach.call(old.attributes, function (attr) { script.setAttribute(attr.name, attr.value); });
      script.textContent = old.textContent;
      old.replaceWith(script);
    });
  }

  function swap(next, selector, scripts) {
    var old = document.querySelector(selector), fresh = next.querySelector(selector);
    if (!old || !fresh) return false;
    var node = document.importNode(fresh, true);
    old.replaceWith(node);
    if (scripts) runScripts(node);
    return true;
  }

  function syncNavigation(next) {
    ['#main-header nav', '#mobile-nav'].forEach(function (selector) {
      var current = document.querySelector(selector), fresh = next.querySelector(selector);
      if (current && fresh) current.innerHTML = fresh.innerHTML;
    });
  }

  function commit(next, url, push) {
    var selectors = ['main', '#bp-page-extra-root'];
    if (!selectors.every(function (selector) { return next.querySelector(selector); })) return false;
    document.dispatchEvent(new CustomEvent('barpilote:before-navigation'));
    replaceHead(next);
    swap(next, 'main', true);
    swap(next, '#bp-page-extra-root', true);
    syncNavigation(next);
    document.title = next.title;
    if (push) history.pushState({ barpiloteOwner: true }, '', url.href);
    var anchor = url.hash ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
    if (anchor) anchor.scrollIntoView(); else scrollTo({ top: 0, left: 0, behavior: 'auto' });
    if (window.BarPiloteCurrency && window.BarPiloteCurrency.applyCurrency) window.BarPiloteCurrency.applyCurrency();
    if (window.loadNotifications) window.loadNotifications();
    document.dispatchEvent(new CustomEvent('barpilote:page-loaded', { detail: { url: url.href } }));
    return true;
  }

  function navigate(target, push) {
    var url = target instanceof URL ? target : new URL(target, location.href), id = ++sequence;
    if (controller) controller.abort();
    controller = new AbortController();
    document.documentElement.classList.add('bp-owner-navigating');
    fetch(url.href, { credentials: 'same-origin', signal: controller.signal, headers: { 'X-Requested-With': 'BarPilote-PJAX', 'Accept': 'text/html' } })
      .then(function (response) {
        if (!response.ok || !(response.headers.get('content-type') || '').includes('text/html')) throw new Error('Invalid response');
        return response.text();
      })
      .then(function (html) {
        if (id !== sequence) return;
        if (!commit(new DOMParser().parseFromString(html, 'text/html'), url, push)) throw new Error('Incompatible layout');
      })
      .catch(function (error) { if (error.name !== 'AbortError') location.assign(url.href); })
      .finally(function () { if (id === sequence) { controller = null; document.documentElement.classList.remove('bp-owner-navigating'); } });
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href]');
    if (link && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      var localUrl = new URL(link.href, location.href);
      if (localUrl.origin === location.origin && localUrl.pathname === location.pathname && localUrl.search === location.search && localUrl.hash) {
        var localAnchor = document.getElementById(decodeURIComponent(localUrl.hash.slice(1)));
        if (localAnchor) {
          event.preventDefault();
          history.pushState({barpiloteOwner: true}, '', localUrl.href);
          localAnchor.scrollIntoView({behavior: 'smooth', block: 'start'});
          return;
        }
      }
    }
    if (!eligible(link, event)) return;
    event.preventDefault();
    navigate(new URL(link.href, location.href), true);
  });
  addEventListener('popstate', function () { navigate(new URL(location.href), false); });
})();

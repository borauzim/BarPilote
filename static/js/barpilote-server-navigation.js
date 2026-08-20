(function () {
  'use strict';
  if (window.__barpiloteServerNavigationReady) return;
  window.__barpiloteServerNavigationReady = true;

  var controller = null;
  var sequence = 0;

  function eligible(link, event) {
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (link.target || link.hasAttribute('download') || link.hasAttribute('data-no-pjax')) return false;
    var href = link.getAttribute('href') || '';
    if (!href || href[0] === '#' || /^(mailto:|tel:|javascript:)/i.test(href)) return false;
    var url;
    try { url = new URL(link.href, location.href); } catch (_) { return false; }
    if (url.origin !== location.origin || url.pathname.indexOf('/serveur/') !== 0) return false;
    if (url.pathname.indexOf('/serveur/logout/') === 0 || url.pathname.indexOf('/serveur/join/') === 0) return false;
    return url.pathname !== location.pathname || url.search !== location.search || url.hash !== location.hash;
  }

  function pageHeadNodes(doc) {
    var start = doc.getElementById('bp-server-page-head-start');
    var end = doc.getElementById('bp-server-page-head-end');
    var nodes = [];
    if (!start || !end) return nodes;
    for (var node = start.nextSibling; node && node !== end; node = node.nextSibling) nodes.push(node);
    return nodes;
  }

  function replacePageHead(next) {
    pageHeadNodes(document).forEach(function (node) { node.remove(); });
    var end = document.getElementById('bp-server-page-head-end');
    pageHeadNodes(next).forEach(function (node) { end.parentNode.insertBefore(document.importNode(node, true), end); });
  }

  function runScripts(root) {
    if (!root) return;
    root.querySelectorAll('script').forEach(function (old) {
      var script = document.createElement('script');
      Array.prototype.forEach.call(old.attributes, function (attribute) { script.setAttribute(attribute.name, attribute.value); });
      script.textContent = old.textContent;
      old.replaceWith(script);
    });
  }

  function swap(next, selector, runPageScripts) {
    var current = document.querySelector(selector);
    var fresh = next.querySelector(selector);
    if (!current || !fresh) return false;
    var imported = document.importNode(fresh, true);
    current.replaceWith(imported);
    if (runPageScripts) runScripts(imported);
    return true;
  }

  function syncNavigation(next) {
    ['#main-header nav', '#mobile-nav'].forEach(function (selector) {
      var current = document.querySelector(selector);
      var fresh = next.querySelector(selector);
      if (current && fresh) current.innerHTML = fresh.innerHTML;
    });
  }

  function commit(next, url, push) {
    var selectors = ['main', '#bpServerPageExtraRoot'];
    if (!selectors.every(function (selector) { return next.querySelector(selector); })) return false;
    document.dispatchEvent(new CustomEvent('barpilote:before-navigation'));
    replacePageHead(next);
    swap(next, 'main', true);
    swap(next, '#bpServerPageExtraRoot', true);
    syncNavigation(next);
    document.title = next.title;
    if (push) history.pushState({barpiloteServer: true}, '', url.href);
    var anchor = url.hash ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
    if (anchor) anchor.scrollIntoView();
    else scrollTo({top: 0, left: 0, behavior: 'auto'});
    if (window.BarPiloteCurrency && window.BarPiloteCurrency.applyCurrency) window.BarPiloteCurrency.applyCurrency();
    if (window.loadNotifications) window.loadNotifications();
    document.dispatchEvent(new CustomEvent('barpilote:page-loaded', {detail: {url: url.href}}));
    return true;
  }

  function navigate(target, push) {
    var url = target instanceof URL ? target : new URL(target, location.href);
    var requestId = ++sequence;
    if (controller) controller.abort();
    controller = new AbortController();
    document.documentElement.classList.add('bp-server-navigating');
    fetch(url.href, {
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {'X-Requested-With': 'BarPilote-PJAX', 'Accept': 'text/html'}
    })
      .then(function (response) {
        if (!response.ok || !(response.headers.get('content-type') || '').includes('text/html')) throw new Error('Invalid response');
        return response.text();
      })
      .then(function (html) {
        if (requestId !== sequence) return;
        var next = new DOMParser().parseFromString(html, 'text/html');
        if (!commit(next, url, push)) throw new Error('Incompatible layout');
      })
      .catch(function (error) {
        if (error.name !== 'AbortError') location.assign(url.href);
      })
      .finally(function () {
        if (requestId === sequence) {
          controller = null;
          document.documentElement.classList.remove('bp-server-navigating');
        }
      });
  }

  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href]');
    if (link && !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      var localUrl = new URL(link.href, location.href);
      if (localUrl.origin === location.origin && localUrl.pathname === location.pathname && localUrl.search === location.search && localUrl.hash) {
        var localAnchor = document.getElementById(decodeURIComponent(localUrl.hash.slice(1)));
        if (localAnchor) {
          event.preventDefault();
          history.pushState({barpiloteServer: true}, '', localUrl.href);
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

(function () {
    if (!('serviceWorker' in navigator)) return;

    window.addEventListener('load', function () {
        navigator.serviceWorker.register('/barpilote-sw.js').catch(function () {});
    });
})();

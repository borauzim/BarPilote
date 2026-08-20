(function () {
    "use strict";
    let activeRequest = null;
    function rootFor(node) { return node && node.closest("[data-instant-filter-root]"); }
    function setStatus(root, loading) {
        const status = root && root.querySelector("[data-filter-status]");
        if (!status) return;
        status.classList.toggle("opacity-60", loading);
        status.innerHTML = loading
            ? "<span class=\"material-symbols-outlined animate-spin text-base\" aria-hidden=\"true\">progress_activity</span>Actualisation"
            : "<span class=\"material-symbols-outlined text-base\" aria-hidden=\"true\">bolt</span>Instantané";
    }
    async function update(root, url, pushState) {
        if (!root) return;
        if (activeRequest) activeRequest.abort();
        activeRequest = new AbortController();
        setStatus(root, true);
        root.setAttribute("aria-busy", "true");
        try {
            const response = await fetch(url, {headers: {"X-Requested-With": "XMLHttpRequest"}, signal: activeRequest.signal});
            if (!response.ok) throw new Error("filter-request-failed");
            const documentCopy = new DOMParser().parseFromString(await response.text(), "text/html");
            const replacement = documentCopy.querySelector("#" + CSS.escape(root.id));
            if (!replacement) throw new Error("filter-root-missing");
            root.replaceWith(replacement);
            if (pushState) window.history.pushState({instantFilter: true}, "", url);
            setStatus(replacement, false);
        } catch (error) {
            if (error.name === "AbortError") return;
            setStatus(root, false);
            root.removeAttribute("aria-busy");
            window.location.assign(url);
        }
    }
    function submitForm(form) {
        const params = new URLSearchParams(new FormData(form));
        const baseUrl = form.action || window.location.pathname;
        update(rootFor(form), params.toString() ? baseUrl + "?" + params.toString() : baseUrl, true);
    }
    document.addEventListener("change", function (event) {
        const form = event.target.closest("[data-instant-filter-form]");
        if (form) submitForm(form);
    });
    document.addEventListener("submit", function (event) {
        const form = event.target.closest("[data-instant-filter-form]");
        if (!form) return;
        event.preventDefault();
        submitForm(form);
    });
    document.addEventListener("click", function (event) {
        const link = event.target.closest("[data-instant-filter-root] a[href]");
        if (!link || link.origin !== window.location.origin) return;
        const root = rootFor(link);
        if (!root || (!link.closest("[aria-label=\"Pagination de l’historique\"]") && link.getAttribute("aria-label") !== "Réinitialiser les filtres")) return;
        event.preventDefault();
        update(root, link.href, true);
    });
    window.addEventListener("popstate", function () {
        const root = document.querySelector("[data-instant-filter-root]");
        if (root) update(root, window.location.href, false);
    });
})();

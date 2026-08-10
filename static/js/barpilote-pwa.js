(function () {
    const REJECT_KEY = 'barpilote_pwa_install_rejected_v1';
    // Le refus reste mémorisé sur cet appareil.
    let deferredInstallPrompt = null;
    let installPanel = null;

    function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    }

    function isIos() {
        return /iphone|ipad|ipod/i.test(window.navigator.userAgent) ||
            (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
    }

    function isIosSafari() {
        return isIos() && /safari/i.test(window.navigator.userAgent) &&
            !/crios|fxios|edgios|opios/i.test(window.navigator.userAgent);
    }

    function isAndroid() {
        return /android/i.test(window.navigator.userAgent);
    }

    function isSecureInstallContext() {
        return window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname);
    }

    function installationRejected() {
        try {
            return localStorage.getItem(REJECT_KEY) === 'true';
        } catch (error) {
            return false;
        }
    }

    function rejectInstallation() {
        try {
            localStorage.setItem(REJECT_KEY, 'true');
        } catch (error) {}
        if (installPanel) {
            installPanel.classList.remove('bp-pwa-install--visible');
            window.setTimeout(function () {
                installPanel && installPanel.remove();
                installPanel = null;
            }, 180);
        }
    }

    function createInstallPanel() {
        if (installPanel || isStandalone() || installationRejected()) return;

        const androidCopy = isAndroid();
        const iosCopy = isIos() && !deferredInstallPrompt;
        const localAndroidBlocked = androidCopy && !deferredInstallPrompt && !isSecureInstallContext();
        installPanel = document.createElement('section');
        installPanel.className = 'bp-pwa-install';
        installPanel.setAttribute('role', 'dialog');
        installPanel.setAttribute('aria-label', 'Installer BarPilote');
        const osLabel = isAndroid() ? 'Android' : isIos() ? 'iOS' : 'Navigateur';
        const buttonLabel = deferredInstallPrompt ? 'Installer' : isIos() ? 'Ajouter' : 'Comment installer';
        const helpText = isIos()
            ? (isIosSafari()
                ? "iPhone détecté : ajoutez BarPilote à votre écran d’accueil."
                : "Sur iPhone, ouvrez BarPilote dans Safari pour l’installer.")
            : localAndroidBlocked
                ? "Android detecte: ouvrez BarPilote sur localhost ou HTTPS pour telecharger l'application."
                : isAndroid()
                    ? "Android detecte: installez l'application BarPilote sur cet appareil."
                    : "Installez BarPilote depuis le menu de votre navigateur.";

        installPanel.innerHTML = `
            <style>
                .bp-pwa-install {
                    position: fixed;
                    left: 1rem;
                    right: 1rem;
                    bottom: 1rem;
                    z-index: 90;
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                    gap: .85rem;
                    align-items: center;
                    max-width: 30rem;
                    margin: 0 auto;
                    padding: .9rem;
                    border: 1px solid rgba(255, 94, 0, .2);
                    border-radius: 1.25rem;
                    background: rgba(255, 255, 255, .96);
                    color: #1a1c1d;
                    box-shadow: 0 22px 55px rgba(26, 28, 29, .16);
                    backdrop-filter: blur(18px);
                    opacity: 0;
                    transform: translateY(18px);
                    transition: opacity 180ms ease, transform 180ms ease;
                    font-family: Inter, system-ui, sans-serif;
                }
                .bp-pwa-install--visible { opacity: 1; transform: translateY(0); }
                .bp-pwa-install__icon {
                    display: grid;
                    place-items: center;
                    width: 2.85rem;
                    height: 2.85rem;
                    border-radius: 1rem;
                    background: transparent;
                    overflow: hidden;
                    border: 0;
                }
                .bp-pwa-install__icon img { width: 100%; height: 100%; object-fit: contain; padding: .25rem; }
                .bp-pwa-install__title {
                    margin: 0;
                    font-size: .9rem;
                    line-height: 1.2;
                    font-weight: 900;
                }
                .bp-pwa-install__os {
                    display: inline-flex;
                    margin: .2rem 0 0;
                    padding: .16rem .45rem;
                    border-radius: 999px;
                    background: #fff1e8;
                    color: #a63b00;
                    font-size: .62rem;
                    line-height: 1;
                    font-weight: 900;
                    text-transform: uppercase;
                }
                .bp-pwa-install__text {
                    margin: .35rem 0 0;
                    color: #5b4137;
                    font-size: .75rem;
                    line-height: 1.35;
                    font-weight: 700;
                }
                .bp-pwa-install__actions {
                    display: flex;
                    align-items: center;
                    gap: .4rem;
                }
                .bp-pwa-install__button {
                    min-height: 2.5rem;
                    border: 0;
                    border-radius: 999px;
                    padding: 0 .95rem;
                    background: #ff5e00;
                    color: #fff;
                    font-size: .72rem;
                    font-weight: 900;
                    text-transform: uppercase;
                    cursor: pointer;
                }
                .bp-pwa-install__close {
                    position: absolute;
                    top: .45rem;
                    right: .45rem;
                    display: grid;
                    place-items: center;
                    width: 2rem;
                    height: 2rem;
                    border: 0;
                    border-radius: 999px;
                    background: #f3f3f5;
                    color: #5b4137;
                    font-size: 1.35rem;
                    line-height: 1;
                    font-weight: 800;
                    cursor: pointer;
                }
                .bp-pwa-install__close:hover,
                .bp-pwa-install__close:focus-visible {
                    background: #e5e5e8;
                    color: #1a1c1d;
                }
                @media (max-width: 420px) {
                    .bp-pwa-install {
                        grid-template-columns: auto 1fr;
                        bottom: .75rem;
                    }
                    .bp-pwa-install__actions {
                        grid-column: 1 / -1;
                        justify-content: flex-end;
                    }
                }
            </style>
            <div class="bp-pwa-install__icon">
                <img src="/static/barpilote_icon_transparent_512.png?v=5" alt="BarPilote">
            </div>
            <div>
                <p class="bp-pwa-install__title">Installer BarPilote</p>
                <span class="bp-pwa-install__os">${osLabel}</span>
                <p class="bp-pwa-install__text">${helpText}</p>
            </div>
            <div class="bp-pwa-install__actions">
                <button type="button" class="bp-pwa-install__button">${buttonLabel}</button>
                <button type="button" class="bp-pwa-install__close" aria-label="Refuser l’installation" title="Refuser l’installation">
                    <span class="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
            </div>
        `;

        const installButton = installPanel.querySelector('.bp-pwa-install__button');
        const closeButton = installPanel.querySelector('.bp-pwa-install__close');

        installButton.addEventListener('click', function () {
            if (deferredInstallPrompt) {
                deferredInstallPrompt.prompt();
                deferredInstallPrompt.userChoice.finally(function () {
                    deferredInstallPrompt = null;
                    rejectInstallation();
                });
                return;
            }

            installButton.textContent = 'Compris';
            installPanel.querySelector('.bp-pwa-install__text').textContent = isIos()
                ? (isIosSafari()
                    ? 'Dans Safari, touchez Partager, puis Ajouter à l’écran d’accueil et enfin Ajouter.'
                    : 'Ouvrez cette page dans Safari, puis touchez Partager et Ajouter à l’écran d’accueil.')
                : localAndroidBlocked
                    ? 'Android local: utilisez adb reverse puis ouvrez http://localhost:8000, ou servez le site en HTTPS. Ensuite Chrome proposera Telecharger l\'application.'
                    : 'Sur Android Chrome: ouvrez le menu du navigateur, puis choisissez Installer l\'application.';
        });
        closeButton.addEventListener('click', rejectInstallation);

        document.body.appendChild(installPanel);
        window.requestAnimationFrame(function () {
            installPanel && installPanel.classList.add('bp-pwa-install--visible');
        });
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('/barpilote-sw.js').catch(function () {});
        });
    }

    window.addEventListener('beforeinstallprompt', function (event) {
        event.preventDefault();
        deferredInstallPrompt = event;
        window.setTimeout(createInstallPanel, 900);
    });

    window.addEventListener('appinstalled', function () {
        localStorage.removeItem(REJECT_KEY);
        if (installPanel) rejectInstallation();
    });

    window.addEventListener('load', function () {
        window.setTimeout(createInstallPanel, 1400);
    });
})();

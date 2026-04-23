import axios from "axios";
import { getApiUrl } from "./apiConfig";

const API_URL = getApiUrl();
// ─── Cookie Helpers ──────────────────────────────────────────

function getCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const cookie = document.cookie
        .split('; ')
        .find(row => row.startsWith(`${name}=`));
    if (!cookie) return null;
    return cookie.split('=')[1] || null;
}

function setCookie(name: string, value: string, maxAge: number) {
    document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function deleteCookie(name: string) {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

// ─── Token Management ────────────────────────────────────────

/**
 * Récupère l'access token JWT depuis les cookies.
 */
export function getToken(): string | null {
    return getCookie('pilot-token');
}

/**
 * Récupère le refresh token depuis les cookies.
 */
export function getRefreshToken(): string | null {
    return getCookie('pilot-refresh');
}

/**
 * Enregistre les tokens JWT (access + refresh) dans les cookies.
 */
export function setToken(accessToken: string, refreshToken?: string) {
    setCookie('pilot-token', accessToken, 86400);       // 24h
    if (refreshToken) {
        setCookie('pilot-refresh', refreshToken, 604800); // 7 jours
    }
}

/**
 * Supprime tous les tokens JWT (déconnexion).
 */
export function deleteToken() {
    deleteCookie('pilot-token');
    deleteCookie('pilot-refresh');
}

// ─── Axios Client with Auto-Refresh ─────────────────────────

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function processQueue(newToken: string) {
    refreshQueue.forEach(cb => cb(newToken));
    refreshQueue = [];
}

/**
 * Crée une instance Axios pré-configurée avec le token JWT
 * et un intercepteur qui renouvelle automatiquement le token
 * lors d'une réponse 401.
 */
export function getAuthClient() {
    const token = getToken();
    const client = axios.create({
        baseURL: API_URL,
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });

    client.interceptors.response.use(
        (response) => response,
        async (error) => {
            const originalRequest = error.config;

            // Si 401 et qu'on n'a pas encore tenté un refresh pour cette requête
            if (error.response?.status === 401 && !originalRequest._retry) {
                const refreshToken = getRefreshToken();
                if (!refreshToken) {
                    // Pas de refresh token → déconnexion
                    return Promise.reject(error);
                }

                if (isRefreshing) {
                    // Un refresh est déjà en cours, on attend en file
                    return new Promise((resolve) => {
                        refreshQueue.push((newToken: string) => {
                            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                            resolve(client(originalRequest));
                        });
                    });
                }

                originalRequest._retry = true;
                isRefreshing = true;

                try {
                    const resp = await axios.post(`${API_URL}/api/auth/token/refresh/`, {
                        refresh: refreshToken,
                    });

                    const newAccess = resp.data.access;
                    setToken(newAccess, resp.data.refresh || refreshToken);

                    // Rejouer les requêtes en attente
                    processQueue(newAccess);

                    // Relancer la requête originale avec le nouveau token
                    originalRequest.headers['Authorization'] = `Bearer ${newAccess}`;
                    return client(originalRequest);
                } catch (refreshError) {
                    // Le refresh a échoué → session expirée
                    deleteToken();
                    refreshQueue = [];
                    if (typeof window !== 'undefined') {
                        window.location.href = '/auth/login';
                    }
                    return Promise.reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            }

            return Promise.reject(error);
        }
    );

    return client;
}

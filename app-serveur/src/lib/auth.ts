import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Récupère le token JWT depuis les cookies du navigateur.
 */
export function getToken(): string | null {
    if (typeof document === "undefined") return null;
    const cookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('pilot-token='));
    if (!cookie) return null;
    return cookie.split('=')[1] || null;
}

/**
 * Crée une instance Axios pré-configurée avec le token JWT.
 */
export function getAuthClient() {
    const token = getToken();
    return axios.create({
        baseURL: API_URL,
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    });
}

/**
 * Enregistre le token JWT dans un cookie.
 */
export function setToken(token: string) {
    // Cookie valide 24h, accessible depuis toute l'app
    document.cookie = `pilot-token=${token}; path=/; max-age=86400; SameSite=Lax`;
}

/**
 * Supprime le token JWT (déconnexion).
 */
export function deleteToken() {
    document.cookie = "pilot-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

export const getApiUrl = () => {
    if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
        // Si l'application est accédée via une IP locale (ex: 192.168.1.x) sur un téléphone,
        // on pointe l'API vers cette même IP au lieu de localhost.
        if (hostname !== "localhost" && hostname !== "127.0.0.1") {
            return `http://${hostname}:8000`;
        }
    }
    return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
};

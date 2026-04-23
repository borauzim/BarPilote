export const getApiUrl = () => {
    if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
        if (hostname !== "localhost" && hostname !== "127.0.0.1") {
            return `http://${hostname}:8000`;
        }
    }
    return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
};

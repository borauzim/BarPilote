"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAuthClient, getToken } from "@/lib/auth";

export default function JoinBarPage() {
    const params = useParams();
    const router = useRouter();
    const code = params.code as string;

    const [isLoading, setIsLoading] = useState(false);
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Vérifie si on est connecté
    const isLogged = !!getToken();

    const handleJoin = async () => {
        if (!isLogged) {
            // S'il n'est pas connecté, on le redirige vers le login avec un retour ici
            localStorage.setItem("return_after_login", `/join/${code}`);
            router.push("/auth/login");
            return;
        }

        setIsLoading(true);
        setStatus("loading");
        setErrorMsg("");

        try {
            const api = getAuthClient();
            const response = await api.post(`/api/proprietaire/bars/join/${code}/`);
            console.log("Rejoint avec succès :", response.data);
            setStatus("success");
            
            // Redirection vers la saisie d'identité au lieu du dashboard
            setTimeout(() => {
                router.push("/onboarding/staff-profile");
            }, 2000);
        } catch (error: any) {
            console.error("Erreur pour rejoindre :", error);
            setStatus("error");
            setErrorMsg(error.response?.data?.detail || "Le lien est invalide ou expiré.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900 font-sans">
            <div className="max-w-sm w-full bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100 text-center">
                
                <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 text-orange-600 shadow-inner">
                    <span className="material-symbols-outlined text-4xl">
                        {status === "success" ? "check_circle" : "storefront"}
                    </span>
                </div>

                <h1 className="text-2xl font-black tracking-tight mb-2">
                    {status === "success" ? "Bienvenue dans l'équipe !" : "Rejoindre un Établissement"}
                </h1>
                
                <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
                    {status === "success" 
                        ? "Vous êtes maintenant lié à l'établissement. Redirection..." 
                        : "Vous avez été invité à rejoindre le personnel d'un établissement partenaire BarPilote."}
                </p>

                {status === "error" && (
                    <div className="bg-red-50 text-red-600 text-sm font-bold p-4 rounded-2xl mb-6 flex items-center gap-2">
                        <span className="material-symbols-outlined">error</span>
                        {errorMsg}
                    </div>
                )}

                {status !== "success" && (
                    <button
                        onClick={handleJoin}
                        disabled={isLoading}
                        className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                    >
                        {isLoading ? (
                            <span className="material-symbols-outlined animate-spin">refresh</span>
                        ) : (!isMounted || !isLogged) ? (
                            <>
                                <span className="material-symbols-outlined">login</span>
                                Se connecter pour rejoindre
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">group_add</span>
                                Accepter l'invitation
                            </>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}

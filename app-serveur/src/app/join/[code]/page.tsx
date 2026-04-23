"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import { getAuthClient, getToken } from "@/lib/auth";
import { getApiUrl } from "@/lib/apiConfig";

export default function JoinBarPage() {
    const { code } = useParams();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isJoining, setIsJoining] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [barInfo, setBarInfo] = useState<{ nom: string, proprietaire_nom: string, type_etablissement: string } | null>(null);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        fetchBarInfo();
    }, [code]);

    const fetchBarInfo = async () => {
        const apiUrl = getApiUrl();
        try {
            // check-invitation est un endpoint public (AllowAny)
            const resp = await axios.get(`${apiUrl}/api/proprietaire/bars/check-invitation/${code}/`);
            setBarInfo(resp.data);
        } catch (err: any) {
            console.error(err);
            setError("Ce lien d'invitation n'est pas valide ou a expiré.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoin = async () => {
        const token = getToken();
        if (!token) {
            localStorage.setItem("join_code_pending", code as string);
            router.push("/auth/login");
            return;
        }

        setIsJoining(true);
        setError(null);

        try {
            const api = getAuthClient();
            await api.post(`/api/proprietaire/bars/join/${code}/`);
            // Redirection vers le profil pour compléter les informations
            router.push("/onboarding/staff-profile");
        } catch (err: any) {
            console.error("Erreur pour rejoindre :", err);
            setError(err.response?.data?.detail || "Erreur lors de l'affiliation.");
        } finally {
            setIsJoining(false);
        }
    };

    if (!isMounted) return null;

    return (
        <div className="min-h-screen bg-[#0c0d0d] flex flex-col items-center justify-center p-6 text-center text-white font-sans overflow-hidden relative">
            {/* Background elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full opacity-30"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full opacity-30"></div>

            <div className="w-full max-w-md z-10 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                {/* Logo Section */}
                <div className="flex flex-col items-center gap-2">
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl mb-2 backdrop-blur-xl">
                        <span className="material-symbols-outlined text-orange-500 text-3xl">token</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tighter uppercase italic">Bar<span className="text-orange-500">Pilote</span></h1>
                </div>

                {/* Main Card */}
                <div className="bg-white/[0.03] backdrop-blur-3xl p-10 rounded-[40px] border border-white/10 shadow-2xl space-y-8 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent"></div>

                    {isLoading ? (
                        <div className="py-12 flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
                            <p className="text-zinc-500 text-xs font-black tracking-widest uppercase mt-2">Analyse du QR Code...</p>
                        </div>
                    ) : error ? (
                        <div className="py-8 space-y-6">
                            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                                <span className="material-symbols-outlined text-red-500 text-3xl">error</span>
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl font-black tracking-tight text-white">Invitation Invalide</h2>
                                <p className="text-zinc-500 text-sm font-medium">{error}</p>
                            </div>
                            <button onClick={() => router.push("/auth/scan")} className="text-orange-500 text-xs font-black underline underline-offset-4 uppercase tracking-widest">Retour au scanner</button>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4">
                                <span className="px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-[10px] font-black tracking-widest uppercase">
                                    Invitation Officielle
                                </span>
                                <h2 className="text-3xl font-black tracking-tighter text-white leading-tight">
                                    Bienvenue chez <span className="text-orange-500 underline decoration-white/20 underline-offset-8">{barInfo?.nom}</span>
                                </h2>
                                <p className="text-zinc-400 text-sm font-semibold leading-relaxed px-4">
                                    L'établissement de <span className="text-white font-black">{barInfo?.proprietaire_nom}</span> souhaite vous recruter dans son équipe VIP.
                                </p>
                            </div>

                            <div className="pt-4">
                                <button
                                    onClick={handleJoin}
                                    disabled={isJoining}
                                    className="w-full bg-white text-black py-5 rounded-3xl font-black text-sm shadow-2xl shadow-white/5 active:scale-95 hover:scale-[1.02] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                >
                                    {isJoining ? (
                                        <span className="material-symbols-outlined animate-spin text-orange-600">sync</span>
                                    ) : (
                                        <>
                                            REJOINDRE L'ÉQUIPE
                                            <span className="material-symbols-outlined text-orange-600">arrow_forward</span>
                                        </>
                                    )}
                                </button>
                                <p className="mt-6 text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em]">En rejoignant, vous devenez un Sommelier Digital</p>
                            </div>
                        </>
                    )}
                </div>

                <button 
                    onClick={() => router.back()}
                    className="text-zinc-500 text-xs font-bold hover:text-white transition-colors flex items-center gap-2 mx-auto"
                >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    ANNULER
                </button>
            </div>
        </div>
    );
}

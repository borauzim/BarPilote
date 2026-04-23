"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthClient, getToken } from "@/lib/auth";

export default function ProtocolSuccessPage() {
    const router = useRouter();
    const [prenom, setPrenom] = useState("");
    const [currentTime, setCurrentTime] = useState("");
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const now = new Date();
        setCurrentTime(now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));

        const token = getToken();
        if (!token) {
            router.push("/auth/login");
        } else {
            fetchProfile();
        }
    }, [router]);

    const fetchProfile = async () => {
        try {
            const api = getAuthClient();
            const resp = await api.get("/api/proprietaire/profiles/me/");
            setPrenom(resp.data.prenom || "Sommelier");
        } catch (error) {
            console.error("Erreur profile:", error);
            setPrenom("Sommelier");
        }
    };

    if (!isMounted) return null;

    return (
        <div className="min-h-screen bg-[#0c0d0d] text-white flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
            {/* Success Icon Animation container */}
            <div className="relative mb-12">
                <div className="absolute inset-0 bg-green-500/20 blur-3xl rounded-full scale-150 animate-pulse"></div>
                <div className="relative w-32 h-32 rounded-full bg-zinc-900 border-4 border-zinc-800 flex items-center justify-center shadow-2xl">
                    <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center animate-in zoom-in duration-500">
                        <span className="material-symbols-outlined text-white text-5xl font-black">check</span>
                    </div>
                </div>
            </div>

            {/* Welcome Text */}
            <div className="space-y-4 mb-16 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
                <h1 className="text-5xl font-black tracking-tighter leading-none">
                    Bienvenue, <br/>
                    <span className="text-white opacity-90">{prenom}</span>
                </h1>
                <p className="text-zinc-500 font-bold text-lg">
                    Service commencé à <span className="text-zinc-300">{currentTime}</span>
                </p>
            </div>

            {/* Small Dashboard Cards (Mockup Style) */}
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500">
                <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl text-left">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-1">Poste</p>
                    <p className="text-sm font-bold text-zinc-300">Bar Principal</p>
                </div>
                <div className="bg-zinc-900/50 border border-white/5 p-6 rounded-3xl text-left">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-1">Statut</p>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <p className="text-sm font-bold text-green-500">En Service</p>
                    </div>
                </div>
            </div>

            {/* Final CTA */}
            <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-10 duration-700 delay-700">
                <button 
                    onClick={() => router.push("/dashboard")}
                    className="w-full bg-[#ea580c] text-white py-6 rounded-[32px] font-black text-lg shadow-2xl shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
                >
                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    <span className="relative">Aller à la Vigie</span>
                    <span className="material-symbols-outlined relative">arrow_forward</span>
                </button>
            </div>

            {/* Background decorative elements */}
            <div className="absolute top-0 left-0 w-full h-full -z-10 pointer-events-none opacity-30">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-green-500/5 blur-[120px] rounded-full"></div>
            </div>
        </div>
    );
}

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { getToken } from "@/lib/auth";
import { getApiUrl } from "@/lib/apiConfig";

interface Table {
    id: string;
    nom: string;
    est_active: boolean;
    active_order_id?: string;
}

export default function TableSelectionPage() {
    const router = useRouter();
    const [tables, setTables] = useState<Table[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const token = getToken();
        if (!token) {
            router.push("/auth/login");
            return;
        }
        fetchTables(token);
    }, [router]);

    const fetchTables = async (token: string) => {
        setIsLoading(true);
        const apiUrl = getApiUrl();
        try {
            const resp = await axios.get(`${apiUrl}/api/proprietaire/tables/`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            setTables(resp.data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0c0d0d] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 animate-pulse">
                    <span className="material-symbols-outlined text-orange-500 text-5xl">radar</span>
                    <p className="text-zinc-500 text-xs font-bold tracking-widest uppercase">Analyse de la salle...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0c0d0d] flex flex-col font-sans text-white overflow-hidden relative">
            {/* Décorations de fond */}
            <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none"></div>
            
            <header className="px-6 pt-12 pb-6 flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => router.push("/dashboard")}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 active:scale-90 transition-all"
                    >
                        <span className="material-symbols-outlined text-white">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-white uppercase">Secteur</h1>
                        <p className="text-orange-500 text-[10px] font-black tracking-[0.2em] uppercase">Sélection de table</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-white/5 shadow-inner">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <span className="text-[10px] font-bold text-zinc-400">En service</span>
                </div>
            </header>

            <main className="flex-1 px-6 pb-24 overflow-y-auto relative z-10">
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    {tables.map((table) => {
                        const isOccupied = !!table.active_order_id;
                        return (
                            <button
                                key={table.id}
                                onClick={() => router.push(`/tables/${table.id}/order`)}
                                className={`relative group p-6 rounded-3xl flex flex-col items-center gap-4 transition-all duration-300 active:scale-95 text-center
                                    ${isOccupied 
                                        ? "bg-zinc-900 border border-orange-500/50 shadow-[0_0_15px_rgba(255,94,0,0.2)]" 
                                        : "bg-zinc-900/50 border border-white/10 hover:border-white/20 hover:bg-zinc-800/50"
                                    }`}
                            >
                                {isOccupied && (
                                    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(255,94,0,0.8)]"></div>
                                )}
                                
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300
                                    ${isOccupied 
                                        ? "bg-orange-500/20 text-orange-500" 
                                        : "bg-white/5 text-zinc-500 group-hover:text-white"
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-3xl">table_restaurant</span>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-base font-black text-white leading-none">{table.nom}</p>
                                    <p className={`text-[9px] font-black uppercase tracking-widest ${isOccupied ? 'text-orange-500' : 'text-zinc-500'}`}>
                                        {isOccupied ? 'Occupée' : 'Libre'}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                    
                    {tables.length === 0 && (
                        <div className="col-span-2 p-12 text-center flex flex-col items-center gap-4 bg-zinc-900/50 rounded-3xl border border-white/5">
                            <span className="material-symbols-outlined text-5xl text-zinc-600">table_bar</span>
                            <p className="text-sm font-bold text-zinc-400">Aucune table détectée sur les radars.</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

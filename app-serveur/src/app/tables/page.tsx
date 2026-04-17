"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { getToken } from "@/lib/auth";

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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
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
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 border-4 border-primary-container/20 border-t-primary-container rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <header className="px-6 pt-12 pb-6 flex items-center gap-4">
                <button 
                    onClick={() => router.push("/dashboard")}
                    className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center hover:bg-surface-container-highest transition-colors"
                >
                    <span className="material-symbols-outlined text-on-surface">arrow_back</span>
                </button>
                <h1 className="text-2xl font-black tracking-tight text-on-surface">Choisir une Table</h1>
            </header>

            <main className="flex-1 px-6 pb-24">
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {tables.map((table) => (
                        <button
                            key={table.id}
                            onClick={() => router.push(`/order/${table.id}`)}
                            className="bg-surface-container-lowest p-6 rounded-[2rem] executive-shadow flex flex-col items-center gap-4 hover:bg-orange-50 transition-all active:scale-95 group text-center"
                        >
                            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:text-primary-container group-hover:bg-orange-50 transition-colors">
                                <span className="material-symbols-outlined text-3xl">table_bar</span>
                            </div>
                            <div className="space-y-1">
                                <p className="text-base font-black text-on-surface leading-none">{table.nom}</p>
                                <div className="flex items-center justify-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Disponible</p>
                                </div>
                            </div>
                        </button>
                    ))}
                    
                    {tables.length === 0 && (
                        <div className="col-span-2 p-12 text-center space-y-4">
                            <span className="material-symbols-outlined text-6xl text-slate-200">sentiment_dissatisfied</span>
                            <p className="text-sm font-bold text-slate-400">Aucune table n&apos;est configurée pour cet établissement.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Hint */}
            <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-background via-background to-transparent pb-8">
                <div className="bg-surface-container-low p-4 rounded-2xl flex items-center gap-3 text-xs font-bold text-slate-500 border border-white">
                    <span className="material-symbols-outlined text-primary-container">info</span>
                    Sélectionnez une table pour ouvrir une nouvelle commande.
                </div>
            </div>
        </div>
    );
}

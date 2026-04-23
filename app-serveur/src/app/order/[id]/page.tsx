"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import { getToken } from "@/lib/auth";
import { getApiUrl } from "@/lib/apiConfig";

interface OrderItem {
    id: number;
    product_name: string;
    quantite: number;
    prix_unitaire: string;
    prix_total: string;
    currency: string;
}

interface Order {
    id: number;
    table_nom: string;
    statut: string;
    date_creation: string;
    total_price: number;
    total_usd: number;
    total_cdf: number;
    items: OrderItem[];
    serveur_nom?: string;
}

export default function OrderDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const token = getToken();
        if (!token) {
            router.push("/");
            return;
        }
        fetchOrder(token);
    }, [id]);

    const fetchOrder = async (token: string) => {
        const apiUrl = getApiUrl();
        try {
            const resp = await axios.get(`${apiUrl}/api/proprietaire/orders/${id}/`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            setOrder(resp.data);
        } catch (err) {
            console.error("Erreur chargement commande:", err);
            router.push("/dashboard");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAcceptAndPrint = () => {
        alert("Bon de préparation envoyé à l'imprimante 🖨️");
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0c0d0d] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    const totalItems = order?.items.reduce((acc, item) => acc + item.quantite, 0) || 0;

    return (
        <div className="min-h-screen bg-[#0c0d0d] text-white flex flex-col font-sans select-none overflow-x-hidden">
            {/* Header */}
            <header className="px-6 py-8 flex items-center justify-between border-b border-white/5 bg-[#0c0d0d]">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => router.back()}
                        className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                    >
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                    <div>
                        <h1 className="text-xl font-black tracking-tight leading-none">
                            Table {order?.table_nom} - {totalItems} Boisson{totalItems > 1 ? 's' : ''}
                        </h1>
                    </div>
                </div>
                <button className="bg-orange-900/20 border border-orange-500/30 text-orange-500 px-5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">
                    Nouvelle Commande
                </button>
            </header>

            {/* Content */}
            <main className="flex-1 p-6 space-y-6 overflow-y-auto pb-40">
                {/* Items List */}
                <div className="space-y-4">
                    {order?.items.map((item) => (
                        <div key={item.id} className="bg-zinc-900/40 border border-white/5 rounded-[2.5rem] p-6 flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center shadow-inner group">
                                <span className="material-symbols-outlined text-orange-500 text-3xl group-hover:scale-110 transition-transform">
                                    {item.product_category === "Cocktails" ? "local_bar" : "wine_bar"}
                                </span>
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-black tracking-tight">{item.quantite}x {item.product_name}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">En attente de préparation</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Metadata Section */}
                <div className="pt-8 space-y-6 animate-in fade-in duration-700">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 border-b border-white/5 pb-2">
                        Métadonnées de la commande
                    </h4>
                    
                    <div className="space-y-4 px-2">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500 font-bold">Serveur</span>
                            <span className="font-black italic">{order?.serveur_nom || "Julian V."}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500 font-bold">Heure de commande</span>
                            <span className="font-black">{new Date(order?.date_creation || Date.now()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500 font-bold">Priorité</span>
                            <span className="font-black text-orange-500 uppercase italic tracking-tighter">Haute</span>
                        </div>
                    </div>
                </div>
            </main>

            {/* Actions Footer */}
            <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-[#0c0d0d] via-[#0c0d0d] to-transparent space-y-4">
                <button 
                    onClick={handleAcceptAndPrint}
                    className="w-full bg-[#007aff] text-white py-6 rounded-[32px] font-black text-lg shadow-2xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 group overflow-hidden relative"
                >
                    <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    <span className="material-symbols-outlined font-black relative">print</span>
                    <span className="relative">Accepter et Imprimer</span>
                </button>

                <button 
                    onClick={() => router.push(`/order/${id}/delivery`)}
                    className="w-full bg-black border border-white/10 text-white py-6 rounded-[32px] font-black text-lg active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                    <span className="material-symbols-outlined font-black">check_circle</span>
                    <span>Marquer comme Servi</span>
                </button>

                <p className="text-center text-[8px] font-black uppercase tracking-[0.3em] text-zinc-600 mt-4 opacity-50">Édition Vigie Apple • Contrôle Bar v2.4</p>
            </div>
        </div>
    );
}

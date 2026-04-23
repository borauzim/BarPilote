"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAuthClient } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import ExecutiveCard from "@/components/ExecutiveCard";

interface OrderItem {
    id: string;
    product_name: string;
    quantite: number;
    prix_unitaire: number;
    devise: string;
}

interface Order {
    id: string;
    table_nom: string;
    statut: string;
    statut_label: string;
    total_usd: number;
    total_cdf: number;
    items: OrderItem[];
    date_creation: string;
    serveur_nom: string;
}

export default function OrdersPage() {
    const router = useRouter();
    const [orders, setOrders] = useState<Order[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        fetchOrders();
        const interval = setInterval(fetchOrders, 20000); // 20s pour plus de réactivité
        return () => clearInterval(interval);
    }, []);

    const fetchOrders = async () => {
        try {
            const api = getAuthClient();
            const resp = await api.get("/api/proprietaire/orders/");
            // On filtre pour ne garder que les commandes actives
            setOrders(resp.data.filter((o: any) => o.statut !== 'PAID' && o.statut !== 'CANCELLED'));
        } catch (err: any) {
            console.error("Orders Fetch Error:", err);
            if (err.response?.status === 401) router.push("/auth/login");
        } finally {
            setIsLoading(false);
        }
    };

    const handleMarkPaid = async (orderId: string) => {
        try {
            const api = getAuthClient();
            await api.post(`/api/proprietaire/orders/${orderId}/mark_paid/`);
            fetchOrders();
        } catch (err) { console.error(err); }
    };

    if (!isMounted) return null;

    return (
        <div className="bg-[#f2f4f7] min-h-screen pb-40 font-sans selection:bg-orange-500/20">
            <header className="px-8 pt-12 pb-8 bg-white/80 backdrop-blur-xl sticky top-0 z-40 border-b border-slate-100 flex justify-between items-end">
                <div>
                   <div className="flex items-center gap-2 mb-1 text-orange-600">
                      <span className="material-symbols-outlined text-sm">confirmation_number</span>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em]">Monitoring Live</span>
                   </div>
                   <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Tickets Actifs</h1>
                </div>
                <div className="bg-orange-600 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase flex items-center gap-2 shadow-lg shadow-orange-500/20">
                   <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                   Serveur Synchro
                </div>
            </header>

            <main className="px-8 mt-10 space-y-8 max-w-4xl mx-auto">
                {isLoading ? (
                    <div className="py-24 flex flex-col items-center justify-center space-y-4">
                        <div className="w-10 h-10 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin"></div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Scan des services en cours...</p>
                    </div>
                ) : orders.length === 0 ? (
                    <div className="py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center px-10">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6"><span className="material-symbols-outlined text-4xl text-slate-200">receipt_long</span></div>
                        <h4 className="text-lg font-black text-slate-900 mb-2">Aucun ticket actif</h4>
                        <p className="text-sm text-slate-400 max-w-xs leading-relaxed">Toutes les tables sont libérées ou en attente de commande.</p>
                    </div>
                ) : (
                    orders.map(order => (
                        <ExecutiveCard key={order.id} variant="white" className="border-none shadow-xl shadow-slate-200/40 p-8 group overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-[40px] rounded-full -mr-16 -mt-16"></div>
                            
                            <div className="flex justify-between items-start mb-8 relative z-10">
                                <div className="flex items-center gap-5">
                                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-orange-600">
                                        <span className="material-symbols-outlined text-3xl">table_restaurant</span>
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{order.table_nom}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 italic">Chef de Rang: {order.serveur_nom}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-orange-50 text-orange-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-orange-100">
                                    {order.statut_label}
                                </div>
                            </div>

                            <div className="space-y-4 mb-10 border-y border-slate-50 py-8 relative z-10">
                                {order.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center group/item">
                                        <div className="flex items-center gap-3">
                                            <span className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[11px] font-black text-slate-400 group-hover/item:bg-orange-50 group-hover/item:text-orange-600 transition-colors">{item.quantite}x</span>
                                            <span className="text-sm font-black text-slate-700">{item.product_name}</span>
                                        </div>
                                        <span className="text-xs font-black text-slate-400">
                                            {item.prix_unitaire.toLocaleString()} {item.devise === 'CDF' ? 'FC' : '$'}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between items-center mb-8 relative z-10">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Total À Encaisser</span>
                                <div className="text-right">
                                    <p className="text-4xl font-black text-slate-900 tracking-tighter">{order.total_usd.toLocaleString()} $</p>
                                    {order.total_cdf > 0 && <p className="text-xs font-black text-orange-600 mt-1">{order.total_cdf.toLocaleString()} FC</p>}
                                </div>
                            </div>

                            <button 
                                onClick={() => handleMarkPaid(order.id)}
                                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl shadow-slate-900/10 active:scale-95 transition-all relative z-10 flex items-center justify-center gap-3 group/btn"
                            >
                                <span className="material-symbols-outlined text-lg group-hover/btn:rotate-12 transition-transform">point_of_sale</span>
                                Finaliser & Encaisser
                            </button>
                        </ExecutiveCard>
                    ))
                )}
            </main>

            <BottomNav activePage="tables" />
        </div>
    );
}

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";

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
        // Rafraîchissement automatique toutes les 30 secondes
        const interval = setInterval(fetchOrders, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchOrders = async () => {
        const token = getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        if (!token) return;

        try {
            const resp = await fetch(`${apiUrl}/api/proprietaire/orders/`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                // On filtre pour ne garder que les commandes actives
                setOrders(data.filter((o: any) => o.statut !== 'PAID' && o.statut !== 'CANCELLED'));
            }
        } catch (err) {
            console.error("Orders Fetch Error:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMarkPaid = async (orderId: string) => {
        const token = getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        try {
            const resp = await fetch(`${apiUrl}/api/proprietaire/orders/${orderId}/mark_paid/`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (resp.ok) {
                fetchOrders();
            }
        } catch (err) { console.error(err); }
    };

    if (!isMounted) return null;

    return (
        <div className="bg-[#f8f9fa] min-h-screen pb-32">
            <header className="px-6 pt-8 pb-4 bg-white shadow-sm">
                <h1 className="text-3xl font-black tracking-tight text-[#1a1c1d]">Tickets Actifs</h1>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Suivi de la salle en temps réel</p>
            </header>

            <main className="px-6 mt-6 space-y-4">
                {isLoading ? (
                    <div className="py-20 text-center animate-pulse text-slate-400 font-bold uppercase text-xs tracking-widest">
                        Synchronisation des tables...
                    </div>
                ) : orders.length === 0 ? (
                    <div className="py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200">
                        <span className="material-symbols-outlined text-4xl text-slate-200 mb-2">confirmation_number</span>
                        <p className="text-slate-400 font-bold text-sm">Aucune commande en cours</p>
                    </div>
                ) : (
                    orders.map(order => (
                        <div key={order.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-black text-[#FF5E00]">{order.table_nom}</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Servi par {order.serveur_nom}</p>
                                </div>
                                <div className="bg-orange-50 text-[#FF5E00] px-3 py-1 rounded-full text-[10px] font-black uppercase">
                                    {order.statut_label}
                                </div>
                            </div>

                            <div className="space-y-2 mb-6 border-y border-slate-50 py-4">
                                {order.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-sm">
                                        <span className="font-bold text-slate-700">{item.quantite}x {item.product_name}</span>
                                        <span className="text-slate-400 font-medium">
                                            {item.prix_unitaire} {item.devise === 'CDF' ? 'FC' : '$'}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl mb-4">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Total Ticket</span>
                                <div className="text-right">
                                    <p className="text-xl font-black text-slate-900">{order.total_usd} $</p>
                                    {order.total_cdf > 0 && <p className="text-[10px] font-bold text-slate-400">{order.total_cdf.toLocaleString()} FC</p>}
                                </div>
                            </div>

                            <button 
                                onClick={() => handleMarkPaid(order.id)}
                                className="w-full bg-[#1a1c1d] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg active:scale-[0.98] transition-all"
                            >
                                Encaisser le Paiement
                            </button>
                        </div>
                    ))
                )}
            </main>

            <BottomNav activePage="tables" />
        </div>
    );
}

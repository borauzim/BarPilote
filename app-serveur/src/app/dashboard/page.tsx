"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { getToken, deleteToken } from "@/lib/auth";
import ActiveShiftOverlay from "@/components/ActiveShiftOverlay";

interface DashboardData {
    bar_info: { nom: string; logo: string | null; };
    revenue: { usd: number; cdf: number; };
    metrics: {
        clients: number;
        active_orders: number;
        avg_basket: number;
        wait_time: number;
    };
    best_seller: { name: string; qty: number; };
}

interface OrderItem {
    id: number;
    product_name: string;
    quantite: number;
}

interface Order {
    id: number;
    table_nom: string;
    statut: string;
    date_creation: string;
    items: OrderItem[];
    total_price: number;
}

export default function ServerDashboard() {
    const router = useRouter();
    const [data, setData] = useState<DashboardData | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [profile, setProfile] = useState<any>(null);
    const [activeShift, setActiveShift] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showWelcome, setShowWelcome] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        const token = getToken();
        if (!token) {
            router.push("/auth/login");
            return;
        }
        fetchInitialData(token);
    }, [router]);

    const fetchInitialData = async (token: string) => {
        setIsLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        try {
            const [profResp, shiftResp, dashResp, ordersResp] = await Promise.all([
                axios.get(`${apiUrl}/api/proprietaire/profile/me/`, { headers: { "Authorization": `Bearer ${token}` } }),
                axios.get(`${apiUrl}/api/proprietaire/shifts/`, { headers: { "Authorization": `Bearer ${token}` } }),
                axios.get(`${apiUrl}/api/proprietaire/dashboard/`, { headers: { "Authorization": `Bearer ${token}` } }),
                axios.get(`${apiUrl}/api/proprietaire/orders/?statut__exclude=PAID`, { headers: { "Authorization": `Bearer ${token}` } })
            ]);

            setProfile(profResp.data);
            const current = shiftResp.data.find((s: any) => s.status === "ACTIVE" || s.status === "BREAK");
            setActiveShift(current);
            setData(dashResp.data);
            setOrders(ordersResp.data.slice(0, 6)); // Top 6 active orders
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        deleteToken();
        router.push("/auth/login");
    };

    const handleMarkServed = async (orderId: string) => {
        const token = getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        try {
            const resp = await axios.post(`${apiUrl}/api/proprietaire/orders/${orderId}/mark_served/`, {}, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            // Mise à jour locale pour éviter le rechargement
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, statut: 'SERVED' } : o));
            // Optionnel: rafraîchir les métriques globales
            fetchData(token);
        } catch (err) {
            console.error("Erreur marquage servi:", err);
            alert("Erreur lors de la mise à jour du statut.");
        }
    };

    const handleMarkPaid = async (orderId: string) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        
        const totalStr = `${order.total_usd > 0 ? order.total_usd.toFixed(2) + '$' : ''}${order.total_usd > 0 && order.total_cdf > 0 ? ' + ' : ''}${order.total_cdf > 0 ? order.total_cdf.toLocaleString() + ' FC' : ''}`;
        
        if (!confirm(`Confirmer l'encaissement de ${totalStr} pour la Table ${order.table_nom} ?`)) return;

        const token = getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        try {
            await axios.post(`${apiUrl}/api/proprietaire/orders/${orderId}/mark_paid/`, {}, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            // Retirer la commande payée de la liste locale
            setOrders(prev => prev.filter(o => o.id !== orderId));
            fetchData(token);
        } catch (err) {
            console.error("Erreur encaissement:", err);
            alert("Erreur lors de l'encaissement.");
        }
    };

    const handleStartShift = async () => {
        setIsLoading(true);
        const token = getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        try {
            const resp = await axios.post(`${apiUrl}/api/proprietaire/shifts/`, { status: "ACTIVE" }, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            setActiveShift(resp.data);
            setShowWelcome(true); // Show the high-fidelity welcome overlay
        } catch (err: any) {
            alert(err.response?.data?.[0] || "Impossible de démarrer le service.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading && !data) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0c0d0d]">
                <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0c0d0d] text-white font-sans selection:bg-orange-500/30">
            
            {isMounted && showWelcome && (
                <ActiveShiftOverlay 
                    workerName={profile?.prenom || "Pilote"} 
                    startTime={new Date(activeShift?.start_time || Date.now()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    barName={data?.bar_info.nom || "BarPilote"}
                    onClose={() => setShowWelcome(false)}
                />
            )}

            {/* Top AppBar */}
            <header className="fixed top-0 w-full z-50 bg-slate-900/40 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 h-16">
                <div className="flex items-center gap-4">
                    <button className="p-2 text-orange-500 hover:bg-white/5 rounded-full transition-all">
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                    <h1 className="text-xl font-black tracking-tighter uppercase">BarPilote <span className="text-orange-500">Vigie</span></h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="hidden md:flex gap-6 mr-4">
                        <span className="text-orange-500 font-bold text-xs uppercase tracking-widest cursor-pointer">Commandes</span>
                        <span className="text-zinc-500 hover:text-white font-bold text-xs uppercase tracking-widest cursor-pointer transition-colors">Tables</span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 overflow-hidden flex items-center justify-center text-orange-500 font-black cursor-pointer hover:bg-zinc-700 transition-all" onClick={handleLogout}>
                        <span className="material-symbols-outlined text-sm">logout</span>
                    </div>
                </div>
            </header>

            <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto">
                
                {/* Dashboard Header */}
                <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
                    <div>
                        <span className="text-[10px] font-black tracking-[0.2em] text-orange-500 uppercase">Opérations en Direct</span>
                        <h2 className="text-4xl font-black tracking-tighter mt-1">Commandes Actives</h2>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="bg-zinc-900/50 px-5 py-3 rounded-2xl border border-white/5 backdrop-blur-sm">
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Impact Jour</span>
                            <span className="text-xl font-black text-white">$ {data?.revenue.usd.toFixed(2)}</span>
                        </div>
                        <div className="bg-zinc-900/50 px-5 py-3 rounded-2xl border border-white/5 backdrop-blur-sm">
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Tables</span>
                            <span className="text-xl font-black text-white">{data?.metrics.active_orders}</span>
                        </div>
                    </div>
                </div>

                {/* Status / Shift management if not active */}
                {!activeShift && (
                    <div className="mb-12 p-8 rounded-[2.5rem] bg-orange-600 flex flex-col items-center text-center gap-6 shadow-2xl shadow-orange-900/20 animate-in zoom-in duration-500">
                        <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-4xl text-white">bolt</span>
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-white tracking-tight">Prêt pour le service ?</h3>
                            <p className="text-white/80 font-medium text-sm">Démarrez votre session pour piloter l&apos;établissement.</p>
                        </div>
                        <button 
                            onClick={handleStartShift}
                            className="bg-white text-orange-600 px-10 py-4 rounded-full font-black text-lg shadow-xl active:scale-95 transition-all"
                        >
                            DÉMARRER MON SERVICE
                        </button>
                    </div>
                )}

                {/* Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    
                    {/* Orders Loop */}
                    {orders.map((order, idx) => {
                        // Priority style for first few orders
                        const isHighPriority = idx === 0;
                        return (
                            <div key={order.id} className={`bento-card p-6 flex flex-col min-h-[220px] relative overflow-hidden group ${isHighPriority ? 'border-orange-500/50 bg-orange-500/5' : ''}`}>
                                {isHighPriority && (
                                    <div className="absolute top-6 right-6 flex items-center gap-2 bg-orange-500 text-white px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">
                                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                                        Urgent
                                    </div>
                                )}
                                
                                <div className="mb-4">
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Table {order.table_nom}</span>
                                    <h3 className="text-xl font-black text-white mt-1 leading-tight">
                                        {order.items.length} Article{order.items.length > 1 ? 's' : ''}
                                    </h3>
                                </div>

                                <div className="space-y-2 flex-1">
                                    {order.items.slice(0, 3).map(item => (
                                        <div key={item.id} className="flex items-center gap-3 text-zinc-400 text-sm font-medium">
                                            <span className="w-1.5 h-1.5 rounded-full bg-orange-500/40"></span>
                                            <span className="flex-1 truncate">{item.product_name}</span>
                                            <span className="text-zinc-600">x{item.quantite}</span>
                                        </div>
                                    ))}
                                    {order.items.length > 3 && (
                                        <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest pl-4">+{order.items.length - 3} autres...</p>
                                    )}
                                </div>

                                <div className="mt-4 p-3 rounded-2xl bg-zinc-900/80 border border-white/5 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Total</span>
                                    <div className="flex gap-3">
                                        {order.total_usd > 0 && <span className="text-sm font-black text-white">{order.total_usd.toFixed(2)}$</span>}
                                        {order.total_cdf > 0 && <span className="text-sm font-black text-orange-500">{order.total_cdf.toLocaleString()} FC</span>}
                                        {order.total_usd === 0 && order.total_cdf === 0 && <span className="text-sm font-black text-zinc-600">0.00$</span>}
                                    </div>
                                </div>

                                <div className="mt-auto pt-6 flex items-center justify-between gap-3">
                                    <span className="font-mono text-zinc-500 text-[10px]">
                                        {new Date(order.date_creation).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    
                                    <div className="flex items-center gap-2">
                                        {order.statut === 'PENDING' ? (
                                            <button 
                                                onClick={() => handleMarkServed(order.id)}
                                                className="bg-orange-500 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-500/20 active:scale-90 transition-all"
                                            >
                                                SERVIR
                                            </button>
                                        ) : order.statut === 'SERVED' ? (
                                            <button 
                                                onClick={() => handleMarkPaid(order.id)}
                                                className="bg-teal-500 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-teal-500/20 active:scale-90 transition-all flex items-center gap-1.5"
                                            >
                                                <span className="material-symbols-outlined !text-sm">payments</span>
                                                PAYER
                                            </button>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-zinc-500 bg-zinc-500/10 px-3 py-1.5 rounded-xl border border-zinc-500/20">
                                                <span className="material-symbols-outlined !text-sm font-bold">check_circle</span>
                                                <span className="text-[9px] font-black uppercase tracking-widest">PAYÉ</span>
                                            </div>
                                        )}
                                        
                                        <button 
                                            onClick={() => router.push(`/order/${order.id}`)}
                                            className="w-10 h-10 rounded-xl bg-zinc-800 border border-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                                        >
                                            <span className="material-symbols-outlined !text-sm">visibility</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Dashboard Large Analytics Card (Bento Style) */}
                    <div className="lg:col-span-2 bento-card p-8 bg-gradient-to-br from-zinc-900 to-black flex flex-col md:flex-row gap-8 items-center border-orange-500/10">
                        <div className="flex-1 space-y-4">
                            <div>
                                <span className="text-orange-500 text-[10px] font-black uppercase tracking-[0.2em]">Efficiency Dashboard</span>
                                <h3 className="text-3xl font-black text-white mt-1 tracking-tighter">Performance Service</h3>
                            </div>
                            <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
                                Votre temps moyen de service est de <span className="text-white font-bold">{data?.metrics.wait_time} min</span>. 
                                <br />Excellent travail ! Continuez à piloter avec précision.
                            </p>
                            <div className="flex gap-4 pt-4">
                                <div className="flex-1 p-4 rounded-2xl bg-white/5 border border-white/5">
                                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1">Panier Moyen</span>
                                    <span className="text-xl font-black text-white">$ {data?.metrics.avg_basket.toFixed(1)}</span>
                                </div>
                                <div className="flex-1 p-4 rounded-2xl bg-white/5 border border-white/5">
                                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest block mb-1">Clients Total</span>
                                    <span className="text-xl font-black text-white">{data?.metrics.clients}</span>
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-1/3 flex flex-col items-center justify-center p-4">
                            <div className="relative w-40 h-40">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle className="text-white/5" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeWidth="8"></circle>
                                    <circle className="text-orange-500" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeDasharray="440" strokeDashoffset="110" strokeLinecap="round" strokeWidth="12"></circle>
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-white tracking-tighter">Vigie</span>
                                    <span className="text-[8px] text-zinc-500 font-black uppercase tracking-[0.2em]">Active</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Action Add Card */}
                    <div 
                        onClick={() => router.push("/tables")}
                        className="citrus-gradient rounded-[2.5rem] p-8 flex flex-col justify-between items-start text-white relative overflow-hidden group cursor-pointer shadow-2xl shadow-orange-950/20 active:scale-95 transition-all"
                    >
                        <div className="absolute -right-4 -top-4 opacity-10 group-hover:rotate-12 transition-transform duration-500">
                            <span className="material-symbols-outlined !text-[160px]">add_circle</span>
                        </div>
                        <span className="material-symbols-outlined !text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
                        <div className="mt-12 relative z-10">
                            <h3 className="text-2xl font-black leading-tight tracking-tight">Nouvelle <br/> Commande</h3>
                            <p className="text-orange-100/70 text-xs font-bold uppercase tracking-widest mt-2">Cliquez pour démarrer</p>
                        </div>
                    </div>

                </div>
            </main>

            {/* Bottom Navigation (Mobile) */}
            <nav className="md:hidden fixed bottom-0 left-0 w-full bg-zinc-900/80 backdrop-blur-xl border-t border-white/5 flex justify-around items-center px-4 pb-8 pt-4 z-50 rounded-t-[2.5rem] executive-shadow">
                <button className="flex flex-col items-center gap-1 text-orange-500 transition-all active:scale-90">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                    <span className="text-[9px] font-black uppercase tracking-widest">Dashboard</span>
                </button>
                <button onClick={() => router.push("/tables")} className="flex flex-col items-center gap-1 text-zinc-500 active:scale-90">
                    <span className="material-symbols-outlined">table_restaurant</span>
                    <span className="text-[9px] font-black uppercase tracking-widest">Tables</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-zinc-500 active:scale-90">
                    <span className="material-symbols-outlined">inventory_2</span>
                    <span className="text-[9px] font-black uppercase tracking-widest">Stock</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-zinc-500 active:scale-90">
                    <span className="material-symbols-outlined">person</span>
                    <span className="text-[9px] font-black uppercase tracking-widest">Profil</span>
                </button>
            </nav>

            {/* Large FAB for desktop/tablets */}
            <button 
                onClick={() => router.push("/tables")}
                className="hidden md:flex fixed right-10 bottom-10 w-20 h-20 citrus-gradient text-white rounded-full shadow-2xl items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 border-8 border-[#0c0d0d]"
            >
                <span className="material-symbols-outlined !text-4xl">add</span>
            </button>

            <style jsx>{`
                .bento-card {
                    background: #0c0d0d;
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 2.5rem;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .bento-card:hover {
                    border-color: rgba(255, 94, 0, 0.3);
                    background: #121314;
                    transform: translateY(-4px);
                }
            `}</style>
        </div>
    );
}

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { getToken, deleteToken } from "@/lib/auth";
import { getApiUrl } from "@/lib/apiConfig";
import ActiveShiftOverlay from "@/components/ActiveShiftOverlay";
import AuthGuard from "@/components/AuthGuard";

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
    total_usd: string;
    total_cdf: string;
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
        if (!isMounted) return;
        
        const token = getToken();
        if (!token) {
            // AuthGuard gérera la redirection
            return;
        }
        fetchInitialData(token);
    }, [router]);

    const fetchInitialData = async (token: string) => {
        setIsLoading(true);
        const apiUrl = getApiUrl();
        try {
            const [profResp, shiftResp, dashResp, ordersResp] = await Promise.all([
                axios.get(`${apiUrl}/api/proprietaire/profiles/me/`, { headers: { "Authorization": `Bearer ${token}` } }),
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
        router.push("/");
    };

    const handleMarkServed = (orderId: number) => {
        router.push(`/order/${orderId}/delivery`);
    };

    const handleMarkPaid = async (orderId: number) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        
        const totalStr = `${order.total_usd > 0 ? parseFloat(order.total_usd).toFixed(2) + '$' : ''}${order.total_usd > 0 && order.total_cdf > 0 ? ' + ' : ''}${order.total_cdf > 0 ? parseFloat(order.total_cdf).toLocaleString() + ' FC' : ''}`;
        
        if (!confirm(`Confirmer l'encaissement de ${totalStr} pour la Table ${order.table_nom} ?`)) return;

        const token = getToken();
        const apiUrl = getApiUrl();
        try {
            await axios.post(`${apiUrl}/api/proprietaire/orders/${orderId}/mark_paid/`, {}, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            setOrders(prev => prev.filter(o => o.id !== orderId));
            const t = getToken();
            if (t) fetchInitialData(t);
        } catch (err) {
            console.error("Erreur encaissement:", err);
            alert("Erreur lors de l'encaissement.");
        }
    };

    const handleStartShift = async () => {
        setIsLoading(true);
        const token = getToken();
        const apiUrl = getApiUrl();
        try {
            const resp = await axios.post(`${apiUrl}/api/proprietaire/shifts/`, { status: "ACTIVE" }, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            setActiveShift(resp.data);
            setShowWelcome(true);
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
        <AuthGuard>
            <div className="min-h-screen bg-[#0c0d0d] text-slate-900 font-sans selection:bg-orange-500/30">
            
            {isMounted && showWelcome && (
                <ActiveShiftOverlay 
                    workerName={profile?.prenom || "Pilote"} 
                    startTime={new Date(activeShift?.start_time || Date.now()).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    barName={data?.bar_info.nom || "BarPilote"}
                    onClose={() => setShowWelcome(false)}
                />
            )}

            {/* TopAppBar */}
            <header className="fixed top-0 w-full z-50 bg-slate-900/80 backdrop-blur-xl shadow-[0_10px_30px_rgba(26,28,29,0.04)] flex items-center justify-between px-6 h-16">
                <div className="flex items-center gap-4">
                    <button className="p-2 text-orange-500 hover:bg-slate-800 transition-colors active:scale-95 rounded-full">
                        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>menu</span>
                    </button>
                    <h1 className="text-xl font-bold text-orange-500 tracking-tight">{data?.bar_info.nom || 'Vigie Bar'}</h1>
                </div>
                <div className="flex items-center gap-6">
                    <nav className="hidden md:flex gap-8">
                        <a className="text-orange-500 font-semibold text-sm" href="#">Commandes</a>
                        <a className="text-slate-500 hover:text-orange-500 transition-all text-sm" href="#">Inventaire</a>
                        <a className="text-slate-500 hover:text-orange-500 transition-all text-sm cursor-pointer" onClick={() => router.push("/tables")}>Tables</a>
                    </nav>
                    <div 
                        onClick={handleLogout}
                        className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 overflow-hidden cursor-pointer hover:border-orange-500 transition-colors"
                    >
                        {profile?.photo_profil ? (
                            <img src={profile.photo_profil} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <span className="material-symbols-outlined text-slate-400">person</span>
                        )}
                    </div>
                </div>
            </header>

            <main className="pt-24 pb-32 px-6 max-w-7xl mx-auto">
                
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

                {/* Dashboard Header */}
                <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <span className="text-[0.6875rem] font-bold tracking-[0.1em] text-orange-500 uppercase">Tableau de Bord Serveur</span>
                        <h2 className="text-4xl font-extrabold text-white tracking-tight mt-1">Service en Cours</h2>
                        <p className="text-slate-400 mt-2">Bienvenue, {profile?.prenom || 'Serveur'} !</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
                            <span className="text-[0.6875rem] text-slate-500 block">REVENU TOTAL</span>
                            <span className="text-xl font-bold text-white">${data?.revenue.usd.toFixed(2) || '0.00'}</span>
                        </div>
                        <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
                            <span className="text-[0.6875rem] text-slate-500 block">TABLES ACTIVES</span>
                            <span className="text-xl font-bold text-white">{data?.metrics.active_orders || 0}</span>
                        </div>
                        <div className="bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
                            <span className="text-[0.6875rem] text-slate-500 block">CLIENTS SERVIS</span>
                            <span className="text-xl font-bold text-white">{data?.metrics.clients || 0}</span>
                        </div>
                    </div>
                </div>

                {/* Server Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/20 p-6 rounded-2xl border border-blue-500/30">
                        <div className="flex items-center justify-between mb-2">
                            <span className="material-symbols-outlined text-blue-400 text-2xl">speed</span>
                            <span className="text-xs text-blue-400 font-bold uppercase">Performance</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{data?.metrics.avg_basket || 0}$</p>
                        <p className="text-sm text-blue-300">Panier moyen</p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-green-600/20 to-green-700/20 p-6 rounded-2xl border border-green-500/30">
                        <div className="flex items-center justify-between mb-2">
                            <span className="material-symbols-outlined text-green-400 text-2xl">timer</span>
                            <span className="text-xs text-green-400 font-bold uppercase">Efficacité</span>
                        </div>
                        <p className="text-2xl font-bold text-white">{data?.metrics.wait_time || 0} min</p>
                        <p className="text-sm text-green-300">Temps moyen</p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/20 p-6 rounded-2xl border border-purple-500/30">
                        <div className="flex items-center justify-between mb-2">
                            <span className="material-symbols-outlined text-purple-400 text-2xl">local_bar</span>
                            <span className="text-xs text-purple-400 font-bold uppercase">Top vente</span>
                        </div>
                        <p className="text-lg font-bold text-white truncate">{data?.best_seller?.name || '-'}</p>
                        <p className="text-sm text-purple-300">{data?.best_seller?.qty || 0} ventes</p>
                    </div>
                    
                    <div className="bg-gradient-to-br from-orange-600/20 to-orange-700/20 p-6 rounded-2xl border border-orange-500/30">
                        <div className="flex items-center justify-between mb-2">
                            <span className="material-symbols-outlined text-orange-400 text-2xl">schedule</span>
                            <span className="text-xs text-orange-400 font-bold uppercase">Service</span>
                        </div>
                        <p className="text-2xl font-bold text-white">
                            {activeShift ? 'En cours' : 'Inactif'}
                        </p>
                        <p className="text-sm text-orange-300">
                            {activeShift ? 'Depuis ' + new Date(activeShift.start_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Démarrer'}
                        </p>
                    </div>
                </div>

                {/* Bento Grid for Orders */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    
                    {/* Orders Loop */}
                    {orders.map((order, idx) => {
                        const elapsedMins = Math.floor((Date.now() - new Date(order.date_creation).getTime()) / 60000);
                        const isV1 = idx === 0;
                        const isV2 = idx === 1;
                        
                        if (isV1) {
                            return (
                                /* V1: Vibrant Border Card (Urgent) */
                                <div key={order.id} className="bg-white rounded-2xl border-[3px] border-orange-600 p-6 shadow-[0_20px_50px_rgba(255,94,0,0.15)] relative flex flex-col min-h-[220px]">
                                    <div className="absolute top-6 right-6 flex items-center gap-2 bg-orange-50 text-orange-700 px-3 py-1 rounded-full border border-orange-200">
                                        <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>timer</span>
                                        <span className="font-bold text-sm tracking-tight">{elapsedMins} min</span>
                                    </div>
                                    <div className="mt-2">
                                        <span className="text-[0.6875rem] font-bold text-slate-400 uppercase tracking-widest">Priorité Immédiate</span>
                                        <h3 className="text-2xl font-extrabold text-slate-900 leading-tight mt-2">Table {order.table_nom} - {order.items.length} Art.</h3>
                                    </div>
                                    <div className="space-y-1 mt-4 flex-1">
                                        {order.items.slice(0, 2).map((item) => (
                                            <p key={item.id} className="text-sm font-medium text-slate-600 truncate">• {item.quantite}x {item.product_name}</p>
                                        ))}
                                    </div>
                                    <div className="mt-auto pt-6 flex justify-between items-center">
                                        <div className="flex -space-x-2">
                                            {order.items.slice(0, 3).map((item, i) => (
                                                <div key={item.id} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center border-2 border-white">
                                                    <span className="material-symbols-outlined text-[16px] text-slate-600">local_bar</span>
                                                </div>
                                            ))}
                                        </div>
                                        {order.statut === 'PENDING' ? (
                                            <button 
                                                onClick={() => handleMarkServed(order.id)}
                                                className="citrus-gradient text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg shadow-orange-500/20 hover:scale-105 transition-transform active:scale-95"
                                            >
                                                Servir Maintenant
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleMarkPaid(order.id)}
                                                className="bg-emerald-600 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg shadow-emerald-500/20 hover:scale-105 transition-transform active:scale-95 flex items-center gap-1"
                                            >
                                                <span className="material-symbols-outlined text-sm">payments</span>
                                                Payer
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        } else if (isV2) {
                            return (
                                /* V2: Modern Card with Subtle Shadows */
                                <div key={order.id} className="bg-white rounded-2xl p-6 shadow-[0_10px_30px_rgba(26,28,29,0.04)] relative flex flex-col min-h-[220px] overflow-hidden group border border-slate-100">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-full blur-3xl -mr-16 -mt-16 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="flex justify-between items-start relative z-10">
                                        <div className="bg-slate-50 w-12 h-12 rounded-xl flex items-center justify-center shadow-inner border border-slate-100">
                                            <span className="material-symbols-outlined text-orange-600" style={{ fontVariationSettings: "'FILL' 1" }}>local_bar</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-tighter">Attente</span>
                                            <span className="text-lg font-mono font-bold text-slate-900">{elapsedMins} min</span>
                                        </div>
                                    </div>
                                    <div className="mt-6 relative z-10 flex-1">
                                        <h3 className="text-xl font-bold text-slate-900 tracking-tight">Table {order.table_nom} - {order.items.length} Art.</h3>
                                        <div className="space-y-1 mt-2">
                                            {order.items.slice(0, 2).map((item) => (
                                                <p key={item.id} className="text-sm font-medium text-slate-500 truncate">• {item.quantite}x {item.product_name}</p>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mt-auto pt-6 flex items-center gap-3 relative z-10">
                                        {order.statut === 'PENDING' ? (
                                            <button 
                                                onClick={() => handleMarkServed(order.id)}
                                                className="w-full bg-slate-100 text-slate-700 hover:bg-orange-50 hover:text-orange-600 px-6 py-2 rounded-full font-bold text-sm transition-colors active:scale-95"
                                            >
                                                Marquer comme Servi
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleMarkPaid(order.id)}
                                                className="w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-6 py-2 rounded-full font-bold text-sm transition-colors active:scale-95 flex items-center justify-center gap-1"
                                            >
                                                <span className="material-symbols-outlined text-sm">payments</span>
                                                Encaisser ({parseFloat(order.total_usd).toFixed(2)}$)
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        } else {
                            return (
                                /* V3: Minimalist Ghost Card */
                                <div key={order.id} className="bg-slate-900/40 border border-slate-800 backdrop-blur-md rounded-2xl p-6 flex flex-col min-h-[220px] hover:border-orange-500/30 transition-all">
                                    <div className="flex justify-between items-center">
                                        <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Table {order.table_nom}</span>
                                        <button onClick={() => router.push(`/order/${order.id}`)}>
                                            <span className="text-white/40 hover:text-white material-symbols-outlined cursor-pointer transition-colors">more_horiz</span>
                                        </button>
                                    </div>
                                    <div className="mt-4 flex-1">
                                        <h3 className="text-xl font-semibold text-white">{order.items.length} Article{order.items.length > 1 ? 's' : ''}</h3>
                                        <div className="mt-3 space-y-2">
                                            {order.items.slice(0, 2).map((item) => (
                                                <div key={item.id} className="flex items-center gap-3 text-slate-400 text-sm">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
                                                    <span className="truncate">{item.product_name} x {item.quantite}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                                        <span className="text-white font-mono text-sm">{elapsedMins} min</span>
                                        {order.statut === 'PENDING' ? (
                                            <button onClick={() => handleMarkServed(order.id)} className="text-orange-500 font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all">
                                                Servir <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                                            </button>
                                        ) : (
                                            <button onClick={() => handleMarkPaid(order.id)} className="text-emerald-500 font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all">
                                                Encaisser <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        }
                    })}

                    {/* Bento Large Card: Summary Stats */}
                    <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-black rounded-3xl p-8 border border-slate-800 flex flex-col md:flex-row gap-8">
                        <div className="flex-1">
                            <span className="text-orange-500 text-[10px] font-bold uppercase tracking-widest">Indicateurs d'Efficacité</span>
                            <h3 className="text-3xl font-bold text-white mt-2">Performance Pic de Service</h3>
                            <p className="text-slate-400 mt-4 leading-relaxed max-w-md">
                                Votre temps de service moyen est actuellement de <span className="text-white font-bold">{data?.metrics.wait_time} minutes</span>. C'est 12% plus rapide que la moyenne de samedi dernier.
                            </p>
                            <div className="mt-8 flex gap-4">
                                <div className="flex-1 p-4 rounded-2xl bg-white/5 border border-white/10">
                                    <span className="text-[10px] text-slate-500 block uppercase">Panier Moyen</span>
                                    <span className="text-2xl font-bold text-white">${data?.metrics.avg_basket.toFixed(2)}</span>
                                </div>
                                <div className="flex-1 p-4 rounded-2xl bg-white/5 border border-white/10">
                                    <span className="text-[10px] text-slate-500 block uppercase">Clients</span>
                                    <span className="text-2xl font-bold text-white">{data?.metrics.clients}</span>
                                </div>
                            </div>
                        </div>
                        <div className="w-full md:w-1/3 flex items-center justify-center">
                            <div className="relative w-40 h-40">
                                {/* Progress Ring */}
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle className="text-slate-800" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeWidth="8"></circle>
                                    <circle className="text-orange-500" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeDasharray="440" strokeDashoffset="110" strokeLinecap="round" strokeWidth="12"></circle>
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-3xl font-black text-white">75%</span>
                                    <span className="text-[8px] text-slate-500 font-bold uppercase">Capacité</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Action Card */}
                    <div 
                        onClick={() => router.push("/tables")}
                        className="bg-orange-600 rounded-3xl p-8 flex flex-col justify-between items-start text-white relative overflow-hidden group cursor-pointer hover:bg-orange-500 transition-colors"
                    >
                        <div className="absolute -right-4 -top-4 opacity-10 group-hover:rotate-12 transition-transform">
                            <span className="material-symbols-outlined text-[160px]">add_circle</span>
                        </div>
                        <span className="material-symbols-outlined text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>add_circle</span>
                        <div className="mt-12 relative z-10">
                            <h3 className="text-2xl font-bold leading-tight">Nouvelle<br/>Commande Rapide</h3>
                            <p className="text-orange-100 text-sm mt-2">Ouvrez instantanément un nouveau compte à une table.</p>
                        </div>
                    </div>

                </div>
            </main>

            {/* BottomNavBar (Mobile Only) */}
            <nav className="md:hidden fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur-xl flex justify-around items-center px-4 pb-6 pt-3 z-50 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/5">
                <a className="flex flex-col items-center justify-center text-orange-500 bg-orange-900/20 rounded-2xl px-4 py-2 active:scale-90 duration-200" href="#">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
                    <span className="text-[11px] font-medium tracking-wide uppercase mt-1">Commandes</span>
                </a>
                <a onClick={() => router.push("/tables")} className="flex flex-col items-center justify-center text-slate-500 px-4 py-2 hover:text-orange-500 transition-all active:scale-90 duration-200 cursor-pointer">
                    <span className="material-symbols-outlined">table_bar</span>
                    <span className="text-[11px] font-medium tracking-wide uppercase mt-1">Tables</span>
                </a>
                <a className="flex flex-col items-center justify-center text-slate-500 px-4 py-2 hover:text-orange-500 transition-all active:scale-90 duration-200 cursor-pointer">
                    <span className="material-symbols-outlined">inventory_2</span>
                    <span className="text-[11px] font-medium tracking-wide uppercase mt-1">Inventaire</span>
                </a>
                <a onClick={() => router.push("/onboarding/staff-profile")} className="flex flex-col items-center justify-center text-slate-500 px-4 py-2 hover:text-orange-500 transition-all active:scale-90 duration-200 cursor-pointer">
                    <span className="material-symbols-outlined">person</span>
                    <span className="text-[11px] font-medium tracking-wide uppercase mt-1">Profil</span>
                </a>
            </nav>

            {/* Large FAB for desktop/tablets */}
            <button 
                onClick={() => router.push("/tables")}
                className="hidden md:flex fixed right-6 bottom-8 w-16 h-16 citrus-gradient text-white rounded-full shadow-2xl items-center justify-center hover:scale-110 active:scale-95 transition-all z-40 border-4 border-slate-900"
            >
                <span className="material-symbols-outlined text-3xl">add</span>
            </button>

            </div>
        </AuthGuard>
    );
}

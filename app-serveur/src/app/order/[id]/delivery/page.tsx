"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { getToken } from "@/lib/auth";
import { getApiUrl } from "@/lib/apiConfig";

interface Order {
    id: string;
    table_nom: string;
    statut: string;
    statut_label: string;
    serveur: string | null;
    serveur_nom: string;
    items: Array<{
        id: string;
        product_nom: string;
        quantity: number;
        price_usd: string;
        total_usd: string;
    }>;
    total_usd: string;
    total_cdf: string;
    date_creation: string;
    date_service: string | null;
}

export default function DeliveryMissionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        console.log("Delivery page - Initialisation avec ID:", id);
        const token = getToken();
        console.log("Delivery page - Token au démarrage:", token ? "présent" : "absent");
        
        if (!token) {
            console.log("Delivery page - Redirection vers login (token manquant)");
            router.push("/auth/login");
            return;
        }
        fetchOrder(token);
    }, [router, id]);

    const fetchOrder = async (token: string) => {
        const apiUrl = getApiUrl();
        console.log("Delivery page - Récupération commande ID:", id, "API:", apiUrl);
        try {
            const resp = await axios.get(`${apiUrl}/api/proprietaire/orders/${id}/`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            console.log("Delivery page - Commande récupérée:", resp.data);
            setOrder(resp.data);
            // Alert de débogage pour confirmer que la page fonctionne
            alert(`Page de livraison chargée - Commande: ${resp.data.table_nom} (${resp.data.statut})`);
        } catch (err) {
            console.error("Erreur chargement commande:", err);
            router.push("/dashboard");
        } finally {
            setIsLoading(false);
        }
    };

    const [deliveryConfirmed, setDeliveryConfirmed] = useState(false);
    const [showOrderDetails, setShowOrderDetails] = useState(false);

    const handleAcceptOrder = async () => {
        console.log("Acceptation de la commande:", id);
        setIsConfirming(true);
        const token = getToken();
        const apiUrl = getApiUrl();
        
        if (!token) {
            alert("Vous devez être connecté pour accepter une commande.");
            setIsConfirming(false);
            return;
        }
        
        try {
            console.log("Acceptation commande à:", `${apiUrl}/api/proprietaire/orders/${id}/accept_order/`);
            const response = await axios.post(`${apiUrl}/api/proprietaire/orders/${id}/accept_order/`, {}, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            console.log("Commande acceptée:", response.data);
            setOrder(response.data);
            alert("Commande acceptée! Vous pouvez maintenant la confirmer.");
        } catch (err: any) {
            console.error("Erreur acceptation commande:", err);
            alert(`Erreur: ${err.response?.data?.detail || err.message || "Impossible d'accepter cette commande."}`);
        } finally {
            setIsConfirming(false);
        }
    };

    const handleConfirmDelivery = async () => {
        console.log("Début confirmation livraison pour commande:", id);
        setIsConfirming(true);
        const token = getToken();
        const apiUrl = getApiUrl();
        
        console.log("Token:", token ? "présent" : "absent");
        console.log("API URL:", apiUrl);
        
        if (!token) {
            console.error("Token manquant");
            alert("Vous devez être connecté pour confirmer une livraison.");
            setIsConfirming(false);
            return;
        }
        
        try {
            console.log("Envoi requête POST à:", `${apiUrl}/api/proprietaire/orders/${id}/mark_served/`);
            const response = await axios.post(`${apiUrl}/api/proprietaire/orders/${id}/mark_served/`, {}, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            console.log("Réponse API:", response.data);
            
            // Mettre à jour l'état local
            setOrder(response.data);
            setDeliveryConfirmed(true);
            
            // Redirection immédiate vers l'accueil après confirmation
            setTimeout(() => {
                router.push("/dashboard");
            }, 1500);
        } catch (err: any) {
            console.error("Erreur confirmation livraison:", err);
            console.error("Détails erreur:", {
                status: err.response?.status,
                statusText: err.response?.statusText,
                data: err.response?.data,
                message: err.message
            });
            
            if (err.response?.status === 401) {
                alert("Session expirée. Veuillez vous reconnecter.");
                router.push("/auth/login");
            } else if (err.response?.status === 404) {
                alert("Commande non trouvée.");
            } else if (err.response?.status === 403) {
                alert("Vous n'avez pas l'autorisation de confirmer cette livraison.");
            } else {
                alert(`Erreur: ${err.response?.data?.detail || err.message || "Une erreur est survenue lors de la confirmation."}`);
            }
        } finally {
            setIsConfirming(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0c0d0d] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0c0d0d] text-white flex flex-col p-8 pb-12 select-none overflow-hidden">
            {/* Header / Back */}
            <div className="flex items-center gap-4 mb-12">
                <button 
                    onClick={() => router.back()}
                    className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                </button>
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">Mission en cours</h2>
            </div>

            {/* Central Mission Icon */}
            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="relative mb-8 group">
                    <div className="absolute inset-0 bg-orange-500/30 blur-[80px] rounded-full scale-110 group-hover:scale-125 transition-transform duration-700"></div>
                    <div className="relative w-48 h-48 bg-orange-500 rounded-[3rem] rotate-12 flex items-center justify-center shadow-2xl transition-transform duration-500 hover:rotate-0">
                        <div
                            className="w-24 h-24 bg-white drop-shadow-md -rotate-12 group-hover:rotate-0 transition-transform"
                            style={{
                                WebkitMaskImage: 'url(/logobarpilote.png)',
                                WebkitMaskSize: 'contain',
                                WebkitMaskRepeat: 'no-repeat',
                                WebkitMaskPosition: 'center',
                                maskImage: 'url(/logobarpilote.png)',
                                maskSize: 'contain',
                                maskRepeat: 'no-repeat',
                                maskPosition: 'center',
                            }}
                        />
                    </div>
                </div>

                <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500">Statut de la mission</p>
                    <h1 className="text-6xl font-black tracking-tighter leading-none">
                        {deliveryConfirmed ? (
                            <>
                                Mission<br/>Terminée
                            </>
                        ) : (
                            <>
                                Mission en<br/>cours
                            </>
                        )}
                    </h1>
                    <p className="text-xl text-zinc-400 font-medium">
                        {deliveryConfirmed ? (
                            <>Livré à la <span className="text-green-500 font-black uppercase italic tracking-tight">Table {order?.table_nom}</span></>
                        ) : (
                            <>Livrer à la <span className="text-white font-black uppercase italic tracking-tight">Table {order?.table_nom}</span></>
                        )}
                    </p>
                </div>
            </div>

            {/* Progress Bar Container */}
            <div className="w-full max-w-md mx-auto mb-16 px-4 animate-in fade-in slide-in-from-bottom-8 duration-500 delay-200">
                <div className="relative h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                        className={`absolute top-0 left-0 h-full transition-all duration-1000 ${
                            deliveryConfirmed 
                                ? 'w-full bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]' 
                                : 'w-[70%] bg-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.5)]'
                        }`}
                    ></div>
                </div>
                <div className="flex justify-between mt-3 px-1 text-[10px] font-black uppercase tracking-widest text-zinc-600">
                    <span className="text-zinc-500">Départ</span>
                    <span className={deliveryConfirmed ? "text-green-500 font-black" : "text-orange-500 font-black"}>
                        {deliveryConfirmed ? "Terminé" : "En Transit"}
                    </span>
                    <span className={deliveryConfirmed ? "text-green-500 font-black" : ""}>Arrivée</span>
                </div>
            </div>

            {/* Actions */}
            <div className="space-y-6 w-full max-w-sm mx-auto animate-in fade-in slide-in-from-bottom-10 duration-500 delay-400">
                {!deliveryConfirmed ? (
                    <>
                        <button 
                            onClick={handleConfirmDelivery}
                            disabled={isConfirming}
                            className="w-full bg-[#ea580c] text-white py-6 rounded-[32px] font-black text-lg shadow-2xl shadow-orange-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 group relative overflow-hidden"
                        >
                            {isConfirming ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin">sync</span>
                                    <span>Confirmation en cours...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined font-black">check_circle</span>
                                    <span>Confirmer la Livraison</span>
                                </>
                            )}
                        </button>

                        <button 
                            onClick={() => setShowOrderDetails(!showOrderDetails)}
                            className="w-full flex items-center justify-center gap-2 text-zinc-600 hover:text-zinc-400 transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">receipt_long</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">Détail Commande</span>
                        </button>

                        {order?.statut === 'SERVED' && (
                            <button 
                                onClick={() => router.push(`/order/${id}/payment`)}
                                className="w-full flex items-center justify-center gap-2 text-green-600 hover:text-green-400 transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">payments</span>
                                <span className="text-[10px] font-black uppercase tracking-widest">Payer la Commande</span>
                            </button>
                        )}

                        <button className="w-full flex items-center justify-center gap-2 text-zinc-600 hover:text-zinc-400 transition-colors">
                            <span className="material-symbols-outlined text-sm">warning</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">Signaler un Problème</span>
                        </button>

                        <button 
                            onClick={async () => {
                                const token = getToken();
                                const apiUrl = getApiUrl();
                                console.log("Test API - Token:", token ? "présent" : "absent");
                                console.log("Test API - URL:", apiUrl);
                                try {
                                    const resp = await axios.get(`${apiUrl}/api/proprietaire/orders/${id}/`, {
                                        headers: { "Authorization": `Bearer ${token}` }
                                    });
                                    console.log("Test API - Commande:", resp.data);
                                    alert(`Connectivité OK. Commande ${resp.data.statut} - Table ${resp.data.table_nom} - Serveur: ${resp.data.serveur_nom}`);
                                } catch (err: any) {
                                    console.error("Test API - Erreur:", err);
                                    alert(`Erreur de connectivité: ${err.response?.status} - ${err.message}`);
                                }
                            }}
                            className="w-full flex items-center justify-center gap-2 text-blue-600 hover:text-blue-400 transition-colors"
                        >
                            <span className="material-symbols-outlined text-sm">bug_report</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">Test API</span>
                        </button>
                    </>
                ) : (
                    <div className="w-full bg-green-600 text-white py-6 rounded-[32px] font-black text-lg shadow-2xl shadow-green-500/20 flex items-center justify-center gap-3 animate-in fade-in duration-500">
                        <span className="material-symbols-outlined font-black">check_circle</span>
                        <span>Livraison Confirmée!</span>
                    </div>
                )}
            </div>

            {/* Popover Détails Commande */}
            {showOrderDetails && order && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
                    <div className="bg-zinc-900 rounded-[32px] p-6 max-w-md w-full max-h-[80vh] overflow-y-auto border border-white/10 shadow-2xl">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-black text-white">Détails de la Commande</h3>
                            <button 
                                onClick={() => setShowOrderDetails(false)}
                                className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-3 border-b border-zinc-800">
                                <span className="text-zinc-400 text-sm">Table</span>
                                <span className="text-white font-black">{order.table_nom}</span>
                            </div>

                            <div className="flex justify-between items-center py-3 border-b border-zinc-800">
                                <span className="text-zinc-400 text-sm">Statut</span>
                                <span className={`font-black text-sm px-3 py-1 rounded-full ${
                                    order.statut === 'PENDING' ? 'bg-yellow-500/20 text-yellow-500' :
                                    order.statut === 'IN_PROGRESS' ? 'bg-blue-500/20 text-blue-500' :
                                    order.statut === 'SERVED' ? 'bg-green-500/20 text-green-500' :
                                    'bg-zinc-500/20 text-zinc-500'
                                }`}>
                                    {order.statut_label || order.statut}
                                </span>
                            </div>

                            <div className="flex justify-between items-center py-3 border-b border-zinc-800">
                                <span className="text-zinc-400 text-sm">Serveur</span>
                                <span className="text-white font-black">{order.serveur_nom}</span>
                            </div>

                            <div className="flex justify-between items-center py-3 border-b border-zinc-800">
                                <span className="text-zinc-400 text-sm">Date</span>
                                <span className="text-white text-sm">
                                    {new Date(order.date_creation).toLocaleDateString('fr-FR', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </span>
                            </div>

                            <div className="pt-4">
                                <h4 className="text-sm font-black text-zinc-500 uppercase tracking-widest mb-3">Articles</h4>
                                <div className="space-y-2">
                                    {order.items.map((item, index) => (
                                        <div key={item.id || index} className="flex justify-between items-center py-2">
                                            <div className="flex-1">
                                                <p className="text-white font-medium">{item.product_nom}</p>
                                                <p className="text-zinc-500 text-xs">Quantité: {item.quantity}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-white font-black">${item.total_usd}</p>
                                                <p className="text-zinc-500 text-xs">${item.price_usd} × {item.quantity}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-zinc-800">
                                <div className="flex justify-between items-center">
                                    <span className="text-lg font-black text-white">Total</span>
                                    <span className="text-xl font-black text-orange-500">${order.total_usd}</span>
                                </div>
                                {order.total_cdf !== "0.00" && (
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-sm text-zinc-400">Total CDF</span>
                                        <span className="text-sm text-zinc-400">{order.total_cdf} CDF</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Decorative background blur */}
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-orange-500/5 blur-[120px] rounded-full"></div>
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-zinc-500/5 blur-[120px] rounded-full"></div>
        </div>
    );
}

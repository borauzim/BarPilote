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

export default function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [order, setOrder] = useState<Order | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile' | 'card'>('cash');
    const [paymentConfirmed, setPaymentConfirmed] = useState(false);

    useEffect(() => {
        console.log("Payment page - Initialisation avec ID:", id);
        const token = getToken();
        console.log("Payment page - Token au démarrage:", token ? "présent" : "absent");
        
        if (!token) {
            console.log("Payment page - Redirection vers login (token manquant)");
            router.push("/auth/login");
            return;
        }
        fetchOrder(token);
    }, [router, id]);

    const fetchOrder = async (token: string) => {
        const apiUrl = getApiUrl();
        console.log("Payment page - Récupération commande ID:", id, "API:", apiUrl);
        try {
            const resp = await axios.get(`${apiUrl}/api/proprietaire/orders/${id}/`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            console.log("Payment page - Commande récupérée:", resp.data);
            setOrder(resp.data);
            
            // Vérifier si la commande peut être payée
            if (resp.data.statut !== 'SERVED') {
                alert("Cette commande doit d'abord être confirmée comme livrée avant d'être payée.");
                router.push(`/order/${id}/delivery`);
                return;
            }
        } catch (err) {
            console.error("Erreur chargement commande:", err);
            router.push("/dashboard");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePayment = async () => {
        console.log("Début paiement pour commande:", id);
        setIsProcessing(true);
        const token = getToken();
        const apiUrl = getApiUrl();
        
        if (!token) {
            alert("Vous devez être connecté pour effectuer un paiement.");
            setIsProcessing(false);
            return;
        }
        
        try {
            console.log("Envoi requête POST à:", `${apiUrl}/api/proprietaire/orders/${id}/mark_paid/`);
            const response = await axios.post(`${apiUrl}/api/proprietaire/orders/${id}/mark_paid/`, {
                payment_method: paymentMethod,
                payment_amount: order?.total_usd
            }, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            console.log("Réponse API paiement:", response.data);
            
            // Mettre à jour l'état local
            setOrder(response.data);
            setPaymentConfirmed(true);
            
            // Redirection vers le dashboard après confirmation
            setTimeout(() => {
                router.push("/dashboard");
            }, 2000);
        } catch (err: any) {
            console.error("Erreur paiement:", err);
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
                alert("Vous n'avez pas l'autorisation d'effectuer ce paiement.");
            } else {
                alert(`Erreur: ${err.response?.data?.detail || err.message || "Une erreur est survenue lors du paiement."}`);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0c0d0d] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin"></div>
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
                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">Paiement</h2>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                {/* Order Summary */}
                <div className="bg-zinc-900/50 rounded-[24px] p-6 mb-8 border border-white/5">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-black text-white">Résumé de la commande</h3>
                        <span className={`px-3 py-1 rounded-full text-xs font-black ${
                            order?.statut === 'SERVED' ? 'bg-green-500/20 text-green-500' : 'bg-zinc-500/20 text-zinc-500'
                        }`}>
                            {order?.statut_label || order?.statut}
                        </span>
                    </div>
                    
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Table</span>
                            <span className="text-white font-medium">{order?.table_nom}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-zinc-400">Articles</span>
                            <span className="text-white font-medium">{order?.items.length}</span>
                        </div>
                        <div className="border-t border-zinc-800 pt-3 mt-3">
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-black text-white">Total à payer</span>
                                <span className="text-2xl font-black text-green-500">${order?.total_usd}</span>
                            </div>
                            {order?.total_cdf !== "0.00" && (
                                <div className="flex justify-between items-center mt-2">
                                    <span className="text-sm text-zinc-400">Total CDF</span>
                                    <span className="text-sm text-zinc-400">{order?.total_cdf} CDF</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Payment Methods */}
                <div className="space-y-4 mb-8">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500 mb-4">Méthode de paiement</h3>
                    
                    <div className="space-y-3">
                        <button
                            onClick={() => setPaymentMethod('cash')}
                            className={`w-full p-4 rounded-[16px] border-2 transition-all flex items-center justify-between ${
                                paymentMethod === 'cash' 
                                    ? 'bg-green-500/10 border-green-500' 
                                    : 'bg-zinc-900/50 border-zinc-700 hover:border-zinc-600'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-xl">payments</span>
                                <span className="font-medium">Espèces</span>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                paymentMethod === 'cash' ? 'border-green-500' : 'border-zinc-600'
                            }`}>
                                {paymentMethod === 'cash' && (
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                )}
                            </div>
                        </button>

                        <button
                            onClick={() => setPaymentMethod('mobile')}
                            className={`w-full p-4 rounded-[16px] border-2 transition-all flex items-center justify-between ${
                                paymentMethod === 'mobile' 
                                    ? 'bg-green-500/10 border-green-500' 
                                    : 'bg-zinc-900/50 border-zinc-700 hover:border-zinc-600'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-xl">smartphone</span>
                                <span className="font-medium">Mobile Money</span>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                paymentMethod === 'mobile' ? 'border-green-500' : 'border-zinc-600'
                            }`}>
                                {paymentMethod === 'mobile' && (
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                )}
                            </div>
                        </button>

                        <button
                            onClick={() => setPaymentMethod('card')}
                            className={`w-full p-4 rounded-[16px] border-2 transition-all flex items-center justify-between ${
                                paymentMethod === 'card' 
                                    ? 'bg-green-500/10 border-green-500' 
                                    : 'bg-zinc-900/50 border-zinc-700 hover:border-zinc-600'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-xl">credit_card</span>
                                <span className="font-medium">Carte bancaire</span>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                paymentMethod === 'card' ? 'border-green-500' : 'border-zinc-600'
                            }`}>
                                {paymentMethod === 'card' && (
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                )}
                            </div>
                        </button>
                    </div>
                </div>

                {/* Payment Button */}
                <div className="mt-auto">
                    {!paymentConfirmed ? (
                        <button 
                            onClick={handlePayment}
                            disabled={isProcessing}
                            className="w-full bg-green-600 text-white py-6 rounded-[32px] font-black text-lg shadow-2xl shadow-green-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 group relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isProcessing ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin">sync</span>
                                    <span>Traitement en cours...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined font-black">payments</span>
                                    <span>Confirmer le Paiement - ${order?.total_usd}</span>
                                </>
                            )}
                        </button>
                    ) : (
                        <div className="w-full bg-green-600 text-white py-6 rounded-[32px] font-black text-lg shadow-2xl shadow-green-500/20 flex items-center justify-center gap-3 animate-in fade-in duration-500">
                            <span className="material-symbols-outlined font-black">check_circle</span>
                            <span>Paiement Confirmé!</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Decorative background blur */}
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-green-500/5 blur-[120px] rounded-full"></div>
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-zinc-500/5 blur-[120px] rounded-full"></div>
        </div>
    );
}

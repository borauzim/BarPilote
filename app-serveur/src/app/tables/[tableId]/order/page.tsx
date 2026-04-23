"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import { getToken } from "@/lib/auth";
import { getApiUrl } from "@/lib/apiConfig";

interface Product {
    id: number;
    produit_details: {
        nom: string;
        categorie: string;
        volume: string;
    };
    prix_vente_unitaire: number;
}

interface BasketItem {
    product: Product;
    quantity: number;
}

export default function OrderTakingPage() {
    const { tableId } = useParams();
    const router = useRouter();
    const [menu, setMenu] = useState<Product[]>([]);
    const [basket, setBasket] = useState<BasketItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string>("All");
    const [tableName, setTableName] = useState<string>("Chargement...");

    useEffect(() => {
        const token = getToken();
        if (!token) {
            router.push("/auth/login");
            return;
        }
        const startTime = performance.now();
        console.log("Début chargement page commande");
        
        // Charger les données en parallèle
        Promise.all([
            fetchMenu(token),
            fetchTableDetails(token)
        ]).then(() => {
            const endTime = performance.now();
            console.log("Page commande chargée - Durée:", (endTime - startTime).toFixed(2), "ms");
        });
    }, [router, tableId]);

    const fetchTableDetails = async (token: string) => {
        const startTime = performance.now();
        const apiUrl = getApiUrl();
        try {
            const resp = await axios.get(`${apiUrl}/api/proprietaire/tables/${tableId}/`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            setTableName(resp.data.nom);
            const endTime = performance.now();
            console.log("Table détails chargés - Durée:", (endTime - startTime).toFixed(2), "ms");
        } catch (err) {
            console.error("Erreur table details:", err);
            setTableName("Table Inconnue");
        }
    };

    const fetchMenu = async (token: string) => {
        const startTime = performance.now();
        const apiUrl = getApiUrl();
        try {
            const resp = await axios.get(`${apiUrl}/api/proprietaire/stock/`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            setMenu(resp.data);
            const endTime = performance.now();
            console.log("Menu chargé - Articles:", resp.data.length, "- Durée:", (endTime - startTime).toFixed(2), "ms");
        } catch (err) {
            console.error("Erreur chargement menu:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const categories = useMemo(() => {
        const cats = new Set(menu.map(p => p.produit_details.categorie));
        return ["All", ...Array.from(cats)];
    }, [menu]);

    const filteredMenu = useMemo(() => {
        if (activeCategory === "All") return menu;
        return menu.filter(p => p.produit_details.categorie === activeCategory);
    }, [menu, activeCategory]);

    const addToBasket = (product: Product) => {
        setBasket(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item => 
                    item.product.id === product.id 
                    ? { ...item, quantity: item.quantity + 1 } 
                    : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId: number, delta: number) => {
        setBasket(prev => {
            return prev.map(item => {
                if (item.product.id === productId) {
                    const newQty = Math.max(0, item.quantity + delta);
                    return { ...item, quantity: newQty };
                }
                return item;
            }).filter(item => item.quantity > 0);
        });
    };

    const totalPrice = useMemo(() => {
        return basket.reduce((sum, item) => sum + (item.product.prix_vente_unitaire * item.quantity), 0);
    }, [basket]);

    const handleSendOrder = async () => {
        if (basket.length === 0) return;
        setIsSubmitting(true);
        const token = getToken();
        const apiUrl = getApiUrl();

        console.log("Début envoi commande - Articles:", basket.length);
        console.log("Table ID:", tableId);
        console.log("API URL:", apiUrl);

        try {
            const startTime = performance.now();
            
            const orderData = {
                table: tableId,
                statut: "PENDING",
                items: basket.map(item => ({
                    product_item: item.product.id,
                    quantite: item.quantity,
                    prix_unitaire: item.product.prix_vente_unitaire
                }))
            };

            console.log("Données commande préparées:", orderData);

            const response = await axios.post(`${apiUrl}/api/proprietaire/orders/`, orderData, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            const endTime = performance.now();
            console.log("Commande envoyée avec succès - Durée:", (endTime - startTime).toFixed(2), "ms");
            console.log("Réponse API:", response.data);

            // Succès et redirection vers le dashboard
            router.push("/dashboard");
        } catch (err: any) {
            const endTime = performance.now();
            console.error("Erreur envoi commande - Durée:", (endTime - startTime).toFixed(2), "ms");
            console.error("Détails erreur:", {
                status: err.response?.status,
                statusText: err.response?.statusText,
                data: err.response?.data,
                message: err.message
            });
            
            if (err.response?.status === 401) {
                alert("Session expirée. Veuillez vous reconnecter.");
                router.push("/auth/login");
            } else if (err.response?.status === 400) {
                alert("Erreur de validation: " + (err.response?.data?.detail || "Vérifiez les données de la commande."));
            } else if (err.response?.status === 500) {
                alert("Erreur serveur. Veuillez réessayer dans un instant.");
            } else {
                alert("Erreur lors de l'envoi de la commande: " + (err.response?.data?.detail || err.message));
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#0c0d0d] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 animate-pulse">
                    <span className="material-symbols-outlined text-orange-500 text-5xl">inventory_2</span>
                    <p className="text-zinc-500 text-xs font-bold tracking-widest uppercase">Chargement du menu...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0c0d0d] flex flex-col font-sans text-white">
            <header className="px-6 pt-12 pb-4 bg-zinc-900/40 backdrop-blur-xl border-b border-white/5 sticky top-0 z-30">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => router.push("/tables")} 
                            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 active:scale-90 transition-all"
                        >
                            <span className="material-symbols-outlined text-white">arrow_back</span>
                        </button>
                        <div>
                            <h1 className="text-xl font-black tracking-tight text-white uppercase">Saisie</h1>
                            <p className="text-[10px] font-black text-orange-500 uppercase tracking-[0.2em]">{tableName}</p>
                        </div>
                    </div>
                </div>

                {/* Categories Scroll */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-5 py-2.5 rounded-full text-[11px] font-black tracking-wider transition-all whitespace-nowrap uppercase border ${
                                activeCategory === cat 
                                ? "bg-orange-500/20 text-orange-500 border-orange-500/50 shadow-[0_0_15px_rgba(255,94,0,0.2)]" 
                                : "bg-zinc-900 text-zinc-500 border-white/5 hover:text-white hover:border-white/20"
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </header>

            <main className="flex-1 px-6 pt-6 pb-64 overflow-y-auto">
                <div className="grid grid-cols-1 gap-3 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    {filteredMenu.map((item) => (
                        <div 
                            key={item.id}
                            className="bg-zinc-900/40 border border-white/5 p-4 rounded-3xl flex items-center justify-between group active:scale-[0.98] transition-all hover:bg-zinc-800/50"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-orange-500 border border-white/5">
                                    <span className="material-symbols-outlined">liquor</span>
                                </div>
                                <div>
                                    <p className="text-sm font-black text-white leading-tight">{item.produit_details.nom}</p>
                                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">{item.produit_details.volume} • {item.produit_details.categorie}</p>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <p className="text-sm font-black text-orange-400">${item.prix_vente_unitaire}</p>
                                <button 
                                    onClick={() => addToBasket(item)}
                                    className="w-10 h-10 rounded-full bg-orange-600 text-white flex items-center justify-center shadow-[0_0_15px_rgba(255,94,0,0.4)] active:scale-90 transition-all font-bold"
                                >
                                    <span className="material-symbols-outlined text-xl">add</span>
                                </button>
                            </div>
                        </div>
                    ))}

                    {filteredMenu.length === 0 && (
                        <div className="text-center p-12 text-zinc-500">
                            <span className="material-symbols-outlined text-5xl mb-4 opacity-50">search_off</span>
                            <p className="text-xs font-bold uppercase tracking-widest">Aucun produit dans cette catégorie.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* Bottom Basket Bar (Vigie Style) */}
            {basket.length > 0 && (
                <div className="fixed bottom-0 left-0 w-full p-4 z-50 animate-in slide-in-from-bottom-12 duration-500">
                    <div className="bg-[#0c0d0d] border border-white/10 rounded-[32px] p-6 shadow-[0_-20px_40px_rgba(0,0,0,0.8)] space-y-4">
                        
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400">En cours d'ajout</h3>
                            <span className="bg-orange-500/20 text-orange-500 text-[10px] font-black px-2 py-1 rounded-md">{basket.length} REF</span>
                        </div>

                        {/* Basket Items Summary */}
                        <div className="max-h-32 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            {basket.map(item => (
                                <div key={item.product.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-md bg-zinc-800 border border-white/10 flex items-center justify-center text-[11px] font-black text-white">
                                            x{item.quantity}
                                        </div>
                                        <p className="text-sm font-bold text-white/90">{item.product.produit_details.nom}</p>
                                    </div>
                                    <div className="flex items-center gap-3 bg-zinc-900 rounded-full border border-white/5 px-2 py-1">
                                        <button onClick={() => updateQuantity(item.product.id, -1)} className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-white active:scale-90 transition-all bg-black/50">
                                            <span className="material-symbols-outlined text-sm">remove</span>
                                        </button>
                                        <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.product.id, 1)} className="w-8 h-8 flex items-center justify-center rounded-full text-orange-500 hover:text-orange-400 active:scale-90 transition-all bg-orange-500/10">
                                            <span className="material-symbols-outlined text-sm">add</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-4">
                            <div>
                                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total panier</p>
                                <p className="text-3xl font-black text-white">${totalPrice.toFixed(2)}</p>
                            </div>
                            <button 
                                onClick={handleSendOrder}
                                disabled={isSubmitting}
                                className="flex-1 bg-orange-600 text-white h-14 rounded-2xl font-black text-sm flex items-center justify-center gap-3 active:scale-95 transition-all shadow-[0_0_20px_rgba(255,94,0,0.5)] disabled:opacity-50 disabled:shadow-none"
                            >
                                {isSubmitting ? (
                                    <span className="material-symbols-outlined animate-spin font-bold">sync</span>
                                ) : (
                                    <>
                                        TRANSMETTRE
                                        <span className="material-symbols-outlined">send</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

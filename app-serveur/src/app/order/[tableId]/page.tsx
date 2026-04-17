"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";
import { getToken } from "@/lib/auth";

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
        fetchMenu(token);
        fetchTableDetails(token);
    }, [router, tableId]);

    const fetchTableDetails = async (token: string) => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        try {
            const resp = await axios.get(`${apiUrl}/api/proprietaire/tables/${tableId}/`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            setTableName(resp.data.nom);
        } catch (err) {
            console.error("Erreur table details:", err);
            setTableName("Table Inconnue");
        }
    };

    const fetchMenu = async (token: string) => {
        setIsLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        try {
            const resp = await axios.get(`${apiUrl}/api/proprietaire/stock/`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            setMenu(resp.data);
            if (resp.data.length > 0) {
                // Categories could be extracted here if needed
            }
        } catch (err) {
            console.error(err);
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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

        try {
            // Création atomique : on envoie tout d'un coup
            const orderData = {
                table: tableId,
                statut: "PENDING",
                items: basket.map(item => ({
                    product_item: item.product.id,
                    quantite: item.quantity,
                    prix_unitaire: item.product.prix_vente_unitaire
                }))
            };

            await axios.post(`${apiUrl}/api/proprietaire/orders/`, orderData, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            // Succès et redirection
            router.push("/dashboard");
        } catch (err: any) {
            alert("Erreur lors de l'envoi de la commande.");
            console.error(err);
        } finally {
            setIsSubmitting(false);
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
            <header className="px-6 pt-12 pb-4 bg-white/80 backdrop-blur-md sticky top-0 z-30">
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => router.push("/tables")} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                        <span className="material-symbols-outlined text-on-surface">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-xl font-black tracking-tight text-on-surface">Nouvelle Commande</h1>
                        <p className="text-[10px] font-bold text-primary-container uppercase tracking-widest">{tableName}</p>
                    </div>
                </div>

                {/* Categories Scroll */}
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-5 py-2.5 rounded-full text-xs font-black transition-all whitespace-nowrap ${
                                activeCategory === cat 
                                ? "bg-primary-container text-white shadow-lg shadow-primary-container/20" 
                                : "bg-surface-container-high text-on-surface-variant"
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </header>

            <main className="flex-1 px-6 pt-4 pb-48">
                <div className="grid grid-cols-1 gap-3">
                    {filteredMenu.map((item) => (
                        <div 
                            key={item.id}
                            className="bg-surface-container-lowest p-4 rounded-3xl executive-shadow flex items-center justify-between group active:scale-[0.98] transition-transform"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-primary-container">
                                    <span className="material-symbols-outlined">liquor</span>
                                </div>
                                <div>
                                    <p className="text-sm font-black text-on-surface leading-tight">{item.produit_details.nom}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.produit_details.volume}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <p className="text-sm font-black text-on-surface">${item.prix_vente_unitaire}</p>
                                <button 
                                    onClick={() => addToBasket(item)}
                                    className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center shadow-lg shadow-primary-container/20 active:scale-90 transition-all font-bold"
                                >
                                    <span className="material-symbols-outlined text-xl">add</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Bottom Basket Bar */}
            {basket.length > 0 && (
                <div className="fixed bottom-0 left-0 w-full p-6 z-50 animate-in slide-in-from-bottom duration-300">
                    <div className="bg-slate-900 rounded-[2.5rem] p-6 shadow-2xl space-y-4">
                        {/* Basket Items Summary */}
                        <div className="max-h-32 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                            {basket.map(item => (
                                <div key={item.product.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[10px] font-black text-white">
                                            {item.quantity}
                                        </div>
                                        <p className="text-xs font-bold text-white/90">{item.product.produit_details.nom}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => updateQuantity(item.product.id, -1)} className="text-white/40 hover:text-white"><span className="material-symbols-outlined text-sm">remove_circle</span></button>
                                        <button onClick={() => updateQuantity(item.product.id, 1)} className="text-white/40 hover:text-white"><span className="material-symbols-outlined text-sm">add_circle</span></button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                            <div className="text-white">
                                <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Total à payer</p>
                                <p className="text-2xl font-black">${totalPrice.toFixed(2)}</p>
                            </div>
                            <button 
                                onClick={handleSendOrder}
                                disabled={isSubmitting}
                                className="bg-primary-container text-white h-14 px-8 rounded-2xl font-black text-sm flex items-center gap-3 active:scale-95 transition-all shadow-lg shadow-primary-container/20 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <span className="material-symbols-outlined animate-spin font-bold">sync</span>
                                ) : (
                                    <>
                                        Envoyer
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

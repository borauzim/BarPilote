"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import { getAuthClient } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import ExecutiveCard from "@/components/ExecutiveCard";

// --- Types ---
interface MasterDrink {
    id: string;
    name: string;
    category: string;
    volume: string;
    imageUrl: string;
}

interface BarStock {
    id: string; 
    drink: MasterDrink;
    boughtQuantity: number; 
    purchaseStrategy: "Bouteille" | "Casier";
    bottlesPerCrate?: number; 
    purchasePrice: number; 
    sellingPrice: number; 
    currency: "USD" | "CDF";
    alertThreshold: number;
    db_id?: string;
}

interface CategoryData {
    id: number;
    nom: string;
}

export default function InventoryAdvancedPage() {
    const router = useRouter();
    const [viewState, setViewState] = useState<"MY_STOCK" | "CATALOG">("MY_STOCK");
    const [myStock, setMyStock] = useState<BarStock[]>([]);
    const [masterCatalog, setMasterCatalog] = useState<MasterDrink[]>([]);
    const [categories, setCategories] = useState<CategoryData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    // Search & Filter
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategoryId, setActiveCategoryId] = useState<string>("all");

    // Editing State
    const [editingStockId, setEditingStockId] = useState<string | null>(null);
    const [formConfig, setFormConfig] = useState<any>({
        strategy: "Casier",
        bottlesPerCrate: 24,
        quantity: 1,
        purchasePrice: 0,
        sellingPrice: 0,
        currency: "USD",
        threshold: 12
    });

    useEffect(() => {
        setIsMounted(true);
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const api = getAuthClient();
            
            // 1. Categories
            const catResp = await api.get("/api/proprietaire/categories/");
            setCategories(catResp.data);

            // 2. Master Catalog (Real products from backend)
            const prodResp = await api.get("/api/proprietaire/master-products/");
            setMasterCatalog(prodResp.data.map((p: any) => ({
                id: p.id,
                name: p.nom,
                category: p.categorie_nom || "Autre",
                volume: p.volume,
                imageUrl: p.photo || "/drinks-3d/img-19.png"
            })));

            // 3. My Stock
            const stockResp = await api.get("/api/proprietaire/stock/");
            setMyStock(stockResp.data.map((s: any) => ({
                db_id: s.id,
                id: `S_${s.id}`,
                drink: {
                    id: s.produit,
                    name: s.produit_details?.nom || "Inconnu",
                    category: s.produit_details?.categorie_nom || "Autre",
                    volume: s.produit_details?.volume || "",
                    imageUrl: s.produit_details?.photo || "/drinks-3d/img-19.png"
                },
                boughtQuantity: s.quantite_actuelle,
                purchaseStrategy: s.strategie_gestion === "CASIER" ? "Casier" : "Bouteille",
                bottlesPerCrate: s.bouteilles_par_casier,
                purchasePrice: s.strategie_gestion === "CASIER" ? s.prix_achat_casier : s.prix_achat_unitaire,
                sellingPrice: s.prix_vente_unitaire,
                currency: s.devise === "CDF" ? "CDF" : "USD",
                alertThreshold: s.seuil_alerte
            })));

        } catch (error: any) {
            console.error("Fetch Error:", error);
            if (error.response?.status === 401) router.push("/auth/login");
        } finally {
            setIsLoading(false);
        }
    };

    const filteredCatalog = useMemo(() => {
        return masterCatalog.filter(drink => {
            const matchesSearch = drink.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesCat = activeCategoryId === "all" || drink.category.toLowerCase() === categories.find(c => c.id.toString() === activeCategoryId)?.nom.toLowerCase();
            return matchesSearch && matchesCat;
        });
    }, [masterCatalog, searchQuery, activeCategoryId, categories]);

    const handleAddToMyStock = (drink: MasterDrink) => {
        if (myStock.find(s => s.drink.id === drink.id)) {
            setViewState("MY_STOCK");
            return;
        }
        const initialItem: BarStock = {
            id: `TEMP_${drink.id}`,
            drink,
            boughtQuantity: 0,
            purchaseStrategy: "Casier",
            bottlesPerCrate: 24,
            purchasePrice: 0,
            sellingPrice: 0,
            currency: "USD",
            alertThreshold: 12
        };
        setMyStock([...myStock, initialItem]);
        setViewState("MY_STOCK");
        handleOpenEdit(initialItem);
    };

    const handleOpenEdit = (stock: BarStock) => {
        setEditingStockId(stock.id);
        setFormConfig({
            strategy: stock.purchaseStrategy,
            bottlesPerCrate: stock.bottlesPerCrate || 24,
            quantity: stock.purchaseStrategy === "Casier" ? Math.floor(stock.boughtQuantity / (stock.bottlesPerCrate || 24)) : stock.boughtQuantity,
            purchasePrice: stock.purchasePrice,
            sellingPrice: stock.sellingPrice,
            currency: stock.currency,
            threshold: stock.alertThreshold
        });
    };

    const handleSaveConfig = async () => {
        const item = myStock.find(s => s.id === editingStockId);
        if (!item) return;

        const api = getAuthClient();
        const payload = {
            produit: item.drink.id,
            strategie_gestion: formConfig.strategy === "Casier" ? "CASIER" : "UNITE",
            quantite_actuelle: formConfig.strategy === "Casier" ? formConfig.quantity * formConfig.bottlesPerCrate : formConfig.quantity,
            seuil_alerte: formConfig.threshold,
            devise: formConfig.currency,
            prix_achat_casier: formConfig.strategy === "Casier" ? formConfig.purchasePrice : 0,
            bouteilles_par_casier: formConfig.bottlesPerCrate,
            prix_achat_unitaire: formConfig.strategy === "Bouteille" ? formConfig.purchasePrice : (formConfig.purchasePrice / formConfig.bottlesPerCrate),
            prix_vente_unitaire: formConfig.sellingPrice
        };

        try {
            const isNew = item.id.startsWith("TEMP_");
            const resp = isNew 
                ? await api.post("/api/proprietaire/stock/", payload)
                : await api.patch(`/api/proprietaire/stock/${item.db_id}/`, payload);
            
            if (resp.status < 300) {
                setEditingStockId(null);
                fetchInitialData(); // Refresh to get correct IDs
            }
        } catch (err) {
            console.error("Save Error:", err);
            alert("Erreur lors de l'enregistrement. Vérifiez les prix.");
        }
    };

    const handleExportPDF = () => {
        setIsExporting(true);
        const doc = new jsPDF();
        doc.setFont("helvetica", "bold");
        doc.text("INVENTAIRE BARPILOTE", 14, 20);
        doc.setFontSize(10);
        doc.text(`Généré le: ${new Date().toLocaleDateString()}`, 14, 30);

        let y = 45;
        myStock.forEach(item => {
            doc.text(`${item.drink.name} (${item.drink.volume})`, 14, y);
            doc.text(`${item.boughtQuantity} btls`, 80, y);
            doc.text(`${item.sellingPrice} ${item.currency}`, 120, y);
            y += 8;
            if (y > 280) { doc.addPage(); y = 20; }
        });

        doc.save(`Inventaire_${Date.now()}.pdf`);
        setIsExporting(false);
    };

    if (!isMounted) return null;

    return (
        <div className="bg-background text-on-surface min-h-screen pb-32">
            {/* HEADER */}
            <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-[0_10px_30px_rgba(26,28,29,0.04)]">
                <div className="flex items-center justify-between px-6 h-16 w-full max-w-7xl mx-auto">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="hover:bg-slate-200/50 p-2 rounded-full transition-colors active:scale-95"
                        >
                            <span className="material-symbols-outlined text-orange-600">arrow_back</span>
                        </button>
                        <div
                            className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-white"
                            style={{
                                WebkitMaskImage: "url(/logobarpilote.png)", WebkitMaskSize: "contain", WebkitMaskRepeat: "no-repeat", WebkitMaskPosition: "center", backgroundColor: "#ea580c",
                            }}
                        />
                        <h1 className="text-2xl font-bold tracking-tight text-orange-600">BarPilote</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Terminer est maintenant en bas */}
                    </div>
                </div>
            </header>

            <main className="pt-24 px-6 max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 relative items-start">

                {/* LEFT COLUMN: Main List */}
                <div className={`flex-1 space-y-6 ${editingStockId ? "lg:w-2/3" : "w-full"}`}>

                    {/* View Toggle & Header */}
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-2">
                        <div>
                            <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-orange-600 mb-1 block">
                                Gestion de Cave
                            </span>
                            <h2 className="text-4xl font-extrabold tracking-tight text-on-surface">
                                {viewState === "MY_STOCK" ? "Mon Stock Actuel" : "Catalogue Général"}
                            </h2>
                        </div>

                        <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200">
                            {viewState === "MY_STOCK" && myStock.length > 0 && (
                                <button
                                    onClick={handleExportPDF}
                                    disabled={isExporting}
                                    className="mr-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-full text-xs font-bold hover:bg-orange-100 transition-all flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-sm">download</span>
                                    {isExporting ? "Exportation..." : "Exporter PDF"}
                                </button>
                            )}
                            <button
                                onClick={() => setViewState("MY_STOCK")}
                                className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${viewState === "MY_STOCK" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                            >
                                Mon Stock ({myStock.length})
                            </button>
                            <button
                                onClick={() => setViewState("CATALOG")}
                                className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${viewState === "CATALOG" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                            >
                                Catalogue RDC
                            </button>
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* ===================== VIEW: CATALOG ===================== */}
                    {viewState === "CATALOG" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="relative flex-1">
                                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                                    <input
                                        type="text" placeholder="Rechercher Primus, Jack Daniel&apos;s..."
                                        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none transition-all shadow-sm"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
                                {ALL_CATEGORIES_DISPLAY.map(cat => (
                                    <button
                                        key={cat} onClick={() => setActiveCategory(cat)}
                                        className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all ${activeCategory === cat ? "bg-orange-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600"}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                {/* ADD CUSTOM BUTTON CARD */}
                                <div onClick={() => setShowAddCustomMaster(true)} className="bg-orange-50 border-2 border-dashed border-orange-200 rounded-3xl overflow-hidden hover:border-orange-500 hover:bg-orange-100 transition-all cursor-pointer group flex flex-col p-4 items-center justify-center text-center gap-3 min-h-[240px]">
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                                        <span className="material-symbols-outlined text-orange-600 text-3xl">add_circle</span>
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-orange-900 text-sm">Boisson Manquante ?</h4>
                                        <p className="text-[10px] text-orange-700 font-medium">Ajoutez-la manuellement au catalogue de votre bar.</p>
                                    </div>
                                </div>
                                {filteredCatalog.map(drink => (
                                    <div key={drink.id} onClick={() => handleAddToMyStock(drink)} className="bg-white border border-slate-200 rounded-3xl overflow-hidden hover:border-orange-500 hover:shadow-2xl transition-all cursor-pointer group flex flex-col p-2">
                                        <div className="aspect-[3/4] bg-gradient-to-b from-slate-50 to-white rounded-2xl relative overflow-hidden flex items-center justify-center p-3">
                                            {/* Using mock image properly rounded */}
                                            <img src={drink.imageUrl} alt={drink.name} className="h-full object-contain group-hover:scale-110 transition-transform duration-700 drop-shadow-2xl" />
                                            <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-md px-2 py-1 rounded-full text-[10px] font-bold text-slate-800 tracking-wider border border-slate-100 shadow-sm">
                                                {drink.volume}
                                            </div>
                                        </div>
                                        <div className="p-3 flex flex-col flex-1">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-orange-600 mb-1">{drink.category}</span>
                                            <h4 className="font-extrabold text-slate-900 leading-tight mb-3 text-sm">{drink.name}</h4>
                                            <div className="mt-auto flex items-center justify-between">
                                                <button className="flex-1 py-2 bg-orange-600 text-white font-bold text-[10px] uppercase tracking-tighter rounded-xl group-hover:bg-orange-700 transition-colors shadow-lg shadow-orange-500/20 active:scale-95">
                                                    Ajouter
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ===================== VIEW: MY STOCK ===================== */}
                    {viewState === "MY_STOCK" && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            {myStock.length === 0 ? (
                                <div className="text-center py-20 bg-slate-50 border border-slate-200 border-dashed rounded-3xl">
                                    <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4 text-orange-500">
                                        <span className="material-symbols-outlined text-4xl">inventory_2</span>
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-800 mb-2">Votre Cave est vide</h3>
                                    <p className="text-slate-500 max-w-sm mx-auto mb-6">Explorez notre catalogue de boissons RDC pour configurer vos achats, vos casiers et vos prix de vente.</p>
                                    <button onClick={() => setViewState("CATALOG")} className="bg-slate-900 text-white px-6 py-3 rounded-full font-bold hover:bg-black transition-all shadow-lg active:scale-95 inline-flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">menu_book</span>
                                        Ouvrir le Catalogue
                                    </button>
                                </div>
                            ) : (
                                <div ref={tableRef} className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-widest">
                                                <th className="p-4 pl-6">Produit</th>
                                                <th className="p-4">Stock Actuel</th>
                                                <th className="p-4">Prix Achat (U)</th>
                                                <th className="p-4">Prix Vente</th>
                                                <th className="p-4">Marge</th>
                                                <th className="p-4 pr-6 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {myStock.map(stock => {
                                                const unitCost = stock.purchaseStrategy === "Casier" ? stock.purchasePrice / (stock.bottlesPerCrate || 24) : stock.purchasePrice;
                                                const margin = ((stock.sellingPrice - unitCost) / stock.sellingPrice) * 100;
                                                const lowStock = stock.boughtQuantity <= stock.alertThreshold;
                                                const displayCurrency = stock.currency === "CDF" ? "FC" : "$";

                                                return (
                                                    <tr key={stock.id} onClick={() => handleOpenEdit(stock)} className={`hover:bg-orange-50/50 transition-colors cursor-pointer group ${editingStockId === stock.id ? 'bg-orange-50/80 ring-1 ring-inset ring-orange-200' : ''}`}>
                                                        <td className="p-4 pl-6">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-12 h-12 bg-white rounded-xl p-1.5 shrink-0 flex items-center justify-center border border-slate-100 shadow-sm">
                                                                    <img src={stock.drink.imageUrl} className="h-full object-contain" alt="" />
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-slate-900 text-sm leading-tight flex items-center gap-2">
                                                                        {stock.drink.name} <span className="text-[10px] bg-slate-200 text-slate-600 px-1 rounded font-semibold">{stock.drink.volume}</span>
                                                                    </p>
                                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">{stock.drink.category}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`w-2 h-2 rounded-full ${lowStock ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
                                                                <span className="font-black text-slate-800">{stock.boughtQuantity || "---"}</span>
                                                                <span className="text-xs text-slate-500">btls</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="font-semibold text-slate-600 text-sm">
                                                                {stock.purchasePrice > 0 ? (
                                                                    stock.currency === "USD" ? `${unitCost.toFixed(2)} $` : `${Math.round(unitCost).toLocaleString()} FC`
                                                                ) : "Non configuré"}
                                                            </span>
                                                            {stock.purchasePrice > 0 && <p className="text-[9px] text-slate-400 mt-0.5">{stock.purchaseStrategy === "Casier" ? `Acheté par casier de ${stock.bottlesPerCrate}` : "Acheté à la pièce"}</p>}
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={`font-black text-lg ${stock.sellingPrice === 0 ? 'text-slate-300' : 'text-slate-900'}`}>
                                                                {stock.sellingPrice > 0 ? (
                                                                    stock.currency === "USD" ? `${stock.sellingPrice.toFixed(2)} $` : `${stock.sellingPrice.toLocaleString()} FC`
                                                                ) : `0 ${displayCurrency}`}
                                                            </span>
                                                        </td>
                                                        <td className="p-4">
                                                            {stock.sellingPrice > 0 ? (
                                                                <span className={`inline-flex items-center gap-1 font-bold text-xs px-2 py-1 rounded-md ${margin > 50 ? 'bg-green-100 text-green-700' : margin > 20 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {margin > 0 ? '+' : ''}{margin.toFixed(0)}%
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-bold text-slate-300">---</span>
                                                            )}
                                                        </td>
                                                        <td className="p-4 pr-6 text-right">
                                                            <button onClick={(e) => handleDeleteFromStock(stock.id, e)} className="p-2 text-slate-300 hover:bg-white hover:text-red-500 hover:shadow-sm rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                                                <span className="material-symbols-outlined text-xl">delete</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Finalize Button at Bottom */}
                            {myStock.length > 0 && viewState === "MY_STOCK" && (
                                <div className="mt-12 mb-20 flex justify-center">
                                    <button
                                        onClick={() => router.push("/")}
                                        className="bg-slate-900 icon-glow text-white px-10 py-5 rounded-3xl text-sm font-black uppercase tracking-[0.2em] hover:bg-black transition-all shadow-2xl active:scale-95 flex items-center gap-4 border border-slate-700 group hover:ring-4 hover:ring-orange-500/10"
                                    >
                                        Terminer & Ouvrir le Cockpit
                                        <span className="material-symbols-outlined group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform">rocket_launch</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Configuration Form Slide-over */}
                {editingStockId && currentEditingItem && (
                    <div className="lg:w-[400px] shrink-0 w-full animate-in slide-in-from-right-8 duration-300">
                        <div className="sticky top-24 bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100vh-120px)] ring-1 ring-slate-900/5">

                            {/* Form Header (Drink Card) */}
                            <div className="bg-slate-900 p-6 flex items-start gap-4 relative overflow-hidden">
                                <div className="w-16 h-20 bg-white/10 rounded-xl p-2 shrink-0 backdrop-blur-md z-10 border border-white/20">
                                    <img src={currentEditingItem.drink.imageUrl} alt="" className="h-full w-full object-contain filter drop-shadow-lg" />
                                </div>
                                <div className="z-10 mt-2">
                                    <span className="bg-orange-500 text-white text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-2 inline-block">
                                        {currentEditingItem.drink.category}
                                    </span>
                                    <h3 className="text-xl font-bold text-white leading-tight">{currentEditingItem.drink.name}</h3>
                                    <span className="text-slate-400 text-sm font-medium">{currentEditingItem.drink.volume}</span>
                                </div>
                                {/* Decorative background icon */}
                                <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-8xl text-white/[0.03] z-0">liquor</span>

                                <button onClick={() => setEditingStockId(null)} className="absolute top-4 right-4 text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full backdrop-blur-sm z-20 transition-colors">
                                    <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50 pb-32">
                                <form id="config-form" onSubmit={handleSaveConfig} className="space-y-6">

                                    {/* BLOCK 1: ACQUISITION (ACHAT) */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5 normal-case">
                                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 uppercase">
                                            <span className="material-symbols-outlined text-slate-400 text-sm">shopping_cart</span>
                                            <h4 className="font-bold text-slate-800 text-sm tracking-widest">Stratégie & Devise</h4>
                                        </div>

                                        {/* Devise Toggle */}
                                        <div className="flex bg-orange-100/50 p-1 rounded-xl mb-2">
                                            <button type="button" onClick={() => setCurrency("USD")} className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${currency === "USD" ? "bg-orange-600 text-white shadow-sm" : "text-orange-900/40"}`}>Dollar ($)</button>
                                            <button type="button" onClick={() => setCurrency("CDF")} className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${currency === "CDF" ? "bg-orange-600 text-white shadow-sm" : "text-orange-900/40"}`}>Franc C. (FC)</button>
                                        </div>

                                        {/* Stratégie Toggle */}
                                        <div className="flex bg-slate-100 p-1 rounded-xl">
                                            <button type="button" onClick={() => setBuyStrategy("Casier")} className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${buyStrategy === "Casier" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500"}`}>Par Casier</button>
                                            <button type="button" onClick={() => setBuyStrategy("Bouteille")} className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${buyStrategy === "Bouteille" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500"}`}>À la l&apos;unité</button>
                                        </div>

                                        {buyStrategy === "Casier" ? (
                                            <>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Casiers achetés</label>
                                                        <input type="number" min="0" value={cratesBought} onChange={(e) => setCratesBought(parseInt(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-center font-bold text-slate-900 outline-none focus:border-orange-500" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Qté par casier</label>
                                                        <input type="number" min="1" value={bottlesPerCrate} onChange={(e) => setBottlesPerCrate(parseInt(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-center font-bold text-slate-900 outline-none focus:border-orange-500" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Prix Achat (1 Casier en {currency === "CDF" ? "FC" : "$"})</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">{currency === "CDF" ? "FC" : "$"}</span>
                                                        <input required type="number" min="0" step={currency === "USD" ? "0.01" : "1"} value={purchasePrice} onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)} className="w-full pl-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-orange-500" />
                                                    </div>
                                                </div>
                                                <div className="bg-orange-50/50 p-2 rounded-lg text-center border border-orange-100">
                                                    <span className="text-[10px] uppercase font-bold text-orange-600 tracking-wider">Coût de Revient par Bouteille</span>
                                                    <p className="font-extrabold text-lg text-orange-700">
                                                        {currency === "USD" ? calculateCostPerBottle().toFixed(2) : Math.round(calculateCostPerBottle()).toLocaleString()} {currency === "CDF" ? "FC" : "$"}
                                                    </p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Bouteilles achetées</label>
                                                    <input type="number" min="0" value={bottlesBought} onChange={(e) => setBottlesBought(parseInt(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-bold text-slate-900 outline-none focus:border-orange-500 text-center" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Prix Achat (1 Bouteille en {currency === "CDF" ? "FC" : "$"})</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">{currency === "CDF" ? "FC" : "$"}</span>
                                                        <input required type="number" min="0" step="1" value={purchasePrice} onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)} className="w-full pl-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-orange-500" />
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* BLOCK 2: VENTE & ALERTE */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 normal-case">
                                        <div>
                                            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Prix de Vente Unitaire ({currency === "CDF" ? "FC" : "$"})</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">{currency === "CDF" ? "FC" : "$"}</span>
                                                <input required type="number" min="0" step={currency === "USD" ? "0.01" : "1"} value={sellingPrice} onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)} className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-3xl text-slate-900 outline-none focus:border-orange-500 focus:bg-white transition-all shadow-inner" />
                                            </div>
                                            {sellingPrice > 0 && purchasePrice > 0 && (
                                                <div className="mt-2 text-right">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${calculateMargin() > 30 ? 'bg-green-500/10 text-green-700' : 'bg-orange-500/10 text-orange-700'}`}>
                                                        Marge estimée : {calculateMargin().toFixed(1)}%
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-3 border-t border-slate-100 text-[32px] font-black">
                                            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 block mb-1 flex items-center justify-between">
                                                Alerte Stock Bas <span className="material-symbols-outlined text-[14px] text-red-500">notifications_active</span>
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <input required type="number" min="1" value={alertThreshold} onChange={(e) => setAlertThreshold(parseInt(e.target.value) || 0)} className="w-20 bg-slate-50 border border-slate-200 p-2 rounded-xl text-center font-bold text-slate-900 outline-none focus:border-red-500" />
                                                <span className="text-xs text-slate-400 font-medium leading-tight lowercase">M&apos;alerter lorsqu&apos;il reste {alertThreshold} bouteille(s)</span>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </div>

                            {/* STICKY FOOTER BUTTON */}
                            <div className="p-6 bg-white/80 backdrop-blur-md border-t border-slate-100">
                                <button
                                    form="config-form"
                                    type="submit"
                                    className="w-full bg-orange-600 text-white rounded-2xl py-5 font-black tracking-widest shadow-xl shadow-orange-500/30 hover:bg-orange-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group"
                                >
                                    <span className="material-symbols-outlined group-hover:rotate-12 transition-transform">verified</span>
                                    ENREGISTRER LES MODIFICATIONS
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                {/* MODAL: ADD CUSTOM MASTER DRINK */}
                {showAddCustomMaster && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowAddCustomMaster(false)} />
                        <div className="relative bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ring-1 ring-black/5">
                            <div className="bg-orange-600 p-6 text-white flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined">local_bar</span>
                                    <h3 className="text-xl font-bold tracking-tight">Nouvelle Boisson</h3>
                                </div>
                                <button onClick={() => setShowAddCustomMaster(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            <form onSubmit={handleCreateCustomMaster} className="p-8 space-y-6">
                                {/* PHOTO UPLOAD PREVIEW */}
                                <div className="flex flex-col items-center gap-4">
                                    <div className="w-32 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden relative group flex items-center justify-center">
                                        {photoPreview ? (
                                            <img src={photoPreview} alt="Preview" className="w-full h-full object-contain p-2" />
                                        ) : (
                                            <span className="material-symbols-outlined text-slate-300 text-4xl">add_a_photo</span>
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handlePhotoChange}
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                        />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cliquez pour ajouter une photo</p>
                                </div>

                                <div>
                                    <label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 block mb-2 px-1">Nom de la Boisson</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Ex: Mutzig Classik, Red Bull..."
                                        value={newDrinkData.name}
                                        onChange={(e) => setNewDrinkData({ ...newDrinkData, name: e.target.value })}
                                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex items-center justify-between mb-2 px-1">
                                            <label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 block">Catégorie</label>
                                            <button 
                                                type="button" 
                                                onClick={() => setShowAddCategory(true)}
                                                className="text-[10px] font-bold text-orange-600 hover:underline"
                                            >
                                                + Nouvelle
                                            </button>
                                        </div>
                                        <select
                                            value={newDrinkData.categoryId}
                                            onChange={(e) => setNewDrinkData({ ...newDrinkData, categoryId: e.target.value })}
                                            className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:border-orange-500 appearance-none"
                                        >
                                            <option value="">Sélectionner...</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 block mb-2 px-1">Volume (cl)</label>
                                        <input
                                            required
                                            type="text"
                                            placeholder="Ex: 33cl, 75cl..."
                                            value={newDrinkData.volume}
                                            onChange={(e) => setNewDrinkData({ ...newDrinkData, volume: e.target.value })}
                                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:border-orange-500 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button 
                                        type="submit" 
                                        disabled={!newDrinkData.name || !newDrinkData.categoryId}
                                        className={`w-full rounded-2xl py-5 font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3 ${(!newDrinkData.name || !newDrinkData.categoryId) ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:shadow-2xl hover:bg-black active:scale-[0.98]'}`}
                                    >
                                        <span className="material-symbols-outlined">add_circle</span>
                                        Ajouter au Catalogue
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {/* MODAL: ADD CATEGORY */}
                {showAddCategory && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setShowAddCategory(false)} />
                        <div className="relative bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="font-bold text-lg">Nouvelle Catégorie</h3>
                                <button onClick={() => setShowAddCategory(false)}><span className="material-symbols-outlined">close</span></button>
                            </div>
                            <form onSubmit={handleCreateCategory} className="p-6 space-y-4">
                                <input 
                                    autoFocus
                                    placeholder="Ex: Whiskies, Cigares..." 
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-orange-500"
                                    value={newCategoryName}
                                    onChange={e => setNewCategoryName(e.target.value)}
                                />
                                <button type="submit" className="w-full bg-orange-600 text-white p-4 rounded-xl font-bold shadow-lg shadow-orange-500/20">
                                    Créer la Catégorie
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </main>

            {/* BOTTOM NAV */}
            <BottomNav activePage="inventory" />
        </div>
    );
}

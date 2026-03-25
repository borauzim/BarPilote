"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

// --- Types ---
interface MasterDrink {
    id: string;
    name: string;
    category: string;
    volume: string;
    imageUrl: string;
}

interface BarStock {
    id: string; // usually linked to MasterDrink.id + variation
    drink: MasterDrink;
    boughtQuantity: number; // total bottles
    purchaseStrategy: "Bouteille" | "Casier";
    bottlesPerCrate?: number; // if casier (e.g. 24)
    purchasePrice: number; // price for the unit (1 bottle or 1 crate)
    sellingPrice: number; // selling price for 1 bottle
    alertThreshold: number;
}

// --- Mock Data ---
const MASTER_CATALOG: MasterDrink[] = [
    // Bières Locales
    { id: "M01", name: "Primus", category: "Bières Locales", volume: "72cl", imageUrl: "/drinks-3d/img-1.png" },
    { id: "M15", name: "Primus", category: "Bières Locales", volume: "33cl", imageUrl: "/drinks-3d/img-2.png" },
    { id: "M02", name: "Skol", category: "Bières Locales", volume: "72cl", imageUrl: "/drinks-3d/img-3.png" },
    { id: "M03", name: "Nkoyi", category: "Bières Locales", volume: "65cl", imageUrl: "/drinks-3d/img-4.png" },
    { id: "M04", name: "Beaufort Lager", category: "Bières Locales", volume: "50cl", imageUrl: "/drinks-3d/img-5.png" },
    { id: "M05", name: "Mutzig", category: "Bières Locales", volume: "65cl", imageUrl: "/drinks-3d/img-6.png" },
    { id: "M06", name: "Doppel Munich", category: "Bières Locales", volume: "50cl", imageUrl: "/drinks-3d/img-7.png" },
    { id: "M07", name: "Tembo", category: "Bières Locales", volume: "65cl", imageUrl: "/drinks-3d/img-8.png" },

    // Bières Importées
    { id: "M08", name: "Heineken", category: "Bières Importées", volume: "33cl", imageUrl: "/drinks-3d/img-9.png" },
    { id: "M09", name: "Corona Extra", category: "Bières Importées", volume: "33cl", imageUrl: "/drinks-3d/img-10.png" },
    { id: "M10", name: "Bavaria", category: "Bières Importées", volume: "50cl", imageUrl: "/drinks-3d/img-11.png" },

    // Spiritueux
    { id: "M11", name: "Jack Daniel's Old No.7", category: "Spiritueux", volume: "75cl", imageUrl: "/drinks-3d/img-12.png" },
    { id: "M12", name: "Chivas Regal 12 Ans", category: "Spiritueux", volume: "75cl", imageUrl: "/drinks-3d/img-13.png" },
    { id: "M13", name: "Bombay Sapphire", category: "Spiritueux", volume: "75cl", imageUrl: "/drinks-3d/img-14.png" },

    // Vins & Champagnes
    { id: "M14", name: "Moët & Chandon Brut", category: "Champagnes", volume: "75cl", imageUrl: "/drinks-3d/img-15.png" },
    { id: "M16", name: "Veuve Clicquot", category: "Champagnes", volume: "75cl", imageUrl: "/drinks-3d/img-16.png" },

    // Softs
    { id: "M17", name: "Coca-Cola", category: "Softs", volume: "30cl", imageUrl: "/drinks-3d/img-17.png" },
    { id: "M18", name: "D'jino", category: "Softs", volume: "30cl", imageUrl: "/drinks-3d/img-18.png" },
];

const CATEGORIES = ["Toutes", ...Array.from(new Set(MASTER_CATALOG.map((m) => m.category)))];

export default function InventoryAdvancedPage() {
    const router = useRouter();

    // --- States ---
    const [viewState, setViewState] = useState<"MY_STOCK" | "CATALOG">("MY_STOCK");
    const [myStock, setMyStock] = useState<BarStock[]>([]);

    // Catalog View States
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState<string>("Toutes");

    // Form State
    const [selectedCatalogItem, setSelectedCatalogItem] = useState<MasterDrink | null>(null);

    // Stock Form Config
    const [buyStrategy, setBuyStrategy] = useState<"Bouteille" | "Casier">("Casier");
    const [bottlesPerCrate, setBottlesPerCrate] = useState<number>(24);
    const [cratesBought, setCratesBought] = useState<number>(1);
    const [bottlesBought, setBottlesBought] = useState<number>(10);
    const [purchasePrice, setPurchasePrice] = useState<number>(0);
    const [sellingPrice, setSellingPrice] = useState<number>(0);
    const [alertThreshold, setAlertThreshold] = useState<number>(5);

    // --- Handlers ---
    const filteredCatalog = MASTER_CATALOG.filter((item) => {
        const matchCat = activeCategory === "Toutes" || item.category === activeCategory;
        const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
    });

    const handleOpenConfig = (drink: MasterDrink) => {
        setSelectedCatalogItem(drink);
        // Defaults for local beers vs spirits
        if (drink.category.includes("Bières") || drink.category === "Softs") {
            setBuyStrategy("Casier");
            setBottlesPerCrate(24);
            setCratesBought(1);
        } else {
            setBuyStrategy("Bouteille");
            setBottlesBought(6);
        }
        setPurchasePrice(0);
        setSellingPrice(0);
        setAlertThreshold(drink.category.includes("Bières") ? 24 : 3);
    };

    const calculateTotalBottles = () => buyStrategy === "Casier" ? cratesBought * bottlesPerCrate : bottlesBought;
    const calculateCostPerBottle = () => {
        if (purchasePrice <= 0) return 0;
        return buyStrategy === "Casier" ? purchasePrice / bottlesPerCrate : purchasePrice;
    };
    const calculateMargin = () => {
        const cost = calculateCostPerBottle();
        if (sellingPrice <= 0 || cost <= 0) return 0;
        return ((sellingPrice - cost) / sellingPrice) * 100;
    };

    const handleSaveToStock = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCatalogItem) return;

        const newStockItem: BarStock = {
            id: `S_${selectedCatalogItem.id}_${Date.now()}`,
            drink: selectedCatalogItem,
            boughtQuantity: calculateTotalBottles(),
            purchaseStrategy: buyStrategy,
            bottlesPerCrate: buyStrategy === "Casier" ? bottlesPerCrate : undefined,
            purchasePrice,
            sellingPrice,
            alertThreshold,
        };

        setMyStock([newStockItem, ...myStock]);
        setSelectedCatalogItem(null);
        setViewState("MY_STOCK"); // Go back to stock view
    };

    const handleDeleteStock = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setMyStock(myStock.filter(s => s.id !== id));
    };


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
                </div>
            </header>

            <main className="pt-24 px-6 max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 relative items-start">

                {/* LEFT COLUMN: Main List */}
                <div className={`flex-1 space-y-6 ${selectedCatalogItem ? "lg:w-2/3" : "w-full"}`}>

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
                                {CATEGORIES.map(cat => (
                                    <button
                                        key={cat} onClick={() => setActiveCategory(cat)}
                                        className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all ${activeCategory === cat ? "bg-orange-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600"}`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredCatalog.map(drink => (
                                    <div key={drink.id} onClick={() => handleOpenConfig(drink)} className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-orange-500 hover:shadow-lg transition-all cursor-pointer group flex flex-col">
                                        <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden flex items-center justify-center p-4">
                                            {/* Using mock image properly rounded */}
                                            <img src={drink.imageUrl} alt={drink.name} className="h-full object-contain group-hover:scale-105 transition-transform duration-500 mix-blend-multiply" />
                                            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-bold text-slate-800 tracking-wider border border-slate-200 shadow-sm">
                                                {drink.volume}
                                            </div>
                                        </div>
                                        <div className="p-4 flex flex-col flex-1">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-orange-600 mb-1">{drink.category}</span>
                                            <h4 className="font-extrabold text-slate-900 leading-tight mb-3">{drink.name}</h4>
                                            <button className="mt-auto w-full py-2 bg-slate-50 text-slate-700 font-bold text-xs rounded-lg group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors border border-slate-200 group-hover:border-orange-200">
                                                Configurer
                                            </button>
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
                                <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-slate-200">
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

                                                return (
                                                    <tr key={stock.id} className="hover:bg-slate-50/50 transition-colors">
                                                        <td className="p-4 pl-6">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 bg-slate-100 rounded-lg p-1 shrink-0 flex items-center justify-center">
                                                                    <img src={stock.drink.imageUrl} className="h-full object-contain mix-blend-multiply" alt="" />
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
                                                                <span className="font-black text-slate-800">{stock.boughtQuantity}</span>
                                                                <span className="text-xs text-slate-500">btls</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="font-semibold text-slate-600 text-sm">{unitCost.toFixed(2)}$</span>
                                                            <p className="text-[9px] text-slate-400 mt-0.5">{stock.purchaseStrategy === "Casier" ? `Acheté par casier de ${stock.bottlesPerCrate}` : "Acheté à la pièce"}</p>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="font-black text-slate-900 text-lg">{stock.sellingPrice}$</span>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={`inline-flex items-center gap-1 font-bold text-xs px-2 py-1 rounded-md ${margin > 50 ? 'bg-green-100 text-green-700' : margin > 20 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                                                                {margin > 0 ? '+' : ''}{margin.toFixed(0)}%
                                                            </span>
                                                        </td>
                                                        <td className="p-4 pr-6 text-right">
                                                            <button onClick={(e) => handleDeleteStock(stock.id, e)} className="p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors">
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
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Configuration Form Slide-over */}
                {selectedCatalogItem && (
                    <div className="lg:w-[400px] shrink-0 w-full animate-in slide-in-from-right-8 duration-300">
                        <div className="sticky top-24 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[calc(100vh-120px)]">

                            {/* Form Header (Drink Card) */}
                            <div className="bg-slate-900 p-6 flex items-start gap-4 relative overflow-hidden">
                                <div className="w-16 h-20 bg-white/10 rounded-xl p-2 shrink-0 backdrop-blur-md z-10 border border-white/20">
                                    <img src={selectedCatalogItem.imageUrl} alt="" className="h-full w-full object-contain filter drop-shadow-lg" />
                                </div>
                                <div className="z-10 mt-2">
                                    <span className="bg-orange-500 text-white text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full mb-2 inline-block">
                                        {selectedCatalogItem.category}
                                    </span>
                                    <h3 className="text-xl font-bold text-white leading-tight">{selectedCatalogItem.name}</h3>
                                    <span className="text-slate-400 text-sm font-medium">{selectedCatalogItem.volume}</span>
                                </div>
                                {/* Decorative background icon */}
                                <span className="material-symbols-outlined absolute -right-6 -bottom-6 text-8xl text-white/[0.03] z-0">liquor</span>

                                <button onClick={() => setSelectedCatalogItem(null)} className="absolute top-4 right-4 text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full backdrop-blur-sm z-20 transition-colors">
                                    <span className="material-symbols-outlined text-sm">close</span>
                                </button>
                            </div>

                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
                                <form onSubmit={handleSaveToStock} className="space-y-6">

                                    {/* BLOCK 1: ACQUISITION (ACHAT) */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                                            <span className="material-symbols-outlined text-slate-400 text-sm">shopping_cart</span>
                                            <h4 className="font-bold text-slate-800 text-sm">Stratégie d&apos;Achat</h4>
                                        </div>

                                        {/* Stratégie Toggle */}
                                        <div className="flex bg-slate-100 p-1 rounded-xl">
                                            <button type="button" onClick={() => setBuyStrategy("Casier")} className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${buyStrategy === "Casier" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500"}`}>Par Casier</button>
                                            <button type="button" onClick={() => setBuyStrategy("Bouteille")} className={`flex-1 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all ${buyStrategy === "Bouteille" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500"}`}>À la l&apos;unité</button>
                                        </div>

                                        {buyStrategy === "Casier" ? (
                                            <>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Casiers achetés</label>
                                                        <input type="number" min="1" value={cratesBought} onChange={(e) => setCratesBought(parseInt(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-center font-bold text-slate-900 outline-none focus:border-orange-500" />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Qté par casier</label>
                                                        <input type="number" min="1" value={bottlesPerCrate} onChange={(e) => setBottlesPerCrate(parseInt(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-center font-bold text-slate-900 outline-none focus:border-orange-500" />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Prix Achat (1 Casier en $)</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                                                        <input required type="number" min="0" step="0.5" value={purchasePrice} onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)} className="w-full pl-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-orange-500" />
                                                    </div>
                                                </div>
                                                <div className="bg-orange-50/50 p-2 rounded-lg text-center border border-orange-100">
                                                    <span className="text-[10px] uppercase font-bold text-orange-600 tracking-wider">Coût de Revient par Bouteille</span>
                                                    <p className="font-extrabold text-lg text-orange-700">{calculateCostPerBottle().toFixed(2)}$</p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Bouteilles achetées</label>
                                                    <input type="number" min="1" value={bottlesBought} onChange={(e) => setBottlesBought(parseInt(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-bold text-slate-900 outline-none focus:border-orange-500 text-center" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Prix Achat (1 Bouteille en $)</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                                                        <input required type="number" min="0" step="0.5" value={purchasePrice} onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)} className="w-full pl-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-orange-500" />
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* BLOCK 2: VENTE & ALERTE */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                        <div>
                                            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Prix de Vente Unitaire ($)</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                                                <input required type="number" min="0" step="1" value={sellingPrice} onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)} className="w-full pl-10 py-4 bg-slate-50 border border-slate-200 rounded-xl font-black text-2xl text-slate-900 outline-none focus:border-orange-500 focus:bg-white transition-colors shadow-inner" />
                                            </div>
                                            {sellingPrice > 0 && purchasePrice > 0 && (
                                                <div className="mt-2 text-right">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md ${calculateMargin() > 30 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                                                        Marge estimée : {calculateMargin().toFixed(1)}%
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-3 border-t border-slate-100">
                                            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 block mb-1 flex items-center justify-between">
                                                Alerte Stock Bas <span className="material-symbols-outlined text-[14px] text-red-500">notifications_active</span>
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <input required type="number" min="1" value={alertThreshold} onChange={(e) => setAlertThreshold(parseInt(e.target.value) || 0)} className="w-20 bg-slate-50 border border-slate-200 p-2 rounded-xl text-center font-bold text-slate-900 outline-none focus:border-red-500" />
                                                <span className="text-xs text-slate-400 font-medium leading-tight">M&apos;alerter lorsqu&apos;il reste {alertThreshold} bouteille(s)</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button type="submit" className="w-full bg-orange-600 text-white rounded-xl py-4 font-bold tracking-wide shadow-lg shadow-orange-500/30 hover:bg-orange-700 active:scale-95 transition-all flex items-center justify-center gap-2">
                                        <span className="material-symbols-outlined">add_task</span>
                                        Ajouter au Stock
                                    </button>

                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

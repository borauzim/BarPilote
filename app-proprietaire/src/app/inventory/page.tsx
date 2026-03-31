"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
    currency: "$" | "FC";
    alertThreshold: number;
}

// --- Mock Data ---
const MASTER_CATALOG_MOCK: MasterDrink[] = [
    { id: "M01", name: "Primus", category: "Bières Locales", volume: "72cl", imageUrl: "/drinks-3d/img-1.png" },
    { id: "M02", name: "Tembo", category: "Bières Locales", volume: "65cl", imageUrl: "/drinks-3d/img-2.png" },
    { id: "M03", name: "Nkoyi Blonde", category: "Bières Locales", volume: "65cl", imageUrl: "/drinks-3d/img-3.png" },
    { id: "M04", name: "Nkoyi Black", category: "Bières Locales", volume: "65cl", imageUrl: "/drinks-3d/img-4.png" },
    { id: "M05", name: "Castel Beer", category: "Bières Locales", volume: "65cl", imageUrl: "/drinks-3d/img-5.png" },
    { id: "M06", name: "Beaufort Premium Lager", category: "Bières Locales", volume: "50cl", imageUrl: "/drinks-3d/img-6.png" },
    { id: "M07", name: "Mützig", category: "Bières Locales", volume: "65cl", imageUrl: "/drinks-3d/img-7.png" },
    { id: "M08", name: "Class", category: "Bières Locales", volume: "50cl", imageUrl: "/drinks-3d/img-8.png" },
    { id: "M10", name: "Turbo King", category: "Bières Locales", volume: "65cl", imageUrl: "/drinks-3d/img-10.png" },
    { id: "M13", name: "N'Tay Rock", category: "Bières Locales", volume: "65cl", imageUrl: "/drinks-3d/img-13.png" },
    { id: "M14", name: "Legend Extra Stout", category: "Bières Locales", volume: "65cl", imageUrl: "/drinks-3d/img-14.png" },
    { id: "M15", name: "33 Export", category: "Bières Locales", volume: "65cl", imageUrl: "/drinks-3d/img-15.png" },
    { id: "M16", name: "Doppel Munich", category: "Bières Locales", volume: "50cl", imageUrl: "/drinks-3d/img-16.png" },
    { id: "M17", name: "Skol", category: "Bières Locales", volume: "72cl", imageUrl: "/drinks-3d/img-17.png" },
    { id: "M21", name: "Simba", category: "Bières Locales", volume: "72cl", imageUrl: "/drinks-3d/img-21.png" },

    // Bières Importées
    { id: "M09", name: "Super Bock", category: "Bières Importées", volume: "33cl", imageUrl: "/drinks-3d/img-9.png" },
    { id: "M11", name: "Heineken Pure Malt", category: "Bières Importées", volume: "33cl", imageUrl: "/drinks-3d/img-11.png" },
    { id: "M12", name: "Tiger Lager", category: "Bières Importées", volume: "33cl", imageUrl: "/drinks-3d/img-12.png" },
    { id: "M18", name: "Guinness Special Export", category: "Bières Importées", volume: "33cl", imageUrl: "/drinks-3d/img-18.png" },
    { id: "M19", name: "Leffe Blonde", category: "Bières Importées", volume: "33cl", imageUrl: "/drinks-3d/img-19.png" },
    { id: "M20", name: "Leffe Rouge", category: "Bières Importées", volume: "33cl", imageUrl: "/drinks-3d/img-20.png" },
    { id: "M22", name: "Meteor Pils", category: "Bières Importées", volume: "33cl", imageUrl: "/drinks-3d/img-22.png" },
    { id: "M27", name: "Amstel Premium Lager", category: "Bières Importées", volume: "33cl", imageUrl: "/drinks-3d/img-27.png" },

    // Alcopops & Ciders
    { id: "M23", name: "Booster Whisky Cola", category: "Alcopops & Ciders", volume: "50cl", imageUrl: "/drinks-3d/img-23.png" },
    { id: "M24", name: "Booster Cider", category: "Alcopops & Ciders", volume: "50cl", imageUrl: "/drinks-3d/img-24.png" },
    { id: "M25", name: "Booster Gin Tonic", category: "Alcopops & Ciders", volume: "50cl", imageUrl: "/drinks-3d/img-25.png" },
    { id: "M26", name: "Savanna Dry", category: "Alcopops & Ciders", volume: "33cl", imageUrl: "/drinks-3d/img-26.png" },

    // Whiskies & Spiritueux
    { id: "M30", name: "Jack Daniel's Old No.7", category: "Whiskies", volume: "70cl", imageUrl: "/drinks-3d/img-19.png" },
    { id: "M31", name: "Johnnie Walker Black Label", category: "Whiskies", volume: "75cl", imageUrl: "/drinks-3d/img-20.png" },
    { id: "M32", name: "Chivas Regal 12 ans", category: "Whiskies", volume: "75cl", imageUrl: "/drinks-3d/img-21.png" },
    { id: "M33", name: "J&B Rare", category: "Whiskies", volume: "75cl", imageUrl: "/drinks-3d/img-22.png" },
    { id: "M34", name: "Hennesy VS", category: "Cognacs", volume: "70cl", imageUrl: "/drinks-3d/img-23.png" },

    // Vins & Champagnes
    { id: "M40", name: "Moët & Chandon Brut Imperial", category: "Champagnes", volume: "75cl", imageUrl: "/drinks-3d/img-24.png" },
    { id: "M41", name: "Veuve Clicquot Ponsardin", category: "Champagnes", volume: "75cl", imageUrl: "/drinks-3d/img-25.png" },
    { id: "M42", name: "Mouton Cadet Bordeaux Rouge", category: "Vins", volume: "75cl", imageUrl: "/drinks-3d/img-26.png" },
    { id: "M43", name: "JP Chenet Cabernet Syrah", category: "Vins", volume: "75cl", imageUrl: "/drinks-3d/img-27.png" },

    // Sucrés (Softs)
    { id: "M50", name: "Coca-Cola Classic", category: "Sucrés (Softs)", volume: "30cl", imageUrl: "/drinks-3d/img-11.png" },
    { id: "M51", name: "Fanta Orange", category: "Sucrés (Softs)", volume: "30cl", imageUrl: "/drinks-3d/img-12.png" },
    { id: "M52", name: "Sprite", category: "Sucrés (Softs)", volume: "30cl", imageUrl: "/drinks-3d/img-13.png" },
    { id: "M53", name: "Schweppes Tonic", category: "Sucrés (Softs)", volume: "33cl", imageUrl: "/drinks-3d/img-14.png" },
];

const CUSTOM_CATEGORIES = ["Bières", "Whiskies", "Vins", "Sucrés (Softs)", "Cocktails", "Autre"];

export default function InventoryAdvancedPage() {
    const router = useRouter();
    const tableRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    // --- States ---
    const [viewState, setViewState] = useState<"MY_STOCK" | "CATALOG">("MY_STOCK");
    const [myStock, setMyStock] = useState<BarStock[]>([]);
    const [customMasterDrinks, setCustomMasterDrinks] = useState<MasterDrink[]>([]);

    // Catalog View States
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState<string>("Toutes");

    // Add Custom Drink State
    const [showAddCustomMaster, setShowAddCustomMaster] = useState(false);
    const [newDrinkData, setNewDrinkData] = useState({ name: "", category: "Bières", volume: "33cl", photoFile: null as File | null });
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);

    // Form/Editing State
    const [editingStockId, setEditingStockId] = useState<string | null>(null);

    // Temp Form Config
    const [buyStrategy, setBuyStrategy] = useState<"Bouteille" | "Casier">("Casier");
    const [bottlesPerCrate, setBottlesPerCrate] = useState<number>(24);
    const [cratesBought, setCratesBought] = useState<number>(1);
    const [bottlesBought, setBottlesBought] = useState<number>(10);
    const [purchasePrice, setPurchasePrice] = useState<number>(0);
    const [sellingPrice, setSellingPrice] = useState<number>(0);
    const [currency, setCurrency] = useState<"$" | "FC">("$");
    const [alertThreshold, setAlertThreshold] = useState<number>(12);

    // Combined Catalog
    const ALL_MASTER_DRINKS = [...MASTER_CATALOG_MOCK, ...customMasterDrinks];
    const ALL_CATEGORIES_DISPLAY = ["Toutes", ...Array.from(new Set(ALL_MASTER_DRINKS.map((m) => m.category)))];

    // --- Handlers ---
    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setNewDrinkData({ ...newDrinkData, photoFile: file });
            setPhotoPreview(URL.createObjectURL(file));
        }
    };

    const handleCreateCustomMaster = (e: React.FormEvent) => {
        e.preventDefault();
        const newMaster: MasterDrink = {
            id: `CUSTOM_${Date.now()}`,
            name: newDrinkData.name,
            category: newDrinkData.category,
            volume: newDrinkData.volume,
            imageUrl: photoPreview || "/drinks-3d/img-19.png", // Use preview or placeholder
        };
        setCustomMasterDrinks([...customMasterDrinks, newMaster]);
        setShowAddCustomMaster(false);
        setNewDrinkData({ name: "", category: "Bières", volume: "33cl", photoFile: null });
        setPhotoPreview(null);
    };

    const filteredCatalog = ALL_MASTER_DRINKS.filter((item) => {
        const matchCat = activeCategory === "Toutes" || item.category === activeCategory;
        const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchCat && matchSearch;
    });

    // 1. Add from Catalog to My Stock
    const handleAddToMyStock = (drink: MasterDrink) => {
        // Prevent duplicates
        if (myStock.find(s => s.drink.id === drink.id)) {
            setViewState("MY_STOCK");
            return;
        }

        const newStockItem: BarStock = {
            id: `S_${drink.id}_${Date.now()}`,
            drink,
            boughtQuantity: 0,
            purchaseStrategy: drink.category.includes("Bières") ? "Casier" : "Bouteille",
            bottlesPerCrate: 24,
            purchasePrice: 0,
            sellingPrice: 0,
            currency: "$",
            alertThreshold: drink.category.includes("Bières") ? 24 : 3,
        };

        setMyStock([...myStock, newStockItem]);
        setViewState("MY_STOCK");
    };

    // 2. Select an item in My Stock to configure
    const handleOpenEdit = (stock: BarStock) => {
        setEditingStockId(stock.id);
        setBuyStrategy(stock.purchaseStrategy);
        setBottlesPerCrate(stock.bottlesPerCrate || 24);
        setPurchasePrice(stock.purchasePrice);
        setSellingPrice(stock.sellingPrice);
        setCurrency(stock.currency || "$");
        setAlertThreshold(stock.alertThreshold);
        // Reset counters for the form
        if (stock.purchaseStrategy === "Casier") {
            setCratesBought(Math.floor(stock.boughtQuantity / (stock.bottlesPerCrate || 24)) || 1);
        } else {
            setBottlesBought(stock.boughtQuantity || 10);
        }
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

    // 3. Save Configuration
    const handleSaveConfig = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingStockId) return;

        setMyStock(myStock.map(s => {
            if (s.id === editingStockId) {
                return {
                    ...s,
                    boughtQuantity: calculateTotalBottles(),
                    purchaseStrategy: buyStrategy,
                    bottlesPerCrate: buyStrategy === "Casier" ? bottlesPerCrate : undefined,
                    purchasePrice,
                    sellingPrice,
                    currency,
                    alertThreshold,
                };
            }
            return s;
        }));
        setEditingStockId(null);
    };

    const handleDeleteFromStock = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setMyStock(myStock.filter(s => s.id !== id));
        if (editingStockId === id) setEditingStockId(null);
    };

    const handleExportPDF = async () => {
        if (!tableRef.current) return;
        setIsExporting(true);
        try {
            const canvas = await html2canvas(tableRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: "#ffffff",
            });
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("p", "mm", "a4");
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.text("Rapport d'Inventaire - BarPilote", 10, 10);
            pdf.addImage(imgData, "PNG", 0, 20, pdfWidth, pdfHeight);
            pdf.save("Inventaire_BarPilote.pdf");
        } catch (error) {
            console.error("Export Error:", error);
            alert("Erreur lors de l'exportation PDF.");
        }
        setIsExporting(false);
    };

    const currentEditingItem = myStock.find(s => s.id === editingStockId);


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
                                                            <span className="font-semibold text-slate-600 text-sm">{stock.purchasePrice > 0 ? `${unitCost.toLocaleString()} ${stock.currency}` : "Non configuré"}</span>
                                                            {stock.purchasePrice > 0 && <p className="text-[9px] text-slate-400 mt-0.5">{stock.purchaseStrategy === "Casier" ? `Acheté par casier de ${stock.bottlesPerCrate}` : "Acheté à la pièce"}</p>}
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={`font-black text-lg ${stock.sellingPrice === 0 ? 'text-slate-300' : 'text-slate-900'}`}>{stock.sellingPrice > 0 ? `${stock.sellingPrice.toLocaleString()} ${stock.currency}` : `0 ${stock.currency}`}</span>
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
                                            <button type="button" onClick={() => setCurrency("$")} className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${currency === "$" ? "bg-orange-600 text-white shadow-sm" : "text-orange-900/40"}`}>Dollar ($)</button>
                                            <button type="button" onClick={() => setCurrency("FC")} className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${currency === "FC" ? "bg-orange-600 text-white shadow-sm" : "text-orange-900/40"}`}>Franc C. (FC)</button>
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
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Prix Achat (1 Casier en {currency})</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">{currency}</span>
                                                        <input required type="number" min="0" step="1" value={purchasePrice} onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)} className="w-full pl-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-orange-500" />
                                                    </div>
                                                </div>
                                                <div className="bg-orange-50/50 p-2 rounded-lg text-center border border-orange-100">
                                                    <span className="text-[10px] uppercase font-bold text-orange-600 tracking-wider">Coût de Revient par Bouteille</span>
                                                    <p className="font-extrabold text-lg text-orange-700">{calculateCostPerBottle().toLocaleString()} {currency}</p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Bouteilles achetées</label>
                                                    <input type="number" min="0" value={bottlesBought} onChange={(e) => setBottlesBought(parseInt(e.target.value) || 0)} className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-bold text-slate-900 outline-none focus:border-orange-500 text-center" />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Prix Achat (1 Bouteille en {currency})</label>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">{currency}</span>
                                                        <input required type="number" min="0" step="1" value={purchasePrice} onChange={(e) => setPurchasePrice(parseFloat(e.target.value) || 0)} className="w-full pl-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 outline-none focus:border-orange-500" />
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* BLOCK 2: VENTE & ALERTE */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 normal-case">
                                        <div>
                                            <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500 block mb-1">Prix de Vente Unitaire ({currency})</label>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">{currency}</span>
                                                <input required type="number" min="0" step="1" value={sellingPrice} onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)} className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-3xl text-slate-900 outline-none focus:border-orange-500 focus:bg-white transition-all shadow-inner" />
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
                                        <label className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 block mb-2 px-1">Catégorie</label>
                                        <select
                                            value={newDrinkData.category}
                                            onChange={(e) => setNewDrinkData({ ...newDrinkData, category: e.target.value })}
                                            className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:border-orange-500 appearance-none"
                                        >
                                            {CUSTOM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
                                    <button type="submit" className="w-full bg-slate-900 text-white rounded-2xl py-5 font-black uppercase tracking-widest shadow-xl hover:shadow-2xl hover:bg-black active:scale-[0.98] transition-all flex items-center justify-center gap-3">
                                        <span className="material-symbols-outlined">add_circle</span>
                                        Ajouter au Catalogue
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface TableData {
    id: string;
    name: string;
    section: string;
    qrGenerated: boolean;
}

export default function TablesManagementPage() {
    const router = useRouter();
    const stickerRef = useRef<HTMLDivElement>(null);

    const [tables, setTables] = useState<TableData[]>([
        { id: "T01", name: "Table 01", section: "Main Hall • Row A", qrGenerated: false },
        { id: "T02", name: "Table 02", section: "Main Hall • Row A", qrGenerated: false },
        { id: "T03", name: "Table 03", section: "Terrace • Section B", qrGenerated: true },
        { id: "T04", name: "Table 04", section: "Terrace • Section B", qrGenerated: false },
    ]);

    const [selectedTable, setSelectedTable] = useState<TableData | null>(tables[2]); // Default select generated one

    const handleGenerateQR = (id: string) => {
        setTables((prev) =>
            prev.map((t) => (t.id === id ? { ...t, qrGenerated: true } : t))
        );
        const tbl = tables.find((t) => t.id === id);
        if (tbl) setSelectedTable({ ...tbl, qrGenerated: true });
    };

    const handleAddTable = () => {
        const newId = `T0${tables.length + 1}`;
        setTables([
            ...tables,
            { id: newId, name: `Table ${tables.length + 1}`, section: "New Zone", qrGenerated: false },
        ]);
    };

    const updateTableName = (id: string, newName: string) => {
        setTables((prev) =>
            prev.map((t) => (t.id === id ? { ...t, name: newName } : t))
        );
        if (selectedTable?.id === id) {
            setSelectedTable((prev) => (prev ? { ...prev, name: newName } : null));
        }
    };

    const handleDeleteTable = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setTables((prev) => prev.filter((t) => t.id !== id));
        if (selectedTable?.id === id) {
            const remaining = tables.filter((t) => t.id !== id);
            setSelectedTable(remaining.length > 0 ? remaining[0] : null);
        }
    };

    const handleDownloadAll = async () => {
        alert("Génération du Pack de Table Complet... 📦\nCela peut prendre quelques secondes.");

        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
        });

        pdf.setFontSize(22);
        pdf.text("Pack de QR Codes - BarPilote", 20, 30);
        pdf.setFontSize(12);
        pdf.text(`Établissement : Le Petit Central`, 20, 40);
        pdf.text(`Nombre de tables : ${tables.length}`, 20, 48);

        // Simulation d'exportation de masse
        // Dans une vraie app, on génèrerait chaque QR code en boucle
        pdf.setFontSize(10);
        pdf.text("Ce pack contient les identifiants pour toutes vos tables configurées.", 20, 60);

        // On ajoute une simulation de rendu pour l'effet "ça marche"
        if (stickerRef.current) {
            const canvas = await html2canvas(stickerRef.current, { scale: 2 });
            const imgData = canvas.toDataURL("image/png");
            pdf.addImage(imgData, "PNG", 50, 80, 100, 140);
        }

        pdf.save("Pack_Complet_BarPilote_Tables.pdf");
    };

    const handleDownloadSingle = async (table: TableData) => {
        setSelectedTable(table);
        // On attend que le DOM se mette à jour pour refléter la sélection dans le stickerRef
        setTimeout(async () => {
            await handleDownloadPDF();
        }, 100);
    };

    const handleDownloadPDF = async () => {
        if (!stickerRef.current) return;

        try {
            const canvas = await html2canvas(stickerRef.current, {
                scale: 3, // Haute résolution
                useCORS: true,
                backgroundColor: "#ffffff",
            });
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a6", // Format sticker
            });

            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

            pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Badge_${selectedTable?.name || "Table"}.pdf`);
        } catch (error) {
            console.error("PDF Generation Error:", error);
            alert("Erreur lors de la génération du PDF.");
        }
    };

    return (
        <div className="bg-background text-on-surface min-h-screen pb-32">
            <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-[0_10px_30px_rgba(26,28,29,0.04)]">
                <div className="flex items-center justify-between px-6 h-16 w-full max-w-7xl mx-auto">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="hover:bg-slate-200/50 p-2 rounded-full transition-colors active:scale-95"
                        >
                            <span className="material-symbols-outlined text-orange-600">arrow_back</span>
                        </button>
                        <div className="w-8 h-8 bg-orange-600 dark:bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xs"
                            style={{
                                WebkitMaskImage: 'url(/logobarpilote.png)',
                                WebkitMaskSize: 'contain',
                                WebkitMaskRepeat: 'no-repeat',
                                WebkitMaskPosition: 'center',
                                maskImage: 'url(/logobarpilote.png)',
                                maskSize: 'contain',
                                maskRepeat: 'no-repeat',
                                maskPosition: 'center',
                                backgroundColor: '#ea580c'
                            }}
                        />
                        <h1 className="text-2xl font-bold tracking-tight text-orange-600 dark:text-orange-500">
                            BarPilote
                        </h1>
                    </div>
                    <div className="flex items-center">
                        <span className="material-symbols-outlined text-gray-600 cursor-pointer p-2 hover:bg-slate-100 rounded-full active:scale-95 duration-200">
                            notifications
                        </span>
                    </div>
                </div>
            </header>

            <main className="pt-24 px-6 max-w-5xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
                    <div>
                        <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-orange-600 mb-1 block">
                            Configuration
                        </span>
                        <h2 className="text-4xl font-extrabold tracking-tight text-on-surface">
                            Création des Tables
                        </h2>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button className="text-orange-600 font-semibold flex items-center gap-2 hover:opacity-80 transition-opacity bg-orange-50 px-4 py-2 rounded-lg">
                            <span className="material-symbols-outlined text-sm">print</span>
                            Imprimer tout
                        </button>
                        <button
                            onClick={handleDownloadAll}
                            className=" citrus-gradient text-white font-bold flex items-center gap-2 hover:brightness-110 shadow-lg shadow-orange-500/20 transition-all px-6 py-2 rounded-full active:scale-95"
                        >
                            <span className="material-symbols-outlined text-sm">download</span>
                            Pack QR
                        </button>
                        <button
                            onClick={() => router.push("/inventory")}
                            className="bg-slate-900 icon-glow text-white font-bold flex items-center gap-2 hover:bg-black shadow-lg transition-all px-6 py-2 rounded-full active:scale-95 border border-slate-700"
                        >
                            Suivant : Stock
                            <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </button>
                    </div>
                </div>

                {/* Deployment Guide Card */}
                <div className="mb-10 bg-orange-50 border border-orange-100 rounded-2xl p-6 lg:p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transform rotate-12">
                        <span className="material-symbols-outlined text-9xl text-orange-600">rocket_launch</span>
                    </div>
                    <div className="relative z-10 space-y-4 max-w-4xl">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-orange-600 font-bold">lightbulb</span>
                            <h3 className="text-orange-950 font-bold text-lg tracking-tight uppercase tracking-wider">Guide de Déploiement Physique</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 lg:gap-8">
                            {[
                                { icon: "download_for_offline", title: "Télécharger", desc: "Récupérez le pack complet de vos QR codes générés." },
                                { icon: "print", title: "Imprimer", desc: "Imprimez-les sur du papier de qualité ou autocollant." },
                                { icon: "layers_clear", title: "Plastifier", desc: "Protégez les codes pour une durabilité maximale." },
                                { icon: "table_bar", title: "Installer", desc: "Posez-les sur les tables pour que vos clients puissent commander." }
                            ].map((step, i) => (
                                <div key={i} className="flex md:flex-col items-center md:items-start gap-4 md:gap-3 bg-white/50 p-4 rounded-xl border border-white">
                                    <div className="bg-orange-600 text-white p-2 rounded-lg shrink-0">
                                        <span className="material-symbols-outlined text-xl">{step.icon}</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-orange-950 uppercase tracking-widest">{step.title}</p>
                                        <p className="text-[11px] text-orange-900/60 font-medium leading-relaxed leading-tight mt-1">{step.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        {tables.map((table) => (
                            <div
                                key={table.id}
                                onClick={() => setSelectedTable(table)}
                                className={`bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-slate-100 flex items-center justify-between group hover:bg-slate-50 transition-colors duration-300 cursor-pointer ${selectedTable?.id === table.id ? "ring-2 ring-orange-500/50" : ""
                                    }`}
                            >
                                <div className="flex items-center gap-4 flex-1">
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${table.qrGenerated ? "bg-orange-100 text-orange-600" : "bg-surface-container-high text-on-surface-variant"}`}>
                                        <span className="material-symbols-outlined">table_bar</span>
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            className="bg-transparent border-none p-0 text-lg font-semibold focus:ring-0 w-full text-on-surface outline-none"
                                            placeholder="Nom de la table"
                                            type="text"
                                            value={table.name}
                                            onChange={(e) => updateTableName(table.id, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                                            {table.section}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleGenerateQR(table.id);
                                        }}
                                        className={`px-4 py-2 text-xs font-bold rounded-full transition-all active:scale-95 ${table.qrGenerated
                                            ? "bg-orange-600 text-white shadow-md shadow-orange-500/20"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                            }`}
                                    >
                                        {table.qrGenerated ? "Regénérer" : "Générer"}
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (table.qrGenerated) handleDownloadSingle(table);
                                            else handleGenerateQR(table.id);
                                        }}
                                        title={table.qrGenerated ? "Télécharger le badge PDF" : "Générer d'abord"}
                                        className={`p-2 rounded-xl transition-all active:scale-95 ${table.qrGenerated
                                            ? "text-orange-600 bg-orange-50 hover:bg-orange-100 ring-1 ring-orange-200"
                                            : "text-slate-300 bg-slate-50 cursor-not-allowed opacity-50"}`}
                                    >
                                        <span className="material-symbols-outlined text-lg">download</span>
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteTable(table.id, e);
                                        }}
                                        title="Supprimer la table"
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors active:scale-95"
                                    >
                                        <span className="material-symbols-outlined text-lg">delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="lg:col-span-1">
                        <div className="sticky top-24 space-y-6">
                            {/* Physical Sticker Preview */}
                            <div ref={stickerRef} className="bg-white rounded-xl p-6 shadow-2xl relative overflow-hidden flex flex-col items-center text-center border border-slate-100">
                                <div className="absolute top-0 left-0 w-full h-2 bg-orange-600"></div>

                                {/* 1. Logo BarPilote + Nom BarPilote au dessus */}
                                <div className="flex items-center justify-center gap-2 mb-4 pt-2">
                                    <div className="w-5 h-5 bg-orange-600 rounded-full"
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
                                    <h4 className="text-orange-600 font-extrabold tracking-tighter text-lg">
                                        BarPilote
                                    </h4>
                                </div>

                                {/* 2. Logo et Nom du Bar */}
                                <div className="flex flex-col items-center mb-4">
                                    <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-1 overflow-hidden shadow-inner text-slate-400">
                                        <span className="material-symbols-outlined">local_bar</span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-800 tracking-tight">Le Petit Central</span>
                                </div>

                                {/* 3. Message de Bienvenue */}
                                <div className="mb-4 px-2">
                                    <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-slate-500 font-bold leading-relaxed">
                                        Bienvenue, scannez le code QR pour commander
                                    </p>
                                </div>

                                {/* 4. Le QR Code */}
                                <div className="bg-gray-50 p-4 rounded-2xl mb-6 aspect-square w-full max-w-[200px] mx-auto flex items-center justify-center border border-slate-200 relative">
                                    {selectedTable?.qrGenerated ? (
                                        <div className="w-full h-full relative flex items-center justify-center">
                                            <img
                                                className="w-full h-full object-contain mix-blend-multiply"
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=barpilote.com/${selectedTable.id}`}
                                                alt="QR Code"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-full h-full relative flex items-center justify-center flex-col text-gray-400 gap-2">
                                            <span className="material-symbols-outlined text-4xl">qr_code_scanner</span>
                                            <span className="text-[10px] font-medium uppercase tracking-widest">Générez d'abord</span>
                                        </div>
                                    )}
                                </div>

                                {/* 5. Le nom de la table */}
                                <div className="space-y-1 mb-2 w-full px-4">
                                    <input
                                        className="text-3xl font-black text-slate-900 tracking-tighter w-full text-center bg-transparent border-none p-0 focus:ring-0 focus:outline-none"
                                        value={selectedTable?.name || ""}
                                        onChange={(e) => {
                                            if (selectedTable) updateTableName(selectedTable.id, e.target.value);
                                        }}
                                        placeholder="Nom de la table"
                                    />
                                </div>

                                <div className="mt-6 pt-4 border-t border-slate-100 w-full relative z-10">
                                    <button
                                        onClick={handleDownloadPDF}
                                        disabled={!selectedTable?.qrGenerated}
                                        className="w-full bg-slate-50 text-slate-600 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-100 hover:text-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200"
                                    >
                                        <span className="material-symbols-outlined text-lg">download</span>
                                        Télécharger PDF
                                    </button>
                                </div>
                            </div>

                            {/* Pricing Card */}
                            <div className="bg-slate-900 text-white rounded-xl p-6 shadow-xl relative overflow-hidden mt-6">
                                <div className="relative z-10">
                                    <div className="flex items-center gap-2 mb-6">
                                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-orange-500 text-sm">sell</span>
                                        </div>
                                        <div>
                                            <h5 className="font-bold text-sm text-white tracking-tight leading-none uppercase tracking-widest">Tarification</h5>
                                            <span className="text-[10px] text-slate-400 font-medium">Transparente & Simple</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {/* Oferte d'essai */}
                                        <div className="flex items-center gap-3 bg-green-500/10 p-3 rounded-lg border border-green-500/20">
                                            <span className="material-symbols-outlined text-green-400">redeem</span>
                                            <div>
                                                <p className="text-sm font-bold text-green-400 uppercase tracking-widest text-[11px]">1er Mois Gratuit</p>
                                                <p className="text-[10px] text-green-400/80 font-medium">Pour toutes vos tables !</p>
                                            </div>
                                        </div>

                                        {/* Mensuel */}
                                        <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                                            <div className="flex flex-col">
                                                <div className="text-xs text-slate-400 font-medium tracking-widest uppercase">Mensuel</div>
                                                <div className="text-[9px] text-slate-500 normal-case tracking-normal mt-0.5">({tables.length} tables × 3$)</div>
                                            </div>
                                            <div className="font-black text-white text-lg">{tables.length * 3}$ <span className="text-slate-500 font-medium text-xs font-normal">/mois</span></div>
                                        </div>

                                        {/* Annuel */}
                                        <div className="flex justify-between items-center bg-orange-500/10 p-3 rounded-lg border border-orange-500/20 shadow-inner">
                                            <div className="flex flex-col">
                                                <div className="text-xs text-orange-400 font-bold tracking-widest uppercase flex items-center gap-2">
                                                    Annuel
                                                    <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded-sm line-through">3$</span>
                                                </div>
                                                <div className="text-[9px] text-orange-500/80 font-medium tracking-normal mt-0.5">({tables.length} tables × 2$)</div>
                                            </div>
                                            <div className="font-black text-orange-400 text-lg">{tables.length * 2}$ <span className="opacity-80 font-medium text-xs font-normal">/mois</span></div>
                                        </div>
                                    </div>
                                </div>
                                {/* Background decoration */}
                                <div className="absolute -right-8 -bottom-12 opacity-[0.03]">
                                    <span className="material-symbols-outlined text-[10rem]">monetization_on</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <button
                onClick={handleAddTable}
                className="fixed bottom-8 right-8 md:bottom-12 md:right-12 w-16 h-16 bg-orange-600 text-white rounded-full shadow-lg shadow-orange-600/30 flex items-center justify-center hover:scale-105 active:scale-95 duration-150 ease-out z-50"
            >
                <span className="material-symbols-outlined text-3xl">add</span>
            </button>
        </div>
    );
}

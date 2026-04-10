"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import { QRCodeCanvas } from "qrcode.react";
import { getToken } from "@/lib/auth";
import BottomNav from "@/components/BottomNav";
import ExecutiveCard from "@/components/ExecutiveCard";
import BigMetric from "@/components/BigMetric";
import DateFilter from "@/components/DateFilter";

export default function TablesManagementPage() {
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);
    const [stats, setStats] = useState<any>(null);
    const [days, setDays] = useState(30);
    const [selectedTable, setSelectedTable] = useState<any>(null);
    const [barName, setBarName] = useState("VOTRE ÉTABLISSEMENT");

    useEffect(() => {
        setIsMounted(true);
        const storedName = localStorage.getItem("bar_name");
        if (storedName) setBarName(storedName.toUpperCase());
    }, []);

    useEffect(() => {
        if (isMounted) {
            fetchTableAnalytics();
        }
    }, [days, isMounted]);

    const fetchTableAnalytics = async () => {
        setIsLoading(true);
        const token = getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        try {
            const resp = await fetch(`${apiUrl}/api/proprietaire/tables/analytics/?days=${days}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (resp.ok) {
                const data = await resp.json();
                setStats(data);
                if (data.tables.length > 0 && !selectedTable) {
                    setSelectedTable(data.tables[0]);
                }
            }
        } catch (err) {
            console.error("Error fetching analytics:", err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddTable = async () => {
        const token = getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        const barId = localStorage.getItem("bar_id");

        if (!token || !barId) return;

        try {
            const response = await fetch(`${apiUrl}/api/proprietaire/tables/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    bar: barId,
                    nom: `Table ${stats?.tables?.length + 1 || 1}`
                })
            });

            if (response.ok) {
                fetchTableAnalytics();
            }
        } catch (error) { console.error(error); }
    };

    const handleDeleteTable = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Supprimer cette table et ses données analytiques ?")) return;
        
        const token = getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        try {
            const response = await fetch(`${apiUrl}/api/proprietaire/tables/${id}/`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (response.ok) fetchTableAnalytics();
        } catch (error) { console.error(error); }
    };

    // Slugification du nom du bar pour les URLs
    const slugify = (text: string) =>
        text.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '_');

    const handleDownloadSingle = (table: any) => {
        setSelectedTable(table);
        // Attendre le prochain cycle de rendu pour que le canvas QR soit mis à jour
        setTimeout(() => generateBadgePDF(table), 300);
    };

    const generateBadgePDF = (table: any) => {
        // Récupérer le canvas QR généré dynamiquement dans le DOM
        const qrCanvas = document.getElementById(`qr-table-${table.id}`) as HTMLCanvasElement;
        const qrData = qrCanvas ? qrCanvas.toDataURL('image/png') : null;

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 120] });
        const W = 80; // largeur PDF en mm

        // ── FOND BLANC ──
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, W, 120, 'F');

        // ── ARCS du LOGO (SVG dessiné en PDF) ──
        pdf.setDrawColor(234, 88, 12);
        pdf.setLineWidth(0.8);
        // Arc 1 (grand)
        pdf.lines([[5, -8], [5, -8]], 28, 14, [1, 1], '', false);
        pdf.ellipse(40, 18, 10, 5, 'S');
        // ── TEXTE BarPilote ──
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(13);
        pdf.setTextColor(234, 88, 12);
        pdf.text('BarPilote', W / 2, 16, { align: 'center' });

        // ── NOM DU BAR ──
        pdf.setFontSize(6);
        pdf.setTextColor(148, 163, 184);
        pdf.setFont('helvetica', 'bold');
        pdf.text(barName, W / 2, 23, { align: 'center', charSpace: 1.5 });

        // ── MESSAGE CLIENT ──
        pdf.setFontSize(5);
        pdf.setTextColor(100, 116, 139);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Scannez pour commander depuis votre table', W / 2, 28, { align: 'center' });

        // ── NOM DE LA TABLE ──
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(28);
        pdf.setTextColor(15, 23, 42);
        pdf.text(table.nom, W / 2, 42, { align: 'center' });

        // ── SOUS-TITRE ORANGE ──
        pdf.setFontSize(5);
        pdf.setTextColor(234, 88, 12);
        pdf.text('ZONE DE SERVICE ACTIVE', W / 2, 48, { align: 'center', charSpace: 2 });

        // ── BORDURE QR (rectangle arrondi orange) ──
        pdf.setDrawColor(234, 88, 12);
        pdf.setLineWidth(0.8);
        pdf.roundedRect(13, 52, 54, 54, 4, 4, 'S');

        // ── QR CODE IMAGE ──
        if (qrData) {
            pdf.addImage(qrData, 'PNG', 15, 54, 50, 50);
        } else {
            pdf.setFontSize(5);
            pdf.setTextColor(150, 150, 150);
            pdf.text('QR Code indisponible', W / 2, 78, { align: 'center' });
        }

        // ── FOOTER ──
        pdf.setFontSize(4.5);
        pdf.setTextColor(148, 163, 184);
        pdf.setFont('helvetica', 'bold');
        pdf.text('PORTAIL DE COMMANDE', W / 2, 112, { align: 'center', charSpace: 1 });
        pdf.setTextColor(234, 88, 12);
        pdf.setFont('helvetica', 'normal');
        const url = `barpilote.com/${slugify(barName)}/${table.id}`;
        pdf.text(url, W / 2, 116, { align: 'center', maxWidth: 72 });

        pdf.save(`Badge_${table.nom.replace(/\s+/g, '_')}.pdf`);
    };

    if (!isMounted) return null;

    return (
        <div className="bg-[#f8f9fa] min-h-screen pb-40">
            {/* QR Canvases cachés (un par table) — lus directement par jsPDF */}
            <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
                {stats?.tables?.map((table: any) => (
                    <QRCodeCanvas
                        key={table.id}
                        id={`qr-table-${table.id}`}
                        value={`https://barpilote.com/${slugify(barName)}/${table.id}`}
                        size={300}
                        level="H"
                        bgColor="#ffffff"
                        fgColor="#000000"
                    />
                ))}
            </div>

            <header className="px-6 pt-10 pb-6 bg-white shadow-sm space-y-6">
                <div className="flex justify-between items-end">
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF5E00] mb-1 block">Configuration Spatiale</span>
                        <h1 className="text-3xl font-black text-[#1a1c1d]">Gestion des Tables</h1>
                    </div>
                    <button 
                        onClick={handleAddTable}
                        className="bg-[#1a1c1d] text-white px-6 py-2.5 rounded-full font-bold text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                    >
                        Nouvelle Table
                    </button>
                </div>
                <DateFilter currentValue={days} onChange={setDays} />
            </header>

            <main className="px-6 mt-6 space-y-8">
                {isLoading ? (
                    <div className="py-20 text-center animate-pulse">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Analyse de la rentabilité des zones...</span>
                    </div>
                ) : (
                    <>
                        {/* Summary Metric */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <ExecutiveCard className="md:col-span-2">
                                <BigMetric 
                                    label="Revenu Total Tables" 
                                    value={stats?.global?.total_revenue || 0} 
                                    prefix="$" 
                                    trend={{ value: 12.5, isUp: true }} 
                                />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-4">
                                    Période : {stats?.global?.period}
                                </p>
                            </ExecutiveCard>
                            <ExecutiveCard variant="dark">
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#FF5E00]">Top Table</h4>
                                    <div>
                                        <p className="text-3xl font-black">{stats?.tables?.[0]?.nom || "---"}</p>
                                        <p className="text-sm opacity-60">Rentabilité Maximale</p>
                                    </div>
                                </div>
                            </ExecutiveCard>
                        </div>

                        {/* List of Tables with Analytics */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {stats?.tables?.map((table: any) => (
                                <ExecutiveCard 
                                    key={table.id} 
                                    className={`relative group border-2 transition-all ${selectedTable?.id === table.id ? 'border-[#FF5E00]' : 'border-transparent'}`}
                                    onClick={() => setSelectedTable(table)}
                                >
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-orange-50 group-hover:text-[#FF5E00] transition-all">
                                            <span className="material-symbols-outlined">table_bar</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDownloadSingle(table); }}
                                                className="p-2 text-slate-300 hover:text-[#FF5E00] transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-lg">download</span>
                                            </button>
                                            <button 
                                                onClick={(e) => handleDeleteTable(table.id, e)}
                                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xl font-black text-[#1a1c1d] mb-4">{table.nom}</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Généré</span>
                                                <p className="text-lg font-black text-[#1a1c1d]">${table.revenue}</p>
                                            </div>
                                            <div>
                                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Commandes</span>
                                                <p className="text-lg font-black text-slate-400">{table.orders}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* QR Mini Preview focus indication */}
                                    <div className="absolute bottom-4 right-4 opacity-10 group-hover:opacity-100 transition-opacity">
                                        <div className="p-1 bg-white rounded-lg shadow-sm border border-slate-100">
                                            <QRCodeCanvas value={`https://barpilote.com/${slugify(barName)}/${table.id}`} size={32} />
                                        </div>
                                    </div>
                                </ExecutiveCard>
                            ))}
                        </div>
                    </>
                )}
            </main>

            <BottomNav activePage="tables" />
        </div>
    );
}

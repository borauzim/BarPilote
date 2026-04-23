"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import jsPDF from "jspdf";
import { QRCodeCanvas } from "qrcode.react";
import { getAuthClient } from "@/lib/auth";
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
        try {
            const api = getAuthClient();
            const resp = await api.get(`/api/proprietaire/tables/analytics/?days=${days}`);
            const data = resp.data;
            setStats(data);
            if (data.tables && data.tables.length > 0 && !selectedTable) {
                setSelectedTable(data.tables[0]);
            }
        } catch (err: any) {
            console.error("Error fetching analytics:", err);
            if (err.response?.status === 401) router.push("/auth/login");
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddTable = async () => {
        try {
            const api = getAuthClient();
            const response = await api.post("/api/proprietaire/tables/", {
                nom: `Table ${stats?.tables?.length + 1 || 1}`
            });

            if (response.status < 300) {
                fetchTableAnalytics();
            }
        } catch (error) { console.error(error); }
    };

    const handleDeleteTable = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Supprimer cette table et ses données analytiques ?")) return;
        
        try {
            const api = getAuthClient();
            const response = await api.delete(`/api/proprietaire/tables/${id}/`);
            if (response.status < 300) fetchTableAnalytics();
        } catch (error) { console.error(error); }
    };

    const slugify = (text: string) =>
        text.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '_');

    const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    const handleDownloadSingle = (table: any) => {
        setSelectedTable(table);
        setTimeout(() => generateBadgePDF(table), 300);
    };

    const generateBadgePDF = async (table: any) => {
        const qrCanvas = document.getElementById(`qr-table-${table.id}`) as HTMLCanvasElement;
        const qrData = qrCanvas ? qrCanvas.toDataURL('image/png') : null;

        // On essaye de charger le logo, sinon on continue sans
        let logoBase64 = "";
        try {
            logoBase64 = await getBase64ImageFromUrl("/logobarpilote_orange.png");
        } catch (e) { console.warn("Logo not found for PDF"); }

        const W = 80;
        const H = 140; 
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [W, H] });

        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, W, H, 'F');

        // HEADER LOGO & TEXT
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        const titleText = 'BarPilote';
        const titleWidth = pdf.getTextWidth(titleText);
        const logoWidth = 6;
        const spacing = 1.5;
        const totalHeaderWidth = logoWidth + spacing + titleWidth;
        const startX = (W - totalHeaderWidth) / 2;

        if (logoBase64) {
            pdf.addImage(logoBase64, 'PNG', startX, 19, logoWidth, logoWidth);
        }
        pdf.setTextColor(234, 88, 12); // Orange-600
        pdf.text(titleText, startX + logoWidth + spacing, 24);

        // BAR NAME
        pdf.setFontSize(6.5);
        pdf.setTextColor(148, 163, 184); 
        pdf.setFont('helvetica', 'bold');
        pdf.text(barName, W / 2, 32, { align: 'center' });

        // MESSAGE
        pdf.setFontSize(5);
        pdf.setTextColor(100, 116, 139); 
        pdf.setFont('helvetica', 'normal');
        pdf.text("Scannez pour commander depuis votre table", W / 2, 38, { align: 'center' });

        // TABLE PILL
        const pillText = String(table.nom).toUpperCase();
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        const textW = pdf.getTextWidth(pillText);
        const pillPad = 12;
        const pillW = textW + pillPad;
        const pillH = 10;
        const pillX = (W - pillW) / 2;
        const pillY = 43;
        
        pdf.setFillColor(26, 28, 29); // #1a1c1d
        pdf.roundedRect(pillX, pillY, pillW, pillH, 5, 5, 'F'); 
        pdf.setTextColor(255, 255, 255);
        pdf.text(pillText, W / 2, pillY + 6.8, { align: 'center' });

        // QR CODE AREA
        pdf.setDrawColor(234, 88, 12);
        pdf.setLineWidth(1.2);
        pdf.roundedRect(12, 57, 56, 56, 4, 4, 'S');
        if (qrData) {
            pdf.addImage(qrData, 'PNG', 14, 59, 52, 52);
        }

        // FOOTER
        pdf.setFontSize(5);
        pdf.setTextColor(148, 163, 184); 
        pdf.setFont('helvetica', 'bold');
        pdf.text('ZONE DE SERVICE ACTIVE', W / 2, 121, { align: 'center' });
        pdf.text("PORTAIL DE COMMANDE", W / 2, 127, { align: 'center' });

        pdf.setTextColor(234, 88, 12); 
        const tableUrl = `barpilote.com/${slugify(barName)}/${table.id}`;
        pdf.text(tableUrl, W / 2, 131, { align: 'center' });

        pdf.save(`Badge_${table.nom.replace(/\s+/g, '_')}.pdf`);
    };

    if (!isMounted) return null;

    return (
        <div className="bg-[#f2f4f7] min-h-screen pb-40 font-sans selection:bg-orange-500/20">
            {/* HIDDEN QR CANVAS FOR PDF GENERATION */}
            <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
                {stats?.tables?.map((table: any) => (
                    <QRCodeCanvas
                        key={table.id}
                        id={`qr-table-${table.id}`}
                        value={`https://barpilote.com/${slugify(barName)}/${table.id}`}
                        size={512}
                        level="H"
                        bgColor="#ffffff"
                        fgColor="#000000"
                    />
                ))}
            </div>

            <header className="px-8 pt-12 pb-8 bg-white/80 backdrop-blur-xl sticky top-0 z-40 border-b border-slate-100 space-y-8">
                <div className="flex justify-between items-end">
                    <div>
                        <div className="flex items-center gap-2 mb-1 text-orange-600">
                           <span className="material-symbols-outlined text-sm">grid_view</span>
                           <span className="text-[10px] font-black uppercase tracking-[0.3em]">Mapping Spatial</span>
                        </div>
                        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Gestion Tables</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => router.push("/orders")}
                            className="bg-orange-50 text-orange-600 px-6 py-3.5 rounded-full font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">confirmation_number</span>
                            Live Orders
                        </button>
                        <button 
                            onClick={handleAddTable}
                            className="bg-slate-900 text-white px-8 py-3.5 rounded-full font-black text-[10px] uppercase tracking-widest shadow-xl shadow-slate-900/10 active:scale-95 transition-all"
                        >
                            Nouvelle Table
                        </button>
                    </div>
                </div>
                <DateFilter currentValue={days} onChange={setDays} />
            </header>

            <main className="px-8 mt-10 space-y-10 max-w-6xl mx-auto">
                {isLoading ? (
                    <div className="py-24 flex flex-col items-center justify-center space-y-4">
                        <div className="w-10 h-10 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin"></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Analyse du trafic salle...</span>
                    </div>
                ) : (
                    <>
                        {/* PERFORMANCE METRICS */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <ExecutiveCard className="md:col-span-2 shadow-2xl shadow-slate-200 border-none">
                                <BigMetric 
                                    label="Revenu Total Tables" 
                                    value={stats?.global?.total_revenue || 0} 
                                    prefix="$" 
                                    trend={{ value: 12.5, isUp: true }} 
                                />
                                <div className="flex items-center gap-3 mt-6">
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                        Période d&apos;analyse : {stats?.global?.period || "30 jours"}
                                    </p>
                                </div>
                            </ExecutiveCard>
                            <ExecutiveCard variant="dark" className="shadow-2xl shadow-black/10">
                                <div className="space-y-6">
                                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-orange-500">
                                       <span className="material-symbols-outlined text-2xl">leaderboard</span>
                                    </div>
                                    <div>
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-2">Zone Mobile #1</h4>
                                        <p className="text-4xl font-black text-white tracking-tighter">{stats?.tables?.[0]?.nom || "---"}</p>
                                        <p className="text-xs text-orange-500 font-black mt-1 uppercase tracking-widest">Rentabilité Maximale</p>
                                    </div>
                                </div>
                            </ExecutiveCard>
                        </div>

                        {/* LIST OF TABLES */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {stats?.tables?.map((table: any) => (
                                <ExecutiveCard 
                                    key={table.id} 
                                    variant="white"
                                    className={`relative group border-2 transition-all p-8 flex flex-col justify-between h-full ${selectedTable?.id === table.id ? 'border-orange-500 shadow-2xl' : 'border-transparent shadow-sm hover:shadow-xl'}`}
                                    onClick={() => setSelectedTable(table)}
                                >
                                    <div className="flex justify-between items-start mb-8">
                                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-600 transition-all duration-500">
                                            <span className="material-symbols-outlined text-2xl">table_bar</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDownloadSingle(table); }}
                                                className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-orange-600 transition-all"
                                                title="Générer Badge"
                                            >
                                                <span className="material-symbols-outlined text-lg">qr_code_2</span>
                                            </button>
                                            <button 
                                                onClick={(e) => handleDeleteTable(table.id, e)}
                                                className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all"
                                                title="Supprimer"
                                            >
                                                <span className="material-symbols-outlined text-lg">delete</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 mb-6 tracking-tighter group-hover:text-orange-600 transition-colors">{table.nom}</h3>
                                        <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-50">
                                            <div>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Généré</span>
                                                <p className="text-xl font-black text-slate-900">${table.revenue}</p>
                                            </div>
                                            <div>
                                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Volume</span>
                                                <p className="text-xl font-black text-slate-400">{table.orders} CMD</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* QR Mini Preview - Decorative yet interactive hint */}
                                    <div className="absolute top-8 right-16 opacity-0 group-hover:opacity-100 transition-all duration-700 translate-x-4 group-hover:translate-x-0">
                                        <div className="p-2 bg-white rounded-xl shadow-2xl border border-slate-100">
                                            <QRCodeCanvas value={`https://barpilote.com/${slugify(barName)}/${table.id}`} size={48} />
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
v>
    );
}

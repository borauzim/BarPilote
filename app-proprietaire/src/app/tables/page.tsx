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

        if (!token) return;

        try {
            const response = await fetch(`${apiUrl}/api/proprietaire/tables/`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
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

    // Convert an image URL to a base64 string
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
        // Attendre le prochain cycle de rendu pour que le canvas QR soit mis à jour
        setTimeout(() => generateBadgePDF(table), 300);
    };

    const generateBadgePDF = async (table: any) => {
        const qrCanvas = document.getElementById(`qr-table-${table.id}`) as HTMLCanvasElement;
        const qrData = qrCanvas ? qrCanvas.toDataURL('image/png') : null;

        // Fetch the orange version of the logo for the PDF
        const logoBase64 = await getBase64ImageFromUrl("/logobarpilote_orange.png");

        const W = 80;
        const H = 140; 
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [W, H] });

        // BACKGROUND
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, W, H, 'F');

        // ==== 1. LOGO AND "BarPilote" ====
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        const titleText = 'BarPilote';
        const titleWidth = pdf.getTextWidth(titleText);
        const logoWidth = 6;
        const spacing = 1.5;
        const totalHeaderWidth = logoWidth + spacing + titleWidth;
        const startX = (W - totalHeaderWidth) / 2;

        pdf.addImage(logoBase64, 'PNG', startX, 19, logoWidth, logoWidth);
        pdf.setTextColor(234, 88, 12);
        pdf.text(titleText, startX + logoWidth + spacing, 24);

        // ==== 2. BAR NAME ====
        pdf.setFontSize(6.5);
        pdf.setTextColor(148, 163, 184); 
        pdf.setFont('helvetica', 'bold');
        pdf.text(barName, W / 2, 32, { align: 'center' });

        // ==== 3. CUSTOMER MESSAGE ====
        pdf.setFontSize(5);
        pdf.setTextColor(100, 116, 139); 
        pdf.setFont('helvetica', 'normal');
        pdf.text("Scannez pour commander depuis votre table", W / 2, 38, { align: 'center' });

        // ==== 4. TABLE PILL ====
        const pillText = String(table.nom).toUpperCase();
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        const textW = pdf.getTextWidth(pillText);
        
        const pillPad = 12;
        const pillW = textW + pillPad;
        const pillH = 10;
        const pillX = (W - pillW) / 2;
        const pillY = 43;
        
        // Draw Pill
        pdf.setFillColor(26, 28, 29); // #1a1c1d
        pdf.roundedRect(pillX, pillY, pillW, pillH, 5, 5, 'F'); 

        // Draw Text
        pdf.setTextColor(255, 255, 255);
        pdf.text(pillText, W / 2, pillY + 6.8, { align: 'center' });

        // ==== 5. QR CODE ====
        pdf.setDrawColor(234, 88, 12);
        pdf.setLineWidth(1.2);
        pdf.roundedRect(12, 57, 56, 56, 4, 4, 'S');
        if (qrData) {
            pdf.addImage(qrData, 'PNG', 14, 59, 52, 52);
        }

        // ==== 6. FOOTER TEXTS ====
        pdf.setFontSize(5);
        pdf.setTextColor(148, 163, 184); 
        pdf.setFont('helvetica', 'bold');
        pdf.text('ZONE DE SERVICE ACTIVE', W / 2, 121, { align: 'center' });

        pdf.setFontSize(5);
        pdf.setTextColor(148, 163, 184); 
        pdf.text("PORTAIL DE COMMANDE", W / 2, 127, { align: 'center' });

        pdf.setFontSize(5);
        pdf.setTextColor(234, 88, 12); 
        pdf.setFont('helvetica', 'bold');
        const tableUrl = `barpilote.com/${slugify(barName)}/${table.id}`;
        const splitUrl = pdf.splitTextToSize(tableUrl, 70);
        pdf.text(splitUrl, W / 2, 131, { align: 'center' });

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

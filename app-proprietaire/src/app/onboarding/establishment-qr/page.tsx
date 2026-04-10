"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";

export default function EstablishmentQRPage() {
    const router = useRouter();
    const [barInfo, setBarInfo] = useState({ code: "", name: "" });
    const [joinUrl, setJoinUrl] = useState("");

    useEffect(() => {
        const code = localStorage.getItem("bar_code_invitation") || "INVALID_CODE";
        const name = localStorage.getItem("bar_name") || "Votre Établissement";
        setBarInfo({ code, name });
        if (typeof window !== "undefined") {
            setJoinUrl(`${window.location.origin}/join/${code}`);
        }
    }, []);

    const slugify = (text: string) =>
        text.toLowerCase().replace(/[^\w ]+/g, '').replace(/ +/g, '_');

    const handleDownloadPDF = () => {
        const qrCanvas = document.getElementById('qr-personnel') as HTMLCanvasElement;
        const qrData = qrCanvas ? qrCanvas.toDataURL('image/png') : null;

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 120] });
        const W = 80;

        // ── FOND BLANC ──
        pdf.setFillColor(255, 255, 255);
        pdf.rect(0, 0, W, 120, 'F');

        // ── BarPilote ──
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(13);
        pdf.setTextColor(234, 88, 12);
        pdf.text('BarPilote', W / 2, 14, { align: 'center' });

        // ── NOM DU BAR ──
        pdf.setFontSize(6);
        pdf.setTextColor(148, 163, 184);
        pdf.text(barInfo.name.toUpperCase(), W / 2, 21, { align: 'center', charSpace: 1.5 });

        // ── MESSAGE ──
        pdf.setFontSize(5);
        pdf.setTextColor(100, 116, 139);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Scannez pour rejoindre l\'equipe et acceder\nau systeme de commande', W / 2, 26, { align: 'center' });

        // ── BADGE PERSONNEL (pill sombre) ──
        pdf.setFillColor(26, 28, 29);
        pdf.roundedRect(22, 31, 36, 5, 2.5, 2.5, 'F');
        pdf.setFontSize(4.5);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.text('BADGE PERSONNEL', W / 2, 34.5, { align: 'center', charSpace: 1.5 });

        // ── BORDURE QR ──
        pdf.setDrawColor(234, 88, 12);
        pdf.setLineWidth(0.8);
        pdf.roundedRect(13, 40, 54, 54, 4, 4, 'S');

        // ── QR CODE ──
        if (qrData) {
            pdf.addImage(qrData, 'PNG', 15, 42, 50, 50);
        }

        // ── TAG ZONE ──
        pdf.setFontSize(5);
        pdf.setTextColor(234, 88, 12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('ZONE DE SERVICE ACTIVE', W / 2, 100, { align: 'center', charSpace: 2 });

        // ── FOOTER URL ──
        pdf.setFontSize(4.5);
        pdf.setTextColor(148, 163, 184);
        pdf.text('LIEN D\'INVITATION', W / 2, 107, { align: 'center', charSpace: 1 });
        pdf.setTextColor(234, 88, 12);
        pdf.setFont('helvetica', 'normal');
        pdf.text(joinUrl, W / 2, 112, { align: 'center', maxWidth: 72 });

        pdf.save(`Badge_Personnel_${slugify(barInfo.name)}.pdf`);
        setTimeout(() => router.push("/tables"), 1500);
    };

    return (
        <div className="min-h-screen bg-[#f8f9fa] text-slate-900 flex flex-col items-center justify-center p-6">

            {/* QR Canvas caché — lu directement par jsPDF */}
            <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
                {joinUrl && (
                    <QRCodeCanvas
                        id="qr-personnel"
                        value={joinUrl}
                        size={300}
                        level="H"
                        bgColor="#ffffff"
                        fgColor="#000000"
                    />
                )}
            </div>

            {/* ─── APERÇU UI ─── */}
            <main className="max-w-md w-full space-y-6 text-center">
                <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF5E00]">Onboarding</span>
                    <h1 className="text-3xl font-black tracking-tight text-[#1a1c1d]">Badge du Personnel</h1>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                        Ce badge QR permet à vos serveurs de s'identifier et de rejoindre automatiquement l'équipe de{" "}
                        <span className="text-orange-600 font-bold">{barInfo.name}</span>.
                    </p>
                </div>

                {/* Aperçu du badge */}
                <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col items-center gap-4">
                    {/* Mini logo */}
                    <div className="flex items-center gap-2">
                        <svg width="24" height="24" viewBox="0 0 36 36" fill="none">
                            <path d="M8 22 Q18 6 28 22" stroke="#ea580c" strokeWidth="3.5" strokeLinecap="round"/>
                            <path d="M12 26 Q18 14 24 26" stroke="#ea580c" strokeWidth="3" strokeLinecap="round"/>
                        </svg>
                        <span className="text-[#FF5E00] font-black tracking-tight">BarPilote</span>
                    </div>

                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{barInfo.name}</p>

                    <div className="bg-[#1a1c1d] text-white text-[9px] font-black uppercase tracking-[3px] px-4 py-1.5 rounded-full">
                        🔒 Badge Personnel
                    </div>

                    {/* QR Code Aperçu */}
                    <div className="border-4 border-[#FF5E00] p-4 rounded-[1.5rem]">
                        {joinUrl && (
                            <QRCodeCanvas value={joinUrl} size={180} level="H" bgColor="#fff" fgColor="#000" />
                        )}
                    </div>

                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">Lien d'Invitation</div>
                    <p className="text-[10px] font-bold text-[#FF5E00] break-all max-w-[280px]">{joinUrl}</p>
                </div>

                {/* Info Box */}
                <div className="bg-orange-50 rounded-2xl p-5 text-left border border-orange-100">
                    <div className="flex gap-3">
                        <span className="material-symbols-outlined text-orange-600">group_add</span>
                        <div>
                            <p className="text-xs font-bold text-orange-900 mb-1">Comment ça marche ?</p>
                            <p className="text-[11px] leading-relaxed text-orange-800/80 font-medium">
                                Vos serveurs scannent ce badge avec leur téléphone. Ils sont automatiquement rattachés à votre stock, vos tables et votre système de commandes BarPilote.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-4 pt-2">
                    <button
                        onClick={handleDownloadPDF}
                        className="w-full bg-[#FF5E00] text-white py-4 rounded-xl font-bold text-base shadow-lg shadow-orange-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">download</span>
                        Télécharger le Badge Personnel (PDF)
                    </button>

                    <button
                        onClick={() => router.push("/tables")}
                        className="w-full text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-900 transition-all flex justify-center items-center gap-2"
                    >
                        Passer à la configuration des tables
                        <span className="material-symbols-outlined text-sm">east</span>
                    </button>
                </div>
            </main>
        </div>
    );
}

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import jsPDF from "jspdf";

export default function EstablishmentQRPage() {
    const router = useRouter();

    const [isMounted, setIsMounted] = useState(false);
    const [barInfo, setBarInfo] = useState({ code: "", name: "" });
    const [joinUrl, setJoinUrl] = useState("");

    useEffect(() => {
        setIsMounted(true);
        const code = localStorage.getItem("bar_code_invitation") || "INVALID_CODE";
        const name = localStorage.getItem("bar_name") || "Votre Établissement";
        setBarInfo({ code, name });
        if (typeof window !== "undefined") {
            setJoinUrl(`${window.location.origin}/join/${code}`);
        }
    }, []);

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

    if (!isMounted) return null;

    const handleDownloadPDF = async () => {
        if (!joinUrl) return;
        
        // Retrieve the generated QR Canvas from DOM
        const qrCanvas = document.getElementById('qr-canvas-personnel') as HTMLCanvasElement;
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
        pdf.text(barInfo.name.toUpperCase(), W / 2, 32, { align: 'center' });

        // ==== 3. CUSTOMER MESSAGE ====
        pdf.setFontSize(5);
        pdf.setTextColor(100, 116, 139); 
        pdf.setFont('helvetica', 'normal');
        pdf.text("Scannez pour rejoindre l'equipe et acceder au", W / 2, 38, { align: 'center' });
        pdf.text("systeme de commande", W / 2, 40.5, { align: 'center' });

        // ==== 4. PERSONNEL PILL & PADLOCK ====
        const pillText = "BADGE PERSONNEL";
        pdf.setFontSize(5);
        pdf.setFont('helvetica', 'bold');
        const textW = pdf.getTextWidth(pillText);
        const lockW = 2.5;
        const lockTextGap = 1.5;
        const totalPillContentW = lockW + lockTextGap + textW;
        
        const pillW = 36;
        const pillH = 7;
        const pillX = (W - pillW) / 2;
        const pillY = 45;
        
        // Draw Pill
        pdf.setFillColor(26, 28, 29); 
        pdf.roundedRect(pillX, pillY, pillW, pillH, 3.5, 3.5, 'F'); 

        // Content Start X
        const contentStartX = (W - totalPillContentW) / 2;

        // Draw Padlock
        const plX = contentStartX;
        const plY = pillY + 3.5; 
        pdf.setDrawColor(250, 170, 0); 
        pdf.setLineWidth(0.3);
        pdf.ellipse(plX + 1.25, plY - 1, 1, 1.2, 'S'); 
        pdf.setFillColor(250, 170, 0); 
        pdf.rect(plX, plY - 1, lockW, 2.5, 'F'); 
        pdf.setFillColor(26, 28, 29); 
        pdf.circle(plX + 1.25, plY + 0.25, 0.3, 'F'); 

        // Draw Text
        pdf.setTextColor(255, 255, 255);
        pdf.text(pillText, plX + lockW + lockTextGap, pillY + 4.5);

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
        pdf.text("LIEN D'INVITATION", W / 2, 127, { align: 'center' });

        pdf.setFontSize(5);
        pdf.setTextColor(234, 88, 12); 
        pdf.setFont('helvetica', 'bold');
        const splitUrl = pdf.splitTextToSize(joinUrl, 70);
        pdf.text(splitUrl, W / 2, 131, { align: 'center' });

        pdf.save(`Badge_Personnel_${slugify(barInfo.name)}.pdf`);
        
        setTimeout(() => router.push("/tables"), 1500);
    };

    return (
        <div className="min-h-screen bg-[#f8f9fa] text-slate-900 flex flex-col items-center justify-center p-6">

            {/* ─── APERÇU UI ─── */}
            <main className="max-w-md w-full space-y-6 text-center">
                <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF5E00]">Onboarding</span>
                    <h1 className="text-3xl font-black tracking-tight text-[#1a1c1d]">Badge du Personnel</h1>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                        Ce badge QR permet à vos serveurs de rejoindre automatiquement l&apos;équipe de{" "}
                        <span className="text-orange-600 font-bold">{barInfo.name}</span>.
                    </p>
                </div>

                {/* Aperçu du badge fidèle - CE BLOC EST CAPTURÉ PAR HTML2CANVAS */}
                <div className="bg-[#ffffff] rounded-[2rem] p-8 border border-[#f1f5f9] flex flex-col items-center gap-3">
                    {/* Logo authentique de l'application */}
                    <div className="flex items-center gap-2">
                        <div 
                            className="w-6 h-6 bg-[#FF5E00]"
                            style={{
                                WebkitMaskImage: 'url(/logobarpilote.png)', 
                                WebkitMaskSize: 'contain', 
                                WebkitMaskRepeat: 'no-repeat', 
                                WebkitMaskPosition: 'center',
                                maskImage: 'url(/logobarpilote.png)', 
                                maskSize: 'contain', 
                                maskRepeat: 'no-repeat', 
                                maskPosition: 'center'
                            }}
                        />
                        <span className="text-[#FF5E00] font-black tracking-tight">BarPilote</span>
                    </div>

                    <p className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8]">{barInfo.name}</p>

                    <p className="text-[10px] text-[#64748b] font-medium max-w-[240px] leading-relaxed">
                        Scannez pour rejoindre l&apos;équipe et accéder au système de commande
                    </p>

                    <div className="bg-[#1a1c1d] text-[#ffffff] text-[9px] font-black uppercase tracking-[3px] px-4 py-1.5 rounded-full flex items-center gap-1.5">
                        <span className="text-yellow-500 material-symbols-outlined text-xs">lock</span> BADGE PERSONNEL
                    </div>

                    {/* QR Code avec bordure orange — ID pour jsPDF */}
                    <div id="qr-personnel-wrapper" className="border-4 border-[#FF5E00] p-4 rounded-[1.5rem]">
                        {joinUrl && (
                            <QRCodeCanvas
                                id="qr-canvas-personnel"
                                value={joinUrl}
                                size={180}
                                level="H"
                                bgColor="#ffffff"
                                fgColor="#000000"
                            />
                        )}
                    </div>

                    <div className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8] mt-2">Zone de Service Active</div>

                    <div className="text-[9px] font-black uppercase tracking-widest text-[#94a3b8] mt-1">Lien d&apos;Invitation</div>
                    <p className="text-[9px] font-bold text-[#FF5E00] break-all max-w-[280px]">{joinUrl}</p>
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
                        disabled={!joinUrl}
                        className="w-full bg-[#FF5E00] text-white py-4 rounded-xl font-bold text-base shadow-lg shadow-orange-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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

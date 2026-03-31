"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";

export default function EstablishmentQRPage() {
    const router = useRouter();

    // ID de l'établissement (à dynamiser plus tard avec le backend)
    const establishmentId = "BAR-PILOTE-KIN-001";

    const handleDownload = () => {
        const canvas = document.querySelector("canvas");
        if (canvas) {
            const url = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.href = url;
            link.download = `QR_CODE_${establishmentId}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Redirection vers la configuration des tables
            setTimeout(() => {
                router.push("/tables");
            }, 1500); // Petit délai pour laisser le téléchargement s'initier
        }
    };

    const handleFinish = () => {
        router.push("/tables");
    };

    return (
        <div className="min-h-screen bg-white text-slate-900 flex flex-col items-center justify-center p-6">
            <main className="max-w-md w-full space-y-8 text-center">
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-black tracking-tight">QR Code du Personnel</h1>
                    <p className="text-slate-500 text-sm font-medium">
                        Ce code permet à vos serveurs de s'identifier auprès de votre établissement.
                    </p>
                </div>

                {/* Classic QR Code Container */}
                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 flex flex-col items-center">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                        <QRCodeCanvas
                            value={establishmentId}
                            size={256}
                            level={"H"}
                            includeMargin={false}
                            imageSettings={{
                                src: "/logobarpilote_orange.png",
                                x: undefined,
                                y: undefined,
                                height: 40,
                                width: 40,
                                excavate: true,
                            }}
                        />
                    </div>
                    <div className="mt-6 text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">ID ÉTABLISSEMENT</p>
                        <p className="text-sm font-bold text-orange-600 mt-1">{establishmentId}</p>
                    </div>
                </div>

                {/* Info Box */}
                <div className="bg-orange-50 rounded-2xl p-6 text-left border border-orange-100">
                    <div className="flex gap-4">
                        <span className="material-symbols-outlined text-orange-600">info</span>
                        <div className="space-y-1">
                            <p className="text-xs font-bold text-orange-900">Pourquoi télécharger ce code ?</p>
                            <p className="text-[11px] leading-relaxed text-orange-800/70 font-medium">
                                En téléchargeant et en affichant ce code, vous permettez à votre personnel de se connecter instantanément à votre cockpit de gestion après avoir scanné leur badge.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-4 pt-4">
                    <button
                        onClick={handleDownload}
                        className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-orange-600/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">download</span>
                        Télécharger le QR Code
                    </button>

                    <button
                        onClick={handleFinish}
                        className="w-full text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-900 transition-all"
                    >
                        Terminer la configuration
                    </button>
                </div>
            </main>
        </div>
    );
}

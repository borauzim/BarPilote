"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";

export default function EstablishmentQRPage() {
    const router = useRouter();
    const [barInfo, setBarInfo] = useState({ code: "", name: "" });
    const [joinUrl, setJoinUrl] = useState("");

    useEffect(() => {
        const code = localStorage.getItem("bar_code_invitation") || "INVALID_CODE";
        const name = localStorage.getItem("bar_name") || "Votre Établissement";
        
        setBarInfo({ code, name });
        // L'URL que les serveurs vont scanner
        setJoinUrl(`${window.location.origin}/join/${code}`);
    }, []);

    const handleDownload = () => {
        const canvas = document.querySelector("canvas");
        if (canvas) {
            const url = canvas.toDataURL("image/png");
            const link = document.createElement("a");
            link.href = url;
            link.download = `QR_CODE_${barInfo.name.replace(/\s+/g, '_')}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Redirection vers le dashboard ou configuration
            setTimeout(() => {
                router.push("/dashboard");
            }, 1500);
        }
    };

    const handleFinish = () => {
        router.push("/dashboard");
    };

    return (
        <div className="min-h-screen bg-white text-slate-900 flex flex-col items-center justify-center p-6">
            <main className="max-w-md w-full space-y-8 text-center pt-8">
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-black tracking-tight">QR Code du Personnel</h1>
                    <p className="text-slate-500 text-sm font-medium leading-relaxed">
                        Ce code unique permet à vos serveurs de s'identifier et de rejoindre automatiquement l'équipe de <span className="text-orange-600 font-bold">{barInfo.name}</span>.
                    </p>
                </div>

                {/* Classic QR Code Container */}
                <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 flex flex-col items-center">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                        {joinUrl && (
                            <QRCodeCanvas
                                value={joinUrl}
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
                        )}
                    </div>
                    <div className="mt-6 text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">LIEN D'INVITATION</p>
                        <p className="text-xs font-bold text-orange-600 mt-1 max-w-[200px] break-all mx-auto opacity-70">
                            {joinUrl}
                        </p>
                    </div>
                </div>

                {/* Info Box */}
                <div className="bg-orange-50 rounded-2xl p-6 text-left border border-orange-100">
                    <div className="flex gap-4">
                        <span className="material-symbols-outlined text-orange-600">group_add</span>
                        <div className="space-y-1 mt-1">
                            <p className="text-xs font-bold text-orange-900">Comment ça marche ?</p>
                            <p className="text-[11px] leading-relaxed text-orange-800/80 font-medium">
                                Les membres de votre personnel (serveurs, protocole) scannent ce code avec l'appareil photo de leur téléphone pour être automatiquement enregistrés dans votre système BarPilote.
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
                        className="w-full text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-900 transition-all flex justify-center items-center gap-2"
                    >
                        Naviguer vers le Dashboard
                        <span className="material-symbols-outlined text-sm">east</span>
                    </button>
                </div>
            </main>
        </div>
    );
}
